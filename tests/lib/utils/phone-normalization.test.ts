import { describe, it, expect } from 'vitest'
import { normalizePhoneToE164, normalizePhoneDigitsOnly } from '@/lib/utils/phone-normalization'

describe('normalizePhoneToE164', () => {
  describe('Polish numbers', () => {
    it('should normalize Polish mobile number with spaces', () => {
      expect(normalizePhoneToE164('123 456 789')).toBe('+48123456789')
    })

    it('should normalize Polish mobile number with dashes', () => {
      expect(normalizePhoneToE164('123-456-789')).toBe('+48123456789')
    })

    it('should keep already normalized Polish number', () => {
      expect(normalizePhoneToE164('+48123456789')).toBe('+48123456789')
    })

    it('should normalize Polish number with country code without plus', () => {
      expect(normalizePhoneToE164('48123456789')).toBe('+48123456789')
    })

    it('should handle Polish number with leading zero', () => {
      expect(normalizePhoneToE164('0123456789')).toBe('+48123456789')
    })
  })

  // The old UA-operator heuristic was removed — bare/trunk-0 numbers now
  // default to Poland (+48), regardless of the historical Ukrainian
  // operator prefix. International input WITH a leading '+' (or a full
  // international digit string without '+') is still preserved as-is.
  describe('bare numbers default to Poland (no UA heuristic)', () => {
    it('normalizes a bare mobile number to +48', () => {
      expect(normalizePhoneToE164('50 123 45 67')).toBe('+48501234567')
    })

    it('normalizes a trunk-0 mobile number to +48', () => {
      expect(normalizePhoneToE164('0501234567')).toBe('+48501234567')
    })

    it('normalizes other historical UA operator prefixes to +48', () => {
      expect(normalizePhoneToE164('066 123 45 67')).toBe('+48661234567')
      expect(normalizePhoneToE164('095 123 45 67')).toBe('+48951234567')
    })
  })

  describe('international numbers are preserved', () => {
    it('keeps a Ukrainian number with country code', () => {
      expect(normalizePhoneToE164('+380501234567')).toBe('+380501234567')
    })

    it('treats a full international digit string without + as international', () => {
      expect(normalizePhoneToE164('380501234567')).toBe('+380501234567')
    })

    it('should preserve German number', () => {
      expect(normalizePhoneToE164('+491234567890')).toBe('+491234567890')
    })

    it('should preserve UK number', () => {
      expect(normalizePhoneToE164('+447911123456')).toBe('+447911123456')
    })

    it('should preserve French number', () => {
      expect(normalizePhoneToE164('+33123456789')).toBe('+33123456789')
    })
  })

  describe('Edge cases', () => {
    it('should handle numbers with mixed separators', () => {
      expect(normalizePhoneToE164('123 456-789')).toBe('+48123456789')
    })

    it('should handle numbers with parentheses', () => {
      expect(normalizePhoneToE164('(123) 456-789')).toBe('+48123456789')
    })

    it('should remove all non-digit characters except plus', () => {
      expect(normalizePhoneToE164('+48 (123) 456-789')).toBe('+48123456789')
    })

    it('should throw INVALID_PHONE for numbers that are too short', () => {
      expect(() => normalizePhoneToE164('12')).toThrow('INVALID_PHONE')
    })

    it('should handle empty string', () => {
      expect(normalizePhoneToE164('')).toBe('')
    })

    it('should handle only spaces', () => {
      expect(normalizePhoneToE164('   ')).toBe('')
    })
  })

  describe('Real-world examples', () => {
    it('should normalize typical Polish format', () => {
      expect(normalizePhoneToE164('793 265 142')).toBe('+48793265142')
    })

    it('should normalize Polish landline', () => {
      expect(normalizePhoneToE164('22 123 45 67')).toBe('+48221234567')
    })
  })
})

describe('normalizePhoneDigitsOnly', () => {
  it('strips all non-digit characters', () => {
    expect(normalizePhoneDigitsOnly('+48 123-456-789')).toBe('48123456789')
  })

  it('returns an empty string for null/undefined/empty input', () => {
    expect(normalizePhoneDigitsOnly(null)).toBe('')
    expect(normalizePhoneDigitsOnly(undefined)).toBe('')
    expect(normalizePhoneDigitsOnly('')).toBe('')
  })
})

// Note: phonesMatchE164 comparison behavior is already covered by
// tests/lib/utils/phone-match.test.ts.
