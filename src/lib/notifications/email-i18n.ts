/**
 * Language-parametric i18n translator for client-facing notification emails.
 * Mirrors `src/lib/telegram-bot/i18n.ts`'s dedicated-instance pattern (core
 * `i18next` only, no `react-i18next`) — email sending happens outside any
 * request/cookie context, so the caller passes the recipient's language
 * explicitly (`Appointment.clientLanguage`) rather than reading a cookie.
 */
import i18next from 'i18next'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n-shared'
import pl from '@/locales/pl.json'
import uk from '@/locales/uk.json'
import en from '@/locales/en.json'

const emailI18n = i18next.createInstance()
let initialized = false

function ensureInitialized() {
  if (initialized) return
  emailI18n.init({
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

/** Returns a fixed-language translator for the `emailNotif.*` keys. */
export function emailT(lang: Language) {
  ensureInitialized()
  return emailI18n.getFixedT(lang)
}
