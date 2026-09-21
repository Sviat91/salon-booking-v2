import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth, mockPrisma, mockEnqueue, order } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    masterProfile: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn() },
    user: { delete: vi.fn() },
  },
  mockEnqueue: vi.fn(),
  order: [] as string[],
}))

vi.mock('@/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/google-calendar/outbox', () => ({ enqueueAppointmentDelete: mockEnqueue }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/i18n-server', () => ({ getServerT: () => (k: string) => k }))
vi.mock('@/lib/encryption', () => ({ encrypt: vi.fn(), decrypt: vi.fn() }))

import { DELETE } from '../../../../src/app/api/admin/admins/[id]/route'
import { deleteMaster } from '../../../../src/app/admin/masters/actions'

const rows = [
  { id: 'a1', masterId: 'u1', googleEventId: 'e1', clientId: 'c' },
  { id: 'a2', masterId: 'other', googleEventId: 'e2', clientId: 'u1' },
]

beforeEach(() => {
  vi.resetAllMocks()
  order.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockAuth.mockResolvedValue({ user: { id: 'sa', role: 'SUPERADMIN' } })
  mockPrisma.masterProfile.findUnique.mockImplementation(async () => {
    order.push('snapshot-profile')
    return { googleCalendarId: 'cal-u1@x.com' }
  })
  mockPrisma.appointment.findMany.mockImplementation(async () => {
    order.push('snapshot-appts')
    return rows
  })
  mockPrisma.user.delete.mockImplementation(async () => void order.push('delete'))
  mockEnqueue.mockImplementation(async () => void order.push('enqueue'))
})

function check() {
  expect(order).toEqual(['snapshot-profile', 'snapshot-appts', 'delete', 'enqueue', 'enqueue'])
  // Both sides must be snapshotted (order differs between the two call sites, so match order-agnostically).
  const where = mockPrisma.appointment.findMany.mock.calls[0][0].where
  expect(where.googleEventId).toEqual({ not: null })
  expect(where.OR).toHaveLength(2)
  expect(where.OR).toEqual(expect.arrayContaining([{ masterId: 'u1' }, { clientId: 'u1' }]))
  expect(mockEnqueue).toHaveBeenNthCalledWith(1, {
    appointmentId: 'a1',
    masterId: 'u1',
    googleEventId: 'e1',
    calendarId: 'cal-u1@x.com',
  })
  expect(mockEnqueue).toHaveBeenNthCalledWith(2, {
    appointmentId: 'a2',
    masterId: 'other',
    googleEventId: 'e2',
  })
}

describe('hard user delete enqueues Google deletes (master and client rows)', () => {
  it('admins/[id] DELETE', async () => {
    const res = await DELETE(new Request('http://x') as never, { params: { id: 'u1' } })
    expect(res.status).toBe(200)
    check()
  })

  it('deleteMaster', async () => {
    await deleteMaster('u1')
    check()
  })

  it('enqueues nothing when the delete fails', async () => {
    mockPrisma.user.delete.mockRejectedValue(new Error('fk'))
    await expect(DELETE(new Request('http://x') as never, { params: { id: 'u1' } })).rejects.toThrow()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })
})
