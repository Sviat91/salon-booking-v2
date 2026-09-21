import prisma from '@/lib/prisma'
import { normalizeCalendarId } from './config'
import { GoogleApiError, getCalendar } from './client'
import { clearMasterEventIds, enqueueBackfillForMaster } from './outbox'

/**
 * Shared connect/disconnect handler behind both PUT surfaces (admin-on-behalf
 * and the master's own). Empty input disconnects.
 */
export async function setMasterCalendarId(
  masterId: string,
  rawCalendarId: string,
): Promise<{ ok: true; queued: number } | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CALENDAR_ID_IN_USE' }> {
  const profile = await prisma.masterProfile.findUnique({
    where: { userId: masterId },
    select: { googleCalendarId: true },
  })
  if (!profile) return { ok: false, code: 'NOT_FOUND' }

  if (!rawCalendarId.trim()) {
    await prisma.masterProfile.update({
      where: { userId: masterId },
      data: {
        googleCalendarId: null,
        googleSyncToken: null,
        googleSyncStatus: null,
        googleSyncError: null,
      },
    })
    await prisma.externalCalendarBlock.deleteMany({ where: { masterId } })
    await clearMasterEventIds(masterId)
    return { ok: true, queued: 0 }
  }

  const calendarId = normalizeCalendarId(rawCalendarId)
  if (!calendarId) return { ok: false, code: 'VALIDATION_ERROR' }
  if (calendarId === profile.googleCalendarId) return { ok: true, queued: 0 }

  const taken = await prisma.masterProfile.findFirst({
    where: { googleCalendarId: calendarId, userId: { not: masterId } },
    select: { id: true },
  })
  if (taken) return { ok: false, code: 'CALENDAR_ID_IN_USE' }

  await prisma.masterProfile.update({
    where: { userId: masterId },
    data: {
      googleCalendarId: calendarId,
      googleSyncToken: null,
      googleSyncError: null,
      googleSyncStatus: null,
    },
  })
  await prisma.externalCalendarBlock.deleteMany({ where: { masterId } })
  await clearMasterEventIds(masterId)
  const { queued } = await enqueueBackfillForMaster(masterId)
  return { ok: true, queued }
}

/**
 * Checks that the service account can reach a calendar. Uses the supplied id,
 * else the master's saved one. Shared by both test routes.
 */
export async function testMasterCalendar(
  masterId: string,
  rawCalendarId?: string | null,
): Promise<
  | { ok: true }
  | { ok: false; status: number; code: 'VALIDATION_ERROR' | 'GOOGLE_CALENDAR_NOT_FOUND' | 'GOOGLE_NO_ACCESS' | 'GOOGLE_API_ERROR' | 'GOOGLE_KEY_INVALID' }
> {
  let calendarId = normalizeCalendarId(rawCalendarId)
  if (!calendarId) {
    const profile = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
      select: { googleCalendarId: true },
    })
    calendarId = normalizeCalendarId(profile?.googleCalendarId)
  }
  if (!calendarId) return { ok: false, status: 400, code: 'VALIDATION_ERROR' }

  try {
    await getCalendar(calendarId)
    return { ok: true }
  } catch (err) {
    if (err instanceof GoogleApiError) {
      if (err.reason === 'no_token') return { ok: false, status: 400, code: 'GOOGLE_KEY_INVALID' }
      if (err.status === 404) return { ok: false, status: 400, code: 'GOOGLE_CALENDAR_NOT_FOUND' }
      if (err.status === 403) return { ok: false, status: 400, code: 'GOOGLE_NO_ACCESS' }
    }
    return { ok: false, status: 502, code: 'GOOGLE_API_ERROR' }
  }
}
