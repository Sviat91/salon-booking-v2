/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Note: the old Google-Calendar-backed POST /api/book smoke tests were removed —
// that flow no longer exists (book/route.ts is DB-based now) and is covered
// end-to-end by tests/app/api/book/consent-gate.test.ts.

vi.mock('../../src/lib/availability', () => ({
  getAvailableDays: vi.fn(),
  getDaySlots: vi.fn(),
}))

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    service: {
      findMany: vi.fn(),
    },
    masterProfile: {
      findUnique: vi.fn(),
    },
    masterService: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../src/lib/prisma', () => ({
  default: mockPrisma,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('API smoke checks', () => {
  it('GET /api/availability returns 400 when dates are missing', async () => {
    const { GET } = await import('../../src/app/api/availability/route')
    const req = { url: 'https://example.com/api/availability' }

    const res = await GET(req as any)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: "Missing 'from' and 'until' query parameters",
    })
  })

  it('GET /api/procedures returns global services when no masterId is provided', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      { id: 'svc_1', name_pl: 'Massage', duration: 60, price: 150 },
    ])

    const { GET } = await import('../../src/app/api/procedures/route')
    const req = { url: 'https://example.com/api/procedures' }

    const res = await GET(req as any)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          id: 'svc_1',
          name_pl: 'Massage',
          duration_min: 60,
          price_pln: 150,
          price_default_pln: 150,
          price_override_pln: null,
        },
      ],
    })
    expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
      where: { masterId: null },
      orderBy: { name_pl: 'asc' },
    })
  })
})
