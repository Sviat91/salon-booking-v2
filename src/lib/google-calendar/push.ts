import type { CalendarSyncTask } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'
import { normalizeCalendarId } from './config'
import { GoogleApiError, deleteEvent, insertEvent, isRetryable, patchEvent } from './client'
import { appointmentToEventBody } from './event-mapping'

export type PushResult = { ok: true } | { ok: false; retryable: boolean; error: string }

function todayUtcMidnight(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function describe(err: unknown): string {
  if (err instanceof GoogleApiError) return `Google ${err.status} ${err.reason}: ${err.message}`
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err)
}

async function masterCalendarId(masterId: string): Promise<string | null> {
  const profile = await prisma.masterProfile.findUnique({
    where: { userId: masterId },
    select: { googleCalendarId: true },
  })
  return normalizeCalendarId(profile?.googleCalendarId)
}

async function markOk(masterId: string): Promise<void> {
  await prisma.masterProfile.updateMany({
    where: { userId: masterId },
    data: { googleSyncStatus: 'ok', googleSyncError: null, googleSyncedAt: new Date() },
  })
}

/** Records the new event id; an already-deleted appointment (P2025) must not throw. */
async function saveEventId(appointmentId: string, googleEventId: string | null): Promise<boolean> {
  try {
    await prisma.appointment.update({ where: { id: appointmentId }, data: { googleEventId } })
    return true
  } catch (err) {
    if ((err as { code?: string } | null)?.code === 'P2025') return false
    throw err
  }
}

/**
 * Deletes the previous master's event left behind by a master reassignment.
 * Idempotent (404/410 = success), so a retry after a later failure is harmless.
 */
async function processStale(task: CalendarSyncTask): Promise<void> {
  const { staleCalendarId, staleGoogleEventId } = task
  if (!staleCalendarId || !staleGoogleEventId) return
  await deleteEvent(staleCalendarId, staleGoogleEventId)
  await prisma.appointment.updateMany({
    where: { id: task.appointmentId, googleEventId: staleGoogleEventId },
    data: { googleEventId: null },
  })
}

export async function processSyncTask(task: CalendarSyncTask): Promise<PushResult> {
  try {
    await processStale(task)

    if (task.operation === 'DELETE') {
      if (task.googleEventId && task.googleEventId === task.staleGoogleEventId) return { ok: true }
      const calendarId = normalizeCalendarId(task.calendarId) ?? (await masterCalendarId(task.masterId))
      if (!calendarId || !task.googleEventId) return { ok: true }
      await deleteEvent(calendarId, task.googleEventId)
      return { ok: true }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: task.appointmentId },
      include: {
        client: { select: { name: true, phone: true } },
        master: { select: { name: true } },
        service: { select: { name_pl: true, name_en: true, name_uk: true } },
      },
    })
    if (!appointment) return { ok: true }

    const calendarId = await masterCalendarId(task.masterId)
    if (!calendarId) return { ok: true }

    let googleEventId = appointment.googleEventId

    if (appointment.status.startsWith('CANCELLED')) {
      if (googleEventId) {
        await deleteEvent(calendarId, googleEventId)
        await saveEventId(appointment.id, null)
      }
      return { ok: true }
    }

    if (appointment.date < todayUtcMidnight() && !googleEventId) return { ok: true }

    const config = await getTenantConfig()
    const body = appointmentToEventBody(appointment, config.brandName || DEFAULT_BRAND_NAME)

    let done = false
    if (googleEventId) {
      try {
        await patchEvent(calendarId, googleEventId, body)
        done = true
      } catch (err) {
        if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) {
          googleEventId = null
          await saveEventId(appointment.id, null)
        } else {
          throw err
        }
      }
    }
    if (!done) {
      const created = await insertEvent(calendarId, body)
      if (!(await saveEventId(appointment.id, created.id))) {
        // Appointment vanished meanwhile: don't leave an orphaned event with client PII.
        await deleteEvent(calendarId, created.id).catch(() => {})
      }
    }

    await markOk(task.masterId)
    return { ok: true }
  } catch (err) {
    return { ok: false, retryable: isRetryable(err), error: describe(err) }
  }
}
