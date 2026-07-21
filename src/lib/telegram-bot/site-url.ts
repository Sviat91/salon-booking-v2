/**
 * Resolves the effective base site URL used by the client booking bot's
 * outbound links (consent `/terms`/`/privacy` links, post-booking "Open
 * website" button). Fallback order (hard requirement): DB
 * `TenantConfig.clientBotSiteUrl` → `process.env.NEXT_PUBLIC_SITE_URL` →
 * `undefined` (callers fall back to relative paths / omit the button).
 */
import { getTenantConfig } from '@/lib/tenant'

export async function resolveSiteUrl(): Promise<string | undefined> {
  const config = await getTenantConfig()
  const dbUrl = config.clientBotSiteUrl?.trim().replace(/\/$/, '')
  if (dbUrl) return dbUrl

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (envUrl) return envUrl

  return undefined
}
