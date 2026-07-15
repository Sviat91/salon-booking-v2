import { describe, it, expect } from 'vitest'
import {
  normalizeNameForMatching,
  normalizeEmailForMatching,
  normalizeSearchQuery,
  normalizeTextWithCyrillicConversion,
} from '@/lib/utils/string-normalization'

// Note: the old comprehensive `normalizeString` transliterator (full
// Cyrillic → Latin, Polish diacritic folding, e.g. Київ→kyiv, Łódź→lodz,
// Александр→aleksandr) no longer exists. It was replaced by these narrower,
// purpose-specific utilities — normalizeTextWithCyrillicConversion only
// maps a partial set of homoglyph-like Cyrillic letters and does not fold
// Polish diacritics.

describe('normalizeNameForMatching', () => {
  it('collapses internal whitespace and lowercases', () => {
    expect(normalizeNameForMatching('  John   Doe  ')).toBe('john doe')
  })

  it('preserves hyphenated names', () => {
    expect(normalizeNameForMatching('Anna-Maria')).toBe('anna-maria')
  })

  it('handles an empty string', () => {
    expect(normalizeNameForMatching('')).toBe('')
  })
})

describe('normalizeEmailForMatching', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmailForMatching('  User@Example.COM  ')).toBe('user@example.com')
  })
})

describe('normalizeSearchQuery', () => {
  it('collapses internal whitespace and lowercases', () => {
    expect(normalizeSearchQuery('  Hello   World!  ')).toBe('hello world!')
  })
})

describe('normalizeTextWithCyrillicConversion', () => {
  it('lowercases and trims a pure-Latin string (no cyrillic to convert)', () => {
    expect(normalizeTextWithCyrillicConversion('  Anna  ')).toBe('anna')
  })

  it('only trims — does not collapse internal whitespace (unlike name/search normalizers)', () => {
    expect(normalizeTextWithCyrillicConversion('  John   Doe  ')).toBe('john   doe')
  })

  it('converts a string made only of mapped cyrillic letters', () => {
    expect(normalizeTextWithCyrillicConversion('мама')).toBe('mama')
  })

  it('leaves unmapped cyrillic letters untouched (partial map, not full transliteration)', () => {
    // а→a, л unmapped, е→e, к→k, с→c, а→a, н→h, д unmapped, р→p
    expect(normalizeTextWithCyrillicConversion('Александр')).toBe('aлekcahдp')
  })
})
