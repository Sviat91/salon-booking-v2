import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockNotify } = vi.hoisted(() => ({
  mockPrisma: {
    appointment: { findMany: vi.fn() },
    externalCalendarBlock: { findMany: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  mockNotify: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/notifications/internal', () => ({ formatDate: () => '22.09.2026' }))
vi.mock('@/lib/notifications/calendar-conflict', () => ({ notifyCalendarConflict: mockNotify }))

import { detectAndNotifyConflicts, findOverlaps, type TimeEntry } from '@/lib/google-calendar/conflicts'

const e = (id: string, startTime: string, endTime: string, date = '2026-09-22'): TimeEntry => ({
  id,
  kind: 'appointment',
  date,
  startTime,
  endTime,
  label: id,
})

describe('findOverlaps', () => {
  it('touching entries do not overlap', () => {
    expect(findOverlaps([e('a', '10:00', '11:00'), e('b', '11:00', '12:00')])).toEqual([])
  })

  it('detects an overlap', () => {
    const pairs = findOverlaps([e('a', '10:00', '11:00'), e('b', '10:30', '11:30')])
    expect(pairs.map(([x, y]) => [x.id, y.id])).toEqual([['a', 'b']])
  })

  it('emits each pair once', () => {
    expect(findOverlaps([e('a', '10:00', '12:00'), e('b', '11:00', '13:00')])).toHaveLength(1)
  })

  it('never pairs different dates', () => {
    expect(findOverlaps([e('a', '10:00', '11:00'), e('b', '10:00', '11:00', '2026-09-23')])).toEqual([])
  })

  it('three mutually overlapping entries give three pairs', () => {
    expect(
      findOverlaps([e('a', '10:00', '12:00'), e('b', '10:30', '12:30'), e('c', '11:00', '13:00')]),
    ).toHaveLength(3)
  })
})

describe('detectAndNotifyConflicts dedup', () => {
  const date = new Date('2026-09-22T00:00:00.000Z')
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma.appointment.findMany.mockResolvedValue([
      { id: 'a1', startTime: '10:00', endTime: '11:00', client: { name: 'Ann' }, service: { name_pl: 'Manicure' } },
    ])
    mockPrisma.externalCalendarBlock.findMany.mockResolvedValue([
      { id: 'b1', title: 'Doctor', startTime: '10:30', endTime: '11:30', conflictNotifiedAt: new Date() },
    ])
    mockPrisma.user.findUnique.mockResolvedValue({ name: 'Master' })
    mockPrisma.externalCalendarBlock.updateMany.mockResolvedValue({ count: 1 })
  })

  it('without appointmentId an already-notified block is not notified again', async () => {
    await detectAndNotifyConflicts('m1', date)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('with appointmentId a move onto an already-notified block still notifies', async () => {
    await detectAndNotifyConflicts('m1', date, undefined, 'a1')
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })
})
