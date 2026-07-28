/// <reference types='vitest' />

import { describe, it, expect } from 'vitest'
import { isDiscountEligible, pickBestDiscount, explainCode, type EligibilityContext } from '@/lib/discounts/eligibility'
import type { DiscountCandidate, CodeStatus } from '@/lib/discounts/shared'

// 2026-07-27 is a Monday.
const NOW = new Date('2026-07-27T12:00:00.000Z')

function candidate(overrides: Partial<DiscountCandidate> = {}): DiscountCandidate {
  return {
    id: 'd1',
    label: 'Test',
    percent: 10,
    masterId: null,
    requiresCode: false,
    code: null,
    oncePerClient: false,
    windowDays: [],
    windowIntervals: [],
    startDate: null,
    endDate: null,
    active: true,
    serviceIds: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function ctx(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    stage: 'final',
    masterId: 'm1',
    serviceId: 's1',
    slotDayOfWeek: 1, // Monday
    slotStartMinutes: 12 * 60,
    appointmentDate: NOW,
    code: null,
    redeemedDiscountIds: new Set(),
    hasClientIdentity: true,
    ...overrides,
  }
}

describe('isDiscountEligible', () => {
  it('excludes an inactive discount', () => {
    expect(isDiscountEligible(candidate({ active: false }), ctx())).toBe(false)
  })

  it('excludes a discount whose appointment date is before its startDate', () => {
    const c = candidate({ startDate: new Date('2027-01-01T00:00:00.000Z') })
    expect(isDiscountEligible(c, ctx())).toBe(false)
  })

  it('excludes a discount whose appointment date is after its endDate', () => {
    const c = candidate({ endDate: new Date('2026-01-01T00:00:00.000Z') })
    expect(isDiscountEligible(c, ctx())).toBe(false)
  })

  describe('period (startDate/endDate) gates the appointment date, not the booking moment', () => {
    const periodRestricted = candidate({
      startDate: new Date('2026-07-29T00:00:00.000Z'),
      endDate: new Date('2026-07-31T23:59:59.000Z'),
    })

    it('excludes a period-restricted discount at stage catalog (appointment date unknown)', () => {
      expect(isDiscountEligible(periodRestricted, ctx({ stage: 'catalog', appointmentDate: null }))).toBe(false)
    })

    it('includes it once a slot inside the period is chosen, even if "now" is before the period starts', () => {
      const appointmentDate = new Date('2026-07-30T09:00:00.000Z')
      expect(isDiscountEligible(periodRestricted, ctx({ stage: 'final', appointmentDate }))).toBe(true)
    })

    it('excludes it when the chosen slot falls outside the period', () => {
      const appointmentDate = new Date('2026-08-05T09:00:00.000Z')
      expect(isDiscountEligible(periodRestricted, ctx({ stage: 'final', appointmentDate }))).toBe(false)
    })
  })

  it('excludes a discount scoped to a different master', () => {
    const c = candidate({ masterId: 'other-master' })
    expect(isDiscountEligible(c, ctx({ masterId: 'm1' }))).toBe(false)
  })

  it('a global discount (masterId: null) applies to any master', () => {
    const c = candidate({ masterId: null })
    expect(isDiscountEligible(c, ctx({ masterId: 'any-master' }))).toBe(true)
  })

  it('excludes a discount scoped to a different service', () => {
    const c = candidate({ serviceIds: ['s1'] })
    expect(isDiscountEligible(c, ctx({ serviceId: 's2' }))).toBe(false)
  })

  it('includes a discount scoped to the matching service', () => {
    const c = candidate({ serviceIds: ['s1'] })
    expect(isDiscountEligible(c, ctx({ serviceId: 's1' }))).toBe(true)
  })

  describe('happy-hour window', () => {
    const windowed = candidate({ windowDays: [1], windowIntervals: [{ start: '09:00', end: '17:00' }] })

    it('excludes a windowed discount at stage catalog (slot unknown)', () => {
      expect(isDiscountEligible(windowed, ctx({ stage: 'catalog', slotDayOfWeek: null, slotStartMinutes: null }))).toBe(false)
    })

    it('includes a windowed discount at stage slot when day and minute match', () => {
      expect(isDiscountEligible(windowed, ctx({ stage: 'slot', slotDayOfWeek: 1, slotStartMinutes: 12 * 60 }))).toBe(true)
    })

    it('excludes a windowed discount when only the day matches (minute outside range)', () => {
      expect(isDiscountEligible(windowed, ctx({ stage: 'slot', slotDayOfWeek: 1, slotStartMinutes: 20 * 60 }))).toBe(false)
    })

    it('excludes a windowed discount when only the minute matches (wrong day)', () => {
      expect(isDiscountEligible(windowed, ctx({ stage: 'slot', slotDayOfWeek: 2, slotStartMinutes: 12 * 60 }))).toBe(false)
    })

    it('a days-only window (no intervals) is treated as no window — always eligible', () => {
      const daysOnly = candidate({ windowDays: [1], windowIntervals: [] })
      expect(isDiscountEligible(daysOnly, ctx({ stage: 'catalog', slotDayOfWeek: null, slotStartMinutes: null }))).toBe(true)
    })

    it('an hours-only window (no days) is treated as no window — always eligible', () => {
      const hoursOnly = candidate({ windowDays: [], windowIntervals: [{ start: '09:00', end: '17:00' }] })
      expect(isDiscountEligible(hoursOnly, ctx({ stage: 'catalog', slotDayOfWeek: null, slotStartMinutes: null }))).toBe(true)
    })
  })

  describe('requiresCode', () => {
    const coded = candidate({ requiresCode: true, code: 'WELCOME10' })

    it('excludes a code discount at stage catalog', () => {
      expect(isDiscountEligible(coded, ctx({ stage: 'catalog', code: 'WELCOME10' }))).toBe(false)
    })

    it('excludes a code discount at stage slot', () => {
      expect(isDiscountEligible(coded, ctx({ stage: 'slot', code: 'WELCOME10' }))).toBe(false)
    })

    it('excludes a code discount at stage final without a matching code', () => {
      expect(isDiscountEligible(coded, ctx({ stage: 'final', code: null }))).toBe(false)
      expect(isDiscountEligible(coded, ctx({ stage: 'final', code: 'WRONG' }))).toBe(false)
    })

    it('includes a code discount at stage final with the matching code', () => {
      expect(isDiscountEligible(coded, ctx({ stage: 'final', code: 'WELCOME10' }))).toBe(true)
    })
  })

  describe('oncePerClient', () => {
    const once = candidate({ oncePerClient: true })

    it('excludes when the client identity is unknown', () => {
      expect(isDiscountEligible(once, ctx({ stage: 'final', hasClientIdentity: false }))).toBe(false)
    })

    it('excludes when this discount id is already in redeemedDiscountIds', () => {
      expect(
        isDiscountEligible(once, ctx({ stage: 'final', hasClientIdentity: true, redeemedDiscountIds: new Set(['d1']) }))
      ).toBe(false)
    })

    it('includes when the client identity is known and not yet redeemed', () => {
      expect(isDiscountEligible(once, ctx({ stage: 'final', hasClientIdentity: true, redeemedDiscountIds: new Set() }))).toBe(true)
    })
  })

  it('rejects a percent outside 1..100', () => {
    expect(isDiscountEligible(candidate({ percent: 0 }), ctx())).toBe(false)
    expect(isDiscountEligible(candidate({ percent: 101 }), ctx())).toBe(false)
    expect(isDiscountEligible(candidate({ percent: 50.5 as unknown as number }), ctx())).toBe(false)
  })
})

describe('pickBestDiscount', () => {
  it('picks the higher percent between an eligible code and an eligible automatic discount', () => {
    const automatic = candidate({ id: 'auto', percent: 10 })
    const coded = candidate({ id: 'code', percent: 15, requiresCode: true, code: 'SAVE15' })
    const winner = pickBestDiscount([automatic, coded], ctx({ stage: 'final', code: 'SAVE15' }))
    expect(winner?.id).toBe('code')
    expect(winner?.percent).toBe(15)
  })

  it('never sums two eligible discounts', () => {
    const a = candidate({ id: 'a', percent: 10 })
    const b = candidate({ id: 'b', percent: 15, requiresCode: true, code: 'SAVE15' })
    const winner = pickBestDiscount([a, b], ctx({ stage: 'final', code: 'SAVE15' }))
    expect(winner?.percent).toBe(15) // not 25
  })

  it('breaks a percent tie by createdAt ascending', () => {
    const older = candidate({ id: 'older', percent: 10, createdAt: new Date('2026-01-01T00:00:00.000Z') })
    const newer = candidate({ id: 'newer', percent: 10, createdAt: new Date('2026-02-01T00:00:00.000Z') })
    const winner = pickBestDiscount([newer, older], ctx())
    expect(winner?.id).toBe('older')
  })

  it('breaks a percent + createdAt tie by id ascending', () => {
    const sameDate = new Date('2026-01-01T00:00:00.000Z')
    const b = candidate({ id: 'b', percent: 10, createdAt: sameDate })
    const a = candidate({ id: 'a', percent: 10, createdAt: sameDate })
    const winner = pickBestDiscount([b, a], ctx())
    expect(winner?.id).toBe('a')
  })

  it('returns null when nothing is eligible', () => {
    const winner = pickBestDiscount([candidate({ active: false })], ctx())
    expect(winner).toBeNull()
  })
})

describe('explainCode', () => {
  it('returns "none" when no code was submitted', () => {
    expect(explainCode([candidate()], ctx({ code: null }))).toBe('none')
  })

  it('returns "unknown" when no discount has the submitted code', () => {
    expect(explainCode([candidate({ code: 'OTHER', requiresCode: true })], ctx({ code: 'MISSING' }))).toBe('unknown')
  })

  it('returns "inactive" for a matched but inactive discount', () => {
    const c = candidate({ code: 'X', requiresCode: true, active: false })
    expect(explainCode([c], ctx({ code: 'X' }))).toBe('inactive')
  })

  it('returns "expired" for a matched discount outside its date window', () => {
    const c = candidate({ code: 'X', requiresCode: true, endDate: new Date('2020-01-01T00:00:00.000Z') })
    expect(explainCode([c], ctx({ code: 'X' }))).toBe('expired')
  })

  it('returns "not_applicable" for a matched discount scoped to a different master', () => {
    const c = candidate({ code: 'X', requiresCode: true, masterId: 'other' })
    expect(explainCode([c], ctx({ code: 'X', masterId: 'm1' }))).toBe('not_applicable')
  })

  it('returns "not_applicable" for a matched discount scoped to a different service', () => {
    const c = candidate({ code: 'X', requiresCode: true, serviceIds: ['s-other'] })
    expect(explainCode([c], ctx({ code: 'X', serviceId: 's1' }))).toBe('not_applicable')
  })

  it('returns "not_applicable" for a matched discount outside its happy-hour window', () => {
    const c = candidate({ code: 'X', requiresCode: true, windowDays: [1], windowIntervals: [{ start: '09:00', end: '10:00' }] })
    expect(explainCode([c], ctx({ code: 'X', stage: 'final', slotDayOfWeek: 1, slotStartMinutes: 20 * 60 }))).toBe('not_applicable')
  })

  it('returns "already_used" when oncePerClient and identity is unknown', () => {
    const c = candidate({ code: 'X', requiresCode: true, oncePerClient: true })
    expect(explainCode([c], ctx({ code: 'X', hasClientIdentity: false }))).toBe('already_used')
  })

  it('returns "already_used" when oncePerClient and this phone already redeemed it', () => {
    const c = candidate({ id: 'd1', code: 'X', requiresCode: true, oncePerClient: true })
    expect(explainCode([c], ctx({ code: 'X', hasClientIdentity: true, redeemedDiscountIds: new Set(['d1']) }))).toBe('already_used')
  })

  it('returns "valid" when every check passes', () => {
    const c = candidate({ code: 'X', requiresCode: true })
    expect(explainCode([c], ctx({ code: 'X' }))).toBe('valid')
  })

  it('covers every CodeStatus value', () => {
    const all: CodeStatus[] = ['none', 'valid', 'unknown', 'inactive', 'expired', 'not_applicable', 'already_used']
    expect(all).toHaveLength(7)
  })
})
