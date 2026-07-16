import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import pl from '@/locales/pl.json'
import uk from '@/locales/uk.json'
import en from '@/locales/en.json'

export * from './i18n-shared'
import { DEFAULT_LANGUAGE } from './i18n-shared'

const resources = {
  pl: { translation: pl },
  uk: { translation: uk },
  en: { translation: en },
}

// Always start with default language to avoid hydration mismatch
// Language will be synced from localStorage in LanguageContext after mount
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n
