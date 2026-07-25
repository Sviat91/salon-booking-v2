import { describe, it, expect } from 'vitest'
import { hasAnyEnabledLocaleValue } from '@/lib/localized-content'

describe('hasAnyEnabledLocaleValue', () => {
  it('is true when only en is filled and en is enabled', () => {
    expect(hasAnyEnabledLocaleValue({ en: 'Hello' }, ['pl', 'en'])).toBe(true)
  })

  it('is false when only pl is filled but pl is not in enabledLocales', () => {
    expect(hasAnyEnabledLocaleValue({ pl: 'Witaj' }, ['en', 'uk'])).toBe(false)
  })

  it('is true when pl is filled and pl is enabled (no locale is privileged, but pl still counts)', () => {
    expect(hasAnyEnabledLocaleValue({ pl: 'Witaj' }, ['pl'])).toBe(true)
  })

  it('is false for whitespace-only values', () => {
    expect(hasAnyEnabledLocaleValue({ pl: '   ', en: '\n\t' }, ['pl', 'en'])).toBe(false)
  })

  it('is false for an empty field object', () => {
    expect(hasAnyEnabledLocaleValue({}, ['pl', 'en', 'uk'])).toBe(false)
  })

  it('is false for an empty enabledLocales list even when values are present', () => {
    expect(hasAnyEnabledLocaleValue({ pl: 'Witaj', en: 'Hello' }, [])).toBe(false)
  })
})
