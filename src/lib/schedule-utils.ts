/**
 * schedule-utils.ts
 *
 * Shared schedule/availability utilities used by:
 *  - availability.ts (getDaySlots, getAvailableDays)
 *  - /api/bookings/[id]/check-extension  (smart shift algorithm)
 *
 * All functions are pure calculation helpers or thin DB readers — no business logic.
 */

import { format } from 'date-fns'
import prisma from './prisma'

export const SCHEDULE_TZ = 'Europe/Warsaw'

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

/** A time window expressed as minutes since midnight. */
export type Range = { start: number; end: number }

export type IntervalEntry = { start: string; end: string }

export type DaySchedule = {
  isDayOff: boolean
  intervals: IntervalEntry[]
}

// ────────────────────────────────────────────
// Primitive converters
// ────────────────────────────────────────────

/**
 * Convert "HH:MM" string to minutes since midnight.
 * Returns NaN for invalid input.
 */
export const t2m = (t: string): number => {
  const s = String(t || '').trim()
  const m = s.match(/^(\d{1,2})[.:](\d{2})$/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Convert minutes since midnight to "HH:MM" string.
 * E.g. 570 → "09:30"
 */
export const m2t = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Format a Date as "YYYY-MM-DD". */
export function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/**
 * Returns JS day-of-week (0=Sunday … 6=Saturday),
 * matching the Schedule.dayOfWeek column in DB.
 */
export function jsDayOfWeek(d: Date): number {
  return d.getDay()
}

// ────────────────────────────────────────────
// Range helpers
// ────────────────────────────────────────────

/** Convert an array of interval strings to Range[] (minutes). */
export function intervalsToRanges(intervals: IntervalEntry[]): Range[] {
  return intervals
    .map(({ start, end }) => ({ start: t2m(start), end: t2m(end) }))
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
}

/**
 * Subtract busy ranges from open working-hour ranges.
 * Returns the free windows that remain.
 */
export function minusBusy(open: Range[], busy: Range[]): Range[] {
  const res: Range[] = []
  const mergedBusy = [...busy].sort((a, b) => a.start - b.start)
  for (const o of open) {
    let cursor = o.start
    for (const b of mergedBusy) {
      if (b.end <= cursor || b.start >= o.end) continue
      if (b.start > cursor) res.push({ start: cursor, end: Math.min(b.start, o.end) })
      cursor = Math.max(cursor, b.end)
      if (cursor >= o.end) break
    }
    if (cursor < o.end) res.push({ start: cursor, end: o.end })
  }
  return res
}

/** Check whether a candidate range [start, end] fits inside any of the open ranges. */
export function fitsInOpen(open: Range[], start: number, end: number): boolean {
  return open.some((r) => r.start <= start && r.end >= end)
}

/** Check whether a candidate range [start, end] overlaps any of the busy ranges. */
export function overlapsWithBusy(busy: Range[], start: number, end: number): boolean {
  return busy.some((b) => b.start < end && b.end > start)
}

// ────────────────────────────────────────────
// DB readers
// ────────────────────────────────────────────

/**
 * Read weekly schedule template from DB for a master.
 * Returns a Map keyed by dayOfWeek (0=Sunday … 6=Saturday).
 */
export async function readWeeklyFromDb(
  masterId: string
): Promise<Map<number, DaySchedule>> {
  const schedules = await prisma.schedule.findMany({ where: { masterId } })

  const map = new Map<number, DaySchedule>()
  for (const s of schedules) {
    let intervals: IntervalEntry[] = []
    try {
      intervals = JSON.parse(s.intervals)
    } catch { /* use empty */ }
    map.set(s.dayOfWeek, { isDayOff: s.isDayOff, intervals })
  }
  return map
}

/**
 * Read date-specific overrides (custom hours or forced day-off) from DB.
 * Returns a Map keyed by "YYYY-MM-DD".
 */
export async function readOverridesFromDb(
  masterId: string,
  from: Date,
  until: Date
): Promise<Map<string, DaySchedule>> {
  const overrides = await prisma.dateOverride.findMany({
    where: {
      masterId,
      date: { gte: from, lte: until },
    },
  })

  const map = new Map<string, DaySchedule>()
  for (const o of overrides) {
    const dateKey = format(o.date, 'yyyy-MM-dd')
    let intervals: IntervalEntry[] = []
    try {
      intervals = JSON.parse(o.intervals)
    } catch { /* use empty */ }
    map.set(dateKey, { isDayOff: o.isDayOff, intervals })
  }
  return map
}

/**
 * Fetch busy (booked) time ranges from the Appointments table for a given day.
 *
 * @param masterId         - filter by master
 * @param dateISO          - date in "YYYY-MM-DD" format
 * @param excludeId        - optional appointment id to exclude (used when modifying an existing booking)
 */
export async function fetchBusyRanges(
  masterId: string,
  dateISO: string,
  excludeId?: string
): Promise<Range[]> {
  const dayStart = new Date(dateISO + 'T00:00:00')
  const dayEnd   = new Date(dateISO + 'T23:59:59')

  const appointments = await prisma.appointment.findMany({
    where: {
      masterId,
      date: { gte: dayStart, lte: dayEnd },
      status: { not: 'CANCELLED' },
      // Exclude the appointment being modified so it doesn't block its own time slot
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { startTime: true, endTime: true },
  })

  return appointments
    .map((a) => {
      const start = t2m(a.startTime)
      const end   = t2m(a.endTime)
      return { start, end }
    })
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
}

/**
 * Resolve the open working-hour ranges for a specific date.
 * Applies overrides first, falls back to weekly template, returns [] for day-off.
 */
export async function getOpenRangesForDate(
  masterId: string,
  dateISO: string
): Promise<Range[]> {
  const dateObj  = new Date(dateISO + 'T00:00:00')
  const untilObj = new Date(dateISO + 'T23:59:59')
  const dow      = jsDayOfWeek(dateObj)

  const weekly    = await readWeeklyFromDb(masterId)
  const overrides = await readOverridesFromDb(masterId, dateObj, untilObj)
  const override  = overrides.get(dateISO)

  if (override) {
    if (override.isDayOff) return []
    return intervalsToRanges(override.intervals)
  }

  const template = weekly.get(dow)
  if (!template || template.isDayOff) return []
  return intervalsToRanges(template.intervals)
}
