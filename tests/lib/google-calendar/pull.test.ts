import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockList, mockNotify, mockOutbox, mockConflicts, mockConfig } = vi.hoisted(() => ({
  mockPrisma: {
    appointment: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    externalCalendarBlock: { deleteMany: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    calendarSyncTask: { findUnique: vi.fn() },
    masterProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
  mockList: vi.fn(),
  mockNotify: { notifyBookingCancellation: vi.fn(), notifyBookingUpdate: vi.fn() },
  mockOutbox: { enqueueAppointmentSync: vi.fn(), enqueueAppointmentDelete: vi.fn(), enqueueSyncForUsers: vi.fn() },
  mockConflicts: vi.fn(),
  mockConfig: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/tenant', () => ({ getTenantConfig: mockConfig }))
vi.mock('@/lib/notifications', () => mockNotify)
vi.mock('@/lib/google-calendar/outbox', () => mockOutbox)
vi.mock('@/lib/google-calendar/conflicts', () => ({ detectAndNotifyConflicts: mockConflicts }))
vi.mock('@/lib/google-calendar/client', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/google-calendar/client')>()),
  listEvents: mockList,
}))

import { GoogleApiError, type GoogleEvent } from '@/lib/google-calendar/client'
import { SALON_APPOINTMENT_KEY } from '@/lib/google-calendar/event-mapping'
import { pullMasterCalendar } from '@/lib/google-calendar/pull'

const APPT_DATE = new Date('2026-10-01T00:00:00.000Z')

const appt = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  masterId: 'm1',
  status: 'CONFIRMED',
  googleEventId: 'ev1',
  serviceId: 's1',
  date: APPT_DATE,
  startTime: '10:00',
  endTime: '11:00',
  client: { name: 'Ann' },
  master: { name: 'Master' },
  service: { name_pl: 'Manicure', name_en: null, name_uk: null },
  ...over,
})

// 2026-10-01 is CEST (UTC+2)
const ev = (id: string, start: string, end: string, marker?: string): GoogleEvent => ({
  id,
  status: 'confirmed',
  start: { dateTime: `2026-10-01T${start}:00+02:00` },
  end: { dateTime: `2026-10-01T${end}:00+02:00` },
  ...(marker ? { extendedProperties: { private: { [SALON_APPOINTMENT_KEY]: marker } } } : {}),
})

const page = (items: GoogleEvent[], extra: Record<string, unknown> = {}) => ({ items, nextSyncToken: 'tok', ...extra })

let profile: Record<string, unknown>

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-21T10:00:00Z'))
  mockConfig.mockResolvedValue({ googleCalendarEnabled: true, googleServiceAccountKey: 'k' })
  profile = { googleCalendarId: 'cal@x.com', googleSyncToken: null, googleFullSyncAt: null }
  mockPrisma.masterProfile.findUnique.mockImplementation(async () => profile)
  mockPrisma.masterProfile.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.appointment.findUnique.mockResolvedValue(null)
  mockPrisma.appointment.findFirst.mockResolvedValue(null)
  mockPrisma.appointment.update.mockResolvedValue({})
  mockPrisma.calendarSyncTask.findUnique.mockResolvedValue(null)
  mockPrisma.externalCalendarBlock.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.externalCalendarBlock.findMany.mockResolvedValue([])
  mockPrisma.externalCalendarBlock.create.mockResolvedValue({ id: 'b1' })
  mockNotify.notifyBookingCancellation.mockResolvedValue(undefined)
  mockNotify.notifyBookingUpdate.mockResolvedValue(undefined)
  mockConflicts.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  // loop guard: pull never enqueues a push
  expect(mockOutbox.enqueueAppointmentSync).not.toHaveBeenCalled()
  expect(mockOutbox.enqueueAppointmentDelete).not.toHaveBeenCalled()
  expect(mockOutbox.enqueueSyncForUsers).not.toHaveBeenCalled()
})

const incrementalProfile = () => {
  profile = { googleCalendarId: 'cal@x.com', googleSyncToken: 'old', googleFullSyncAt: new Date('2026-09-20T00:00:00Z') }
}

describe('pull - Google-side deletion', () => {
  it('cancelled item with only { id, status } cancels via the googleEventId fallback (salon-only notification)', async () => {
    incrementalProfile()
    mockPrisma.appointment.findFirst.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([{ id: 'ev1', status: 'cancelled' }]))
    const res = await pullMasterCalendar('m1')
    expect(res.ok).toBe(true)
    expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { masterId: 'm1', googleEventId: 'ev1' } }),
    )
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: 'CANCELLED', googleEventId: null },
    })
    expect(mockNotify.notifyBookingCancellation).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'google')
  })

  it('a cancelled foreign event only deletes its block', async () => {
    incrementalProfile()
    mockList.mockResolvedValue(page([{ id: 'x9', status: 'cancelled' }]))
    await pullMasterCalendar('m1')
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
    expect(mockPrisma.externalCalendarBlock.deleteMany).toHaveBeenCalledWith({
      where: { masterId: 'm1', googleEventId: 'x9' },
    })
  })
})

describe('pull - site wins while a push is pending', () => {
  beforeEach(() => {
    incrementalProfile()
    mockPrisma.calendarSyncTask.findUnique.mockResolvedValue({ id: 't1' })
  })

  it('skips a Google-side time change', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([ev('ev1', '12:00', '13:00', 'a1')]))
    await pullMasterCalendar('m1')
    expect(mockPrisma.calendarSyncTask.findUnique).toHaveBeenCalledWith({
      where: { appointmentId: 'a1' },
      select: { id: true },
    })
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
    expect(mockNotify.notifyBookingUpdate).not.toHaveBeenCalled()
  })

  it('skips a cancellation', async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([{ id: 'ev1', status: 'cancelled' }]))
    await pullMasterCalendar('m1')
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
    expect(mockNotify.notifyBookingCancellation).not.toHaveBeenCalled()
  })
})

describe('pull - site events', () => {
  beforeEach(incrementalProfile)

  it('echo (matching times) -> no write, no notification', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([ev('ev1', '10:00', '11:00', 'a1')]))
    await pullMasterCalendar('m1')
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
    expect(mockNotify.notifyBookingUpdate).not.toHaveBeenCalled()
    expect(mockNotify.notifyBookingCancellation).not.toHaveBeenCalled()
  })

  it('different times -> appointment updated and notified as google', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([ev('ev1', '12:00', '13:00', 'a1')]))
    await pullMasterCalendar('m1')
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { date: APPT_DATE, startTime: '12:00', endTime: '13:00' },
    })
    expect(mockNotify.notifyBookingUpdate).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ startTime: '10:00' }),
      'google',
    )
  })

  it('duplicated marker with a googleEventId mismatch is treated as foreign -> block upserted', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([ev('dup', '12:00', '13:00', 'a1')]))
    await pullMasterCalendar('m1')
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
    expect(mockPrisma.externalCalendarBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleEventId: 'dup', masterId: 'm1' }) }),
    )
  })
})

describe('pull - sync token handling', () => {
  it('stores nextSyncToken only after all pages are applied', async () => {
    mockList
      .mockResolvedValueOnce({ items: [ev('x1', '10:00', '11:00')], nextPageToken: 'p2' })
      .mockResolvedValueOnce({ items: [ev('x2', '12:00', '13:00')], nextSyncToken: 'final' })
    const res = await pullMasterCalendar('m1')
    expect(res.ok).toBe(true)
    expect(mockPrisma.externalCalendarBlock.create).toHaveBeenCalledTimes(2)
    const writes = mockPrisma.masterProfile.updateMany.mock.calls.map((c) => c[0].data)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ googleSyncToken: 'final', googleSyncStatus: 'ok' })
  })

  it('does not store a token when a page fails', async () => {
    mockList
      .mockResolvedValueOnce({ items: [ev('x1', '10:00', '11:00')], nextPageToken: 'p2' })
      .mockRejectedValueOnce(new GoogleApiError(500, '', 'boom'))
    const res = await pullMasterCalendar('m1')
    expect(res.ok).toBe(false)
    expect(mockPrisma.externalCalendarBlock.create).not.toHaveBeenCalled()
    const writes = mockPrisma.masterProfile.updateMany.mock.calls.map((c) => c[0].data)
    expect(writes.some((d) => 'googleSyncToken' in d)).toBe(false)
    expect(writes[0]).toMatchObject({ googleSyncStatus: 'error' })
  })

  it.each([400, 410])('%i on a syncToken request clears the token without throwing', async (status) => {
    incrementalProfile()
    mockList.mockRejectedValue(new GoogleApiError(status, '', 'gone'))
    const res = await pullMasterCalendar('m1')
    expect(res).toEqual({ ok: true })
    expect(mockPrisma.masterProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'm1' },
      data: { googleSyncToken: null },
    })
  })

  it('a stale full sync (> 7 days) drops the token and does a full (timeMin) request', async () => {
    profile = { googleCalendarId: 'cal@x.com', googleSyncToken: 'old', googleFullSyncAt: new Date('2026-09-01T00:00:00Z') }
    mockList.mockResolvedValue(page([]))
    await pullMasterCalendar('m1')
    const params = mockList.mock.calls[0][1]
    expect(params.syncToken).toBeUndefined()
    expect(params.timeMin).toBeDefined()
    const data = mockPrisma.masterProfile.updateMany.mock.calls[0][0].data
    expect(data.googleFullSyncAt).toBeInstanceOf(Date)
  })

  it('an incremental sync does not touch googleFullSyncAt', async () => {
    incrementalProfile()
    mockList.mockResolvedValue(page([]))
    await pullMasterCalendar('m1')
    expect(mockList.mock.calls[0][1].syncToken).toBe('old')
    expect(mockPrisma.masterProfile.updateMany.mock.calls[0][0].data).not.toHaveProperty('googleFullSyncAt')
  })
})

describe('pull - full sync cleanup', () => {
  const notInCalls = () =>
    mockPrisma.externalCalendarBlock.deleteMany.mock.calls.filter((c) => c[0]?.where?.googleEventId?.notIn)

  it('deletes blocks missing from the feed', async () => {
    mockList.mockResolvedValue(page([ev('x1', '10:00', '11:00')]))
    await pullMasterCalendar('m1')
    expect(notInCalls()).toHaveLength(1)
    expect(notInCalls()[0][0]).toEqual({ where: { masterId: 'm1', googleEventId: { notIn: ['x1'] } } })
  })

  it('does not delete when the feed was truncated', async () => {
    mockList.mockResolvedValue({ items: [], nextPageToken: 'more' })
    await pullMasterCalendar('m1')
    expect(mockList).toHaveBeenCalledTimes(20)
    expect(notInCalls()).toHaveLength(0)
    expect(mockPrisma.masterProfile.updateMany.mock.calls[0][0].data).toMatchObject({ googleSyncToken: null })
    expect(mockPrisma.masterProfile.updateMany.mock.calls[0][0].data).not.toHaveProperty('googleFullSyncAt')
  })

  it('does not delete when the feed errored', async () => {
    mockList.mockRejectedValue(new GoogleApiError(500, '', 'boom'))
    await pullMasterCalendar('m1')
    expect(notInCalls()).toHaveLength(0)
  })

  it('a throw in loadAppointment does not wipe that event block (M4)', async () => {
    mockPrisma.appointment.findUnique.mockRejectedValue(new Error('db down'))
    mockList.mockResolvedValue(page([ev('x1', '10:00', '11:00', 'a1')]))
    const res = await pullMasterCalendar('m1')
    expect(res.ok).toBe(true)
    expect(notInCalls()[0][0].where.googleEventId.notIn).toContain('x1')
  })

  it('an event classified as site is not kept as foreign', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appt())
    mockList.mockResolvedValue(page([ev('ev1', '10:00', '11:00', 'a1')]))
    await pullMasterCalendar('m1')
    expect(notInCalls()[0][0].where.googleEventId.notIn).toEqual([])
  })
})
