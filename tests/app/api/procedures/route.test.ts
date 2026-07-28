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
    // Discounts (prisma/AGENTS.md: a schema change requires updating mocks).
    discount: {
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
    mockPrisma.discount.findMany.mockResolvedValue([])
  })

  it('returns effective, default and override price for assigned master services, with null discount fields when none apply', async () => {
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
        discount_percent: null,
        discount_label: null,
        price_after_discount_pln: null,
      },
    ])
  })

  it('populates discount fields when an eligible catalog-stage discount exists', async () => {
    mockPrisma.masterProfile.findUnique.mockResolvedValue({ id: 'mp_1' })
    mockPrisma.masterService.findMany.mockResolvedValue([
      {
        priceOverride: null,
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
    mockPrisma.discount.findMany.mockResolvedValue([
      {
        id: 'disc_1',
        label: 'Happy hour',
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
      },
    ])

    const res = await GET({ url: 'http://localhost/api/procedures?masterId=master_1' } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items[0]).toMatchObject({
      discount_percent: 20,
      discount_label: 'Happy hour',
      price_after_discount_pln: 120,
    })
  })

  it('returns global services with null override and null discount fields when masterId is missing', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      { id: 'svc_2', name_pl: 'Classic M', name_en: null, name_uk: null, duration: 90, price: 150 },
    ])

    const res = await GET({ url: 'http://localhost/api/procedures' } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.service.findMany).toHaveBeenCalledTimes(1)
    // masterId absent: the discount layer must never be called.
    expect(mockPrisma.discount.findMany).not.toHaveBeenCalled()
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
        discount_percent: null,
        discount_label: null,
        price_after_discount_pln: null,
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
