/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    consentRecord: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

import { POST } from '../../../../../src/app/api/consents/check/route'

function createRequest(body: { phone: string; name: string; email?: string }) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as any
}

describe('POST /api/consents/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns skipConsentModal=true when latest matching consent is active', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      {
        id: 'c_1',
        consentDate: new Date('2026-04-01T10:00:00.000Z'),
        emailNormalized: 'user@example.com',
        consentPrivacyV10: true,
        consentTermsV10: true,
        consentWithdrawnDate: null,
        erasureDate: null,
      },
    ])

    const res = await POST(
      createRequest({
        phone: '+48 501 748 708',
        name: 'Sviatoslav Upirow',
        email: 'user@example.com',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipConsentModal).toBe(true)
    expect(body.hasValidConsent).toBe(true)
    expect(body.consentDate).toBe('2026-04-01T10:00:00.000Z')
  })

  it('returns skipConsentModal=false when no matching consent exists', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([])

    const res = await POST(
      createRequest({
        phone: '+48 501 748 708',
        name: 'Sviatoslav Upirow',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipConsentModal).toBe(false)
    expect(body.hasValidConsent).toBe(false)
  })

  it('treats latest withdrawn record as invalid even if older active record exists', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      {
        id: 'c_2',
        consentDate: new Date('2026-04-02T10:00:00.000Z'),
        emailNormalized: 'user@example.com',
        consentPrivacyV10: false,
        consentTermsV10: false,
        consentWithdrawnDate: new Date('2026-04-02T11:00:00.000Z'),
        erasureDate: null,
      },
      {
        id: 'c_1',
        consentDate: new Date('2026-03-20T10:00:00.000Z'),
        emailNormalized: 'user@example.com',
        consentPrivacyV10: true,
        consentTermsV10: true,
        consentWithdrawnDate: null,
        erasureDate: null,
      },
    ])

    const res = await POST(
      createRequest({
        phone: '+48 501 748 708',
        name: 'Sviatoslav Upirow',
        email: 'user@example.com',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipConsentModal).toBe(false)
    expect(body.hasValidConsent).toBe(false)
  })
})

