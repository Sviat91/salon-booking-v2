/**
 * Pure resolver for per-locale user-generated content (e.g. `Service.name_*`,
 * `MasterProfile.bio_*`). Framework-free (no React/i18next deps) so it's safe
 * to import from both client and server code — same rationale as `i18n-shared.ts`.
 */
import { DEFAULT_LANGUAGE, Language, SUPPORTED_LANGUAGES } from '@/lib/i18n-shared'

export type LocalizedField = Partial<Record<Language, string | null | undefined>>

/**
 * Resolves the best display value for `lang`: the value for `lang` itself if
 * non-empty; else the default-locale (`pl`) value if non-empty; else the
 * first non-empty value among `SUPPORTED_LANGUAGES`; else `''`.
 */
export function resolveLocalized(field: LocalizedField, lang: Language): string {
  const direct = field[lang]?.trim()
  if (direct) return direct

  const fallback = field[DEFAULT_LANGUAGE]?.trim()
  if (fallback) return fallback

  for (const candidate of SUPPORTED_LANGUAGES) {
    const value = field[candidate]?.trim()
    if (value) return value
  }

  return ''
}

/**
 * Parses a tenant's `enabledLocales` JSON string into a validated, non-empty
 * array of `Language` values (preserving `SUPPORTED_LANGUAGES` order). Falls
 * back to all supported locales on parse failure or an empty/invalid result.
 */
export function parseEnabledLocales(json: string | null | undefined): Language[] {
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        const valid = SUPPORTED_LANGUAGES.filter((lang) => parsed.includes(lang))
        if (valid.length > 0) return valid
      }
    } catch {
      // fall through to default below
    }
  }

  return [...SUPPORTED_LANGUAGES]
}
