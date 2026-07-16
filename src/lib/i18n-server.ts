/**
 * Server-only i18n helper for Server Components / Server Actions, which cannot
 * use the `useTranslation()` hook or read `localStorage`. Reads the `lang`
 * cookie mirrored by `LanguageContext` (see `src/contexts/LanguageContext.tsx`)
 * and returns a fixed-language translator bound to it.
 *
 * Uses a dedicated i18next instance (no `react-i18next` binding) rather than the
 * client singleton in `@/lib/i18n` — `initReactI18next` calls `React.createContext`
 * at init time, which breaks Next's "Collecting page data" build phase (a restricted
 * React build with no `createContext`) when pulled into a Server Component's module graph.
 */
import { cookies } from 'next/headers'
import i18next from 'i18next'
import { DEFAULT_LANGUAGE, isValidLanguage, type Language } from '@/lib/i18n-shared'
import pl from '@/locales/pl.json'
import uk from '@/locales/uk.json'
import en from '@/locales/en.json'

const serverI18n = i18next.createInstance()
let initialized = false

function ensureInitialized() {
  if (initialized) return
  serverI18n.init({
    resources: {
      pl: { translation: pl },
      uk: { translation: uk },
      en: { translation: en },
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
  })
  initialized = true
}

/** Resolves the active `Language` for the current request from the `lang` cookie. */
export function getServerLanguage(): Language {
  const langCookie = cookies().get('lang')?.value
  return langCookie && isValidLanguage(langCookie) ? langCookie : DEFAULT_LANGUAGE
}

export function getServerT() {
  ensureInitialized()
  return serverI18n.getFixedT(getServerLanguage())
}
