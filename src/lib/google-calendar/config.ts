/**
 * Pure helpers for Google Calendar sync configuration — zero Prisma, zero React.
 * Never throws, never logs the service-account key.
 */

export interface ServiceAccountKey {
  clientEmail: string
  privateKey: string
}

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

/** How far forward (in days) we push/import. */
export const SYNC_WINDOW_DAYS = 400

export function parseServiceAccountKey(json: string): ServiceAccountKey | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return null
    const clientEmail = parsed.client_email
    const privateKey = parsed.private_key
    if (parsed.type !== 'service_account') return null
    if (typeof clientEmail !== 'string' || !clientEmail.trim()) return null
    if (typeof privateKey !== 'string' || !privateKey.includes('BEGIN PRIVATE KEY')) return null
    return { clientEmail: clientEmail.trim(), privateKey }
  } catch {
    return null
  }
}

const CALENDAR_ID_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/

export function normalizeCalendarId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  if (!value) return null
  if (value === 'primary') return null
  return CALENDAR_ID_RE.test(value) ? value : null
}

export function isGoogleSyncEnabled(config: {
  googleCalendarEnabled?: boolean | null
  googleServiceAccountKey?: string | null
}): boolean {
  return Boolean(config.googleCalendarEnabled && config.googleServiceAccountKey)
}
