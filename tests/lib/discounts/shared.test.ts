/// <reference types='vitest' />

import { describe, it, expect } from 'vitest'
import {
  normalizeDiscountCode,
  parseWindowDays,
  parseWindowIntervals,
  serializeWindowDays,
  serializeWindowIntervals,
  hhmmToMinutes,
  applyPercent,
  resolveAppointmentPrice,
  discountPercentFromSnapshot,
} from '@/lib/discounts/shared'

describe('normalizeDiscountCode', () => {
  it('trims, collapses whitespace, and uppercases', () => {
    expect(normalizeDiscountCode('  welcome  10  ')).toBe('WELCOME 10')
  })

  it('returns null for null/undefined/empty input', () => {
    expect(normalizeDiscountCode(null)).toBeNull()
    expect(normalizeDiscountCode(undefined)).toBeNull()
    expect(normalizeDiscountCode('')).toBeNull()
    expect(normalizeDiscountCode('   ')).toBeNull()
  })

  it('is idempotent — normalizing an already-normalized code returns the same value', () => {
    const once = normalizeDiscountCode('welcome10')
    expect(normalizeDiscountCode(once)).toBe(once)
  })
})

describe('parseWindowDays', () => {
  it('parses, dedupes, and sorts a valid JSON array', () => {
    expect(parseWindowDays('[3,1,1,0]')).toEqual([0, 1, 3])
  })

  it('drops out-of-range or non-integer entries', () => {
    expect(parseWindowDays('[0,7,-1,2.5,3]')).toEqual([0, 3])
  })

  it('returns [] for null, malformed JSON, or a non-array', () => {
    expect(parseWindowDays(null)).toEqual([])
    expect(parseWindowDays('not json')).toEqual([])
    expect(parseWindowDays('{"a":1}')).toEqual([])
  })
})

describe('parseWindowIntervals', () => {
  it('parses a valid JSON array of intervals', () => {
    expect(parseWindowIntervals('[{"start":"09:00","end":"17:00"}]')).toEqual([{ start: '09:00', end: '17:00' }])
  })

  it('drops entries where end <= start', () => {
    expect(parseWindowIntervals('[{"start":"17:00","end":"09:00"}]')).toEqual([])
    expect(parseWindowIntervals('[{"start":"09:00","end":"09:00"}]')).toEqual([])
  })

  it('drops entries with a malformed time string', () => {
    expect(parseWindowIntervals('[{"start":"9","end":"17:00"}]')).toEqual([])
  })

  it('returns [] for null, malformed JSON, or a non-array', () => {
    expect(parseWindowIntervals(null)).toEqual([])
    expect(parseWindowIntervals('not json')).toEqual([])
    expect(parseWindowIntervals('{"a":1}')).toEqual([])
  })
})

describe('serializeWindowDays / serializeWindowIntervals', () => {
  it('round-trips through parse', () => {
    const days = [0, 2, 4]
    expect(parseWindowDays(serializeWindowDays(days))).toEqual(days)

    const intervals = [{ start: '09:00', end: '17:00' }]
    expect(parseWindowIntervals(serializeWindowIntervals(intervals))).toEqual(intervals)
  })

  it('returns null for an empty array', () => {
    expect(serializeWindowDays([])).toBeNull()
    expect(serializeWindowIntervals([])).toBeNull()
  })
})

describe('hhmmToMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(hhmmToMinutes('09:30')).toBe(570)
    expect(hhmmToMinutes('00:00')).toBe(0)
  })

  it('returns NaN for malformed input', () => {
    expect(hhmmToMinutes('bad')).toBeNaN()
    expect(hhmmToMinutes('')).toBeNaN()
  })
})

describe('applyPercent', () => {
  it('applies a percentage discount, rounded to the nearest cent', () => {
    expect(applyPercent(149.99, 15)).toBe(127.49)
    expect(applyPercent(100, 20)).toBe(80)
  })

  it('clamps percent to 0..100', () => {
    expect(applyPercent(100, -10)).toBe(100)
    expect(applyPercent(100, 150)).toBe(0)
  })

  it('never returns a negative price', () => {
    expect(applyPercent(0, 50)).toBe(0)
  })
})

describe('resolveAppointmentPrice', () => {
  it('prefers finalPrice when present', () => {
    expect(resolveAppointmentPrice(80, 100)).toBe(80)
  })

  it('falls back to livePrice when finalPrice is null or undefined', () => {
    expect(resolveAppointmentPrice(null, 100)).toBe(100)
    expect(resolveAppointmentPrice(undefined, 100)).toBe(100)
  })
})

describe('discountPercentFromSnapshot', () => {
  it('derives the percent from a normal discounted snapshot', () => {
    expect(discountPercentFromSnapshot(100, 80)).toBe(20)
  })

  it('returns null when prices are equal (no discount)', () => {
    expect(discountPercentFromSnapshot(100, 100)).toBeNull()
  })

  it('returns null when originalPrice is 0', () => {
    expect(discountPercentFromSnapshot(0, 0)).toBeNull()
  })

  it('returns null when either input is nullish', () => {
    expect(discountPercentFromSnapshot(null, 80)).toBeNull()
    expect(discountPercentFromSnapshot(100, null)).toBeNull()
    expect(discountPercentFromSnapshot(undefined, undefined)).toBeNull()
  })

  it('returns null when finalPrice is greater than originalPrice (not a discount)', () => {
    expect(discountPercentFromSnapshot(80, 100)).toBeNull()
  })
})
