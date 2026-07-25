import { describe, it, expect } from 'vitest'
import {
  parseBlockConfig,
  defaultConfigFor,
  parseBlockSlot,
  serializeBlockSlot,
} from '@/lib/content/blocks'

describe('parseBlockConfig', () => {
  it('returns the default config for malformed JSON', () => {
    expect(parseBlockConfig('photoWidget', '{not json')).toEqual(defaultConfigFor('photoWidget'))
  })

  it('returns the default config for an empty/null value', () => {
    expect(parseBlockConfig('text', null)).toEqual(defaultConfigFor('text'))
    expect(parseBlockConfig('text', undefined)).toEqual(defaultConfigFor('text'))
  })

  it('returns the default config for a wrong shape', () => {
    expect(parseBlockConfig('photoGallery', JSON.stringify({ photos: 'not-an-array' })))
      .toEqual(defaultConfigFor('photoGallery'))
  })

  it('round-trips a valid photoWidget config', () => {
    const config = { style: 'fade' as const, photos: ['/uploads/a.png', '/uploads/b.png'] }
    expect(parseBlockConfig('photoWidget', JSON.stringify(config))).toEqual(config)
  })

  it('round-trips a valid photoGallery config', () => {
    const config = { photos: ['/uploads/a.png'] }
    expect(parseBlockConfig('photoGallery', JSON.stringify(config))).toEqual(config)
  })

  it('round-trips a valid text config', () => {
    const config = { text_pl: 'Witaj', text_en: 'Hello' }
    expect(parseBlockConfig('text', JSON.stringify(config))).toEqual(config)
  })

  it('accepts an already-parsed object, not just a JSON string', () => {
    const config = { photos: ['/uploads/a.png'] }
    expect(parseBlockConfig('photoGallery', config)).toEqual(config)
  })
})

describe('parseBlockSlot', () => {
  it('returns null for null/empty input', () => {
    expect(parseBlockSlot(null)).toBeNull()
    expect(parseBlockSlot(undefined)).toBeNull()
    expect(parseBlockSlot('')).toBeNull()
  })

  it('returns null for garbage JSON', () => {
    expect(parseBlockSlot('{not json')).toBeNull()
  })

  it('returns null for an unrecognised type', () => {
    expect(parseBlockSlot(JSON.stringify({ type: 'bogus', config: {} }))).toBeNull()
  })

  it('parses a valid slot and validates its nested config', () => {
    const slot = { type: 'photoWidget' as const, config: { style: 'strip' as const, photos: ['/uploads/a.png'] } }
    expect(parseBlockSlot(JSON.stringify(slot))).toEqual(slot)
  })

  it('round-trips through serializeBlockSlot', () => {
    const slot = { type: 'text' as const, config: { text_pl: 'Cześć' } }
    expect(parseBlockSlot(serializeBlockSlot(slot))).toEqual(slot)
    expect(serializeBlockSlot(null)).toBe('')
  })
})
