import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { SYNC_WINDOW_DAYS, isGoogleSyncEnabled, normalizeCalendarId } from './config'
import { listEvents } from './client'
import { SALON_APPOINTMENT_KEY } from './event-mapping'
import { processSyncTask } from './push'

const MAX_ATTEMPTS = 8
const ENQUEUE_CAP = 500
const MAX_PAGES = 20

const KEY = Symbol.for('salon.googleCalendar.outbox')

type OutboxState = { draining: boolean; kickScheduled: boolean }

function state(): OutboxState {
  const g = globalThis as unknown as Record<symbol, OutboxState | undefined>
  return (g[KEY] ??= { draining: false, kickScheduled: false })
}

function todayUtcMidnight(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function syncEnabled(): Promise<boolean> {
  return isGoogleSyncEnabled(await getTenantConfig())
}

export function kickOutbox(): void {
  const s = state()
  if (s.kickScheduled) return
  s.kickScheduled = true
  const handle = setTimeout(() => {
    s.kickScheduled = false
    void drainOutbox()
  }, 250)
  handle.unref?.()
}

type StaleFields = { staleCalendarId: string; staleGoogleEventId: string }

async function upsertTask(
  appointmentId: string,
  masterId: string,
  stale?: StaleFields,
): Promise<void> {
  await prisma.calendarSyncTask.upsert({
    where: { appointmentId },
    create: { appointmentId, masterId, operation: 'UPSERT', ...stale },
    // Stale fields are only overwritten when new values are supplied.
    update: {
      operation: 'UPSERT',
      masterId,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      ...stale,
    },
  })
}

/**
 * Queues a push for the appointment. When the appointment was reassigned to a
 * different master, pass previousMasterId + previousGoogleEventId so the old
 * master's event is deleted before the new one is inserted.
 */
export async function enqueueAppointmentSync(
  appointmentId: string,
  opts?: { previousMasterId?: string; previousGoogleEventId?: string | null },
): Promise<void> {
  try {
    if (!(await syncEnabled())) return
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { masterId: true },
    })
    if (!appt) return
    let stale: StaleFields | undefined
    if (opts?.previousMasterId && opts.previousGoogleEventId) {
      // Double reassignment before the drain: the same event is still waiting to be
      // deleted from its ORIGINAL calendar, so keep that pair instead of overwriting it.
      const existing = await prisma.calendarSyncTask.findUnique({
        where: { appointmentId },
        select: { staleCalendarId: true, staleGoogleEventId: true },
      })
      const keepExisting =
        !!existing?.staleCalendarId && existing.staleGoogleEventId === opts.previousGoogleEventId
      const prev = keepExisting
        ? null
        : await prisma.masterProfile.findUnique({
            where: { userId: opts.previousMasterId },
            select: { googleCalendarId: true },
          })
      if (prev?.googleCalendarId) {
        stale = {
          staleCalendarId: prev.googleCalendarId,
          staleGoogleEventId: opts.previousGoogleEventId,
        }
      }
    }
    await upsertTask(appointmentId, appt.masterId, stale)
    kickOutbox()
  } catch (err) {
    console.error('[google-calendar outbox] enqueueAppointmentSync failed:', err)
  }
}

export async function enqueueAppointmentDelete(input: {
  appointmentId: string
  masterId: string
  googleEventId: string | null
  /** Snapshotted calendar id; skips the profile lookup (profile may already be gone). */
  calendarId?: string
}): Promise<void> {
  try {
    if (!input.googleEventId) return
    if (!(await syncEnabled())) return
    const profile = input.calendarId
      ? { googleCalendarId: input.calendarId }
      : await prisma.masterProfile.findUnique({
          where: { userId: input.masterId },
          select: { googleCalendarId: true },
        })
    const data = {
      masterId: input.masterId,
      operation: 'DELETE',
      googleEventId: input.googleEventId,
      calendarId: profile?.googleCalendarId ?? null,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
    }
    await prisma.calendarSyncTask.upsert({
      where: { appointmentId: input.appointmentId },
      create: { appointmentId: input.appointmentId, ...data },
      update: data,
    })
    kickOutbox()
  } catch (err) {
    console.error('[google-calendar outbox] enqueueAppointmentDelete failed:', err)
  }
}

export async function enqueueSyncForUsers(userIds: string[]): Promise<void> {
  try {
    if (userIds.length === 0) return
    if (!(await syncEnabled())) return
    const appts = await prisma.appointment.findMany({
      where: {
        clientId: { in: userIds },
        OR: [{ googleEventId: { not: null } }, { date: { gte: todayUtcMidnight() } }],
      },
      select: { id: true, masterId: true },
      take: ENQUEUE_CAP,
    })
    for (const a of appts) await upsertTask(a.id, a.masterId)
    if (appts.length > 0) kickOutbox()
  } catch (err) {
    console.error('[google-calendar outbox] enqueueSyncForUsers failed:', err)
  }
}

async function fetchExistingEventIds(calendarId: string, from: Date, to: Date): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await listEvents(calendarId, {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: 'true',
        maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      })
      for (const item of res.items ?? []) {
        if (item.status === 'cancelled') continue
        const id = item.extendedProperties?.private?.[SALON_APPOINTMENT_KEY]
        if (id) map.set(id, item.id)
      }
      pageToken = res.nextPageToken
      if (!pageToken) break
    }
  } catch (err) {
    // Never blocks connect: worst case we fall back to today's insert-everything behavior.
    console.error('[google-calendar outbox] fetchExistingEventIds failed:', err)
  }
  return map
}

export async function enqueueBackfillForMaster(masterId: string): Promise<{ queued: number }> {
  try {
    const from = todayUtcMidnight()
    const to = new Date(from.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const appts = await prisma.appointment.findMany({
      where: { masterId, status: { not: 'CANCELLED' }, date: { gte: from, lte: to } },
      select: { id: true },
    })
    if (appts.length === 0) return { queued: 0 }

    const profile = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
      select: { googleCalendarId: true },
    })
    const calendarId = normalizeCalendarId(profile?.googleCalendarId)
    const existing = calendarId ? await fetchExistingEventIds(calendarId, from, to) : new Map<string, string>()
    for (const a of appts) {
      const eventId = existing.get(a.id)
      if (eventId) await prisma.appointment.update({ where: { id: a.id }, data: { googleEventId: eventId } })
    }

    for (const a of appts) await upsertTask(a.id, masterId)
    kickOutbox()
    return { queued: appts.length }
  } catch (err) {
    console.error('[google-calendar outbox] enqueueBackfillForMaster failed:', err)
    return { queued: 0 }
  }
}

export async function clearMasterEventIds(masterId: string): Promise<void> {
  try {
    await prisma.appointment.updateMany({ where: { masterId }, data: { googleEventId: null } })
  } catch (err) {
    console.error('[google-calendar outbox] clearMasterEventIds failed:', err)
  }
}

export async function drainOutbox(limit = 25): Promise<{ processed: number; failed: number }> {
  const s = state()
  if (s.draining) return { processed: 0, failed: 0 }
  s.draining = true
  let processed = 0
  let failed = 0
  try {
    const tasks = await prisma.calendarSyncTask.findMany({
      where: { nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    })
    for (const task of tasks) {
      let counted = false
      try {
        const unchanged = { id: task.id, updatedAt: task.updatedAt }
        const result = await processSyncTask(task)
        if (result.ok) {
          const { count } = await prisma.calendarSyncTask.deleteMany({ where: unchanged })
          if (count === 0) logRewritten(task.id)
          processed++
          counted = true
          continue
        }
        failed++
        counted = true
        const error = result.error.slice(0, 300)
        const attempts = result.retryable ? task.attempts + 1 : MAX_ATTEMPTS
        if (attempts >= MAX_ATTEMPTS) {
          const { count } = await prisma.calendarSyncTask.deleteMany({ where: unchanged })
          if (count === 0) {
            logRewritten(task.id)
            continue
          }
          await prisma.masterProfile.updateMany({
            where: { userId: task.masterId },
            data: { googleSyncStatus: 'error', googleSyncError: error },
          })
        } else {
          const delayMs = Math.min(30_000 * 2 ** attempts, 30 * 60_000)
          const { count } = await prisma.calendarSyncTask.updateMany({
            where: unchanged,
            data: { attempts, nextAttemptAt: new Date(Date.now() + delayMs), lastError: error },
          })
          if (count === 0) logRewritten(task.id)
        }
      } catch (err) {
        if (!counted) failed++
        console.error('[google-calendar outbox] task failed:', task.id, err)
      }
    }
  } catch (err) {
    console.error('[google-calendar outbox] drain failed:', err)
  } finally {
    s.draining = false
  }
  return { processed, failed }
}

function logRewritten(taskId: string): void {
  console.debug('[google-calendar outbox] task rewritten during processing, left for next tick:', taskId)
}
