/**
 * availability.ts
 *
 * Public API for the booking calendar:
 *  - getAvailableDays  → which days have at least one free slot
 *  - getDaySlots       → concrete time slots for a specific date
 *
 * Schedule/busy-range utilities are shared from ./schedule-utils.
 */

import { addDays } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import {
  SCHEDULE_TZ,
  isoDate,
  jsDayOfWeek,
  intervalsToRanges,
  minusBusy,
  t2m,
  readWeeklyFromDb,
  readOverridesFromDb,
  fetchBusyRanges,
} from './schedule-utils'

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Get available days in a date range for a master.
 * For each day returns { date, hasWindow } — whether there is at least one
 * free slot of `minDuration` minutes.
 */
export async function getAvailableDays(
  fromISO: string,
  untilISO: string,
  minDuration: number,
  opts?: { debug?: boolean; masterId?: string }
) {
  const masterId = opts?.masterId
  if (!masterId) {
    return { days: [] }
  }

  const from  = new Date(fromISO  + 'T00:00:00')
  const until = new Date(untilISO + 'T23:59:59')

  const weekly    = await readWeeklyFromDb(masterId)
  const overrides = await readOverridesFromDb(masterId, from, until)

  const days: { date: string; hasWindow: boolean }[] = []
  let cursor  = new Date(fromISO  + 'T00:00:00')
  const endDate = new Date(untilISO + 'T00:00:00')

  const nowLocal = toZonedTime(new Date(), SCHEDULE_TZ)
  const todayISO = isoDate(nowLocal)

  while (cursor <= endDate) {
    const date = isoDate(cursor)

    if (date < todayISO) {
      days.push({ date, hasWindow: false })
      cursor = addDays(cursor, 1)
      continue
    }

    const dow  = jsDayOfWeek(cursor)

    let isDayOff   = false
    let openRanges = intervalsToRanges([]) // empty default

    // Override takes priority over weekly template
    const override = overrides.get(date)
    if (override) {
      isDayOff = override.isDayOff
      if (!isDayOff && override.intervals.length > 0) {
        openRanges = intervalsToRanges(override.intervals)
      }
    } else {
      const template = weekly.get(dow)
      if (template) {
        isDayOff = template.isDayOff
        if (!isDayOff) {
          openRanges = intervalsToRanges(template.intervals)
        }
      } else {
        isDayOff = true // no schedule defined → treat as day off
      }
    }

    let hasWindow = false
    if (!isDayOff && openRanges.length > 0) {
      const busyRanges = await fetchBusyRanges(masterId, date)
      const free       = minusBusy(openRanges, busyRanges)
      hasWindow        = free.some((r) => r.end - r.start >= minDuration)
    }

    days.push({ date, hasWindow })
    cursor = addDays(cursor, 1)
  }

  const result: Record<string, unknown> = { days }
  if (opts?.debug) {
    result.debug = {
      weeklyKeys:     weekly.size,
      overridesCount: overrides.size,
      minDuration,
      fromISO,
      untilISO,
    }
  }
  return result
}

/**
 * Generate concrete time slots for a specific date.
 * Returns { slots: [{ startISO, endISO }] }.
 */
export async function getDaySlots(
  dateISO: string,
  minDuration: number,
  stepMin: number = 15,
  masterId?: string,
  excludeAppointmentId?: string
) {
  if (!masterId) {
    return { slots: [] as { startISO: string; endISO: string }[] }
  }

  const weekly    = await readWeeklyFromDb(masterId)
  const dateObj   = new Date(dateISO + 'T00:00:00')
  const untilObj  = new Date(dateISO + 'T23:59:59')
  const dow       = jsDayOfWeek(dateObj)

  const overrides = await readOverridesFromDb(masterId, dateObj, untilObj)
  const override  = overrides.get(dateISO)

  let isDayOff   = false
  let openRanges = intervalsToRanges([]) // empty default

  if (override) {
    isDayOff = override.isDayOff
    if (!isDayOff && override.intervals.length > 0) {
      openRanges = intervalsToRanges(override.intervals)
    }
  } else {
    const template = weekly.get(dow)
    if (template) {
      isDayOff = template.isDayOff
      if (!isDayOff) {
        openRanges = intervalsToRanges(template.intervals)
      }
    } else {
      isDayOff = true
    }
  }

  if (isDayOff || openRanges.length === 0) {
    return { slots: [] as { startISO: string; endISO: string }[] }
  }

  const busyRanges = await fetchBusyRanges(masterId, dateISO, excludeAppointmentId)
  const free       = minusBusy(openRanges, busyRanges)

  // Hide past slots when viewing today (Warsaw time)
  let minStartMin = 0
  const nowLocal  = toZonedTime(new Date(), SCHEDULE_TZ)
  const todayISO  = isoDate(nowLocal)
  if (dateISO === todayISO) {
    minStartMin = (nowLocal.getHours() + 1) * 60
  }

  // Build slot list with step alignment
  const slots: { startISO: string; endISO: string }[] = []
  for (const r of free) {
    const windowStart = Math.max(r.start, minStartMin)
    let start = Math.ceil(windowStart / stepMin) * stepMin
    while (start + minDuration <= r.end) {
      const end  = start + minDuration
      const hhS  = String(Math.floor(start / 60)).padStart(2, '0')
      const mmS  = String(start % 60).padStart(2, '0')
      const hhE  = String(Math.floor(end   / 60)).padStart(2, '0')
      const mmE  = String(end   % 60).padStart(2, '0')
      const localStartStr = `${dateISO}T${hhS}:${mmS}:00`
      const localEndStr   = `${dateISO}T${hhE}:${mmE}:00`
      const startUtc = fromZonedTime(localStartStr, SCHEDULE_TZ)
      const endUtc   = fromZonedTime(localEndStr,   SCHEDULE_TZ)
      const startISO = formatInTimeZone(startUtc, SCHEDULE_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
      const endISO   = formatInTimeZone(endUtc,   SCHEDULE_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
      slots.push({ startISO, endISO })
      start += stepMin
    }
  }
  return { slots }
}
