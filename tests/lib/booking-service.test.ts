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
    mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'existing_app' })

    const result = await createBooking(baseInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT')
    }
    expect(mockPrisma.appointment.create).not.toHaveBeenCalled()
  })

  it('returns CONFLICT when the transactional re-check finds a race-created appointment', async () => {
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

    const result = await createBooking({ ...baseInput, language: 'uk' })

    expect(result.ok).toBe(true)
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
})
