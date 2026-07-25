/**
 * Pure page helpers for the content pages feature. Framework-free (no React,
 * no Prisma) so both client and server code can import it.
 */

/** The only two `visibility` targets a global page can opt into (AD, spec's Admin & Master UI). */
export const PAGE_VISIBILITY_TARGETS = [
  { id: 'home', labelKey: 'admin.settings.general.homePageLabel' },
  { id: 'booking', labelKey: 'admin.settings.general.bookingPageLabel' },
] as const

export function parseVisibility(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string')
  } catch {
    // fall through
  }
  return []
}

export function serializeVisibility(ids: string[]): string {
  return JSON.stringify(ids)
}

/**
 * Slugifies a title for use in a `Page.slug`: lowercase, Polish `ł/Ł` mapped
 * to `l` (not stripped by NFD normalization), diacritics stripped, non
 * `[a-z0-9]` runs collapsed to a single `-`, trimmed, capped at 60 chars,
 * falling back to `'page'` when the result would otherwise be empty.
 */
export function slugify(title: string): string {
  const withoutPolishL = title.replace(/ł/g, 'l').replace(/Ł/g, 'L')
  const normalized = withoutPolishL
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '')
  return slug || 'page'
}

export type NavPage = {
  id: string
  slug: string
  href: string
  // C-3: nullable — no locale is privileged/required at the DB level.
  title_pl: string | null
  title_en: string | null
  title_uk: string | null
}
