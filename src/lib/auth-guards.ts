// Login rate-limit + Turnstile guard for the Credentials `authorize()` callback
// in `src/auth.ts`. Lives here (not inline in `src/auth.ts`) because `@/auth`
// cannot be imported under Vitest (next-auth's transitive `next/server`
// import breaks the `node` test environment) — this module imports only
// `@/lib/cache` and `@/lib/turnstile`, so it stays unit-testable.

import { rateLimit } from '@/lib/cache'
import { validateTurnstileForAPI } from '@/lib/turnstile'

// Per-IP cap: catches wide credential-stuffing sweeps across many accounts
// from one IP, not normal multi-account testing from one office/home IP.
export const LOGIN_ATTEMPT_LIMIT = 30
export const LOGIN_ATTEMPT_WINDOW_SEC = 15 * 60

// Per-account cap: the actual brute-force target, stays tight.
export const ACCOUNT_ATTEMPT_LIMIT = 10
export const ACCOUNT_ATTEMPT_WINDOW_SEC = 15 * 60

export type LoginGuardResult =
  | { ok: true }
  | { ok: false; reason: 'RATE_LIMITED' | 'TURNSTILE_FAILED' }

export async function checkLoginGuards(params: {
  ip: string
  email: string
  turnstileToken?: unknown
}): Promise<LoginGuardResult> {
  const { ip, email, turnstileToken } = params

  const { allowed: ipAllowed } = await rateLimit(`rate:login:${ip}`, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_SEC)
  const normalizedEmail = email.trim().toLowerCase()
  const { allowed: acctAllowed } = await rateLimit(
    `rate:login:acct:${normalizedEmail}`,
    ACCOUNT_ATTEMPT_LIMIT,
    ACCOUNT_ATTEMPT_WINDOW_SEC
  )
  if (!ipAllowed || !acctAllowed) {
    return { ok: false, reason: 'RATE_LIMITED' }
  }

  // Auth.js delivers form values as strings — anything else is treated as absent.
  const token = typeof turnstileToken === 'string' && turnstileToken ? turnstileToken : undefined

  const result = await validateTurnstileForAPI(token, ip, { requireToken: false })
  if (!result.success) {
    // Fail OPEN only when the outbound siteverify fetch itself threw (Cloudflare
    // or egress outage). A third-party outage must never lock every role,
    // including the salon's own admin panel, out of the app. Missing/invalid/
    // expired/replayed tokens still fail closed.
    if (result.errorResponse?.code === 'VERIFY_ERROR') {
      return { ok: true }
    }
    return { ok: false, reason: 'TURNSTILE_FAILED' }
  }

  return { ok: true }
}
