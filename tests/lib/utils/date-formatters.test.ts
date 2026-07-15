import { describe, it, expect } from 'vitest'
import {
  getTimeFormatter,
  getFullDateFormatter,
  formatTimeRange,
  formatFullDateTime,
  formatISODate,
  timeFormatter,
  fullDateFormatter,
} from '@/lib/utils/date-formatters'

const sampleDate = new Date('2024-01-15T14:30:00Z')

describe('date-formatters (locale-aware)', () => {
  it('defaults to pl-PL formatting when no locale is passed', () => {
    expect(formatTimeRange(sampleDate, sampleDate)).toBe(
      `${timeFormatter.format(sampleDate)}–${timeFormatter.format(sampleDate)}`
    )
  })

  it('formats month/weekday names differently per locale', () => {
    const pl = getFullDateFormatter('pl-PL').format(sampleDate)
    const uk = getFullDateFormatter('uk-UA').format(sampleDate)
    const en = getFullDateFormatter('en-GB').format(sampleDate)

    expect(pl).not.toBe(uk)
    expect(pl).not.toBe(en)
    expect(uk).not.toBe(en)
  })

  it('formatFullDateTime respects the passed locale', () => {
    const result = formatFullDateTime(sampleDate, 'en-GB')
    expect(result).toContain(getTimeFormatter('en-GB').format(sampleDate))
  })

  it('keeps existing pl-PL default instances backward-compatible', () => {
    expect(fullDateFormatter.format(sampleDate)).toBe(getFullDateFormatter('pl-PL').format(sampleDate))
  })

  it('formatISODate remains locale-independent', () => {
    expect(formatISODate(sampleDate)).toBe('2024-01-15')
  })
})
