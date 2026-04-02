/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    appointment: {
      findMany: vi.fn(),
    },
    masterProfile: {
      findUnique: vi.fn(),
    },
    masterService: {
      findMany: vi.fn(),
    },
  },
  mockAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

vi.mock('@/auth', () => ({
  auth: mockAuth,
}))

import { GET } from '../../../../../src/app/api/master/appointments/route'

function createRequest(url = 'http://localhost/api/master/appointments?from=2026-04-01&to=2026-04-30') {
  return { url } as any
}

describe('GET /api/master/appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'master_1', role: 'MASTER' },
    })
  })

  it('returns effective service price with master override', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'a_1',
        date: '2026-04-05T00:00:00.000Z',
        startTime: '09:00',
        endTime: '10:00',
        status: 'CONFIRMED',
        notes: null,
        service: { id: 'svc_1', name: 'Pedeciure', duration: 60, price: 150 },
        client: { id: 'u_1', name: 'Sviat', phone: '+48501748708', email: null },
        master: { masterProfile: { color: '#166534' } },
      },
    ])
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ id: 'mp_1' })
    mockPrisma.masterService.findMany.mockResolvedValue([
      { serviceId: 'svc_1', priceOverride: 170 },
    ])

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.appointments[0].service.price).toBe(170)
  })

  it('keeps default service price when no override exists', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'a_2',
        date: '2026-04-06T00:00:00.000Z',
        startTime: '10:00',
        endTime: '11:00',
        status: 'CONFIRMED',
        notes: null,
        service: { id: 'svc_2', name: 'Classic M', duration: 90, price: 150 },
        client: { id: 'u_2', name: 'Anna', phone: '+48123123123', email: null },
        master: { masterProfile: { color: '#166534' } },
      },
    ])
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ id: 'mp_1' })
    mockPrisma.masterService.findMany.mockResolvedValue([])

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.appointments[0].service.price).toBe(150)
  })

  it('returns 401 for unauthorized user', async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })
})
