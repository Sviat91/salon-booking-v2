# Review: Turnstile/rate-limit coverage on public endpoints + login
**Date:** 2026-08-03
**Verdict:** APPROVED

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
None found.

## Passed Checks
- [x] **R1 fail-open paths intact**: `rateLimit()` in `src/lib/cache.ts:63-73` fails open (`{allowed:true}`) on missing/erroring Redis — untouched. Every new/touched call site (`support/contact`, `master/contact`, `forgot-password`, `auth-guards.ts`) uses `{ requireToken: false }`. `VERIFY_ERROR` fails open **only** inside `src/lib/auth-guards.ts:37-39` (with explanatory comment); `support/contact/route.ts`, `master/contact/route.ts`, `forgot-password/route.ts` all propagate `turnstileResult.errorResponse`/`status` unconditionally on any failure, i.e. keep fail-closed behavior for `VERIFY_ERROR` there — exactly per D5's login-only scoping.
- [x] **R2 single-use token reset on failure**: `ContactMasterPanel.tsx:85` calls `turnstile.resetWidget()` in the catch block; `ForgotPasswordForm.tsx:102` and `LoginForm.tsx:115` both call `resetTurnstile()` in their failure branches before `setError`.
- [x] **D6 no new error-code plumbing**: `src/auth.ts:32-35` — guard failure just `console.warn` + `return null`, no custom `CredentialsSignin` subclass, no new redirect param. `LoginForm.tsx`'s existing `CredentialsSignin` handling is untouched.
- [x] **D9 RegisterForm.tsx diff confinement**: new `turnstileTokenRef` with one added line inside the existing `callback`, `resetTurnstile()` helper, `waitForFreshTurnstileToken()`, and the submit-handler insertion between register-response-OK and `signIn()` with a conditional spread of `freshToken`. No markup changes; file is 309 lines, well under 500.
- [x] **D2 getRequestIp widening non-breaking**: `src/lib/consent-service.ts:282-285` — signature is `(req: Request)`, cast to `Request & {ip?: string}`, body unchanged. `NextRequest` type import correctly removed. All existing `NextRequest` callers compile since `NextRequest extends Request`.
- [x] **D4 login rate-limit budget**: `LOGIN_ATTEMPT_LIMIT=10`, `LOGIN_ATTEMPT_WINDOW_SEC=900`, key `rate:login:${ip}` (IP only, never email) — confirmed by unit test asserting `rateLimit` called with `('rate:login:1.2.3.4', 10, 900)`.
- [x] **F9/testability**: `tests/lib/auth-guards.test.ts` mocks only `@/lib/cache` and `@/lib/turnstile`, no Prisma/`@/auth` import. All 6 required cases present.
- [x] **Scope discipline**: `checkLoginGuards` grep hits only `src/auth.ts` + `src/lib/auth-guards.ts`. `validateTurnstileForAPI` grep hits exactly the 8 expected routes. `src/auth.config.ts` and `src/middleware.ts` confirmed untouched/Edge-safe.
- [x] **File sizes**: `src/auth.ts` = 61 lines, `src/lib/auth-guards.ts` = 36 lines, `ContactMasterPanel.tsx` = 200, `LoginForm.tsx` = 207, `ForgotPasswordForm.tsx` = 176, `RegisterForm.tsx` = 309 — all well under 500.
- [x] **i18n**: `TURNSTILE_TOKEN_REQUIRED`/`TURNSTILE_FAILED` added to `KNOWN_ERROR_CODES`; all three locale files have non-empty, real translations for the three new keys.
- [x] **DOX pass**: all 5 AGENTS.md files updated accurately and consistently.
- [x] Route ordering per plan: rate-limit → Turnstile check → business logic, in all three touched routes and in `checkLoginGuards`.
- [x] `tests/app/api/support/contact.test.ts` unmodified and still compatible.

## Summary
Clean, disciplined implementation matching the plan's Architecture Decisions and Implementation Steps with no deviations found. All three independent fail-open guarantees (Redis-down, no-Turnstile-secret, Cloudflare-siteverify-down) are intact and correctly scoped. The single-use-token UX trap is handled correctly in all three new/touched forms, and the `RegisterForm.tsx` auto-login fix is confined exactly to the sanctioned lines. `src/auth.ts`'s diff is minimal and introduces no new NextAuth error-code plumbing. Test coverage is complete and correctly avoids importing `@/auth`. Scope discipline holds — no unrelated files touched. Approved. The mandatory Gap-4 manual browser matrix (8 rows) still requires live human verification before this is truly done — that could not be executed by either agent (no browser access).
