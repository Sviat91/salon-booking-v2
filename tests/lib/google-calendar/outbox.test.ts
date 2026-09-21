import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockProcess, mockConfig } = vi.hoisted(() => ({
  mockPrisma: {
    calendarSyncTask: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    appointment: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    masterProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
  mockProcess: vi.fn(),
  mockConfig: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/tenant', () => ({ getTenantConfig: mockConfig }))
vi.mock('@/lib/google-calendar/push', () => ({ processSyncTask: mockProcess }))

import {
  drainOutbox,
  enqueueAppointmentDelete,
  enqueueAppointmentSync,
} from '@/lib/google-calendar/outbox'

const T0 = new Date('2026-09-21T10:00:00.000Z')

function task(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    appointmentId: 'a1',
    masterId: 'm1',
    operation: 'UPSERT',
    attempts: 0,
    updatedAt: T0,
    ...over,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  mockConfig.mockResolvedValue({ googleCalendarEnabled: true, googleServiceAccountKey: 'k' })
  mockPrisma.appointment.findUnique.mockResolvedValue({ masterId: 'new-master' })
  mockPrisma.calendarSyncTask.upsert.mockResolvedValue({})
  mockPrisma.calendarSyncTask.deleteMany.mockResolvedValue({ count: 1 })
  mockPrisma.calendarSyncTask.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.masterProfile.updateMany.mockResolvedValue({ count: 1 })
})

describe('enqueueAppointmentSync', () => {
  it('is inert when sync is disabled', async () => {
    mockConfig.mockResolvedValue({ googleCalendarEnabled: false })
    await enqueueAppointmentSync('a1')
    expect(mockPrisma.calendarSyncTask.upsert).not.toHaveBeenCalled()
  })

  it('writes stale fields (resolved from the previous master) on create and update', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'old@x.com' })
    await enqueueAppointmentSync('a1', { previousMasterId: 'old-master', previousGoogleEventId: 'ev1' })

    expect(mockPrisma.masterProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'old-master' },
      select: { googleCalendarId: true },
    })
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.create).toMatchObject({
      masterId: 'new-master',
      operation: 'UPSERT',
      staleCalendarId: 'old@x.com',
      staleGoogleEventId: 'ev1',
    })
    expect(arg.update).toMatchObject({
      masterId: 'new-master',
      staleCalendarId: 'old@x.com',
      staleGoogleEventId: 'ev1',
    })
  })

  it('does not touch stale fields on a later unrelated enqueue', async () => {
    await enqueueAppointmentSync('a1')
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.update).not.toHaveProperty('staleCalendarId')
    expect(arg.update).not.toHaveProperty('staleGoogleEventId')
    expect(arg.create).not.toHaveProperty('staleCalendarId')
  })

  it('does not set stale fields when the previous master had no calendar', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: null })
    await enqueueAppointmentSync('a1', { previousMasterId: 'old-master', previousGoogleEventId: 'ev1' })
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.update).not.toHaveProperty('staleCalendarId')
  })

  it('keeps the FIRST stale pair on a double reassignment (A -> B -> C)', async () => {
    // Task already carries (A's calendar, E); the event is now being moved away from B.
    mockPrisma.calendarSyncTask.findUnique.mockResolvedValue({
      staleCalendarId: 'a@x.com',
      staleGoogleEventId: 'E',
    })
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'b@x.com' })
    await enqueueAppointmentSync('a1', { previousMasterId: 'master-b', previousGoogleEventId: 'E' })
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.update).not.toHaveProperty('staleCalendarId')
    expect(arg.update).not.toHaveProperty('staleGoogleEventId')
    expect(arg.update).toMatchObject({ masterId: 'new-master', operation: 'UPSERT' })
  })

  it('overwrites the stale pair when the previous event id differs from the pending one', async () => {
    mockPrisma.calendarSyncTask.findUnique.mockResolvedValue({
      staleCalendarId: 'a@x.com',
      staleGoogleEventId: 'E',
    })
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'b@x.com' })
    await enqueueAppointmentSync('a1', { previousMasterId: 'master-b', previousGoogleEventId: 'E2' })
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.update).toMatchObject({ staleCalendarId: 'b@x.com', staleGoogleEventId: 'E2' })
  })

  it('never throws', async () => {
    mockPrisma.appointment.findUnique.mockRejectedValue(new Error('db down'))
    await expect(enqueueAppointmentSync('a1')).resolves.toBeUndefined()
  })
})

describe('enqueueAppointmentDelete', () => {
  it('DELETE overwrites a pending UPSERT (upsert update carries operation DELETE)', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'cal@x.com' })
    await enqueueAppointmentDelete({ appointmentId: 'a1', masterId: 'm1', googleEventId: 'ev1' })
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.update).toMatchObject({ operation: 'DELETE', googleEventId: 'ev1', calendarId: 'cal@x.com', attempts: 0 })
    expect(arg.create).toMatchObject({ appointmentId: 'a1', operation: 'DELETE' })
  })

  it('a DELETE upsert over an UPSERT row leaves the stale fields untouched', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ googleCalendarId: 'cal@x.com' })
    await enqueueAppointmentDelete({ appointmentId: 'a1', masterId: 'm1', googleEventId: 'ev1' })
    const arg = mockPrisma.calendarSyncTask.upsert.mock.calls[0][0]
    expect(arg.update).not.toHaveProperty('staleCalendarId')
    expect(arg.update).not.toHaveProperty('staleGoogleEventId')
  })

  it('uses a supplied calendarId without a profile lookup', async () => {
    await enqueueAppointmentDelete({
      appointmentId: 'a1',
      masterId: 'gone',
      googleEventId: 'ev1',
      calendarId: 'snap@x.com',
    })
    expect(mockPrisma.masterProfile.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.calendarSyncTask.upsert.mock.calls[0][0].update.calendarId).toBe('snap@x.com')
  })

  it('skips when there is no google event id', async () => {
    await enqueueAppointmentDelete({ appointmentId: 'a1', masterId: 'm1', googleEventId: null })
    expect(mockPrisma.calendarSyncTask.upsert).not.toHaveBeenCalled()
  })
})

describe('drainOutbox', () => {
  it('deletes a completed task only if unchanged since read (updatedAt guard)', async () => {
    mockPrisma.calendarSyncTask.findMany.mockResolvedValue([task()])
    mockProcess.mockResolvedValue({ ok: true })
    expect(await drainOutbox()).toEqual({ processed: 1, failed: 0 })
    expect(mockPrisma.calendarSyncTask.deleteMany).toHaveBeenCalledWith({ where: { id: 't1', updatedAt: T0 } })
  })

  it('leaves a rewritten task for the next tick without throwing', async () => {
    mockPrisma.calendarSyncTask.findMany.mockResolvedValue([task()])
    mockProcess.mockResolvedValue({ ok: true })
    mockPrisma.calendarSyncTask.deleteMany.mockResolvedValue({ count: 0 })
    await expect(drainOutbox()).resolves.toEqual({ processed: 1, failed: 0 })
  })

  it('backs off a retryable failure with a guarded updateMany', async () => {
    mockPrisma.calendarSyncTask.findMany.mockResolvedValue([task({ attempts: 2 })])
    mockProcess.mockResolvedValue({ ok: false, retryable: true, error: 'boom' })
    await drainOutbox()
    const arg = mockPrisma.calendarSyncTask.updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 't1', updatedAt: T0 })
    expect(arg.data).toMatchObject({ attempts: 3, lastError: 'boom' })
    expect(mockPrisma.calendarSyncTask.deleteMany).not.toHaveBeenCalled()
  })

  it('drops a non-retryable failure (guarded) and marks the master as errored', async () => {
    mockPrisma.calendarSyncTask.findMany.mockResolvedValue([task()])
    mockProcess.mockResolvedValue({ ok: false, retryable: false, error: 'forbidden' })
    await drainOutbox()
    expect(mockPrisma.calendarSyncTask.deleteMany).toHaveBeenCalledWith({ where: { id: 't1', updatedAt: T0 } })
    expect(mockPrisma.masterProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'm1' },
      data: { googleSyncStatus: 'error', googleSyncError: 'forbidden' },
    })
  })

  it('does not mark the master errored when the dropped task was rewritten meanwhile', async () => {
    mockPrisma.calendarSyncTask.findMany.mockResolvedValue([task()])
    mockProcess.mockResolvedValue({ ok: false, retryable: false, error: 'forbidden' })
    mockPrisma.calendarSyncTask.deleteMany.mockResolvedValue({ count: 0 })
    await drainOutbox()
    expect(mockPrisma.masterProfile.updateMany).not.toHaveBeenCalled()
  })

  it('isolates per-task errors: one throwing task does not abandon the rest', async () => {
    mockPrisma.calendarSyncTask.findMany.mockResolvedValue([task({ id: 't1' }), task({ id: 't2' })])
    mockProcess
      .mockResolvedValueOnce({ ok: false, retryable: false, error: 'x' })
      .mockResolvedValueOnce({ ok: true })
    mockPrisma.masterProfile.updateMany.mockRejectedValue(new Error('db'))
    const res = await drainOutbox()
    expect(res).toEqual({ processed: 1, failed: 1 })
    expect(mockPrisma.calendarSyncTask.deleteMany).toHaveBeenLastCalledWith({
      where: { id: 't2', updatedAt: T0 },
    })
  })

  it('does not run two drains concurrently (globalThis guard)', async () => {
    let release!: () => void
    mockPrisma.calendarSyncTask.findMany.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([])
      }),
    )
    const first = drainOutbox()
    expect(await drainOutbox()).toEqual({ processed: 0, failed: 0 })
    release()
    await first
    expect(mockPrisma.calendarSyncTask.findMany).toHaveBeenCalledTimes(1)
  })
})
