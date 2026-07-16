/**
 * Maps an app `Language` to its `date-fns` `Locale` object, for `format()`/calendar
 * grids that use `date-fns` instead of `Intl.DateTimeFormat` (see `localeFor()` in
 * `src/lib/i18n.ts` for the `Intl`-based equivalent).
 */
import { pl, uk, enGB } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import type { Language } from '@/lib/i18n-shared'

const DATE_FNS_LOCALES: Record<Language, Locale> = { pl, uk, en: enGB }

export function dateFnsLocale(lang: Language): Locale {
  return DATE_FNS_LOCALES[lang]
}
