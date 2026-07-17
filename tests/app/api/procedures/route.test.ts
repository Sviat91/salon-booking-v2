/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

import { GET } from '../../../../src/app/api/procedures/route'

describe('GET /api/procedures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns effective, default and override price for assigned master services', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ id: 'mp_1' })
    mockPrisma.masterService.findMany.mockResolvedValue([
      {
        priceOverride: 170,
        service: {
          id: 'svc_1',
          name_pl: 'Pedeciure',
          name_en: 'Pedicure',
          name_uk: 'Педикюр',
          duration: 60,
          price: 150,
        },
      },
    ])

    const res = await GET({ url: 'http://localhost/api/procedures?masterId=master_1' } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toEqual([
      {
        id: 'svc_1',
        name_pl: 'Pedeciure',
        name_en: 'Pedicure',
        name_uk: 'Педикюр',
        duration_min: 60,
        price_pln: 170,
        price_default_pln: 150,
        price_override_pln: 170,
      },
    ])
  })

  it('returns global services with null override when masterId is missing', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      { id: 'svc_2', name_pl: 'Classic M', name_en: null, name_uk: null, duration: 90, price: 150 },
    ])

    const res = await GET({ url: 'http://localhost/api/procedures' } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.service.findMany).toHaveBeenCalledTimes(1)
    expect(body.items).toEqual([
      {
        id: 'svc_2',
        name_pl: 'Classic M',
        name_en: null,
        name_uk: null,
        duration_min: 90,
        price_pln: 150,
        price_default_pln: 150,
        price_override_pln: null,
      },
    ])
  })

  it('returns empty items when database query fails', async () => {
    mockPrisma.service.findMany.mockRejectedValue(new Error('db down'))

    const res = await GET({ url: 'http://localhost/api/procedures' } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ items: [] })
  })
})
