import { describe, it, expect } from 'vitest'
import { phonesMatchE164 } from '@/lib/utils/phone-normalization'

describe('phonesMatchE164', () => {
  it('matches the same +48 number formatted differently', () => {
    expect(phonesMatchE164('+48123456789', '123 456 789')).toBe(true)
  })

  it('matches a bare 9-digit stored number against a +48-prefixed input (no-backfill case)', () => {
    expect(phonesMatchE164('+48123456789', '123456789')).toBe(true)
  })

  it('does not match different country codes sharing the same last 9 digits', () => {
    expect(phonesMatchE164('+48123456789', '+380123456789')).toBe(false)
  })

  it('returns false when either side is null', () => {
    expect(phonesMatchE164(null, '+48123456789')).toBe(false)
    expect(phonesMatchE164('+48123456789', null)).toBe(false)
  })

  it('returns false when either side is empty', () => {
    expect(phonesMatchE164('', '+48123456789')).toBe(false)
    expect(phonesMatchE164('+48123456789', '')).toBe(false)
  })

  it('returns false for garbage input', () => {
    expect(phonesMatchE164('not-a-phone', '+48123456789')).toBe(false)
  })
})
