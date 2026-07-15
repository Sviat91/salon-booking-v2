import { describe, it, expect } from 'vitest'
import { apiErrorKey, KNOWN_ERROR_CODES } from '@/lib/errors/apiErrorKey'

describe('apiErrorKey', () => {
  it('maps every enumerated code to its own errors.<code> key', () => {
    for (const code of KNOWN_ERROR_CODES) {
      expect(apiErrorKey(code)).toBe(`errors.${code}`)
    }
  })

  it('maps a known code to its errors.* key', () => {
    expect(apiErrorKey('BOOKING_NOT_FOUND')).toBe('errors.BOOKING_NOT_FOUND')
  })

  it('maps RATE_LIMITED and TOO_MANY_REQUESTS to their own distinct keys', () => {
    expect(apiErrorKey('RATE_LIMITED')).toBe('errors.RATE_LIMITED')
    expect(apiErrorKey('TOO_MANY_REQUESTS')).toBe('errors.TOO_MANY_REQUESTS')
  })

  it('falls back to errors.generic for an unknown code', () => {
    expect(apiErrorKey('SOME_UNKNOWN_CODE')).toBe('errors.generic')
  })

  it('falls back to errors.generic when code is undefined', () => {
    expect(apiErrorKey(undefined)).toBe('errors.generic')
  })

  it('falls back to errors.generic for an empty string', () => {
    expect(apiErrorKey('')).toBe('errors.generic')
  })
})
