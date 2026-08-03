# Plan: Add Turnstile CAPTCHA to registration

**Date:** 2026-08-03
**Status:** Implemented (pending manual browser verification)
**Mode:** LIGHT (reuses an existing pattern already used in 3+ places, no architecture decisions)

## Problem

`POST /api/auth/register` (`src/app/api/auth/register/route.ts`) currently has only IP rate-limiting (5/15min), no Turnstile CAPTCHA at all — unlike `/api/book`, which validates a Turnstile token via `validateTurnstileForAPI()` for unauthenticated requests. The user explicitly asked for registration to also be CAPTCHA-protected, matching booking. `RegisterForm.tsx` currently has zero Turnstile code.

## Reference pattern to copy

`src/app/support/page.tsx` lines 52-101 (widget mount) is the cleanest existing example: reads `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`, lazy-loads the Cloudflare script once, polls for `window.turnstile` to appear, renders into a ref'd div, stores the resulting token in state via the widget's `callback`. `src/components/BookingForm.tsx` (`siteKey` at line 65) is another equivalent instance. Server-side, `src/app/api/book/route.ts` lines 61-69 is the reference: `validateTurnstileForAPI(token, ip, { requireToken: false })`, and on failure return `NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })`.

## Implementation Steps

- [x] **Step 1: Client widget in `RegisterForm.tsx`**
  - Add the same `siteKey`/`turnstileRef`/`widgetIdRef`/`turnstileToken` state + mount/cleanup `useEffect` as `support/page.tsx` lines 52-101 (copy the mechanism, adapt variable names only if needed for lint).
  - Render a `<div ref={turnstileRef} />` inside the form, above the submit button — same placement convention as `support/page.tsx`'s "Turnstile" section (~line 290).
  - Include `turnstileToken` in the `fetch('/api/auth/register', ...)` body (`JSON.stringify({ ...existing fields, turnstileToken })`).
  - Do not require the token client-side (no blocking the submit button) — mirror `support/page.tsx`'s behavior; the server is the enforcement point, consistent with how `/api/book` works.

- [x] **Step 2: Server-side check in `src/app/api/auth/register/route.ts`**
  - Import `validateTurnstileForAPI` from `@/lib/turnstile` and `getRequestIp` (already imported).
  - Add the check immediately after the existing rate-limit block (after line 34), before parsing the body with zod — same ordering `/api/book` uses (rate-limit first, then Turnstile, then payload validation).
  - `const turnstileResult = await validateTurnstileForAPI(raw?.turnstileToken, ip, { requireToken: false })` — note `raw` (the parsed JSON body) doesn't exist yet at that point in the current code (body is parsed at line 36); reorder so `req.json()` happens before the Turnstile check, or read `turnstileToken` from the raw body first. Simplest: move `const raw = await req.json()` up to right after the rate-limit block, before the Turnstile check, then proceed to `registerSchema.safeParse(raw)` as before. `turnstileToken` is not part of `registerSchema` and must stay untyped/read directly off `raw` (`raw?.turnstileToken`), not added to the zod schema (same convention as `/api/book`, which doesn't validate `turnstileToken` through its main schema either — check `src/app/api/book/route.ts`'s body parsing to confirm before writing this).
  - On failure: `return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })`.

- [x] **Step 3: i18n**
  - No new user-facing string is introduced by `validateTurnstileForAPI`'s generic JSON error codes (`TURNSTILE_TOKEN_REQUIRED`, etc.) — confirm how `/api/book`'s equivalent errors are surfaced to the user (there's an `apiErrorKey()`/`errors.*` mapping system per CLAUDE.md — check `src/lib/errors/apiErrorKey.ts` or equivalent for whether these Turnstile error codes already have translated messages mapped, since they're shared codes, not new ones). If the codes are already mapped (likely, since `/api/book` already surfaces them), no new locale keys needed. If `RegisterForm.tsx`'s catch block doesn't already run errors through that mapping, wire it in minimally — check how `BookingForm.tsx` displays a Turnstile-related error to a user today and mirror that, don't invent a new error-display convention.

## Acceptance Criteria

- [x] `npm run lint` — zero new warnings/errors (pre-existing unrelated lint errors remain in other files, none in the two touched files)
- [x] `npx tsc --noEmit` — clean
- [x] `npm run test` — still green (32 files / 285 tests passed). `tests/app/api/auth/register.route.test.ts` needed no changes: `TURNSTILE_SECRET`/`TURNSTILE_SECRET_KEY` are set to `''` in `tests/setup/env.ts`, so `validateTurnstileForAPI(token, ip, { requireToken: false })` takes the "Turnstile disabled" branch and returns `{ success: true }` without a token, identical to how `tests/app/api/book/consent-gate.test.ts` needs no Turnstile mocking either.
- [ ] Registration still works end-to-end for a real browser session (widget renders, token gets included, request succeeds) — requires manual browser verification, cannot be automated here.
- [x] No other files changed besides `RegisterForm.tsx`, `src/app/api/auth/register/route.ts`, and (only if genuinely required per Step 3) a test file — no test file changes were required.

## Out of scope

- Login (`/auth/login`) — user did not ask for CAPTCHA there, explicitly scoped this to registration only.
- Any change to `/api/book`, `support/page.tsx`, or other existing Turnstile call sites — copy the pattern, don't refactor it into a shared hook/component unless doing so is trivially small; if extracting a shared hook would touch more than these files, don't do it, just duplicate the ~40 lines like the existing 3 call sites already do.
