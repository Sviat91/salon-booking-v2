import { describe, expect, it } from 'vitest'
import {
  MAX_BLOCK_DAYS,
  classifyEvent,
  eventTimesMatch,
  googleEventToBlocks,
  isWithinSyncWindow,
  needsFullSync,
} from '@/lib/google-calendar/import-mapping'
import { SALON_APPOINTMENT_KEY } from '@/lib/google-calendar/event-mapping'
import type { GoogleEvent } from '@/lib/google-calendar/client'

const timed = (start: string, end: string): GoogleEvent => ({
  id: 'e1',
  start: { dateTime: start },
  end: { dateTime: end },
})
const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

describe('googleEventToBlocks', () => {
  it('single-day all-day event -> 1 row', () => {
    const rows = googleEventToBlocks({ id: 'e', start: { date: '2026-05-01' }, end: { date: '2026-05-02' } })
    expect(rows).toEqual([{ date: day('2026-05-01'), startTime: '00:00', endTime: '23:59', allDay: true }])
  })

  it('3-day all-day event -> 3 rows (exclusive end)', () => {
    const rows = googleEventToBlocks({ id: 'e', start: { date: '2026-05-01' }, end: { date: '2026-05-04' } })
    expect(rows.map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('timed event maps to Warsaw wall clock', () => {
    const rows = googleEventToBlocks(timed('2026-05-01T09:00:00+02:00', '2026-05-01T10:30:00+02:00'))
    expect(rows).toEqual([{ date: day('2026-05-01'), startTime: '09:00', endTime: '10:30', allDay: false }])
  })

  it('converts a UTC-offset event to Warsaw time', () => {
    const rows = googleEventToBlocks(timed('2026-05-01T07:00:00Z', '2026-05-01T08:00:00Z'))
    expect(rows[0]).toMatchObject({ startTime: '09:00', endTime: '10:00' })
  })

  it('event crossing midnight -> 2 rows', () => {
    const rows = googleEventToBlocks(timed('2026-05-01T22:00:00+02:00', '2026-05-02T01:00:00+02:00'))
    expect(rows).toEqual([
      { date: day('2026-05-01'), startTime: '22:00', endTime: '23:59', allDay: false },
      { date: day('2026-05-02'), startTime: '00:00', endTime: '01:00', allDay: false },
    ])
  })

  it('event ending exactly at 00:00 next day -> no empty trailing row', () => {
    const rows = googleEventToBlocks(timed('2026-05-01T22:00:00+02:00', '2026-05-02T00:00:00+02:00'))
    expect(rows).toEqual([{ date: day('2026-05-01'), startTime: '22:00', endTime: '23:59', allDay: false }])
  })

  it('truncates a 60-day event at MAX_BLOCK_DAYS', () => {
    const rows = googleEventToBlocks({ id: 'e', start: { date: '2026-05-01' }, end: { date: '2026-06-30' } })
    expect(rows).toHaveLength(MAX_BLOCK_DAYS)
  })

  it('handles both DST transition days', () => {
    // 2026-03-29 02:00 CET -> 03:00 CEST; 10:00 local is +02:00
    expect(googleEventToBlocks(timed('2026-03-29T10:00:00+02:00', '2026-03-29T11:00:00+02:00'))[0]).toMatchObject({
      date: day('2026-03-29'),
      startTime: '10:00',
      endTime: '11:00',
    })
    // 2026-10-25 03:00 CEST -> 02:00 CET; 10:00 local is +01:00
    expect(googleEventToBlocks(timed('2026-10-25T09:00:00Z', '2026-10-25T10:00:00Z'))[0]).toMatchObject({
      date: day('2026-10-25'),
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('returns [] for missing / unparseable / inverted times', () => {
    expect(googleEventToBlocks({ id: 'e' })).toEqual([])
    expect(googleEventToBlocks(timed('garbage', '2026-05-01T10:00:00Z'))).toEqual([])
    expect(googleEventToBlocks(timed('2026-05-01T10:00:00Z', '2026-05-01T09:00:00Z'))).toEqual([])
  })
})

describe('classifyEvent', () => {
  const marked = (id: string): GoogleEvent => ({
    id: 'g1',
    extendedProperties: { private: { [SALON_APPOINTMENT_KEY]: id } },
  })

  it('marker + matching event id -> site', () => {
    expect(classifyEvent(marked('a1'), () => 'g1')).toEqual({ kind: 'site', appointmentId: 'a1' })
  })
  it('marker + mismatched id -> foreign', () => {
    expect(classifyEvent(marked('a1'), () => 'other')).toEqual({ kind: 'foreign' })
    expect(classifyEvent(marked('a1'), () => null)).toEqual({ kind: 'foreign' })
  })
  it('no marker -> foreign', () => {
    expect(classifyEvent({ id: 'g1' }, () => 'g1')).toEqual({ kind: 'foreign' })
  })
  it('transparent -> ignore', () => {
    expect(classifyEvent({ ...marked('a1'), transparency: 'transparent' }, () => 'g1')).toEqual({ kind: 'ignore' })
  })
})

describe('eventTimesMatch', () => {
  const appt = { date: day('2026-05-01'), startTime: '09:00', endTime: '10:00' }

  it('identical -> true', () => {
    expect(eventTimesMatch(timed('2026-05-01T09:00:00+02:00', '2026-05-01T10:00:00+02:00'), appt)).toBe(true)
  })
  it('15-minute shift -> false', () => {
    expect(eventTimesMatch(timed('2026-05-01T09:15:00+02:00', '2026-05-01T10:15:00+02:00'), appt)).toBe(false)
  })
  it('same wall clock on either side of a DST change compares by Warsaw local time', () => {
    const a = { date: day('2026-03-29'), startTime: '10:00', endTime: '11:00' }
    expect(eventTimesMatch(timed('2026-03-29T10:00:00+02:00', '2026-03-29T11:00:00+02:00'), a)).toBe(true)
    // same instant expressed in UTC
    expect(eventTimesMatch(timed('2026-03-29T08:00:00Z', '2026-03-29T09:00:00Z'), a)).toBe(true)
    // 10:00 at the wrong offset is a different local time
    expect(eventTimesMatch(timed('2026-03-29T10:00:00+01:00', '2026-03-29T11:00:00+01:00'), a)).toBe(false)
  })
  it('all-day event never matches', () => {
    expect(eventTimesMatch({ id: 'e', start: { date: '2026-05-01' }, end: { date: '2026-05-02' } }, appt)).toBe(false)
  })
})

describe('isWithinSyncWindow', () => {
  const today = day('2026-05-01')
  const row = (d: string) => ({ date: day(d), startTime: '10:00', endTime: '11:00', allDay: false })
  it('accepts today and inside the window, rejects past and beyond', () => {
    expect(isWithinSyncWindow(row('2026-05-01'), today, 400)).toBe(true)
    expect(isWithinSyncWindow(row('2026-04-30'), today, 400)).toBe(false)
    expect(isWithinSyncWindow(row('2027-06-06'), today, 400)).toBe(false)
  })
})

describe('needsFullSync', () => {
  const now = new Date('2026-09-21T12:00:00Z')
  it('no token -> false (already a full sync)', () => {
    expect(needsFullSync(null, null, now)).toBe(false)
    expect(needsFullSync(undefined, new Date('2020-01-01'), now)).toBe(false)
  })
  it('token but never fully synced -> true', () => {
    expect(needsFullSync('t', null, now)).toBe(true)
  })
  it('token with a recent full sync -> false', () => {
    expect(needsFullSync('t', new Date('2026-09-15T12:00:00Z'), now)).toBe(false)
  })
  it('token with a full sync older than 7 days -> true', () => {
    expect(needsFullSync('t', new Date('2026-09-14T11:59:00Z'), now)).toBe(true)
  })
})
