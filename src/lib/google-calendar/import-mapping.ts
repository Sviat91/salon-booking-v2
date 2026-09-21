/**
 * Pure mapping of a Google Calendar event to ExternalCalendarBlock rows.
 * No Prisma, no fetch. Date/time convention is identical to Appointment:
 * date = UTC midnight of the Warsaw-local day, times = "HH:MM" Warsaw wall clock.
 */
import { formatInTimeZone } from 'date-fns-tz'
import { SCHEDULE_TZ } from '@/lib/schedule-utils'
import type { GoogleEvent } from './client'
import { SALON_APPOINTMENT_KEY } from './event-mapping'

/** A longer multi-day event imports only its first N days. */
export const MAX_BLOCK_DAYS = 14

const DAY_MS = 86_400_000
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export interface BlockRow {
  date: Date
  startTime: string
  endTime: string
  allDay: boolean
}

function dayStartUtc(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`)
}

function localParts(iso: string): { day: string; time: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return {
    day: formatInTimeZone(d, SCHEDULE_TZ, 'yyyy-MM-dd'),
    time: formatInTimeZone(d, SCHEDULE_TZ, 'HH:mm'),
  }
}

export function googleEventToBlocks(event: GoogleEvent): BlockRow[] {
  const rows: BlockRow[] = []

  if (event.start?.date) {
    const startDay = event.start.date
    if (!ISO_DAY_RE.test(startDay)) return []
    const startMs = dayStartUtc(startDay).getTime()
    if (Number.isNaN(startMs)) return []
    // Google's all-day end.date is exclusive; a missing end means one day.
    let endMs = startMs + DAY_MS
    if (event.end?.date) {
      if (!ISO_DAY_RE.test(event.end.date)) return []
      const parsedEnd = dayStartUtc(event.end.date).getTime()
      if (Number.isNaN(parsedEnd)) return []
      if (parsedEnd > startMs) endMs = parsedEnd
    }
    for (let ms = startMs; ms < endMs && rows.length < MAX_BLOCK_DAYS; ms += DAY_MS) {
      rows.push({ date: new Date(ms), startTime: '00:00', endTime: '23:59', allDay: true })
    }
    return rows
  }

  if (!event.start?.dateTime || !event.end?.dateTime) return []
  const start = localParts(event.start.dateTime)
  const end = localParts(event.end.dateTime)
  if (!start || !end) return []
  if (new Date(event.end.dateTime).getTime() <= new Date(event.start.dateTime).getTime()) return []

  const startMs = dayStartUtc(start.day).getTime()
  const endMs = dayStartUtc(end.day).getTime()
  for (let ms = startMs; ms <= endMs && rows.length < MAX_BLOCK_DAYS; ms += DAY_MS) {
    const isFirst = ms === startMs
    const isLast = ms === endMs
    const startTime = isFirst ? start.time : '00:00'
    const endTime = isLast ? end.time : '23:59'
    // An event ending exactly at midnight leaves no empty trailing row.
    if (isLast && !isFirst && endTime === '00:00') continue
    rows.push({ date: new Date(ms), startTime, endTime, allDay: false })
  }
  return rows
}

export type EventClassification =
  | { kind: 'site'; appointmentId: string }
  | { kind: 'foreign' }
  | { kind: 'ignore' }

/**
 * `status === 'cancelled'` is handled by the caller (it needs the deletion branch).
 * A marker whose appointment does not point back at this event id (a duplicated
 * event) is treated as foreign.
 */
export function classifyEvent(
  event: GoogleEvent,
  lookupAppointmentEventId: (appointmentId: string) => string | null | undefined,
): EventClassification {
  if (event.transparency === 'transparent') return { kind: 'ignore' }
  const appointmentId = event.extendedProperties?.private?.[SALON_APPOINTMENT_KEY]
  if (appointmentId && lookupAppointmentEventId(appointmentId) === event.id) {
    return { kind: 'site', appointmentId }
  }
  return { kind: 'foreign' }
}

/** Echo suppressor: true when the event's Warsaw-local slot equals the appointment's. */
export function eventTimesMatch(
  event: GoogleEvent,
  appt: { date: Date; startTime: string; endTime: string },
): boolean {
  const rows = googleEventToBlocks(event)
  if (rows.length !== 1 || rows[0].allDay) return false
  const [row] = rows
  return (
    row.date.getTime() === appt.date.getTime() &&
    row.startTime === appt.startTime &&
    row.endTime === appt.endTime
  )
}

export function isWithinSyncWindow(row: BlockRow, todayUtcMidnight: Date, windowDays: number): boolean {
  const ms = row.date.getTime()
  return ms >= todayUtcMidnight.getTime() && ms <= todayUtcMidnight.getTime() + windowDays * DAY_MS
}

export const FULL_SYNC_INTERVAL_MS = 7 * DAY_MS

/** True when a stored syncToken exists but the last completed full sync is missing or older than 7 days. */
export function needsFullSync(token: string | null | undefined, fullSyncAt: Date | null | undefined, now: Date): boolean {
  if (!token) return false
  if (!fullSyncAt) return true
  return now.getTime() - fullSyncAt.getTime() > FULL_SYNC_INTERVAL_MS
}
