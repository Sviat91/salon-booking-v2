/**
 * Language-parametric i18n translator for the Telegram client bot.
 * Mirrors `src/lib/i18n-server.ts`'s dedicated-instance pattern (core `i18next`
 * only, no `react-i18next`), but exposes a fixed-language translator for an
 * arbitrary `Language` instead of reading a request cookie — the bot picks its
 * language from the chat, not from `next/headers`.
 */
import i18next from 'i18next'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n-shared'
import pl from '@/locales/pl.json'
import uk from '@/locales/uk.json'
import en from '@/locales/en.json'

const botI18n = i18next.createInstance()
let initialized = false

function ensureInitialized() {
  if (initialized) return
  botI18n.init({
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

/** Returns a fixed-language translator for the bot's `bot.*` (and any other) keys. */
export function botT(lang: Language) {
  ensureInitialized()
  return botI18n.getFixedT(lang)
}
