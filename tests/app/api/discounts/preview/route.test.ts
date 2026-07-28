/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    masterProfile: { findUnique: vi.fn() },
    masterService: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    discount: { findMany: vi.fn() },
    discountRedemption: { findMany: vi.fn() },
  },
}))

const rateLimit = vi.fn()

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/cache', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

// Deliberately no @/auth mock — the route must not import @/auth (public route).
import { POST } from '../../../../../src/app/api/discounts/preview/route'

function createRequest(body: unknown) {
  return {
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

const activeDiscount = {
  id: 'disc_1',
  label: 'Automatic 20%',
  percent: 20,
  masterId: null,
  requiresCode: false,
  code: null,
  oncePerClient: false,
  windowDays: null,
  windowIntervals: null,
  startDate: null,
  endDate: null,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  services: [],
}

const codedOncePerClientDiscount = {
  id: 'disc_2',
  label: 'Welcome',
  percent: 15,
  masterId: null,
  requiresCode: true,
  code: 'WELCOME15',
  oncePerClient: true,
  windowDays: null,
  windowIntervals: null,
  startDate: null,
  endDate: null,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  services: [],
}

describe('POST /api/discounts/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    mockPrisma.masterProfile.findUnique.mockResolvedValue(null)
    mockPrisma.masterService.findUnique.mockResolvedValue(null)
    mockPrisma.service.findUnique.mockResolvedValue({ id: 'svc_1', price: 100 })
    mockPrisma.discount.findMany.mockResolvedValue([])
    mockPrisma.discountRedemption.findMany.mockResolvedValue([])
  })

  it('rejects when the IP rate limit is exceeded', async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 31 })

    const res = await POST(createRequest({ masterId: 'm_1', serviceId: 'svc_1' }) as any)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
  })

  it('returns a validation error for a malformed body', async () => {
    const res = await POST(createRequest({ masterId: '' }) as any)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 SERVICE_NOT_FOUND when the service does not resolve', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null)

    const res = await POST(createRequest({ masterId: 'm_1', serviceId: 'missing' }) as any)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.code).toBe('SERVICE_NOT_FOUND')
  })

  it('applies an eligible automatic discount at stage "slot" (startISO present, no code/phone)', async () => {
    mockPrisma.discount.findMany.mockResolvedValue([activeDiscount])

    const res = await POST(
      createRequest({ masterId: 'm_1', serviceId: 'svc_1', startISO: '2026-08-03T10:00:00.000Z' }) as any
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.originalPrice).toBe(100)
    expect(body.finalPrice).toBe(80)
    expect(body.percent).toBe(20)
    expect(body.codeStatus).toBe('none')
  })

  it('accepts a valid promo code at stage "final" (startISO + code)', async () => {
    mockPrisma.discount.findMany.mockResolvedValue([codedOncePerClientDiscount])
    mockPrisma.discountRedemption.findMany.mockResolvedValue([])

    const res = await POST(
      createRequest({
        masterId: 'm_1',
        serviceId: 'svc_1',
        startISO: '2026-08-03T10:00:00.000Z',
        code: 'welcome15',
        phone: '+48501748708',
      }) as any
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.codeStatus).toBe('valid')
    expect(body.finalPrice).toBe(85)
    expect(body.discountId).toBe('disc_2')
  })

  it('reports "already_used" when this phone has already redeemed the oncePerClient discount', async () => {
    mockPrisma.discount.findMany.mockResolvedValue([codedOncePerClientDiscount])
    mockPrisma.discountRedemption.findMany.mockResolvedValue([{ discountId: 'disc_2' }])

    const res = await POST(
      createRequest({
        masterId: 'm_1',
        serviceId: 'svc_1',
        startISO: '2026-08-03T10:00:00.000Z',
        code: 'WELCOME15',
        phone: '+48501748708',
      }) as any
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.codeStatus).toBe('already_used')
    // Not eligible, so the undiscounted price is quoted.
    expect(body.finalPrice).toBe(100)
  })
})
