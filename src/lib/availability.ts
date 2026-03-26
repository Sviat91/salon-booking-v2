import { format, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import prisma from './prisma'

const TZ = 'Europe/Warsaw'

type Range = { start: number; end: number } // minutes in day

/**
 * Read weekly schedule template from DB for a master.
 * Returns a map: { 0: { isDayOff, intervals: [{start:"09:00", end:"18:00"}] }, ... }
 * dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
 */
async function readWeeklyFromDb(masterId: string): Promise<Map<number, { isDayOff: boolean; intervals: { start: string; end: string }[] }>> {
  const schedules = await prisma.schedule.findMany({
    where: { masterId },
  })

  const map = new Map<number, { isDayOff: boolean; intervals: { start: string; end: string }[] }>()
  for (const s of schedules) {
    let intervals: { start: string; end: string }[] = []
    try {
      intervals = JSON.parse(s.intervals)
    } catch { /* use empty */ }
    map.set(s.dayOfWeek, { isDayOff: s.isDayOff, intervals })
  }
  return map
}

/**
 * Read date-specific overrides (custom hours or day-off) from DB.
 * Returns a map keyed by "YYYY-MM-DD".
 */
async function readOverridesFromDb(
  masterId: string,
  from: Date,
  until: Date
): Promise<Map<string, { isDayOff: boolean; intervals: { start: string; end: string }[] }>> {
  const overrides = await prisma.dateOverride.findMany({
    where: {
      masterId,
      date: { gte: from, lte: until },
    },
  })

  const map = new Map<string, { isDayOff: boolean; intervals: { start: string; end: string }[] }>()
  for (const o of overrides) {
    const dateKey = format(o.date, 'yyyy-MM-dd')
    let intervals: { start: string; end: string }[] = []
    try {
      intervals = JSON.parse(o.intervals)
    } catch { /* use empty */ }
    map.set(dateKey, { isDayOff: o.isDayOff, intervals })
  }
  return map
}

/**
 * Fetch busy (booked) time ranges from Appointments table.
 * Returns array of { start: minutesInDay, end: minutesInDay } for each active appointment.
 */
async function fetchBusyRanges(
  masterId: string,
  dateISO: string
): Promise<Range[]> {
  const dayStart = new Date(dateISO + 'T00:00:00')
  const dayEnd = new Date(dateISO + 'T23:59:59')

  const appointments = await prisma.appointment.findMany({
    where: {
      masterId,
      date: { gte: dayStart, lte: dayEnd },
      status: { not: 'CANCELLED' },
    },
    select: { startTime: true, endTime: true },
  })

  return appointments
    .map((a) => {
      const start = t2m(a.startTime)
      const end = t2m(a.endTime)
      return { start, end }
    })
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
}

// ────────────────────────────────────────────
// Utility helpers
// ────────────────────────────────────────────

/** Convert "HH:MM" to minutes since midnight */
const t2m = (t: string) => {
  const s = String(t || '').trim()
  const m = s.match(/^(\d{1,2})[.:](\d{2})$/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** Convert intervals array to Range[] (minutes) */
function intervalsToRanges(intervals: { start: string; end: string }[]): Range[] {
  return intervals
    .map(({ start, end }) => ({ start: t2m(start), end: t2m(end) }))
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
}

/** Subtract busy ranges from open ranges */
function minusBusy(open: Range[], busy: Range[]): Range[] {
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

function isoDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

/**
 * JS Date.getDay() returns 0=Sunday, same as Schedule.dayOfWeek in DB.
 */
function jsDayOfWeek(d: Date): number {
  return d.getDay()
}

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

  const from = new Date(fromISO + 'T00:00:00')
  const until = new Date(untilISO + 'T23:59:59')

  const weekly = await readWeeklyFromDb(masterId)
  const overrides = await readOverridesFromDb(masterId, from, until)

  const days: { date: string; hasWindow: boolean }[] = []
  let cursor = new Date(fromISO + 'T00:00:00')
  const endDate = new Date(untilISO + 'T00:00:00')

  while (cursor <= endDate) {
    const date = isoDate(cursor)
    const dow = jsDayOfWeek(cursor)

    // Determine open intervals for this day
    let isDayOff = false
    let openRanges: Range[] = []

    // Check override first (specific date takes priority)
    const override = overrides.get(date)
    if (override) {
      isDayOff = override.isDayOff
      if (!isDayOff && override.intervals.length > 0) {
        openRanges = intervalsToRanges(override.intervals)
      }
    } else {
      // Fall back to weekly template
      const template = weekly.get(dow)
      if (template) {
        isDayOff = template.isDayOff
        if (!isDayOff) {
          openRanges = intervalsToRanges(template.intervals)
        }
      } else {
        // No schedule defined for this day → treat as day off
        isDayOff = true
      }
    }

    let hasWindow = false
    if (!isDayOff && openRanges.length > 0) {
      const busyRanges = await fetchBusyRanges(masterId, date)
      const free = minusBusy(openRanges, busyRanges)
      hasWindow = free.some((r) => r.end - r.start >= minDuration)
    }

    days.push({ date, hasWindow })
    cursor = addDays(cursor, 1)
  }

  const result: any = { days }
  if (opts?.debug) {
    result.debug = {
      weeklyKeys: weekly.size,
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
  masterId?: string
) {
  if (!masterId) {
    return { slots: [] as { startISO: string; endISO: string }[] }
  }

  const weekly = await readWeeklyFromDb(masterId)
  const dateObj = new Date(dateISO + 'T00:00:00')
  const dow = jsDayOfWeek(dateObj)

  // Get overrides for this specific day
  const overrides = await readOverridesFromDb(masterId, dateObj, dateObj)
  const override = overrides.get(dateISO)

  let isDayOff = false
  let openRanges: Range[] = []

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

  // Fetch busy appointments for this day
  const busyRanges = await fetchBusyRanges(masterId, dateISO)
  const free = minusBusy(openRanges, busyRanges)

  // If the requested date is today (in Warsaw), hide past slots
  let minStartMin = 0
  const nowLocal = toZonedTime(new Date(), TZ)
  const todayISO = isoDate(nowLocal)
  if (dateISO === todayISO) {
    minStartMin = (nowLocal.getHours() + 1) * 60
  }

  // Build slots with step alignment
  const slots: { startISO: string; endISO: string }[] = []
  for (const r of free) {
    const windowStart = Math.max(r.start, minStartMin)
    let start = Math.ceil(windowStart / stepMin) * stepMin
    while (start + minDuration <= r.end) {
      const end = start + minDuration
      const hhS = String(Math.floor(start / 60)).padStart(2, '0')
      const mmS = String(start % 60).padStart(2, '0')
      const hhE = String(Math.floor(end / 60)).padStart(2, '0')
      const mmE = String(end % 60).padStart(2, '0')
      const localStartStr = `${dateISO}T${hhS}:${mmS}:00`
      const localEndStr = `${dateISO}T${hhE}:${mmE}:00`
      const startUtc = fromZonedTime(localStartStr, TZ)
      const endUtc = fromZonedTime(localEndStr, TZ)
      const startISO = formatInTimeZone(startUtc, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
      const endISO = formatInTimeZone(endUtc, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
      slots.push({ startISO, endISO })
      start += stepMin
    }
  }
  return { slots }
}
