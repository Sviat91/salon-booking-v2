import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockClient, mockConfig } = vi.hoisted(() => ({
  mockPrisma: {
    appointment: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    masterProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
  mockClient: {
    deleteEvent: vi.fn(),
    insertEvent: vi.fn(),
    patchEvent: vi.fn(),
  },
  mockConfig: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/tenant', () => ({ getTenantConfig: mockConfig }))
vi.mock('@/lib/google-calendar/client', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/google-calendar/client')>()),
  ...mockClient,
}))

import { GoogleApiError } from '@/lib/google-calendar/client'
import { processSyncTask } from '@/lib/google-calendar/push'

const FUTURE = new Date(Date.now() + 5 * 24 * 3600 * 1000)

function task(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    appointmentId: 'a1',
    masterId: 'new-master',
    operation: 'UPSERT',
    googleEventId: null,
    calendarId: null,
    staleCalendarId: null,
    staleGoogleEventId: null,
    ...over,
  } as never
}

function appointment(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    status: 'CONFIRMED',
    date: FUTURE,
    startTime: '10:00',
    endTime: '11:00',
    googleEventId: null,
    notes: null,
    client: { name: 'Anna', phone: '+48123456789' },
    master: { name: 'Master' },
    service: { name_pl: 'Manicure', name_en: null, name_uk: null },
    ...over,
  }
}

const order: string[] = []

beforeEach(() => {
  vi.resetAllMocks()
  order.length = 0
  mockConfig.mockResolvedValue({ brandName: 'Salon' })
  mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'new@x.com' })
  mockPrisma.masterProfile.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.appointment.update.mockResolvedValue({})
  mockPrisma.appointment.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.appointment.findUnique.mockResolvedValue(appointment())
  mockClient.deleteEvent.mockImplementation(async () => void order.push('delete'))
  mockClient.insertEvent.mockImplementation(async () => {
    order.push('insert')
    return { id: 'new-ev' }
  })
  mockClient.patchEvent.mockResolvedValue({ id: 'x' })
})

describe('processSyncTask - stale event (master reassignment)', () => {
  const stale = { staleCalendarId: 'old@x.com', staleGoogleEventId: 'old-ev' }

  it('deletes the stale event before inserting into the new calendar', async () => {
    const res = await processSyncTask(task(stale))
    expect(res).toEqual({ ok: true })
    expect(order).toEqual(['delete', 'insert'])
    expect(mockClient.deleteEvent).toHaveBeenCalledWith('old@x.com', 'old-ev')
    expect(mockClient.insertEvent.mock.calls[0][0]).toBe('new@x.com')
    // googleEventId cleared only if it still equals the stale id
    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', googleEventId: 'old-ev' },
      data: { googleEventId: null },
    })
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { googleEventId: 'new-ev' },
    })
  })

  it('a failing stale delete keeps the task retryable and inserts nothing', async () => {
    mockClient.deleteEvent.mockRejectedValue(new GoogleApiError(503, '', 'down'))
    const res = await processSyncTask(task(stale))
    expect(res).toMatchObject({ ok: false, retryable: true })
    expect(mockClient.insertEvent).not.toHaveBeenCalled()
    expect(mockPrisma.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('finishes without inserting when the new master has no calendar', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: null })
    const res = await processSyncTask(task(stale))
    expect(res).toEqual({ ok: true })
    expect(mockClient.deleteEvent).toHaveBeenCalledTimes(1)
    expect(mockClient.insertEvent).not.toHaveBeenCalled()
  })

  it('a DELETE task still removes a pending stale event and skips the duplicate delete', async () => {
    const res = await processSyncTask(
      task({ ...stale, operation: 'DELETE', googleEventId: 'old-ev', calendarId: 'new@x.com' }),
    )
    expect(res).toEqual({ ok: true })
    expect(mockClient.deleteEvent).toHaveBeenCalledTimes(1)
    expect(mockClient.deleteEvent).toHaveBeenCalledWith('old@x.com', 'old-ev')
  })
})

describe('processSyncTask - pull cursor', () => {
  it('a successful push marks status ok but never writes googleSyncedAt', async () => {
    const res = await processSyncTask(task({}))
    expect(res).toEqual({ ok: true })
    expect(mockPrisma.masterProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'new-master' },
      data: { googleSyncStatus: 'ok', googleSyncError: null },
    })
  })
})

describe('processSyncTask - stale edge cases', () => {
  const stale = { staleCalendarId: 'old@x.com', staleGoogleEventId: 'old-ev' }

  it('a DELETE task whose googleEventId differs from the stale one deletes both events', async () => {
    const res = await processSyncTask(
      task({ ...stale, operation: 'DELETE', googleEventId: 'other-ev', calendarId: 'new@x.com' }),
    )
    expect(res).toEqual({ ok: true })
    expect(mockClient.deleteEvent).toHaveBeenCalledTimes(2)
    expect(mockClient.deleteEvent).toHaveBeenNthCalledWith(1, 'old@x.com', 'old-ev')
    expect(mockClient.deleteEvent).toHaveBeenNthCalledWith(2, 'new@x.com', 'other-ev')
  })

  // The real deleteEvent swallows 404/410 (covered in client.test.ts), so it resolves here.
  it.each([404, 410])('a stale delete answered with %i counts as success and the insert follows', async () => {
    mockClient.deleteEvent.mockImplementation(async () => {
      order.push('delete')
    })
    const res = await processSyncTask(task(stale))
    expect(res).toEqual({ ok: true })
    expect(order).toEqual(['delete', 'insert'])
  })
})

describe('processSyncTask - basic flows', () => {
  it('inserts a new event and stores its id', async () => {
    expect(await processSyncTask(task())).toEqual({ ok: true })
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { googleEventId: 'new-ev' },
    })
  })

  it('patches an existing event', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appointment({ googleEventId: 'ev9' }))
    await processSyncTask(task())
    expect(mockClient.patchEvent.mock.calls[0].slice(0, 2)).toEqual(['new@x.com', 'ev9'])
    expect(mockClient.insertEvent).not.toHaveBeenCalled()
  })

  it('tolerates the appointment being deleted after insert (P2025) and cleans the orphan event', async () => {
    mockPrisma.appointment.update.mockRejectedValue(Object.assign(new Error('gone'), { code: 'P2025' }))
    expect(await processSyncTask(task())).toEqual({ ok: true })
    expect(mockClient.deleteEvent).toHaveBeenCalledWith('new@x.com', 'new-ev')
  })

  it('classifies errors: 403 non-quota is non-retryable', async () => {
    mockClient.insertEvent.mockRejectedValue(new GoogleApiError(403, 'forbidden', 'no'))
    expect(await processSyncTask(task())).toMatchObject({ ok: false, retryable: false })
  })
})
