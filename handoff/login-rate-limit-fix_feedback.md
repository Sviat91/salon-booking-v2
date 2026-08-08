# Review feedback: login-rate-limit-fix

## Verdict: Minor/Syntax — one fix needed, then done

Security-critical logic verified correct by tracing actual code (not just
trusting plan checkmarks): both IP and per-account rate limits run
unconditionally (no short-circuit masking), email normalization matches
exactly between `checkLoginGuards()` and `auth.ts`'s `$queryRaw` lookup, the
`RateLimitedError extends CredentialsSignin` class-field override mechanism
genuinely works (verified in `@auth/core/errors.js`), `LoginForm.tsx` reads
`res.code` correctly with no race against the existing
`errorParam === 'CredentialsSignin'` effect, locale keys are consistent, and
tests correctly isolate the two limiters. No unrelated files touched.

## Issue to fix

**`src/lib/AGENTS.md`** — still describes the pre-fix behavior:
`checkLoginGuards({ ip, turnstileToken })` (missing the new required `email`
param) and "rate limit 10 attempts/15min per IP (`rate:login:<ip>`)" with no
mention of the new per-account key or the raised 30-attempt IP cap. Per this
repo's DOX contract, update it to describe the actual current design:
- `checkLoginGuards({ ip, email, turnstileToken })`
- per-IP cap raised to 30/15min (`rate:login:<ip>`) — wide-sweep protection
- new, stricter per-account cap, 10/15min (`rate:login:acct:<normalizedEmail>`)
  — actual brute-force target
- on `RATE_LIMITED`, `src/auth.ts` now throws a `RateLimitedError` (code
  `rate_limited`) instead of returning `null`, surfaced to `LoginForm.tsx` as
  a distinct "too many attempts" message instead of the generic
  invalid-credentials message

## Not required (noted, low priority, skip unless trivial)
- Test at `tests/lib/auth-guards.test.ts:21-28` is named "when IP rate limit
  is exceeded" but its mock actually exhausts both keys — outcome is still
  correct, just a misleading name. Optional rename, not required.
