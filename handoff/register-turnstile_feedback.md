# Review: register-turnstile

**Date:** 2026-08-03
**Verdict:** APPROVED

## Critical/Architectural Issues

None found.

## Minor/Syntax Issues

- Plan documentation inaccuracy (informational only, no code fix required): `handoff/register-turnstile_plan.md:26` — the plan asserts `/api/book` keeps `turnstileToken` "untyped" and out of its main zod schema. This is factually wrong: `bookingApiSchema` in `src/lib/validation/api-schemas.ts:28` explicitly includes `turnstileToken: z.string().nullish()`. The register route's actual implementation (reading `raw?.turnstileToken` directly, keeping it out of `registerSchema`) is still correct and functionally fine — zod silently strips unknown keys by default since `registerSchema` isn't `.strict()` — so no code change is needed.

## Passed Checks

- [x] `RegisterForm.tsx` widget mount/cleanup (lines 32-81) is a byte-for-byte match of `support/page.tsx` lines 52-101: same siteKey env read, script lazy-load, poll for `window.turnstile`, render into ref, cleanup on unmount. No logic drift.
- [x] `turnstileToken` included in the `POST /api/auth/register` fetch body.
- [x] Widget rendered above the submit button, gated on siteKey truthiness; submit not blocked client-side on token presence.
- [x] `route.ts` ordering: rate-limit → `req.json()` → `validateTurnstileForAPI` → zod validation — correct sequence.
- [x] `turnstileToken` read directly off `raw`, not part of `registerSchema`'s field list.
- [x] `validateTurnstileForAPI(raw?.turnstileToken, ip, { requireToken: false })` called correctly; error response/status returned unmodified on failure, matching `/api/book`.
- [x] Test env (`tests/setup/env.ts`) has empty Turnstile secrets, so existing register tests pass unchanged via the "disabled" branch.
- [x] No i18n regression — register route's raw English error strings were already the pre-existing convention, unchanged by this feature.
- [x] Login (`/auth/login`), `/api/book`, `support/page.tsx`, `BookingForm.tsx` all confirmed untouched/out of scope.
- [x] File sizes: `RegisterForm.tsx` 309 lines, `route.ts` 167 lines — both well under 500.

## Summary

Faithful mirror of the existing Turnstile pattern (client widget from `support/page.tsx`, server check from `/api/book`), correct ordering, correct error propagation, zero regressions, zero scope creep. Approved, ready to ship pending the user's manual browser verification (widget renders + registration still succeeds end-to-end).
