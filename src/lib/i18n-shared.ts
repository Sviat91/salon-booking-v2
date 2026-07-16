/**
 * Pure language constants/helpers shared by both the client i18next singleton
 * (`src/lib/i18n.ts`) and the server-only translator (`src/lib/i18n-server.ts`).
 * Has zero React/i18next dependency so it's safe to import from Server Component
 * code without pulling `react-i18next` (and its `React.createContext` call) into
 * the RSC module graph — see `i18n-server.ts` for why that matters.
 */
export const SUPPORTED_LANGUAGES = ['pl', 'uk', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'pl'

export const LANGUAGE_NAMES: Record<Language, string> = {
  pl: 'Polski',
  uk: 'Українська',
  en: 'English',
}

export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language)
}

const BCP47_LOCALES: Record<Language, string> = {
  pl: 'pl-PL',
  uk: 'uk-UA',
  en: 'en-GB',
}

/** Maps an app `Language` to its BCP-47 locale for `Intl`/`Intl.DateTimeFormat` use. */
export function localeFor(lang: Language): string {
  return BCP47_LOCALES[lang]
}
