# Plan: Rate-limit registration (Roadmap Priority 3, item 1)

**Date:** 2026-07-14
**Status:** In Progress
**Mode:** LIGHT (orchestrator-written plan; replicates the existing Redis token-bucket rate-limit pattern already used on 6 other routes, no architectural decisions)

## Goal

`POST /api/auth/register` (`src/app/api/auth/register/route.ts`) has zero rate limiting — anyone can spam-create `CLIENT` accounts. The project already has a working rate-limit utility (`rateLimit()` in `src/lib/cache.ts`) used on 6 other routes: `forgot-password`, `reset-password`, `consents/export`, `consents/withdraw`, `consents/erase`, `support/contact`, `master/contact`. This plan adds the same protection to registration, matching the closest sibling routes (`forgot-password`/`reset-password`, same `/api/auth/*` family) exactly.

## Background — current code (verified live)

`src/app/api/auth/register/route.ts`:
- `POST` handler: parses/validates body with `registerSchema` (Zod) → checks existing user by email → bcrypt-hashes password → `prisma.$transaction` creates the user + merges legacy guest bookings + calls `saveConsentRecord(...)`.
- Already imports `getRequestIp` from `@/lib/consent-service` (used today only for the consent record's IP field):
  ```ts
  export function getRequestIp(req: NextRequest): string {
    const reqWithIp = req as NextRequest & { ip?: string }
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || reqWithIp.ip || "0.0.0.0"
  }
  ```
- No rate limiting, no CAPTCHA, no throttling currently exists in this file.

`src/lib/cache.ts` exports:
```ts
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; count: number }>
```
Token bucket via Redis `INCR`+`EXPIRE`. Returns `{ allowed: true, count: 1 }` if Redis is unconfigured/unreachable (fails open — a known, separate gap affecting all 6 existing callers too, NOT fixed by this plan, see Constraints).

Sibling routes' exact pattern (`src/app/api/auth/forgot-password/route.ts:26`, `src/app/api/auth/reset-password/route.ts:27`) — rate-limit check happens FIRST, before any request-body parsing:
```ts
const ip = getIp(req) // or getRequestIp(req)
const { allowed } = await rateLimit(`forgot-pw:${ip}`, 3, 900)
if (!allowed) {
  return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
}
```
(`forgot-password` uses limit 3/900s, `reset-password` uses 10/900s — both 15-minute windows, same family as this route.)

## Implementation Steps

- [x] Step 1: `src/app/api/auth/register/route.ts`
  - Add import: `import { rateLimit } from "@/lib/cache"` (alongside the existing imports).
  - As the very first statement inside `POST`, before `req.json()`/schema parsing (matching `forgot-password`/`reset-password`'s placement, not the consents/* routes' validate-then-limit ordering — registering is the same `/api/auth/*` family, and rate-limiting before parsing avoids spending a DB/bcrypt round trip on spam):
    ```ts
    const ip = getRequestIp(req)
    const { allowed } = await rateLimit(`rate:register:${ip}`, 5, 900)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }
    ```
  - Limit chosen: 5 registrations per 15 minutes (900s) per IP — sits between the two closest sibling routes (`forgot-password` 3/900s, `reset-password` 10/900s), reasonable for blocking spam loops without blocking a shared-IP household/office making a few legitimate signups.
  - `getRequestIp` is already imported in this file — no new IP-extraction helper needed, reuse it for both the rate-limit key and (unchanged) the existing consent-record IP usage further down.
  - Error response shape (`{ error: string }`, 429, no `code` field) matches `forgot-password`/`reset-password` exactly — the closest same-family precedent — rather than the `{ error, code: "RATE_LIMITED" }` shape used by the unrelated consents/* routes.

- [x] Step 2: Test file
  - Read `tests/app/api/auth/register.route.test.ts` in full first.
  - If it already mocks `@/lib/cache` (unlikely, since no rate-limit exists yet) — nothing to do.
  - Otherwise, add a mock for `@/lib/cache`'s `rateLimit` so tests get a deterministic `{ allowed: true, count: 1 }` regardless of environment (matching however `forgot-password.route.test.ts`/`reset-password.route.test.ts` already mock it, if those test files exist — check and follow the same convention). Do not change any other test expectations/behavior in this file.

- [x] Step 3: Verify
  - `npx tsc --noEmit` clean.
  - `npm run build` succeeds.
  - `npm run lint` — no new problems vs. the current baseline (54 problems / 49 errors / 5 warnings).
  - `npm run test -- register` (or the equivalent targeted run) — confirm the registration test file passes/fails at the same rate as before this change (don't introduce new failures; pre-existing unrelated failures in the broader suite are expected per ROADMAP Priority 4's known ~11-failing-file baseline).
  - Read the final route file once to confirm the rate-limit check is the first statement in `POST`, before `req.json()`.

## Acceptance Criteria

- [x] `POST /api/auth/register` returns `429 { error: "Too many requests. Please try again later." }` after 5 requests from the same IP within a 15-minute window, before touching the database.
- [x] Legitimate registration (under the limit) is completely unaffected — same validation, same transaction, same response shape as before.
- [x] No other route, validation logic, or consent-record behavior changed.
- [x] `tsc`/`build` clean; `lint`/`test` no new failures vs. baseline.

## Constraints & Risks

- **DO NOT** fix `rateLimit()`'s fail-open behavior in `src/lib/cache.ts` (returns `{ allowed: true }` whenever Redis is unconfigured/unreachable) — this is a real, separate gap affecting all 6 existing rate-limited routes too, flagged to the user, but out of scope for this specific task (adding rate-limiting to registration using the *existing* utility as-is). Raise as its own follow-up if the user wants it addressed.
- **DO NOT** add CAPTCHA/Turnstile here — Roadmap Priority 1 item 4 already tracks that separately as a deliberately-deferred, broader pass across multiple endpoints (not just registration).
- **DO NOT** change the rate-limit key to include anything besides IP (e.g. email) — matches every existing sibling route's IP-only keying convention exactly.
- No dev server — stop after implementation for the user's manual test: submit the registration form 6 times in quick succession (same network/IP) and confirm the 6th attempt is rejected with a 429/friendly error instead of proceeding.
