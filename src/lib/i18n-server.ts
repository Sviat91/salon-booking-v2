/**
 * Server-only i18n helper for Server Components / Server Actions, which cannot
 * use the `useTranslation()` hook or read `localStorage`. Reads the `lang`
 * cookie mirrored by `LanguageContext` (see `src/contexts/LanguageContext.tsx`)
 * and returns a fixed-language translator bound to it.
 */
import { cookies } from 'next/headers'
import i18n, { DEFAULT_LANGUAGE, isValidLanguage } from '@/lib/i18n'

export function getServerT() {
  const langCookie = cookies().get('lang')?.value
  const lang = langCookie && isValidLanguage(langCookie) ? langCookie : DEFAULT_LANGUAGE
  return i18n.getFixedT(lang)
}
