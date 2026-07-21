import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/schedule-utils', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    readWeeklyFromDb: vi.fn(),
    readOverridesFromDb: vi.fn(),
    fetchBusyRanges: vi.fn(),
  }
})

import { getAvailableDays, getDaySlots } from '@/lib/availability'
import { readWeeklyFromDb, readOverridesFromDb, fetchBusyRanges } from '@/lib/schedule-utils'

const MASTER_ID = 'master_1'
// Fixed dates far from "today" so the getDaySlots past-slot-trimming logic
// (which compares against the real current date in Europe/Warsaw) never engages.
const WORKING_DAY = '2027-03-08' // Monday
const DAY_OFF = '2027-03-07' // Sunday

describe('availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const weekly = new Map([
      [0, { isDayOff: true, intervals: [] }], // Sunday
      [1, { isDayOff: false, intervals: [{ start: '09:00', end: '18:00' }] }],
      [2, { isDayOff: false, intervals: [{ start: '09:00', end: '18:00' }] }],
      [3, { isDayOff: false, intervals: [{ start: '09:00', end: '18:00' }] }],
      [4, { isDayOff: false, intervals: [{ start: '09:00', end: '18:00' }] }],
      [5, { isDayOff: false, intervals: [{ start: '09:00', end: '18:00' }] }],
      [6, { isDayOff: false, intervals: [{ start: '09:00', end: '18:00' }] }],
    ])

    ;(readWeeklyFromDb as unknown as Mock).mockResolvedValue(weekly)
    ;(readOverridesFromDb as unknown as Mock).mockResolvedValue(new Map())
    ;(fetchBusyRanges as unknown as Mock).mockResolvedValue([])
  })

  describe('getDaySlots', () => {
    it('returns non-empty step-aligned slots on a working day', async () => {
      const { slots } = await getDaySlots(WORKING_DAY, 60, 15, MASTER_ID)

      expect(slots.length).toBeGreaterThan(0)
      expect(slots[0].startISO).toContain('T09:')
      for (const slot of slots) {
        const start = new Date(slot.startISO)
        const end = new Date(slot.endISO)
        expect((end.getTime() - start.getTime()) / 60000).toBe(60)
        expect(start.getMinutes() % 15).toBe(0)
      }
    })

    it('returns empty for a day-off (Sunday template)', async () => {
      const { slots } = await getDaySlots(DAY_OFF, 60, 15, MASTER_ID)
      expect(slots).toEqual([])
    })

    it('returns empty when masterId is missing', async () => {
      const { slots } = await getDaySlots(WORKING_DAY, 60, 15, undefined)
      expect(slots).toEqual([])
      expect(readWeeklyFromDb).not.toHaveBeenCalled()
    })

    it('excludes a slot overlapping a busy range', async () => {
      ;(fetchBusyRanges as unknown as Mock).mockResolvedValue([{ start: 10 * 60, end: 11 * 60 }])

      const { slots } = await getDaySlots(WORKING_DAY, 60, 15, MASTER_ID)

      const conflicting = slots.find((s) => s.startISO.includes('T10:00'))
      expect(conflicting).toBeUndefined()
    })

    it('does not start a slot where minDuration would overlap the busy block', async () => {
      ;(fetchBusyRanges as unknown as Mock).mockResolvedValue([{ start: 10 * 60 + 30, end: 11 * 60 }])

      const { slots } = await getDaySlots(WORKING_DAY, 60, 15, MASTER_ID)

      // A 60-min slot starting at 10:00 would run until 11:00, overlapping 10:30-11:00 busy.
      const overlapping = slots.find((s) => s.startISO.includes('T10:00'))
      expect(overlapping).toBeUndefined()
    })

    it('returns slots in chronological order', async () => {
      const { slots } = await getDaySlots(WORKING_DAY, 60, 15, MASTER_ID)

      for (let i = 1; i < slots.length; i++) {
        const prevStart = new Date(slots[i - 1].startISO)
        const currStart = new Date(slots[i].startISO)
        expect(currStart.getTime()).toBeGreaterThan(prevStart.getTime())
      }
    })
  })

  describe('getAvailableDays', () => {
    it('marks a working day as hasWindow:true and a day-off as hasWindow:false', async () => {
      const { days } = await getAvailableDays(DAY_OFF, WORKING_DAY, 60, { masterId: MASTER_ID })

      const sunday = days.find((d: { date: string }) => d.date === DAY_OFF)
      const monday = days.find((d: { date: string }) => d.date === WORKING_DAY)

      expect(sunday?.hasWindow).toBe(false)
      expect(monday?.hasWindow).toBe(true)
    })

    it('returns no days when masterId is missing', async () => {
      const { days } = await getAvailableDays(DAY_OFF, WORKING_DAY, 60, {})
      expect(days).toEqual([])
    })

    it('marks past dates as hasWindow:false even on a normally-working weekday', async () => {
      // 2020-01-06 is a Monday (working day per template) but far in the past.
      const { days } = await getAvailableDays('2020-01-01', '2020-01-07', 60, { masterId: MASTER_ID })

      expect(days.every((d: { hasWindow: boolean }) => d.hasWindow === false)).toBe(true)
      expect(fetchBusyRanges).not.toHaveBeenCalled()
    })
  })
})
