import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockOutbox } = vi.hoisted(() => ({
  mockPrisma: {
    masterProfile: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    externalCalendarBlock: { deleteMany: vi.fn() },
  },
  mockOutbox: { clearMasterEventIds: vi.fn(), enqueueBackfillForMaster: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/google-calendar/outbox', () => mockOutbox)

import { setMasterCalendarId } from '@/lib/google-calendar/connect'

beforeEach(() => {
  vi.resetAllMocks()
  mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'mine@x.com' })
  mockPrisma.masterProfile.update.mockResolvedValue({})
  mockOutbox.enqueueBackfillForMaster.mockResolvedValue({ queued: 3 })
})

describe('setMasterCalendarId', () => {
  it('unchanged id -> no uniqueness query and no write', async () => {
    const res = await setMasterCalendarId('m1', 'mine@x.com')
    expect(res).toEqual({ ok: true, queued: 0 })
    expect(mockPrisma.masterProfile.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.masterProfile.update).not.toHaveBeenCalled()
  })

  it("another master's id -> CALENDAR_ID_IN_USE, nothing written", async () => {
    mockPrisma.masterProfile.findFirst.mockResolvedValue({ id: 'p2' })
    const res = await setMasterCalendarId('m1', 'taken@x.com')
    expect(res).toEqual({ ok: false, code: 'CALENDAR_ID_IN_USE' })
    expect(mockPrisma.masterProfile.findFirst).toHaveBeenCalledWith({
      where: { googleCalendarId: 'taken@x.com', userId: { not: 'm1' } },
      select: { id: true },
    })
    expect(mockPrisma.masterProfile.update).not.toHaveBeenCalled()
  })

  it('free id -> writes, clears event ids and backfills', async () => {
    mockPrisma.masterProfile.findFirst.mockResolvedValue(null)
    const res = await setMasterCalendarId('m1', 'free@x.com')
    expect(res).toEqual({ ok: true, queued: 3 })
    expect(mockPrisma.masterProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'm1' }, data: expect.objectContaining({ googleCalendarId: 'free@x.com' }) }),
    )
    expect(mockOutbox.clearMasterEventIds).toHaveBeenCalledWith('m1')
    expect(mockOutbox.enqueueBackfillForMaster).toHaveBeenCalledWith('m1')
  })

  it('id change deletes the master blocks and nulls the sync token', async () => {
    mockPrisma.masterProfile.findFirst.mockResolvedValue(null)
    await setMasterCalendarId('m1', 'free@x.com')
    expect(mockPrisma.masterProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleSyncToken: null }) }),
    )
    expect(mockPrisma.externalCalendarBlock.deleteMany).toHaveBeenCalledWith({ where: { masterId: 'm1' } })
  })

  it('disconnect deletes the master blocks and nulls the sync token', async () => {
    const res = await setMasterCalendarId('m1', '  ')
    expect(res).toEqual({ ok: true, queued: 0 })
    expect(mockPrisma.masterProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleCalendarId: null, googleSyncToken: null }),
      }),
    )
    expect(mockPrisma.externalCalendarBlock.deleteMany).toHaveBeenCalledWith({ where: { masterId: 'm1' } })
  })
})
