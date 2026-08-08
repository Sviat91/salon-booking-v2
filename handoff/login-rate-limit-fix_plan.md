# Plan: fix confusing "wrong password" during login rate-limit

## Root cause (confirmed by reading code, no server run needed)

`checkLoginGuards()` in `src/lib/auth-guards.ts` rate-limits ALL login
attempts by `rate:login:${ip}` only — one shared Redis-backed bucket per IP,
10 attempts / 15 min, covering every account and role hitting from that IP.
`.env` has real Upstash Redis configured locally (not the in-memory
fallback), so the bucket survives dev-server restarts and only clears when
its 15-minute TTL rolls off.

When exceeded, `src/auth.ts`'s `authorize()` does `return null` — NextAuth
always surfaces this as the generic `CredentialsSignin` error, which
`LoginForm.tsx` renders as "invalid email or password", indistinguishable
from an actually-wrong password.

This explains every symptom the user reported: rapid multi-account testing
from one IP (create/delete/recreate test users, retyped passwords, mixed
client/master/admin logins) exhausted the shared 10-attempt bucket; every
subsequent login from that IP — any role, correct password or not — was
silently rejected until the 15-minute window expired ("само починилось через
время").

Confirmed via:
- `src/lib/auth-guards.ts:23` — `rateLimit(\`rate:login:${ip}\`, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_SEC)`
- `src/lib/cache.ts` — `rateLimit()` uses real Upstash `Redis.incr`/`expire` when configured
- `.env` — `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set locally
- `tests/lib/auth-guards.test.ts` — existing test locks in the current (buggy) single-IP-key behavior
- No other lockout/failed-attempt mechanism exists anywhere else in `src/` (grepped, nothing found)

## Fix

### 1. [x] `src/lib/auth-guards.ts`
- `checkLoginGuards()` gains a required `email: string` param.
- Keep a per-IP cap, but raise it — it exists to catch wide credential-stuffing
  sweeps across many accounts from one IP, not to cap normal multi-account
  testing from one office/home IP. New: `IP_ATTEMPT_LIMIT = 30` /
  `IP_ATTEMPT_WINDOW_SEC = 15 * 60` (keep the existing constant names/window
  for the IP check to minimize churn, just raise the number to 30).
- Add a new, stricter per-account cap keyed by the normalized email — this is
  the actual brute-force target and should stay tight:
  `ACCOUNT_ATTEMPT_LIMIT = 10` / same 15-minute window, key
  `rate:login:acct:${normalizedEmail}` (lowercase+trim the email the same way
  `src/auth.ts` already does before its `$queryRaw` lookup).
- Check both; if either is exceeded, return `{ ok: false, reason: 'RATE_LIMITED' }`.
- Keep the existing Turnstile check unchanged, still only runs if both rate
  checks pass.

### 2. [x] `src/auth.ts`
- Pass `credentials.email` (normalized the same way as the existing
  `normalizedEmail` used for the `$queryRaw` lookup — compute it once, reuse
  for both) into `checkLoginGuards({ ip, email: normalizedEmail, turnstileToken })`.
- On `guard.reason === 'RATE_LIMITED'`, throw a custom error instead of
  `return null`, so the reason survives NextAuth's redirect round-trip:
  ```ts
  import { CredentialsSignin } from "next-auth"
  // or from "@auth/core/errors" — check which import path the installed
  // next-auth version re-exports CredentialsSignin from; use whichever
  // resolves (next-auth v5 beta re-exports it from the main package).

  class RateLimitedError extends CredentialsSignin {
    code = "rate_limited"
  }
  ```
  Then in the guard-fail branch: if `guard.reason === 'RATE_LIMITED'`, `throw new RateLimitedError()`; otherwise (Turnstile failure) keep the existing `console.warn` + `return null` behavior unchanged — Turnstile failures should stay generic, only rate-limit gets the distinct code.
- Everything else in `authorize()` unchanged.

### 3. [x] `src/components/auth/LoginForm.tsx`
- `signIn("credentials", { redirect: false, ... })`'s return value includes a
  `code` field (confirmed in `node_modules/next-auth/react.js` — extracted
  from the `code` query param on the redirect URL).
- In the `if (res?.error)` branch, check `res.code === 'rate_limited'` first;
  if so, show a new translated message (e.g. `t('auth.tooManyAttempts', 'Too
  many login attempts. Please try again in a few minutes.')`) instead of
  `auth.invalidCredentials`. Otherwise keep existing behavior.
- Add `auth.tooManyAttempts` key to `src/locales/{pl,en,uk}.json` (match the
  existing tone/structure of neighboring `auth.*` keys, Polish wording as the
  primary/default locale).

### 4. [x] Tests — `tests/lib/auth-guards.test.ts`
- Update all existing `checkLoginGuards(...)` calls to pass `email:
  'user@example.com'` (or similar) alongside `ip`.
- Update the "calls rateLimit with the exact login key/limit/window" test to
  assert on the new per-IP raised limit AND add a new assertion/test for the
  per-account call (`rate:login:acct:user@example.com`, 10, 900).
- Add a new test: per-account limit exceeded (IP allowed) still returns
  `RATE_LIMITED` and does not call `validateTurnstileForAPI`.
- Add a new test: per-account limit exceeded takes effect even when IP limit
  still has headroom (i.e., the two checks are independent, both enforced).

### 5. [x] `src/auth.ts` call-site check (confirmed: only `authorize()` calls `checkLoginGuards`, grep run before editing)
- Confirm no other caller of `checkLoginGuards` exists besides `authorize()`
  (grep before editing) — if there is one, it also needs the new `email` arg.

## Out of scope
- Not touching `/api/book`'s or other unrelated rate limits.
- Not touching the Turnstile-failure branch's error surfacing — stays generic
  by design (unchanged from before this fix).
- Not adding a distinct message for `TURNSTILE_FAILED` — only `RATE_LIMITED`
  gets a distinct client message per this plan.

## Verify
- `npx vitest run tests/lib/auth-guards.test.ts` passes.
- `npm run lint` clean.
- `npx tsc --noEmit` clean (or `npm run build` if that's the project's actual
  type-check gate — check `package.json` scripts).
