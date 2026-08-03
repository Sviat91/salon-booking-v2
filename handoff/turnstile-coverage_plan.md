# Plan: Close the remaining Turnstile/rate-limit gaps on public endpoints

**Date:** 2026-08-03
**Status:** In Progress
**Mode:** FULL (Gap 4 touches `src/auth.ts` — the single code path every SUPERADMIN/ADMIN/MASTER/CLIENT login depends on)

## Goal

Make CAPTCHA + IP rate-limiting coverage consistent across every unauthenticated public write endpoint: enforce the token server-side on `/api/support/contact`, add widget + server check to `/api/master/contact` and `/api/auth/forgot-password`, and put a rate limit + Turnstile gate on email/password login (`src/auth.ts`'s Credentials `authorize()`), without breaking any existing login or the post-registration auto-login.

---

## Verified facts (checked in this session — do not re-derive, do not contradict)

| # | Fact | Source |
| --- | --- | --- |
| F1 | `next-auth@^5.0.0-beta.30` is installed; `@auth/core`'s `CredentialsConfig.authorize` signature is `(credentials: Partial<Record<keyof CredentialsInputs, unknown>>, request: Request)`. | `node_modules/@auth/core/providers/credentials.d.ts` L53-65 |
| F2 | Auth.js passes the **entire POST body** to `authorize` (`const credentials = body ?? {}`) — extra fields are **not** filtered by the declared `credentials: {}` keys — and reconstructs `request` as `new Request(url, { headers, method, body })` with the **original headers**, so `x-forwarded-for` survives. `if (!user) throw new CredentialsSignin()` → the client sees the generic `CredentialsSignin` error that `LoginForm.tsx` already handles. | `node_modules/@auth/core/lib/actions/callback/index.js` L227-236 |
| F3 | `signIn()` from `next-auth/react` forwards every extra option into the form body: `body: new URLSearchParams({ ...signInParams, csrfToken, callbackUrl })`. Values are stringified — a `null` would be sent as the literal string `"null"`, so the token must be spread conditionally, never passed as `null`. | `node_modules/next-auth/react.js` L126-164 |
| F4 | The repo's dominant convention is `turnstileToken: z.string().nullish()` **inside** the route's Zod schema (`/api/book` + all three GDPR endpoints), then `body.turnstileToken`. Only `/api/auth/register` reads it off the raw body (its schema is strict). | `src/lib/validation/api-schemas.ts` L28, L166, L181, L195 |
| F5 | `src/components/booking-management/hooks/useTurnstileSession.ts` already exists and is production-hardened (script load, render retries, `error-callback`/`expired-callback`, `resetWidget`, `ensureWidget`, `removeWidget`, `turnstileRequired`). `BookingManagement.tsx` L51 instantiates it and renders the widget only inside `SearchPanel`. `src/components/booking-management/AGENTS.md` L17 already mandates it for this module. | read in session |
| F6 | `getRequestIp(req: NextRequest)` (`src/lib/consent-service.ts` L283-286) uses only `req.headers.get()` plus an `.ip` cast — `NextRequest` is used **nowhere else** in that file (the L1 type import exists solely for this signature). | read in session |
| F7 | `validateTurnstileForAPI(token, ip, { requireToken: false })` returns `{ success: true }` when `config.TURNSTILE_SECRET_EFFECTIVE` is empty, and `errorResponse.code === 'VERIFY_ERROR'` when the `fetch` to `challenges.cloudflare.com` itself throws (network failure → currently fails **closed**). | `src/lib/turnstile.ts` L172-250 |
| F8 | `rateLimit()` fails **open** (`{ allowed: true }`) when Redis is unconfigured or throws — a Upstash outage can never lock anyone out. Existing budgets: register 5/15min, forgot-password 3/15min, book 8/15min, support/master contact 3/15min, GDPR 3/15min. | `src/lib/cache.ts` L63-73 |
| F9 | `tests/setup/env.ts` sets `TURNSTILE_SECRET`/`TURNSTILE_SECRET_KEY` to `''`, so every existing route test takes the "Turnstile disabled" branch and needs no new mock. `@/auth` **cannot** be imported under Vitest (next-auth's transitive `next/server` import); the documented workaround is `vi.mock('@/auth', ...)`. | `tests/setup/env.ts`, `src/app/api/AGENTS.md` L34 |
| F10 | `deploy/nginx.conf.template` L22-23 sets `X-Real-IP` and `X-Forwarded-For` — per-IP limiting is meaningful in production. In local dev (no proxy) there is no `x-forwarded-for`, so every request buckets into `0.0.0.0`. | read in session |
| F11 | `supportContactApiSchema` / `masterContactApiSchema` / `forgotPasswordApiSchema` exist in `api-schemas.ts` but are **stale and unused** — their field names don't match the live routes (`subject`, `fullName`, `requestId` are missing). Pre-existing dead code: mention, do not delete, do not switch the routes onto them. | `src/lib/validation/api-schemas.ts` L209-244 |
| F12 | `management.turnstileRequired` already exists in `pl/en/uk.json` (L1045). `auth.invalidCredentials` exists. `errors.TURNSTILE_*` codes do **not** exist in `KNOWN_ERROR_CODES`, so a Turnstile rejection currently renders `errors.generic`. `tests/lib/errors/apiErrorKey.test.ts` iterates the set generically, so adding codes cannot break it. | read in session |

---

## Architecture Decisions

### D1 — Schema-declared token, not raw-body reads (Gaps 1-3)

Add `turnstileToken: z.string().nullish()` to each route's **existing inline** `BodySchema`/`schema` and read `body.turnstileToken`. This follows F4 (4 of the 5 existing call sites) and is required here anyway: `z.object()` strips unknown keys, so `/api/support/contact`'s current `body = BodySchema.parse(await req.json())` would silently drop the token the client already sends today. Do **not** switch these routes onto the stale shared schemas (F11), and do **not** add a `.max()` length cap (a long Cloudflare token must never become a `VALIDATION_ERROR`).

### D2 — Gap 4 IP source: widen `getRequestIp` to `Request`

`src/lib/consent-service.ts` L283-286 becomes `export function getRequestIp(req: Request): string` with the cast changed to `req as Request & { ip?: string }`, and the now-unused `import type { NextRequest }` on L1 is deleted (F6). Widening a parameter type is provably non-breaking for all ~10 existing `NextRequest` callers (`NextRequest extends Request`). This keeps exactly **one** IP-extraction convention in the repo; no local copy is added to `src/auth.ts`, and `src/app/api/auth/forgot-password/route.ts` keeps its own pre-existing local `getIp()` untouched (out of scope to unify).

### D3 — Gap 4 guard logic lives in `src/lib/auth-guards.ts`, not inline in `src/auth.ts`

New module `src/lib/auth-guards.ts` exporting `checkLoginGuards({ ip, turnstileToken })`. Reasons, in order of weight:

1. **Testability.** `@/auth` cannot be imported under Vitest (F9), so any logic left inside `authorize()` is permanently untestable. A `src/lib/` module that imports only `@/lib/cache` and `@/lib/turnstile` is unit-testable with two `vi.mock`s and no Prisma mock.
2. Matches `src/lib/AGENTS.md`'s ownership rule ("core business logic... the layer API routes and pages call into").
3. Keeps the diff in the highest-blast-radius file down to ~8 lines.

Signature (exact):

```ts
export const LOGIN_ATTEMPT_LIMIT = 10
export const LOGIN_ATTEMPT_WINDOW_SEC = 15 * 60

export type LoginGuardResult =
  | { ok: true }
  | { ok: false; reason: 'RATE_LIMITED' | 'TURNSTILE_FAILED' }

export async function checkLoginGuards(params: {
  ip: string
  turnstileToken?: unknown
}): Promise<LoginGuardResult>
```

### D4 — Login budget: **10 attempts / 15 min / IP**, key `rate:login:${ip}`

Chosen deliberately, between the codebase's existing auth-adjacent budgets (forgot-password 3/15min, register 5/15min, book 8/15min):

- A real person mistyping a password 2-3 times, plus a household/small office behind one NAT IP, must not get locked out — 3 or 5 is too tight for the one flow users hit daily.
- 10/15min caps a single IP at 960 guesses/day, and every one of those attempts must additionally carry a fresh, single-use Cloudflare token, which makes credential-stuffing economically dead.
- Rate-limit **first**, Turnstile **second** (cheaper check first; avoids hammering Cloudflare's siteverify under attack).
- Keyed by IP only, **never by email** — an email-keyed limiter is a trivial account-lockout DoS against a known admin address.
- Successful logins count toward the bucket (same as every other `rateLimit()` call site — do not add a "only count failures" special case).

### D5 — Turnstile fails **open** on `VERIFY_ERROR` for login only

`verifyTurnstile()` returns `VERIFY_ERROR` when the outbound `fetch` to `challenges.cloudflare.com` throws (F7), i.e. when Cloudflare or the server's egress is down. For `/api/book` that fails closed, which is fine. For **login** that would lock every role — including the salon owner's admin panel — out of the app for the duration of a third-party outage. `checkLoginGuards` therefore treats `errorResponse.code === 'VERIFY_ERROR'` as a pass, and only that code. Missing token, invalid token, expired token, and replayed token all still fail closed. This must carry an explanatory comment in the code and is covered by a unit test.

`requireToken: false` is used (same as every other call site), so an install with no `TURNSTILE_SECRET_KEY` configured keeps working — a self-hoster without Cloudflare keys must not be locked out either.

### D6 — Failure UX inside `authorize()`: `return null`, generic message (RESOLVED — not an open question)

Rate-limit and Turnstile failures `return null`, exactly like a wrong password does today. Auth.js turns that into `throw new CredentialsSignin()` (F2), which `LoginForm.tsx` already renders as `auth.invalidCredentials` in both its code paths (`res?.error` at L47-48 and the `?error=CredentialsSignin` param at L24-28). **No** custom `CredentialsSignin` subclass, **no** new `code=` plumbing, **no** new error param handling. Rationale: this is the highest-blast-radius file in the repo, and Auth.js v5's custom-error-code redirect mechanism is exactly the kind of subtlety that would introduce a bug in the one path every user of every role depends on. Server-side observability comes from a `console.warn('[auth] login blocked', { reason, ip })` line, not from the response.

**The distinguishable message the user does get is client-side only** (D7), which needs no NextAuth plumbing at all.

### D7 — Single-use tokens force a widget reset on every failed attempt (the real UX trap)

Cloudflare Turnstile tokens are single-use: once `siteverify` has consumed one, replaying it returns `timeout-or-duplicate`. Without handling this, the flow is: user mistypes password → server consumes the token → user retypes the **correct** password → the same (now-dead) token is replayed → login rejected → "Invalid email or password" **with correct credentials**, forever, until a page reload. Every new/edited form in this plan therefore:

1. calls the widget's `reset()` and clears the stored token in the **failure** branch of its submit handler, and
2. refuses to fire the request at all when `siteKey` is configured but no token is present yet, showing a distinct translated message instead of letting the user get a misleading "invalid credentials"/generic error.

Messages: `management.turnstileRequired` (already exists, F12) for `ContactMasterPanel`; a new `auth.captchaRequired` key for `LoginForm`/`ForgotPasswordForm`.

### D8 — Widget mechanism per domain: reuse the hook inside booking-management, inline copy inside auth

- `ContactMasterPanel.tsx` gets **its own** `useTurnstileSession(siteKey)` instance (F5). It does **not** thread props through `PanelRenderer` from `BookingManagement`'s instance: `PanelRenderer.tsx` (423 lines) and `BookingManagement.tsx` (297 lines) are flagged as near the 500-line limit in their AGENTS.md, panels are mutually exclusive so two instances are never mounted at once, and the parent's widget div only ever lives inside `SearchPanel` (so the parent instance has no mounted container while the contact panel is open). Each instance owns its own refs and cleans itself up on unmount.
- `LoginForm.tsx` / `ForgotPasswordForm.tsx` copy the inline mechanism from `RegisterForm.tsx` L32-81 (the freshest auth-side precedent) plus a small `resetTurnstile()` helper. They must **not** import `@/components/booking-management/hooks/useTurnstileSession` — that hook is inside a domain module whose `index.ts` is documented as its only public entry point, and it carries booking-management-specific `sessionStorage` behaviour. Relocating/extracting a shared hook would mean refactoring three working, already-shipped call sites, which is out of scope (same reasoning the register plan used: duplicate the ~45 lines rather than refactor).

### D9 — Post-registration auto-login must keep working (forced, minimal exception to "don't touch `RegisterForm.tsx`")

`RegisterForm.tsx` L131 calls `signIn("credentials", { email, password })` right after a successful registration. Once `authorize()` enforces Turnstile, that call arrives with **no token** and would be rejected — the user would land on "Failed to auto-login. Please sign in manually." after every registration. Passing the same token is impossible: `/api/auth/register` already consumed it (D7).

Resolution: a contained change to `RegisterForm.tsx`'s **submit handler only** (no change to its widget mount code, no change to `/api/auth/register`): after the register response is OK, reset the widget and poll up to 4 s for a fresh token, then pass it to `signIn`. If it times out (e.g. an interactive-mode challenge needing a click), fall through to the **existing, already-translated** "sign in manually" fallback at L138-141. Worst case is today's fallback; best case is unchanged behaviour.

Rejected alternatives: a Redis "auto-login grant" nonce (new secret-ish mechanism, touches the register route, over-engineered); skipping the Turnstile requirement for accounts created in the last 60 s (would require checking the password **before** the CAPTCHA, which inverts the guard and makes the CAPTCHA gate only successful logins); accepting the degraded fallback silently (a visible regression in a flow shipped hours ago).

### D10 — Explicitly out of scope (do not touch)

- `/api/auth/reset-password` — possession of an emailed one-time token is the gate; rate-limit only. Unchanged.
- The booking-management API family (`bookings/{cancel,update-time,update-procedure}`, `bookings/[id]` PATCH, `bookings/[id]/check-extension`, `bookings/all`) — prior documented decision, `ROADMAP.md` Priority 1 item 4: they act on a known booking ID with ownership proven by full E.164 phone match, and they are already IP rate-limited (15-20/15min). Not reopened today.
- `/api/discounts/preview`, `/api/discounts/today` — read-only, rate-limited, page-load-time. CAPTCHA does not fit.
- `/api/book`, the three GDPR endpoints, `/api/auth/register`, `src/app/support/page.tsx`'s widget, `src/auth.config.ts`, `src/middleware.ts`, the Telegram bot — already correct or explicitly excluded.
- `RegisterForm.tsx` — touched **only** per D9, submit handler + two helpers. Nothing else in that file changes.

---

## Implementation Steps

- [x] **Step 1 — Gap 1 server: `/api/support/contact` actually validates the token it already receives**
  - Files: `src/app/api/support/contact/route.ts`
  - Add `import { validateTurnstileForAPI } from '../../../../lib/turnstile'` (relative import — match this file's existing `'../../../../lib/...'` style, it does not use the `@/` alias).
  - Add `turnstileToken: z.string().nullish(),` as the last field of `BodySchema` (D1).
  - Immediately **after** the rate-limit block (after L56, before the `log.info` at L58), insert:
    ```ts
    const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, { requireToken: false })
    if (!turnstileResult.success) {
      log.warn({ ip, email: maskEmailForLog(email) }, 'Contact form Turnstile rejected')
      return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
    }
    ```
  - Nothing else changes. `notifyContactForm` keeps being called with explicit fields, so the token never reaches a notification payload. `src/app/support/page.tsx` is **not** touched — it already sends `turnstileToken` (L114).

- [x] **Step 2 — Gap 2 server: `/api/master/contact`**
  - Files: `src/app/api/master/contact/route.ts`
  - Identical shape to Step 1: relative `validateTurnstileForAPI` import, `turnstileToken: z.string().nullish()` on `BodySchema`, check inserted after the rate-limit block (after L56), log line `log.warn({ ip, phone: maskPhoneForLog(phone) }, 'Master contact form Turnstile rejected')`.

- [x] **Step 3 — Gap 2 client: Turnstile widget in `ContactMasterPanel`**
  - Files: `src/components/booking-management/ContactMasterPanel.tsx`
  - `import { useTurnstileSession } from './hooks/useTurnstileSession'`; inside the component:
    `const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined`
    `const turnstile = useTurnstileSession(siteKey)` (D8 — its own instance, no `PanelRenderer` prop plumbing).
  - In `handleSubmit`, directly after the existing `if (!canSubmit || isSubmitting) return` guard and **before** `setIsSubmitting(true)`:
    ```ts
    if (turnstile.turnstileRequired) {
      setError(t('management.turnstileRequired'))
      return
    }
    ```
  - Add `turnstileToken: turnstile.turnstileToken,` to the `JSON.stringify({...})` body.
  - In the `catch` block, before `setError(...)`, call `turnstile.resetWidget()` (D7 — the failed attempt burned the token).
  - Render the widget between the message field and the action buttons (i.e. after the closing `</div>` of the `space-y-3` block, before the `flex gap-2 pt-2` button row):
    ```tsx
    {siteKey ? (
      <div className="flex justify-center">
        <div ref={turnstile.turnstileRef} className="rounded-xl" />
      </div>
    ) : null}
    ```
  - Do **not** add the token to `canSubmit` — the submit-time guard above is the chosen UX (D7), and `canSubmit` keeps its current meaning.
  - `PanelRenderer.tsx`, `BookingManagement.tsx`, and `SearchPanel.tsx` stay untouched.

- [x] **Step 4 — Gap 3 server: `/api/auth/forgot-password`**
  - Files: `src/app/api/auth/forgot-password/route.ts`
  - `import { validateTurnstileForAPI } from '@/lib/turnstile'` (this file uses `@/` aliases).
  - Add `turnstileToken: z.string().nullish(),` to the inline `schema` (L9-11).
  - Keep the existing local `getIp()` and its `ip` variable — do **not** introduce `getRequestIp` here (D2).
  - Order: rate-limit block (unchanged) → `schema.safeParse(raw)` (unchanged) → **new** Turnstile check → then the anti-enumeration success response / DB work:
    ```ts
    const turnstileResult = await validateTurnstileForAPI(parsed.data.turnstileToken, ip, { requireToken: false })
    if (!turnstileResult.success) {
      return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
    }
    ```
  - Placing it after parse is deliberate: parsing has no side effects, and the token is only reachable through the schema (D1). The anti-enumeration "always 200" behaviour is unchanged for every non-Turnstile path.

- [x] **Step 5 — Gap 3 client: Turnstile widget in `ForgotPasswordForm`**
  - Files: `src/components/auth/ForgotPasswordForm.tsx`
  - Copy the widget mechanism verbatim from `RegisterForm.tsx` L32-81 (`siteKey`, `turnstileRef`, `widgetIdRef`, `turnstileToken` state, the load/render/cleanup `useEffect`, `clientLog` import from `@/lib/client-logger`). Adapt nothing except formatting.
  - Add a local helper next to it:
    ```ts
    const resetTurnstile = React.useCallback(() => {
      setTurnstileToken(null)
      const turnstile = (window as any)?.turnstile
      if (turnstile && widgetIdRef.current) {
        try { turnstile.reset(widgetIdRef.current) } catch (error) { clientLog.warn('Turnstile reset failed:', error) }
      }
    }, [])
    ```
    (`(window as any)` needs the same `// eslint-disable-next-line @typescript-eslint/no-explicit-any` treatment the surrounding copied code uses if lint complains — `RegisterForm.tsx` currently gets away without it, so match `RegisterForm.tsx` first and only add the disable comment if `npm run lint` flags it.)
  - In `onSubmit`, before the `fetch`: `if (siteKey && !turnstileToken) { setError(t('auth.captchaRequired')); setIsLoading(false); return }` — place it after `setIsLoading(true)`/`setError(null)` so the loading flag is correctly cleared.
  - Send `turnstileToken` in the JSON body: `JSON.stringify({ email, turnstileToken })`.
  - On a non-OK response: call `resetTurnstile()` and set the error as `data.code ? t(apiErrorKey(data.code)) : (data.error || t('errors.generic'))` (import `apiErrorKey` from `@/lib/errors/apiErrorKey`) — this is what makes a Turnstile rejection show a translated message instead of the route's raw English string.
  - Render `{siteKey && (<div className="flex justify-center"><div ref={turnstileRef} className="rounded-xl" /></div>)}` inside the form, between the error line and the submit `<Button>` — same placement `RegisterForm.tsx` uses (L289-294).

- [x] **Step 6 — Gap 4a: widen `getRequestIp` to accept a plain `Request`**
  - Files: `src/lib/consent-service.ts`
  - L283-285 → `export function getRequestIp(req: Request): string` and `const reqWithIp = req as Request & { ip?: string }`. Body otherwise identical.
  - Delete the now-unused `import type { NextRequest } from "next/server"` on L1 (F6 — it has no other use in the file).
  - Verify with `npx tsc --noEmit` that no existing caller broke (none can: `NextRequest extends Request`).

- [x] **Step 7 — Gap 4b: new `src/lib/auth-guards.ts`**
  - Files: `src/lib/auth-guards.ts` (new, ~35 lines)
  - Imports: `rateLimit` from `@/lib/cache`, `validateTurnstileForAPI` from `@/lib/turnstile`. **Nothing else** — no Prisma, no next-auth, no `next/server` (this is what keeps it Vitest-importable, D3).
  - Exports exactly the shape in D3. Body:
    1. `const { allowed } = await rateLimit(\`rate:login:${ip}\`, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_SEC)`; if `!allowed` → `{ ok: false, reason: 'RATE_LIMITED' }` (and do **not** call Turnstile — D4).
    2. `const token = typeof turnstileToken === 'string' && turnstileToken ? turnstileToken : undefined` (Auth.js delivers form values as strings, F3 — anything else is treated as absent).
    3. `const result = await validateTurnstileForAPI(token, ip, { requireToken: false })`.
    4. If `!result.success`: `if (result.errorResponse?.code === 'VERIFY_ERROR') return { ok: true }` with the D5 comment explaining the fail-open, else `{ ok: false, reason: 'TURNSTILE_FAILED' }`.
    5. `return { ok: true }`.
  - Add a file-header comment stating why this lives here and not in `src/auth.ts` (D3 reason 1).

- [x] **Step 8 — Gap 4c: wire the guard into `src/auth.ts`**
  - Files: `src/auth.ts` (currently 61 lines; must land well under 500)
  - Add `turnstileToken: { label: "Turnstile", type: "hidden" }` to the `credentials: { ... }` config object (L18-21). This is only needed so `credentials.turnstileToken` type-checks — Auth.js forwards the field either way (F2) — and it is inert because `pages.signIn` points at the custom `/auth/login` page, so Auth.js's built-in sign-in page is never rendered.
  - Change `async authorize(credentials)` → `async authorize(credentials, request)` (F1).
  - Insert **after** the existing `if (!credentials?.email || !credentials?.password) return null` early-return and **before** the existing `try {`:
    ```ts
    const ip = getRequestIp(request)
    const guard = await checkLoginGuards({ ip, turnstileToken: credentials.turnstileToken })
    if (!guard.ok) {
      console.warn("[auth] login blocked:", guard.reason, ip)
      return null
    }
    ```
  - New imports: `getRequestIp` from `@/lib/consent-service`, `checkLoginGuards` from `@/lib/auth-guards`.
  - The existing `try { ... } catch { ... } return null` block is **not** modified in any way. No new error class, no `CredentialsSignin` subclass (D6).
  - **Boundary the coder must not cross:** `src/auth.config.ts` is the Edge-runtime config used by `src/middleware.ts` and must keep importing nothing Node-only (its L3-5 comment). None of this change goes near it, and `src/middleware.ts` is not touched.

- [x] **Step 9 — Gap 4d: `LoginForm.tsx` widget + token**
  - Files: `src/components/auth/LoginForm.tsx`
  - Same widget mechanism + `resetTurnstile()` helper as Step 5 (copied from `RegisterForm.tsx` L32-81).
  - In `onSubmit`, after `setError(null)`: `if (siteKey && !turnstileToken) { setError(t('auth.captchaRequired')); setIsLoading(false); return }`.
  - `signIn` call becomes:
    ```ts
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      ...(turnstileToken ? { turnstileToken } : {}),
      ...(callbackUrl ? { callbackUrl } : {}),
    })
    ```
    The conditional spread is mandatory — a `null` would be transmitted as the string `"null"` (F3).
  - In the `if (res?.error)` branch, call `resetTurnstile()` **before** `setError(...)` (D7 — this is the fix that lets a user who mistyped their password retry successfully).
  - Render `{siteKey && (<div className="flex justify-center"><div ref={turnstileRef} className="rounded-xl" /></div>)}` between the error line (L108-112) and the "Forgot password?" row.
  - The `errorParam === 'CredentialsSignin'` effect (L24-28) is unchanged.

- [x] **Step 10 — Gap 4e: keep post-registration auto-login working (D9 — the one sanctioned edit to `RegisterForm.tsx`)**
  - Files: `src/components/auth/RegisterForm.tsx`
  - Add `const turnstileTokenRef = React.useRef<string | null>(null)` and set it inside the existing widget `callback` alongside the existing `setTurnstileToken(token)` (one added line inside the callback — this is the only edit inside the mount effect, and it exists to avoid a stale closure).
  - Add two small helpers next to it: `resetTurnstile()` (as in Step 5, also clearing `turnstileTokenRef.current`) and
    ```ts
    async function waitForFreshTurnstileToken(previous: string | null, timeoutMs = 4000): Promise<string | null> {
      if (!siteKey) return null
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const current = turnstileTokenRef.current
        if (current && current !== previous) return current
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return null
    }
    ```
  - In `onSubmit`, between the successful `/api/auth/register` response and the `signIn(...)` call:
    ```ts
    // Turnstile tokens are single-use — /api/auth/register just consumed ours,
    // and the login guard in src/auth.ts now requires a valid one. Reset the
    // widget and wait briefly for a fresh token; on timeout we fall through to
    // the existing "sign in manually" fallback below.
    const consumed = turnstileTokenRef.current
    resetTurnstile()
    const freshToken = await waitForFreshTurnstileToken(consumed)
    ```
    and pass `...(freshToken ? { turnstileToken: freshToken } : {})` into the existing `signIn("credentials", {...})` options.
  - **Nothing else in this file changes** — not the form markup, not the register `fetch` payload, not the consent checkboxes, not the existing fallback branch.

- [x] **Step 11 — i18n + error-code mapping**
  - Files: `src/lib/errors/apiErrorKey.ts`, `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Add `'TURNSTILE_TOKEN_REQUIRED'` and `'TURNSTILE_FAILED'` to `KNOWN_ERROR_CODES` (these are the two codes `validateTurnstileForAPI` emits, F7; `TURNSTILE_NOT_CONFIGURED` is unreachable with `requireToken: false` — do not add it).
  - Add to all three locale files (`npm run i18n:check` enforces exact key parity — real translations, never an empty string):
    - `errors.TURNSTILE_TOKEN_REQUIRED` — PL e.g. "Potwierdź weryfikację zabezpieczającą i spróbuj ponownie."
    - `errors.TURNSTILE_FAILED` — PL e.g. "Weryfikacja zabezpieczająca nie powiodła się. Spróbuj ponownie."
    - `auth.captchaRequired` — PL e.g. "Poczekaj na zakończenie weryfikacji zabezpieczającej i spróbuj ponownie." (used by `LoginForm` + `ForgotPasswordForm`, D7)
  - Do **not** add a new key for `ContactMasterPanel` — it reuses the existing `management.turnstileRequired` (F12).

- [x] **Step 12 — Tests**
  - Files: `tests/lib/auth-guards.test.ts` (new)
  - `vi.mock('@/lib/cache', ...)` and `vi.mock('@/lib/turnstile', ...)` only — no Prisma mock, no `@/auth` import (D3/F9). Cases:
    1. rate limit exceeded → `{ ok: false, reason: 'RATE_LIMITED' }` **and** `validateTurnstileForAPI` was not called;
    2. rate limit called with exactly `('rate:login:1.2.3.4', 10, 900)`;
    3. allowed + Turnstile success → `{ ok: true }`;
    4. allowed + `TURNSTILE_TOKEN_REQUIRED` → `{ ok: false, reason: 'TURNSTILE_FAILED' }`;
    5. allowed + `VERIFY_ERROR` → `{ ok: true }` (D5 fail-open);
    6. a non-string `turnstileToken` (`undefined`, `null`, `123`) is forwarded to `validateTurnstileForAPI` as `undefined`.
  - `authorize()` itself gets **no** unit test — `@/auth` is not importable under Vitest (F9); that is precisely why the logic was extracted. Its wiring is covered by the manual matrix below.
  - No existing test file should need changes: `tests/app/api/support/contact.test.ts` doesn't send a `turnstileToken` and `TURNSTILE_SECRET*` is `''` in the test env, so the new check short-circuits to success (F9). If the suite reports otherwise, **fix the route or add the mock — do not weaken an assertion**.

- [x] **Step 13 — DOX pass**
  - Files: `src/app/api/AGENTS.md`, `src/lib/AGENTS.md`, `src/components/AGENTS.md`, `src/components/booking-management/AGENTS.md`, `tests/AGENTS.md`
  - `src/app/api/AGENTS.md` — add one bullet that is the durable anti-drift contract (this whole task exists because that contract was never written down): every **unauthenticated public write** endpoint must call `rateLimit()` **and** `validateTurnstileForAPI(token, ip, { requireToken: false })`; list the covered set (`book`, `auth/register`, `auth/forgot-password`, `consents/{erase,export,withdraw}`, `support/contact`, `master/contact`) and the deliberate exemptions with their one-line reasons (`auth/reset-password` = emailed one-time token; the `bookings/*` family = known booking ID + full-E.164 ownership, rate-limit only, `ROADMAP.md` P1#4; `discounts/{preview,today}` = read-only GET).
  - `src/lib/AGENTS.md` — new bullet for `auth-guards.ts` (login rate limit 10/15min per IP + Turnstile gate, fail-open on `VERIFY_ERROR` only, deliberately a separate module from `src/auth.ts` because `@/auth` is not importable under Vitest); note that `consent-service.ts`'s `getRequestIp()` now takes a plain `Request` so `authorize()` can share it.
  - `src/components/booking-management/AGENTS.md` — extend L17: the hook now also gates `ContactMasterPanel` → `POST /api/master/contact`, and a panel that posts to a public endpoint owns its **own** `useTurnstileSession` instance rather than threading props through `PanelRenderer`.
  - `src/components/AGENTS.md` — one bullet: `auth/{Login,Register,ForgotPassword}Form.tsx` each carry an inline Turnstile widget and must send `turnstileToken` + reset the widget on failure (tokens are single-use); new auth forms copy that inline pattern and must not import the booking-management hook.
  - `tests/AGENTS.md` — add `tests/lib/auth-guards.test.ts` to the Local Contracts log with the note that `src/auth.ts`'s `authorize()` stays untested by design (the `@/auth`-under-Vitest constraint already documented in `src/app/api/AGENTS.md` L34).

- [x] **Step 14 — Verification**
  - `npm run lint` (zero **new** problems — a pre-existing baseline of ~45 problems exists on `master` in untouched files; confirm the delta with `git stash` if the count is ambiguous), `npx tsc --noEmit`, `npm run test`, `npm run i18n:check`.
  - **Do NOT run `npm run dev` or `npm run build`** — the user runs their own dev server and a concurrent build corrupts `.next/` (standing project constraint).
  - Then produce the manual-check list for the user (project `CLAUDE.md` requirement), **in Russian, short**, covering the Gap 4 matrix below.

---

## Acceptance Criteria

- [ ] `npm run test` green, including the 6 new `tests/lib/auth-guards.test.ts` cases; no existing test modified.
- [ ] `npx tsc --noEmit` clean; `npm run lint` introduces zero new problems; `npm run i18n:check` passes.
- [ ] `grep -rn "validateTurnstileForAPI" src/app/api` lists exactly: `book`, `auth/register`, `auth/forgot-password`, `support/contact`, `master/contact`, `consents/erase`, `consents/export`, `consents/withdraw` — and `grep -rn "checkLoginGuards" src` lists `src/auth.ts` + `src/lib/auth-guards.ts`.
- [ ] `git diff --stat` touches **only**: the 5 route/lib server files, 4 client components, `apiErrorKey.ts`, 3 locale files, `src/lib/auth-guards.ts` (new), `tests/lib/auth-guards.test.ts` (new), 5 AGENTS.md files. In particular `src/auth.config.ts`, `src/middleware.ts`, `src/app/api/book/route.ts`, the `consents/*` routes, `/api/auth/register/route.ts`, `PanelRenderer.tsx`, `BookingManagement.tsx`, `SearchPanel.tsx`, and `src/app/support/page.tsx` are byte-identical.
- [ ] `RegisterForm.tsx`'s diff is confined to the submit handler + the ref/helpers described in Step 10 (no markup change).
- [ ] Every touched file stays under 500 lines (`src/auth.ts` lands at ~80).
- [ ] No new npm dependency (`git diff package.json` is empty).
- [ ] **Gap 4 manual browser matrix — all 8 rows verified live before this is called done** (see below). Unit tests alone are explicitly not sufficient for this step.

### Gap 4 requires extra scrutiny — manual browser matrix (mandatory)

A mistake here locks every role out of the product. Verify **all** of these against a real browser and a real Cloudflare widget, on a dev server the user restarts themselves:

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Correct email+password, widget solved — as **SUPERADMIN** | Logged in, middleware role-routing lands on `/admin` as before |
| 2 | Correct email+password, widget solved — as **CLIENT** | Logged in, lands on `/profile`/`callbackUrl` as before |
| 3 | **Wrong** password, then immediately retry with the **correct** password on the same page | 1st: "Nieprawidłowy e-mail lub hasło"; 2nd: **succeeds** (proves the widget reset in D7 works — this is the single most important regression check) |
| 4 | 11 rapid wrong-password attempts from one IP | 11th blocked; message stays the generic "invalid email or password" (D6); a correct password also fails until the 15-min window rolls over |
| 5 | Submit before the widget finishes / with the widget removed via devtools | Client shows `auth.captchaRequired`, **no** network request to `/api/auth/callback/credentials` |
| 6 | Tamper the token in devtools to garbage, then submit with correct credentials | Rejected with the generic message; server log shows `[auth] login blocked: TURNSTILE_FAILED` |
| 7 | Register a brand-new account end-to-end | Still auto-logged-in and lands on `/profile` (D9). If it falls back to "sign in manually", that path must still work |
| 8 | Google / Telegram OAuth sign-in, and sign-out | Unaffected (no code path in this change touches them) |

Plus, for Gaps 1-3: support form still sends (and now genuinely validates), master-contact form sends with the widget visible, forgot-password still returns its anti-enumeration success for an unknown email.

---

## Constraints & Risks

**Must not be touched**
- `src/auth.config.ts` (Edge runtime — no Prisma/bcrypt/Node-only imports; its L3-5 comment is binding) and `src/middleware.ts`.
- `/api/book`, `/api/auth/register`, `consents/{erase,export,withdraw}`, `src/app/support/page.tsx`, the `bookings/*` family, `/api/auth/reset-password`, `/api/discounts/*` (D10).
- `PanelRenderer.tsx` / `BookingManagement.tsx` / `SearchPanel.tsx` (D8) — both parents are already flagged as near the 500-line limit.
- The stale `supportContactApiSchema` / `masterContactApiSchema` / `forgotPasswordApiSchema` in `api-schemas.ts` (F11) — pre-existing dead code, mention in the final report, do not delete and do not migrate the routes onto them.
- No new npm dependency: `validateTurnstileForAPI`, `rateLimit`, `useTurnstileSession`, `apiErrorKey` all already exist.

**Risks**

1. **R1 — Total-lockout risk (the reason this is FULL mode).** Three independent fail-open paths must all stay intact: `rateLimit()` fails open when Redis is down (F8); `requireToken: false` means an install with no Turnstile secret still logs in (F7); `VERIFY_ERROR` fails open so a Cloudflare siteverify outage can't lock the salon out of its own admin panel (D5). If the coder "hardens" any of these three into fail-closed, that is a critical review rejection.
2. **R2 — Single-use tokens (D7).** The most likely way to ship a broken login is to add the server check without the client-side widget reset. Matrix row 3 exists specifically to catch it. Note that `src/app/support/page.tsx` and (pre-Step-10) `RegisterForm.tsx` have the **same** latent flaw on a retry after a failed submit — flagged to the user, deliberately not fixed here (out of scope), and worth a follow-up task.
3. **R3 — The `RegisterForm.tsx` exception (D9).** This is a knowing, minimal deviation from the "don't touch RegisterForm.tsx" instruction, forced by Gap 4. The fallback if the user rejects it: revert Step 10 and accept that every registration ends with "Failed to auto-login. Please sign in manually." The coder must implement Step 10 as written and must **not** silently choose the degraded fallback instead.
4. **R4 — Shared-IP rate limiting.** 10/15min is per IP, so a salon where several staff log in from one office NAT could theoretically hit it. Mitigations: the budget is deliberately the loosest in the codebase (D4); a locked-out admin recovers in 15 minutes; Redis being down removes the limit entirely. In local dev there is no `x-forwarded-for`, so **all** dev logins share the `0.0.0.0` bucket (F10) — expect this while running matrix row 4 and don't mistake it for a bug.
5. **R5 — `getRequestIp` widening (D2)** touches a helper used by ~10 routes. It is a parameter-type widening (always safe), but `npx tsc --noEmit` is the gate that proves it; do not skip it. Also confirm the L1 `NextRequest` type import is actually removed, or lint's unused-import rule will flag it.
6. **R6 — Auth.js internals.** F1/F2/F3 were read from the installed `node_modules` in this session, not from memory. If a future `next-auth` beta bump changes the `authorize(credentials, request)` signature or stops forwarding unknown body fields, login-with-Turnstile breaks silently (the token would arrive as `undefined` → `TURNSTILE_TOKEN_REQUIRED` → generic "invalid credentials" for everyone). Pin/verify before upgrading `next-auth`; matrix row 1 is the canary.
