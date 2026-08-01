# Plan: Turnstile + rate-limit hardening on booking endpoints

## Goal

`/api/book` renders the Turnstile widget and the client sends a real token,
but the server never reads or verifies it — zero actual bot protection despite
looking protected. The `bookings/*` management endpoints (cancel/update-time/
update-procedure/patch/check-extension/all) have no rate limiting at all.
Apply the existing, already-proven pattern (`rateLimit()` from `@/lib/cache` +
`validateTurnstileForAPI()` from `@/lib/turnstile`, both already used in
`register`, `consents/*`, `support/contact`, `master/contact`,
`discounts/preview`, `discounts/today`) to close both gaps.

Telegram bot booking flow is **already protected**
(`src/lib/telegram-bot/handlers/confirm.ts:200`, `rateLimit('tgbook:${chatId}', 5, 3600)`)
— out of scope, do not touch.

## Reconnaissance (confirmed by direct code reading)

- `src/app/api/book/route.ts` — `bookingApiSchema` has a `turnstileToken`
  field (`src/lib/validation/api-schemas.ts:28`), the client renders the
  widget and sends a real token (`src/components/hooks/useBookingSubmit.ts:90,173`),
  but the route handler never destructures `body.turnstileToken` or calls
  `verifyTurnstile`/`validateTurnstileForAPI`. No rate limiting either.
- `src/app/api/bookings/cancel/route.ts`, `update-time/route.ts`,
  `update-procedure/route.ts`, `[id]/route.ts` (PATCH),
  `[id]/check-extension/route.ts`, `all/route.ts` (GET) — zero `rateLimit(`
  calls (confirmed via grep — all 0 hits). The frontend
  (`src/components/booking-management/api/bookingManagementApi.ts:108,145`)
  explicitly comments `turnstileToken` as `// kept for API compatibility —
  not sent to server` / `// Not used anymore - kept for compatibility` — a
  past, deliberate decision not to require Turnstile here. User confirmed
  this session: correct call, these are actions on an *existing* appointment
  already gated by full E.164 phone-ownership match, not a first-touch
  surface. Only rate limiting is being added here, not Turnstile.
- Reference pattern (`src/app/api/consents/erase/route.ts:125,137`):
  ```ts
  const rate = await rateLimit(`rate:gdpr:erase:${ip}`, 3, 15 * 60)
  if (!rate.allowed) return NextResponse.json({ error: "...", code: "RATE_LIMITED" }, { status: 429 })
  // ... later, only for unauthenticated:
  const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, { requireToken: false })
  if (!turnstileResult.success) return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
  ```
  `requireToken: false` is required — otherwise `validateTurnstileForAPI`
  returns a hard 500 when Turnstile is unconfigured (dev/no-keys), instead of
  the intended "disabled = allow" fallback.
- `getRequestIp` lives in `@/lib/consent-service` (`src/lib/consent-service.ts:283`),
  already imported in `book/route.ts`; needs adding as an import in the five
  `bookings/*` files that don't have it yet.
- `rateLimit(key, limit, windowSec)` (`src/lib/cache.ts:63`) — Redis-backed,
  fails open (`{allowed: true}`) if Upstash isn't configured — matches every
  other call site's behavior, no special handling needed.

## Changes

### 1. `src/app/api/book/route.ts`

- Import `rateLimit` from `@/lib/cache` and `validateTurnstileForAPI` from
  `@/lib/turnstile`.
- Right after `body` is parsed (before the `auth()` call): compute
  `const ip = getRequestIp(req)` (hoist the existing inline call used later),
  then:
  ```ts
  const { allowed } = await rateLimit(`rate:book:${ip}`, 8, 15 * 60)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }
  ```
  (8 per 15 min — generous enough for a guest booking multiple family
  members in one sitting, still bounds scripted abuse.)
- After computing `isAuth`, only for guests:
  ```ts
  if (!isAuth) {
    const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, { requireToken: false })
    if (!turnstileResult.success) {
      return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
    }
  }
  ```
- Reuse the hoisted `ip` variable in the existing `createBooking({ ip, ... })` call instead of calling `getRequestIp(req)` twice.

### 2. `src/app/api/bookings/cancel/route.ts`

- Import `rateLimit` from `@/lib/cache`, `getRequestIp` from `@/lib/consent-service`.
- After the JSON body parse succeeds, before the required-fields check:
  ```ts
  const ip = getRequestIp(req)
  const { allowed } = await rateLimit(`rate:bookings-cancel:${ip}`, 15, 15 * 60)
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later.", code: "RATE_LIMITED" }, { status: 429 })
  }
  ```

### 3. `src/app/api/bookings/update-time/route.ts`

Same shape, key `rate:bookings-update-time:${ip}`, limit 15/15min.

### 4. `src/app/api/bookings/update-procedure/route.ts`

Same shape, key `rate:bookings-update-procedure:${ip}`, limit 15/15min.

### 5. `src/app/api/bookings/[id]/route.ts` (PATCH)

Same shape, key `rate:bookings-patch:${ip}`, limit 15/15min.

### 6. `src/app/api/bookings/[id]/check-extension/route.ts`

Same shape, key `rate:bookings-check-extension:${ip}`, limit 20/15min
(called mid-flow, potentially more than once per attempt while the user
compares alternative slots).

### 7. `src/app/api/bookings/all/route.ts` (GET)

Search/lookup endpoint — no JSON body, params come from the query string.
Add right after `searchParams` are read, before validating required params:
```ts
const ip = getRequestIp(req)
const { allowed } = await rateLimit(`rate:bookings-all:${ip}`, 20, 15 * 60)
if (!allowed) {
  return NextResponse.json({ error: "Too many requests. Please try again later.", code: "RATE_LIMITED" }, { status: 429 })
}
```

## Out of scope

- Telegram bot — already has its own rate limit, do not touch.
- Frontend changes — `turnstileToken` is already collected and sent by
  `BookingForm.tsx`/`useBookingSubmit.ts` for `/api/book`; no client work
  needed. The `bookings/*` management endpoints intentionally do not collect
  a token client-side (confirmed prior-session decision) — not restoring that.
- No changes to `.env.example` / deploy tooling — `TURNSTILE_SECRET_KEY` /
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are already documented and already
  prompted for interactively by `deploy/install.sh`.

## Acceptance criteria

- [x] `/api/book`: guest request with a missing/invalid Turnstile token is
      rejected with 400 when `TURNSTILE_SECRET_KEY` is configured; behaves
      exactly as before (no token required) when it's unset — verify by
      reading `validateTurnstileForAPI`'s fallback branch, not by hitting
      Cloudflare's live API.
- [x] `/api/book`: authenticated (`CLIENT` session) bookings are never asked
      for a Turnstile token.
- [x] All 7 files above return `429` with `{ error, code: "RATE_LIMITED" }`
      once their per-IP limit is exceeded within the window.
- [x] `npm run lint` and `npx tsc --noEmit` clean.
- [x] `npm run test` — no regressions in existing booking/GDPR/discount test
      suites (rate limiting fails open when Redis/Upstash isn't configured,
      which is the case in the test environment — confirm no test starts
      hitting a real limit because of added calls sharing a IP-less/global
      key by mistake).
- [x] No changes to files outside the 7 listed above.
