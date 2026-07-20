/**
 * Pure calendar-grid and month-arithmetic helpers shared by the inline
 * calendar keyboard renderer (`keyboards.ts`) and the date/time wizard
 * handlers (`handlers/datetime.ts`). No I/O, no bot/ctx dependency — keeps
 * both consumers small and testable.
 */
import { localeFor, type Language } from '@/lib/i18n-shared'

/** Shifts a `'YYYY-MM'` month string by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(year, mon - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** First and last calendar day (`'YYYY-MM-DD'`) of a `'YYYY-MM'` month. */
export function monthBounds(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` }
}

/** Monday-first week grid of `'YYYY-MM-DD'` strings (`null` = blank cell) for `month`. */
export function buildMonthGrid(month: string): (string | null)[][] {
  const [year, mon] = month.split('-').map(Number)
  const monthIndex = mon - 1
  const totalDays = new Date(year, mon, 0).getDate()
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7 // Monday=0..Sunday=6

  const cells: (string | null)[] = new Array(firstWeekday).fill(null)
  for (let day = 1; day <= totalDays; day++) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

/** Localized short (2-char) Monday-first weekday initials, e.g. `['Po','Wt',...]`. */
export function weekdayLabels(lang: Language): string[] {
  const formatter = new Intl.DateTimeFormat(localeFor(lang), { weekday: 'short' })
  const labels: string[] = []
  for (let i = 0; i < 7; i++) {
    // 2024-01-01 is a Monday — used only as a Monday reference date.
    labels.push(formatter.format(new Date(2024, 0, 1 + i)).slice(0, 2))
  }
  return labels
}

/** Localized `'Month YYYY'` label for a `'YYYY-MM'` month. */
export function monthLabel(month: string, lang: Language): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(year, mon - 1, 1)
  const label = new Intl.DateTimeFormat(localeFor(lang), { month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
