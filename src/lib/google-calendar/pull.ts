/**
 * Google -> site pull for one master. Never throws.
 *
 * LOOP GUARD: this file must NEVER enqueue an outbox push (no calls into outbox.ts) —
 * a change that came from Google must not be pushed back. Echo suppression is state
 * comparison (eventTimesMatch), not etag bookkeeping.
 */
import { addDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { SCHEDULE_TZ } from '@/lib/schedule-utils'
import { notifyBookingCancellation, notifyBookingUpdate } from '@/lib/notifications'
import { SYNC_WINDOW_DAYS, isGoogleSyncEnabled, normalizeCalendarId } from './config'
import { GoogleApiError, listEvents, type GoogleEvent } from './client'
import { SALON_APPOINTMENT_KEY } from './event-mapping'
import {
  classifyEvent,
  eventTimesMatch,
  googleEventToBlocks,
  isWithinSyncWindow,
  needsFullSync,
} from './import-mapping'
import { detectAndNotifyConflicts } from './conflicts'

const MAX_PAGES = 20

const APPOINTMENT_INCLUDE = {
  client: { select: { name: true } },
  master: { select: { name: true } },
  service: { select: { name_pl: true, name_en: true, name_uk: true } },
} as const

function describe(err: unknown): string {
  if (err instanceof GoogleApiError) return `Google ${err.status} ${err.reason}: ${err.message}`.slice(0, 300)
  return (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 300)
}

function warsawTodayUtcMidnight(): Date {
  return new Date(`${formatInTimeZone(new Date(), SCHEDULE_TZ, 'yyyy-MM-dd')}T00:00:00.000Z`)
}

type Ctx = {
  masterId: string
  calendarId: string
  todayUtc: Date
  seenForeign: Set<string>
  warnings: string[]
}

async function loadAppointment(masterId: string, appointmentId: string | undefined) {
  if (!appointmentId) return null
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: APPOINTMENT_INCLUDE,
  })
  return appt && appt.masterId === masterId ? appt : null
}

/** Site wins while a push is pending: read-only check of the outbox (never enqueues). */
async function hasPendingPush(appointmentId: string): Promise<boolean> {
  const task = await prisma.calendarSyncTask.findUnique({ where: { appointmentId }, select: { id: true } })
  return Boolean(task)
}

async function handleEvent(item: GoogleEvent, ctx: Ctx): Promise<void> {
  const { masterId } = ctx
  // Added first so a throw below can never make the full-sync cleanup wipe this event's block.
  if (item.status !== 'cancelled') ctx.seenForeign.add(item.id)
  const appt = await loadAppointment(masterId, item.extendedProperties?.private?.[SALON_APPOINTMENT_KEY])
  const apptCancelled = Boolean(appt?.status.startsWith('CANCELLED'))

  if (item.status === 'cancelled') {
    // Google sends deleted events without extendedProperties, so fall back to the stored event id.
    const target =
      appt ??
      (await prisma.appointment.findFirst({
        where: { masterId, googleEventId: item.id },
        include: APPOINTMENT_INCLUDE,
      }))
    if (target && target.googleEventId === item.id && !target.status.startsWith('CANCELLED')) {
      if (await hasPendingPush(target.id)) return
      // Google-side deletion of a site event = cancellation; notify salon only, never push back.
      await prisma.appointment.update({
        where: { id: target.id },
        data: { status: 'CANCELLED', googleEventId: null },
      })
      notifyBookingCancellation(target, 'google').catch(console.error)
      return
    }
    await prisma.externalCalendarBlock.deleteMany({ where: { masterId, googleEventId: item.id } })
    return
  }

  const cls = classifyEvent(item, (id) => (appt && appt.id === id ? appt.googleEventId : null))

  if (cls.kind === 'ignore') {
    await prisma.externalCalendarBlock.deleteMany({ where: { masterId, googleEventId: item.id } })
    ctx.seenForeign.delete(item.id)
    return
  }

  if (cls.kind === 'site' && appt) {
    ctx.seenForeign.delete(item.id)
    if (apptCancelled || eventTimesMatch(item, appt)) return // our own echo
    if (await hasPendingPush(appt.id)) return

    const rows = googleEventToBlocks(item)
    if (rows.length !== 1 || rows[0].allDay) {
      ctx.warnings.push('Google event for a site booking is multi-day/all-day; ignored')
      return
    }
    const [row] = rows
    const previous = {
      date: appt.date,
      startTime: appt.startTime,
      serviceId: appt.serviceId,
      serviceName: appt.service.name_pl,
    }
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { date: row.date, startTime: row.startTime, endTime: row.endTime },
    })
    notifyBookingUpdate(appt.id, previous, 'google').catch(console.error)
    await detectAndNotifyConflicts(masterId, row.date, undefined, appt.id)
    return
  }

  if (cls.kind === 'site') {
    ctx.seenForeign.delete(item.id)
    return
  }
  if (apptCancelled) {
    ctx.seenForeign.delete(item.id)
    return
  }

  // Foreign event -> external block rows (one per Warsaw-local day).
  const rows = googleEventToBlocks(item).filter((r) => isWithinSyncWindow(r, ctx.todayUtc, SYNC_WINDOW_DAYS))
  const existing = await prisma.externalCalendarBlock.findMany({
    where: { masterId, googleEventId: item.id },
  })
  const byDate = new Map(existing.map((b) => [b.date.getTime(), b]))
  const title = item.summary ?? null
  const description = item.description ?? null
  const touched: { id: string; date: Date }[] = []

  for (const row of rows) {
    const prev = byDate.get(row.date.getTime())
    if (!prev) {
      const created = await prisma.externalCalendarBlock.create({
        data: {
          masterId,
          googleCalendarId: ctx.calendarId,
          googleEventId: item.id,
          title,
          description,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          allDay: row.allDay,
        },
      })
      touched.push({ id: created.id, date: row.date })
      continue
    }
    const timesChanged = prev.startTime !== row.startTime || prev.endTime !== row.endTime
    if (
      timesChanged ||
      prev.title !== title ||
      prev.description !== description ||
      prev.allDay !== row.allDay ||
      prev.googleCalendarId !== ctx.calendarId
    ) {
      await prisma.externalCalendarBlock.update({
        where: { id: prev.id },
        data: {
          googleCalendarId: ctx.calendarId,
          title,
          description,
          startTime: row.startTime,
          endTime: row.endTime,
          allDay: row.allDay,
          ...(timesChanged ? { conflictNotifiedAt: null } : {}),
        },
      })
      if (timesChanged) touched.push({ id: prev.id, date: row.date })
    }
  }

  const keep = new Set(rows.map((r) => r.date.getTime()))
  const stale = existing.filter((b) => !keep.has(b.date.getTime())).map((b) => b.id)
  if (stale.length > 0) {
    await prisma.externalCalendarBlock.deleteMany({ where: { id: { in: stale } } })
  }

  for (const t of touched) await detectAndNotifyConflicts(masterId, t.date, t.id)
}

export async function pullMasterCalendar(masterId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getTenantConfig()
    if (!isGoogleSyncEnabled(config)) return { ok: true }

    const profile = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
      select: { googleCalendarId: true, googleSyncToken: true, googleFullSyncAt: true },
    })
    const calendarId = normalizeCalendarId(profile?.googleCalendarId)
    if (!profile || !calendarId) return { ok: true }

    // Incremental sync never widens the fixed time window, so force a full sync weekly.
    const forceFull = needsFullSync(profile.googleSyncToken, profile.googleFullSyncAt, new Date())
    const incremental = Boolean(profile.googleSyncToken) && !forceFull
    const todayUtc = warsawTodayUtcMidnight()
    const params: Record<string, string> = incremental
      ? { syncToken: profile.googleSyncToken as string, singleEvents: 'true', showDeleted: 'true', maxResults: '250' }
      : {
          timeMin: fromZonedTime(`${todayUtc.toISOString().slice(0, 10)}T00:00:00`, SCHEDULE_TZ).toISOString(),
          timeMax: addDays(todayUtc, SYNC_WINDOW_DAYS).toISOString(),
          singleEvents: 'true',
          showDeleted: 'true',
          maxResults: '250',
        }

    const items: GoogleEvent[] = []
    let nextSyncToken: string | undefined
    let truncated = false
    try {
      let pageToken: string | undefined
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await listEvents(calendarId, { ...params, ...(pageToken ? { pageToken } : {}) })
        items.push(...(res.items ?? []))
        pageToken = res.nextPageToken
        if (!pageToken) {
          nextSyncToken = res.nextSyncToken
          break
        }
        if (page === MAX_PAGES - 1) truncated = true
      }
    } catch (err) {
      if (incremental && err instanceof GoogleApiError && (err.status === 410 || err.status === 400)) {
        await prisma.masterProfile.updateMany({ where: { userId: masterId }, data: { googleSyncToken: null } })
        return { ok: true }
      }
      throw err
    }

    const ctx: Ctx = { masterId, calendarId, todayUtc, seenForeign: new Set(), warnings: [] }
    for (const item of items) {
      try {
        await handleEvent(item, ctx)
      } catch (err) {
        console.error('[google-calendar pull] event failed:', err)
        ctx.warnings.push(describe(err))
      }
    }

    // A full sync is authoritative: drop blocks whose event is no longer in the feed
    // (covers a token reset and blocks left over from a previously connected calendar).
    if (!incremental && !truncated) {
      await prisma.externalCalendarBlock.deleteMany({
        where: { masterId, googleEventId: { notIn: [...ctx.seenForeign] } },
      })
    }

    await prisma.masterProfile.updateMany({
      where: { userId: masterId },
      data: {
        googleSyncToken: truncated ? null : (nextSyncToken ?? null),
        googleSyncedAt: new Date(),
        ...(!incremental && !truncated ? { googleFullSyncAt: new Date() } : {}),
        googleSyncStatus: 'ok',
        googleSyncError: ctx.warnings[0]?.slice(0, 300) ?? null,
      },
    })
    return { ok: true }
  } catch (err) {
    const message = describe(err)
    console.error('[google-calendar pull] failed:', message)
    try {
      await prisma.masterProfile.updateMany({
        where: { userId: masterId },
        data: { googleSyncStatus: 'error', googleSyncError: message, googleSyncedAt: new Date() },
      })
    } catch (inner) {
      console.error('[google-calendar pull] could not record error:', inner)
    }
    return { ok: false, error: message }
  }
}
