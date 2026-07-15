/**
 * Date formatting utilities
 * Centralized Intl.DateTimeFormat factories for consistent date/time display.
 * Locale-aware: pass a BCP-47 locale (see `localeFor()` in `src/lib/i18n.ts`) to
 * render in the active UI language. Defaults to `pl-PL` for backward compatibility.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    formatterCache.set(key, formatter)
  }
  return formatter
}

/**
 * Time formatter, HH:mm (24-hour format)
 * @example "14:30", "09:15"
 */
export function getTimeFormatter(locale = 'pl-PL'): Intl.DateTimeFormat {
  return getFormatter(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Full date formatter: "weekday, day month year"
 * @example "poniedziałek, 15 stycznia 2024"
 */
export function getFullDateFormatter(locale = 'pl-PL'): Intl.DateTimeFormat {
  return getFormatter(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Date formatter (no year): "weekday, day month"
 * @example "poniedziałek, 15 stycznia"
 */
export function getDateFormatter(locale = 'pl-PL'): Intl.DateTimeFormat {
  return getFormatter(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Short date formatter: "day.month.year"
 * @example "15.01.2024"
 */
export function getShortDateFormatter(locale = 'pl-PL'): Intl.DateTimeFormat {
  return getFormatter(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Compact date formatter: "short weekday, day short month"
 * @example "pon, 15 sty"
 */
export function getCompactDateFormatter(locale = 'pl-PL'): Intl.DateTimeFormat {
  return getFormatter(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

// Backward-compatible pl-PL default instances (existing callers are unaffected).
export const timeFormatter = getTimeFormatter()
export const fullDateFormatter = getFullDateFormatter()
export const dateFormatter = getDateFormatter()
export const shortDateFormatter = getShortDateFormatter()
export const compactDateFormatter = getCompactDateFormatter()

/**
 * Format date as ISO date string (YYYY-MM-DD)
 * Locale-independent.
 * @example "2024-01-15"
 */
export function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Format time range
 * @example "14:30–15:30"
 */
export function formatTimeRange(startDate: Date, endDate: Date, locale = 'pl-PL'): string {
  const formatter = getTimeFormatter(locale)
  return `${formatter.format(startDate)}–${formatter.format(endDate)}`
}

/**
 * Format full date with time
 * @example "poniedziałek, 15 stycznia 2024, 14:30"
 */
export function formatFullDateTime(date: Date, locale = 'pl-PL'): string {
  return `${getFullDateFormatter(locale).format(date)}, ${getTimeFormatter(locale).format(date)}`
}

/**
 * Format date with time (without year)
 * @example "poniedziałek, 15 stycznia, 14:30"
 */
export function formatDateTime(date: Date, locale = 'pl-PL'): string {
  return `${getDateFormatter(locale).format(date)}, ${getTimeFormatter(locale).format(date)}`
}
