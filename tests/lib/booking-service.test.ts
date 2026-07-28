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

import { createBooking } from '../../src/lib/booking-service'

const baseInput = {
  startISO: '2026-04-10T10:00:00+02:00',
  endISO: '2026-04-10T11:00:00+02:00',
  procedureId: 'svc_1',
  masterId: 'master_1',
  name: 'Sviat',
  phone: '+48 501 748 708',
  email: 'user@example.com',
  ip: '127.0.0.1',
  authenticatedUserId: null,
}

const validConsent = [
  {
    id: 'consent_existing',
    consentDate: new Date('2026-04-01T10:00:00.000Z'),
    emailNormalized: 'user@example.com',
    consentPrivacyV10: true,
    consentTermsV10: true,
    consentWithdrawnDate: null,
    erasureDate: null,
  },
]

const activeDiscount = {
  id: 'disc_1',
  label: 'Test discount',
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

describe('createBooking (guest flow)', () => {
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
      name: baseInput.name,
      email: baseInput.email,
    })
    mockPrisma.user.update.mockResolvedValue({})

    mockPrisma.service.findFirst.mockResolvedValue({ id: 'svc_1' })
    mockPrisma.service.create.mockResolvedValue({ id: 'svc_fallback' })
    mockPrisma.service.findUnique.mockResolvedValue({ id: 'svc_1', price: 100 })

    // Discounts: no master price override, no discounts, no prior redemptions.
    mockPrisma.masterProfile.findUnique.mockResolvedValue(null)
    mockPrisma.masterService.findUnique.mockResolvedValue(null)
    mockPrisma.discount.findMany.mockResolvedValue([])
    mockPrisma.discountRedemption.findMany.mockResolvedValue([])
    mockPrisma.discountRedemption.findFirst.mockResolvedValue(null)
    mockPrisma.discountRedemption.create.mockResolvedValue({ id: 'redemption_1' })
  })

  it('returns CONSENT_REQUIRED when valid consent is missing and consents are not provided', async () => {
    const result = await createBooking(baseInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONSENT_REQUIRED')
    }
    expect(mockPrisma.appointment.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.consentRecord.create).not.toHaveBeenCalled()
  })

  it('creates consent record and books appointment when required consents are provided', async () => {
    const result = await createBooking({
      ...baseInput,
      consents: { dataProcessing: true, terms: true, notifications: true },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.appointmentId).toBe('app_1')
    }
    expect(mockPrisma.consentRecord.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(1)
  })

  it('returns CONFLICT without creating an appointment when the slot is already taken', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)
    mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'existing_app' })

    const result = await createBooking(baseInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT')
    }
    expect(mockPrisma.appointment.create).not.toHaveBeenCalled()
  })

  it('returns CONFLICT when the transactional re-check finds a race-created appointment', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)
    // First (pre-transaction) check passes, but the transactional re-check races to a conflict.
    mockPrisma.appointment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'raced_app' })

    const result = await createBooking(baseInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT')
    }
    expect(mockPrisma.appointment.create).not.toHaveBeenCalled()
  })

  it('persists clientLanguage from a valid language field', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)

    const result = await createBooking({ ...baseInput, language: 'uk' })

    expect(result.ok).toBe(true)
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientLanguage: 'uk' }) })
    )
  })

  it('defaults clientLanguage to pl for invalid or missing language', async () => {
    mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)

    const resultInvalid = await createBooking({ ...baseInput, language: 'xx' })
    expect(resultInvalid.ok).toBe(true)
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientLanguage: 'pl' }) })
    )

    mockPrisma.appointment.create.mockClear()

    const resultMissing = await createBooking({ ...baseInput })
    expect(resultMissing.ok).toBe(true)
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientLanguage: 'pl' }) })
    )
  })

  describe('discount snapshot + redemption', () => {
    it('snapshots originalPrice/finalPrice/discountId on the created appointment when no discount applies', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)

      const result = await createBooking(baseInput)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.originalPrice).toBe(100)
        expect(result.finalPrice).toBe(100)
        expect(result.discountPercent).toBeNull()
      }
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ originalPrice: 100, finalPrice: 100, discountId: null }),
        })
      )
      expect(mockPrisma.discountRedemption.create).not.toHaveBeenCalled()
    })

    it('applies the best eligible automatic discount and writes exactly one redemption row', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)
      mockPrisma.discount.findMany.mockResolvedValue([activeDiscount])

      const result = await createBooking(baseInput)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.originalPrice).toBe(100)
        expect(result.finalPrice).toBe(80)
        expect(result.discountPercent).toBe(20)
      }
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ originalPrice: 100, finalPrice: 80, discountId: 'disc_1' }),
        })
      )
      expect(mockPrisma.discountRedemption.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.discountRedemption.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ discountId: 'disc_1', appointmentId: 'app_1' }) })
      )
    })

    it('returns DISCOUNT_INVALID and creates no appointment when a supplied code is unknown', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)

      const result = await createBooking({ ...baseInput, discountCode: 'BADCODE' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('DISCOUNT_INVALID')
      }
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled()
      expect(mockPrisma.discountRedemption.create).not.toHaveBeenCalled()
    })

    it('returns DISCOUNT_INVALID when the in-transaction oncePerClient re-check finds a race-created redemption', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue(validConsent)
      mockPrisma.discount.findMany.mockResolvedValue([{ ...activeDiscount, oncePerClient: true }])
      // Pre-check (outside the transaction): not yet redeemed.
      mockPrisma.discountRedemption.findMany.mockResolvedValue([])
      // In-transaction re-check: a concurrent booking just redeemed it first.
      mockPrisma.discountRedemption.findFirst.mockResolvedValue({ id: 'redemption_existing' })

      const result = await createBooking(baseInput)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('DISCOUNT_INVALID')
      }
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled()
    })
  })
})
