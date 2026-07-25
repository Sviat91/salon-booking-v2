import { describe, it, expect } from 'vitest'
import { slugify, parseVisibility, serializeVisibility } from '@/lib/content/pages-shared'

describe('slugify', () => {
  it('handles Polish diacritics and em dash', () => {
    expect(slugify('Nasze Zdjęcia — Wnętrze')).toBe('nasze-zdjecia-wnetrze')
  })

  it('maps ł/Ł to l', () => {
    expect(slugify('Łazienka i głowa')).toBe('lazienka-i-glowa')
  })

  it('falls back to "page" for punctuation-only input', () => {
    expect(slugify('!!! --- ???')).toBe('page')
  })

  it('falls back to "page" for empty input', () => {
    expect(slugify('')).toBe('page')
  })

  it('caps length at 60 characters', () => {
    const long = 'a'.repeat(100)
    const result = slugify(long)
    expect(result.length).toBeLessThanOrEqual(60)
  })

  it('collapses whitespace/punctuation runs into a single dash', () => {
    expect(slugify('Hello   World!!')).toBe('hello-world')
  })
})

describe('parseVisibility', () => {
  it('returns [] for null/undefined/garbage', () => {
    expect(parseVisibility(null)).toEqual([])
    expect(parseVisibility(undefined)).toEqual([])
    expect(parseVisibility('{not json')).toEqual([])
    expect(parseVisibility(JSON.stringify({ not: 'an array' }))).toEqual([])
  })

  it('parses a valid string array', () => {
    expect(parseVisibility(JSON.stringify(['home', 'booking']))).toEqual(['home', 'booking'])
  })

  it('round-trips through serializeVisibility', () => {
    expect(parseVisibility(serializeVisibility(['home']))).toEqual(['home'])
  })
})
