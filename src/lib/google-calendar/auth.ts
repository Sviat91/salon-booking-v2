import { createSign } from 'node:crypto'
import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { decrypt } from '@/lib/encryption'
import {
  GOOGLE_CALENDAR_SCOPE,
  isGoogleSyncEnabled,
  parseServiceAccountKey,
  type ServiceAccountKey,
} from './config'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** Token endpoint is temporarily unavailable (network/timeout/5xx/429) — retryable. */
export class TokenUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenUnavailableError'
  }
}

let cached: { token: string; expiresAt: number; clientEmail: string } | null = null

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

async function loadServiceAccount(): Promise<ServiceAccountKey | null> {
  try {
    const config = await getTenantConfig()
    if (!isGoogleSyncEnabled(config)) return null
    const json = decrypt(config.googleServiceAccountKey)
    if (!json) return null
    return parseServiceAccountKey(json)
  } catch {
    return null
  }
}

/**
 * Returns a cached service-account access token, or null when the key is not
 * configured/parseable or the token endpoint rejects it (4xx other than 429).
 * Throws TokenUnavailableError only for transient token-endpoint failures.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const key = await loadServiceAccount()
    if (!key) return null

    if (
      cached &&
      cached.clientEmail === key.clientEmail &&
      Date.now() < cached.expiresAt - 60_000
    ) {
      return cached.token
    }

    const iat = Math.floor(Date.now() / 1000)
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64url(
      JSON.stringify({
        iss: key.clientEmail,
        scope: GOOGLE_CALENDAR_SCOPE,
        aud: TOKEN_URL,
        iat,
        exp: iat + 3600,
      }),
    )
    const signingInput = `${header}.${claims}`
    const signature = createSign('RSA-SHA256').update(signingInput).sign(key.privateKey)
    const assertion = `${signingInput}.${b64url(signature)}`

    let res: Response
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch (err) {
      console.error('[google-calendar auth] token request failed:', err instanceof Error ? err.name : 'error')
      throw new TokenUnavailableError('Google token endpoint unreachable')
    }

    if (!res.ok) {
      console.error(`[google-calendar auth] token request failed: HTTP ${res.status}`)
      if (res.status >= 500 || res.status === 429) {
        throw new TokenUnavailableError(`Google token endpoint HTTP ${res.status}`)
      }
      return null
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) {
      console.error('[google-calendar auth] token response had no access_token')
      return null
    }
    cached = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      clientEmail: key.clientEmail,
    }
    return cached.token
  } catch (err) {
    if (err instanceof TokenUnavailableError) throw err
    console.error('[google-calendar auth] failed:', err instanceof Error ? err.name : 'error')
    return null
  }
}

/** Reads the plaintext SA email column (does not re-decrypt the key). */
export async function getServiceAccountEmail(): Promise<string | null> {
  try {
    const row = await prisma.tenantConfig.findFirst({
      select: { googleServiceAccountEmail: true },
    })
    return row?.googleServiceAccountEmail ?? null
  } catch {
    return null
  }
}

export function resetAccessTokenCache(): void {
  cached = null
}
