/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma: any = {
    consentRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    appointment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    // Discounts (prisma/AGENTS.md: a schema change requires updating mocks).
    masterProfile: {
      findUnique: vi.fn(),
    },
    masterService: {
      findUnique: vi.fn(),
    },
    discount: {
      findMany: vi.fn(),
    },
    discountRedemption: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  }
  mockPrisma.$transaction = vi.fn(async (cb: any) => cb(mockPrisma))
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

import { POST } from '../../../../src/app/api/book/route'

function createRequest(body: Record<string, unknown>) {
  return {
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    json: vi.fn().mockResolvedValue(body),
  } as any
}

const baseBody = {
  startISO: '2026-04-10T10:00:00+02:00',
  endISO: '2026-04-10T11:00:00+02:00',
  procedureId: 'svc_1',
  masterId: 'master_1',
  name: 'Sviat',
  phone: '+48 501 748 708',
  email: 'user@example.com',
}

describe('POST /api/book consent gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.consentRecord.findMany.mockResolvedValue([])
    mockPrisma.consentRecord.create.mockResolvedValue({ id: 'consent_1' })

    mockPrisma.appointment.findFirst.mockResolvedValue(null)
    mockPrisma.appointment.create.mockResolvedValue({ id: 'app_1' })

    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: 'user_1',
      name: baseBody.name,
      email: baseBody.email,
    })
    mockPrisma.user.update.mockResolvedValue({})

    mockPrisma.service.findFirst.mockResolvedValue({ id: 'svc_1' })
    mockPrisma.service.create.mockResolvedValue({ id: 'svc_fallback' })
    mockPrisma.service.findUnique.mockResolvedValue({ id: 'svc_1', price: 100 })

    mockPrisma.masterProfile.findUnique.mockResolvedValue(null)
    mockPrisma.masterService.findUnique.mockResolvedValue(null)
    mockPrisma.discount.findMany.mockResolvedValue([])
    mockPrisma.discountRedemption.findMany.mockResolvedValue([])
    mockPrisma.discountRedemption.findFirst.mockResolvedValue(null)
    mockPrisma.discountRedemption.create.mockResolvedValue({ id: 'redemption_1' })
  })

  it('returns CONSENT_REQUIRED when valid consent is missing and consents are not provided', async () => {
    const res = await POST(createRequest(baseBody))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('CONSENT_REQUIRED')
    expect(mockPrisma.appointment.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.consentRecord.create).not.toHaveBeenCalled()
  })

  it('creates consent record and books appointment when required consents are provided', async () => {
    const res = await POST(
      createRequest({
        ...baseBody,
        consents: {
          dataProcessing: true,
          terms: true,
          notifications: true,
        },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.eventId).toBe('app_1')
    expect(mockPrisma.consentRecord.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(1)
  })

  it('books without new consent record when existing valid consent is found', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      {
        id: 'consent_existing',
        consentDate: new Date('2026-04-01T10:00:00.000Z'),
        emailNormalized: 'user@example.com',
        consentPrivacyV10: true,
        consentTermsV10: true,
        consentWithdrawnDate: null,
        erasureDate: null,
      },
    ])

    const res = await POST(createRequest(baseBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.eventId).toBe('app_1')
    expect(mockPrisma.consentRecord.create).not.toHaveBeenCalled()
    expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(1)
  })

  it('persists clientLanguage from a valid language field', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      {
        id: 'consent_existing',
        consentDate: new Date('2026-04-01T10:00:00.000Z'),
        emailNormalized: 'user@example.com',
        consentPrivacyV10: true,
        consentTermsV10: true,
        consentWithdrawnDate: null,
        erasureDate: null,
      },
    ])

    const res = await POST(createRequest({ ...baseBody, language: 'uk' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.eventId).toBe('app_1')
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientLanguage: 'uk' }) })
    )
  })

  it('defaults clientLanguage to pl for invalid or missing language', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      {
        id: 'consent_existing',
        consentDate: new Date('2026-04-01T10:00:00.000Z'),
        emailNormalized: 'user@example.com',
        consentPrivacyV10: true,
        consentTermsV10: true,
        consentWithdrawnDate: null,
        erasureDate: null,
      },
    ])

    const resInvalid = await POST(createRequest({ ...baseBody, language: 'xx' }))
    expect(resInvalid.status).toBe(200)
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientLanguage: 'pl' }) })
    )

    mockPrisma.appointment.create.mockClear()

    const resMissing = await POST(createRequest({ ...baseBody }))
    expect(resMissing.status).toBe(200)
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientLanguage: 'pl' }) })
    )
  })
})

