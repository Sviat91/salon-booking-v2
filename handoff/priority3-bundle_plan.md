# Plan: Roadmap Priority 3 bundle (5 items) — phone verification, git leaks, security headers, double-booking race, hardcoded RU placeholder

**Date:** 2026-07-14
**Status:** Complete
**Mode:** FULL (planner-written; architectural decisions on phone-match semantics, CSP trade-off, and first-ever use of `$transaction`)

## Goal
Close five unrelated Roadmap Priority-3 items in one combined pass: (1) verify guest phone by full normalized number instead of last-9-digits, (2) stop tracking `app.db` + `public/uploads/` in git without rewriting history, (3) add pragmatic security headers via `next.config.mjs`, (4) close the double-booking race with `$transaction`, and (5) replace the hardcoded Russian placeholder service string with an English default.

## Scope note — what is explicitly NOT in this pass
- **6th Priority-3 item (mixed pl/ru error-message text)** — deferred by the user to a separate future session. Do NOT touch error-message wording.
- **No git history rewrite** (no `filter-repo`/BFG/force-push) — Item 2 is `git rm --cached` only.
- **`Somique Beauty Design System/uploads/`** (3 tracked files at repo root) — a design-deliverable reference bundle, NOT app runtime output. Leave its git-tracking untouched.
- **No nonce-based CSP / no `middleware.ts` or `layout.tsx` restructuring** — Item 3 is a pragmatic `unsafe-inline` CSP in `next.config.mjs` only (see Architecture Decisions).
- **No DB unique constraint / no schema migration** — Item 4 uses `$transaction` only (see Architecture Decisions).
- **Do not remove the fallback-service creation mechanism** — Item 5 changes only the literal string.
- **No dev server** — user tests manually after implementation.

## Architecture Decisions

### Item 1 — "full number" comparison semantics (the key correctness decision)
- **Compare full E.164, normalizing BOTH sides at compare time.** Use the already-proven `normalizePhoneToE164()` from `src/lib/utils/phone-normalization.ts` (Polish-default: bare 9-digit → `+48…`, `00`-prefix → `+`, throws `Error('INVALID_PHONE')` on garbage). This is the same helper `consent-service.ts` and the three GDPR routes already rely on.
- **Why E.164 and NOT digits-only full match:** there is no backfill migration in scope, so `User.phone` rows stored before this fix may lack a country code (e.g. bare `123456789`). A pure digits-only full-string match would REGRESS those users: input `+48123456789` (`48123456789`) ≠ stored `123456789`. `normalizePhoneToE164` canonicalises BOTH sides to `+48123456789`, so a pre-fix bare number and a `+48`-prefixed input still match. That is exactly what we need.
- **Why this still fixes the vuln:** the old `.slice(-9)` matched any number sharing the last 9 digits regardless of country code. Under E.164, knowing only someone's 9-digit national number and passing it bare normalizes to `+48…`; it will NOT match a stored `+380…` (Ukrainian) number. Cross-country-code suffix matching is closed. Numbers stored/entered without any country code both default to `+48`, so same-underlying-number still matches (symmetric mis-assignment does not break equality).
- **Extract ONE shared helper** `phonesMatchE164(a, b)` in `phone-normalization.ts` and call it from all 5 routes. Justified (not speculative) abstraction: 5 identical, security-critical copies today; a single tested function prevents divergence and gives a unit-test target. It swallows the `INVALID_PHONE` throw and returns `false` (invalid/empty never matches).
- **Keep each route's existing `length < 9` early guard** (returns `400 INVALID_PHONE` / "too short") so that UX is unchanged; only the last-9 comparison is replaced.
- **Normalize at storage time too** in `book/route.ts`: new guest `User.phone` is written as E.164, and the guest-lookup `findFirst` uses the same normalized value so lookup and write stay consistent. Existing raw rows are not backfilled (out of scope); compare-time normalization keeps them working.

### Item 1 — dead code (correction to the research brief)
- The two functions to delete — `verifyBookingAccess()` and `matchesSearchCriteria()` in `src/lib/booking-helpers.ts` — are unused in production **but are imported and tested by `tests/lib/booking-helpers.test.ts`** (research said "not called anywhere"; that missed the test import). That test file tests a stale Google-Calendar-era signature (`verifyBookingAccess(mockEvent, phone, name)` vs the real 2-arg object signature) and is already part of the known-failing baseline. Deleting the functions without touching the test would turn a body-level failure into an unresolved-import failure for the whole file (including the unrelated `canModifyBooking` block). So the coder must also trim that test file.
- Per the standing Roadmap Priority-4 directive ("delete all dead/old/unnecessary code immediately, no confirmation"), delete both functions. Keep them minimal-blast-radius:
  - `canModifyBooking` is ALSO unused in production, but the research did NOT scope it and it is a still-valid pure util — **leave it and its test block intact** (surgical; out of scope).
  - The deprecated wrappers `normalizeString`/`normalizePhone` and the interface `UserAccessCriteria` in `booking-helpers.ts` become internally-unused after the deletion but are `export`ed, so ESLint `no-unused-vars` will NOT flag them and their top-of-file imports stay referenced. **Leave them** (removing them cascades into import removal — out of the surgical scope; note as observed).

### Item 2 — untrack without ignoring the live DB or rewriting history
- **`app.db` needs no new `.gitignore` rule** — `*.db` (line 39) already matches it at every level. gitignore does not retroactively untrack, which is why the root file is still tracked. The only action is `git rm --cached app.db`. Adding a redundant `app.db` line would violate surgical/minimal; skip it. (This is a deliberate deviation from the raw research note, which suggested adding `app.db` — flagged here so the reviewer sees it.)
- **`public/uploads/` DOES need a new rule** — it has none today. Add `public/uploads/` to `.gitignore`. The upload route (`src/app/api/upload/route.ts:44-45`) does `mkdir(uploadsDir, { recursive: true })`, so the directory is recreated at runtime on first upload; no `.gitkeep` is required and none is added.
- **`git rm --cached` only** (never `git rm`, never `-f`): files must remain physically on disk so uploaded images keep serving at `/uploads/<name>`. History still contains the old bytes — a full scrub is a separate, explicitly-requested task (see Constraints).

### Item 3 — pragmatic `unsafe-inline` CSP (explicit trade-off, do not silently upgrade)
- **Use a CSP with `'unsafe-inline'` for `script-src`/`style-src`, set globally via `next.config.mjs` `headers()` — NOT a nonce-based CSP.** `layout.tsx` renders 5 inline `<script>/<style dangerouslySetInnerHTML>` blocks with per-request DYNAMIC content (dark-mode bootstrap + TenantConfig-driven CSS vars/backgrounds), so hashes won't work and nonces would require threading a per-request nonce through `middleware.ts` (currently narrowly `matcher`-scoped, would need site-wide coverage) and `layout.tsx` — a much larger, higher-risk change than the rest of this bundle warrants.
- **This is a real, known weakening** of CSP's XSS protection that a strict review will flag. It is stated here on purpose: going from zero headers to CSP-with-`unsafe-inline`-plus-proper-allowlists is still a strict improvement, and full nonce hardening is a clearly-labelled future follow-up. The coder must NOT silently upgrade to nonces.
- **Global via `next.config.mjs`, not middleware** — the middleware `matcher` doesn't cover `/` or `/[masterId]` (where headers matter most). `headers()` applies to all paths without touching auth middleware.
- **Allowlists driven by verified live usage:** analytics `https://stats.theboatscanner.com` (script + beacon); images from `'self'`, `data:`, `blob:`, and the three Google hosts already in `images.remotePatterns` (`drive.google.com`, `lh3.googleusercontent.com`, `googleusercontent.com`); same-origin iframe (`HomepagePreview.tsx` embeds `/?preview=1`) → `frame-src 'self'`, `frame-ancestors 'self'`, and `X-Frame-Options: SAMEORIGIN` (NOT `DENY`). No OAuth providers are wired, so no OAuth redirect origins are allowlisted (don't hardcode assumptions that block future extension).

### Item 4 — `$transaction` (not a DB constraint) given SQLite
- The conflict check is an **overlapping-range** query (`startTime < newEnd AND endTime > newStart`), not an exact-slot match, so a Prisma `@@unique` index would NOT close the gap (two different-but-overlapping starts both pass a unique index) — it would be a false sense of security. Do NOT add one.
- Wrap the conflict `findFirst` + the `create`/`update` in a single `prisma.$transaction(async (tx) => …)` at each of the 3 sites, using `tx` for both queries. On SQLite the write happens under an engine-level write lock held for the transaction, collapsing the read→write interleaving window. This is the tractable fix; SQLite/Prisma don't support Postgres-style exclusion constraints. First `$transaction` in the codebase — the plain `new PrismaClient()` in `src/lib/prisma.ts` supports interactive transactions.
- **In `book/route.ts`, KEEP the existing early conflict check (lines 97-113) as a fast-fail** so a guest `User` + consent record are not created for a slot that is already taken; ADD the authoritative in-transaction re-check wrapping the create. The early check is UX/cleanliness; the tx check is the correctness guarantee.

### Item 5 — language-neutral default
- Replace the literal `"Консультация"` with `"General Service"`. Keep `duration: 60`, `price: 0`, and the whole two-step "reuse generic `masterId: null` service, else auto-create" mechanism unchanged (the mechanism is required — `Appointment.serviceId` is non-nullable and the no-`procedureId` path is reachable).

---

## Implementation Steps

### Group A — Item 1: full-number phone verification + dead-code removal

- [x] **A1 — Add the shared `phonesMatchE164` helper**
  - Files: `src/lib/utils/phone-normalization.ts`
  - Append a new exported function (uses the existing `normalizePhoneToE164` in the same file):
    ```ts
    /**
     * Compare two phone numbers by full normalized E.164 value.
     * Returns true only if both normalize to the same E.164 number.
     * Null/empty/invalid inputs never match (returns false).
     */
    export function phonesMatchE164(
      a: string | null | undefined,
      b: string | null | undefined
    ): boolean {
      if (!a || !b) return false
      let na: string
      let nb: string
      try { na = normalizePhoneToE164(a) } catch { return false }
      try { nb = normalizePhoneToE164(b) } catch { return false }
      return na.length > 0 && na === nb
    }
    ```

- [x] **A2 — `bookings/cancel/route.ts`**
  - Files: `src/app/api/bookings/cancel/route.ts`
  - Add import: `import { phonesMatchE164 } from "@/lib/utils/phone-normalization"`.
  - Keep lines 46-52 (`searchPhoneDigits` + `length < 9` → 400 guard). Delete line 53 (`const searchLast9 = …`).
  - Replace the verify block (lines 78-89) so the ownership check becomes:
    ```ts
    const phoneMatch = phonesMatchE164(phone, appointment.client.phone)
    if (!phoneMatch) {
      return NextResponse.json(
        { error: "Weryfikacja nie powiodła się. Sprawdź poprawność danych.", code: "VERIFICATION_FAILED" },
        { status: 403 }
      )
    }
    ```
    (Remove the now-unused `clientPhoneDigits` line.)

- [x] **A3 — `bookings/update-time/route.ts`**
  - Files: `src/app/api/bookings/update-time/route.ts`
  - Same pattern as A2: add the import, keep lines 71-77 guard, delete line 78 (`searchLast9`), replace the verify block (lines 119-130) with the `phonesMatchE164(phone, appointment.client.phone)` check. Also update the stale doc-comment at line 31 ("phone last-9-digits") to "full E.164 number" — surgical one-line comment fix only.

- [x] **A4 — `bookings/update-procedure/route.ts`**
  - Files: `src/app/api/bookings/update-procedure/route.ts`
  - Same pattern: add the import, keep lines 55-61 guard, delete line 62 (`searchLast9`), replace the verify block (lines 87-98) with the `phonesMatchE164(phone, appointment.client.phone)` check.

- [x] **A5 — `bookings/[id]/route.ts` (PATCH)**
  - Files: `src/app/api/bookings/[id]/route.ts`
  - Same pattern: add the import, keep lines 75-81 guard, delete line 82 (`searchLast9`), replace the verify block (lines 108-119) with the `phonesMatchE164(phone, appointment.client.phone)` check. (Item 4 also edits this file — see D3; the two edits are in different regions and don't conflict.)

- [x] **A6 — `bookings/all/route.ts` (GET)**
  - Files: `src/app/api/bookings/all/route.ts`
  - Add the import. Keep lines 40-46 guard, delete line 47 (`searchLast9`). In the `matchingAppointments` filter, replace the phone check (lines 111-114) with:
    ```ts
    // Phone check — full normalized E.164 number
    if (!phonesMatchE164(rawPhone, client.phone)) return false
    ```
    Leave the name-matching logic (lines 116-131) untouched. Update the stale header comment (lines 19-23 / "Phone last-9-digits must match") to "full E.164 number".

- [x] **A7 — Normalize guest phone at storage time in `book/route.ts`**
  - Files: `src/app/api/book/route.ts`
  - Add import: `import { normalizePhoneToE164 } from "@/lib/utils/phone-normalization"`.
  - Immediately after the guest-phone validation (after line 46, still OUTSIDE the `try` at line 72), compute the normalized value with a proper 400 on garbage:
    ```ts
    let normalizedGuestPhone: string | null = null
    if (!isAuth && phone) {
      try {
        normalizedGuestPhone = normalizePhoneToE164(phone)
      } catch {
        return NextResponse.json(
          { error: "Invalid phone number", code: "INVALID_PHONE" },
          { status: 400 }
        )
      }
    }
    ```
  - In the guest branch (lines 128-147): change the `findFirst` lookup from `phone` to `normalizedGuestPhone` (both the `phone ?` ternary condition and the `where: { phone }`), and change the create's `phone: phone || null` to `phone: normalizedGuestPhone`. Leave the consent calls (`evaluateConsentStatus`, `saveConsentRecord`) receiving the original raw `phone` — they normalize internally, so behavior is unchanged.

- [x] **A8 — Delete dead helpers from `booking-helpers.ts`**
  - Files: `src/lib/booking-helpers.ts`
  - Delete `verifyBookingAccess()` (lines 40-92) and `matchesSearchCriteria()` (lines 125-184) in full, including their leading doc-comments.
  - **Leave untouched:** `normalizeString`/`normalizePhone` (deprecated exported wrappers — still exported, no lint error), the `UserAccessCriteria` interface (exported), `canModifyBooking`, `BookingModificationCheck`, `TimeSlot`, `getAvailableSlotsForRebooking`, `getProcedureDuration`, `BookingErrors`, and the top-of-file imports (lines 1-5). Do NOT cascade-delete these.

- [x] **A9 — Trim the stale test file**
  - Files: `tests/lib/booking-helpers.test.ts`
  - Change the import (line 2) to `import { canModifyBooking } from '@/lib/booking-helpers'`.
  - Delete the `describe('verifyBookingAccess', …)` block (lines 5-105) and the `describe('matchesSearchCriteria', …)` block (lines 173-276). Keep the `describe('canModifyBooking', …)` block and the outer `describe('booking-helpers', …)` wrapper.
  - (Note: the remaining `canModifyBooking` tests use a stale signature and are already part of the failing baseline — that is pre-existing and out of scope. Goal here is only to remove tests for the deleted functions and keep the import resolvable.)

- [x] **A10 — Unit test for the new helper**
  - Files: `tests/lib/utils/phone-match.test.ts` (new)
  - Add focused tests for `phonesMatchE164` covering: same `+48` number formatted differently (`+48123456789` vs `123 456 789`) → true; bare-9-digit stored vs `+48`-prefixed input (the no-backfill regression case) → true; different country codes sharing last 9 digits (`+48123456789` vs `+380…123456789`-style) → false; `null`/empty either side → false; garbage input → false. Put it in a NEW file (the existing `tests/lib/utils/phone-normalization.test.ts` has a pre-existing broken import and fails on load — do not entangle with it).

### Group B — Item 2: stop tracking `app.db` + `public/uploads/`

- [x] **B1 — `.gitignore`**
  - Files: `.gitignore`
  - Add `public/uploads/` (a good spot is right after the `node_modules/` / build block, or under a new `# Runtime uploads` comment). Do NOT add an `app.db` line — `*.db` (existing line 39) already covers it.

- [x] **B2 — Untrack the leaked files (working tree preserved)**
  - Run (repo root): first `git ls-files app.db public/uploads` to CONFIRM exactly what is tracked, then:
    - `git rm --cached app.db`
    - `git rm --cached public/uploads/*` (the 21 tracked `.png`/`.jpeg` files)
  - Use `--cached` only — never `git rm`, never `-f`. Do not stage `Somique Beauty Design System/uploads/`. Do not touch `prisma/app.db` (live DB; already ignored/untracked). If `git ls-files` shows a tracked `prisma/prisma/app.db`, leave it (out of scope; it is not the live DB and not in the research scope). Verify afterwards that all files still physically exist on disk.

### Group C — Item 3: security headers in `next.config.mjs`

- [x] **C1 — Add `headers()` to `next.config.mjs`**
  - Files: `next.config.mjs`
  - Add an `async headers()` method to the `nextConfig` object (alongside `experimental`, `images`, `reactStrictMode` — leave those untouched). Apply to all paths via `source: '/:path*'`. The CSP value MUST be a single-line string (no raw newlines in a header value); build it by joining directives with `"; "`:
    ```js
    async headers() {
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://stats.theboatscanner.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://drive.google.com https://lh3.googleusercontent.com https://googleusercontent.com",
        "font-src 'self' data:",
        "connect-src 'self' https://stats.theboatscanner.com",
        "frame-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ')

      return [
        {
          source: '/:path*',
          headers: [
            { key: 'Content-Security-Policy', value: csp },
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ],
        },
      ]
    },
    ```
  - Do NOT add `upgrade-insecure-requests` (would break local http manual testing). Do NOT touch `middleware.ts` or `layout.tsx`.

### Group D — Item 4: close the double-booking race with `$transaction`

- [x] **D1 — `book/route.ts` (create path)**
  - Files: `src/app/api/book/route.ts`
  - Leave the early conflict check (lines 97-113) as a fast-fail. Replace the final create (lines 194-204) + the two lines after it (206-208) with an atomic transaction that re-checks the conflict using `tx` and returns `null` on conflict:
    ```ts
    const created = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          masterId,
          date: new Date(dateOnly),
          status: { not: "CANCELLED" },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflict) return null
      return tx.appointment.create({
        data: {
          clientId: clientUser.id,
          masterId,
          serviceId,
          date: new Date(dateOnly),
          startTime,
          endTime,
          status: "CONFIRMED",
        },
      })
    })

    if (!created) {
      return NextResponse.json(
        { error: "Time slot is already booked", code: "CONFLICT" },
        { status: 409 }
      )
    }

    notifyBookingConfirmation(created.id).catch(console.error)
    return NextResponse.json({ eventId: created.id })
    ```

- [x] **D2 — `bookings/update-time/route.ts`**
  - Files: `src/app/api/bookings/update-time/route.ts`
  - Wrap the conflict `findFirst` (lines 151-161) + the `update` (lines 171-178) in one `$transaction`, signalling conflict via a boolean and translating to the existing 409 outside the tx:
    ```ts
    const hasConflict = await prisma.$transaction(async (tx) => {
      const conflicting = await tx.appointment.findFirst({
        where: {
          masterId: targetMasterId,
          date: new Date(newDate),
          status: { not: "CANCELLED" },
          id: { not: eventId },
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime },
        },
      })
      if (conflicting) return true
      await tx.appointment.update({
        where: { id: eventId },
        data: { date: new Date(newDate), startTime: newStartTime, endTime: newEndTime },
      })
      return false
    })

    if (hasConflict) {
      return NextResponse.json(
        { error: "Wybrany termin jest już zajęty.", code: "CONFLICT" },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })
    ```

- [x] **D3 — `bookings/[id]/route.ts` (PATCH)**
  - Files: `src/app/api/bookings/[id]/route.ts`
  - Restructure so the conflict re-check and the update are atomic (this file's Item-1 edit A5 is in the verify block above and is independent):
    - In the time-change block (lines 126-166): keep parse/validate and the `updateData.date/startTime/endTime` + `changes` assignments, but REMOVE the inline conflict check (lines 142-158). Capture the conflict window in a hoisted var, e.g. add after the `updateData`/`changes` assignments: `conflictWindow = { date: new Date(newDate), startTime: newStartTime, endTime: newEndTime }` where `let conflictWindow: { date: Date; startTime: string; endTime: string } | null = null` is declared just above line 122 (near `updateData`).
    - Keep the procedure block (lines 169-183) unchanged (service lookup stays outside the tx).
    - Replace the final update (lines 186-189) with:
      ```ts
      const hasConflict = await prisma.$transaction(async (tx) => {
        if (conflictWindow) {
          const conflicting = await tx.appointment.findFirst({
            where: {
              masterId: appointment.masterId,
              date: conflictWindow.date,
              status: { not: "CANCELLED" },
              id: { not: appointmentId },
              startTime: { lt: conflictWindow.endTime },
              endTime: { gt: conflictWindow.startTime },
            },
          })
          if (conflicting) return true
        }
        await tx.appointment.update({ where: { id: appointmentId }, data: updateData })
        return false
      })

      if (hasConflict) {
        return NextResponse.json(
          { error: "Wybrany termin jest już zajęty.", code: "CONFLICT" },
          { status: 409 }
        )
      }

      return NextResponse.json({ changes })
      ```

### Group E — Item 5: replace hardcoded RU placeholder

- [x] **E1 — `book/route.ts` fallback service string**
  - Files: `src/app/api/book/route.ts`
  - In the fallback create (lines 185-190), change `name: "Консультация"` to `name: "General Service"`. Leave `duration: 60`, `price: 0`, the surrounding "reuse generic else create" logic, and the comment intent unchanged (optionally update the comment "placeholder 'Consultation'" to match, but do not change behavior).

### Group F — DOX + verification

- [x] **F1 — DOX pass**
  - `src/lib/AGENTS.md`: add a Local Contract note that guest phone verification/matching uses full-E.164 comparison via `phonesMatchE164` (phone-normalization.ts), not last-9-digits; note that `booking-helpers.ts` no longer holds the dead `verifyBookingAccess`/`matchesSearchCriteria` access helpers.
  - `src/app/api/AGENTS.md`: add a Local Contract note that booking mutation routes (`book`, `bookings/update-time`, `bookings/[id]`) wrap the conflict check + write in a single `prisma.$transaction` (no DB-level uniqueness), and that ownership verification is full-E.164.
  - `tests/AGENTS.md`: note the removed `verifyBookingAccess`/`matchesSearchCriteria` blocks from `booking-helpers.test.ts` and the new `tests/lib/utils/phone-match.test.ts`.
  - `ROADMAP.md`: mark the five addressed Priority-3 items done (phone last-9-digits; `app.db`+uploads in git; security headers; double-booking race; hardcoded "Консультация") — keep the 6th (pl/ru error-text) OPEN. Add a "Уже сделано (сессия 2026-07-14)" entry summarizing this bundle. Record the two explicit trade-offs: CSP uses `unsafe-inline` (nonce hardening deferred) and git history still contains the old leaked bytes (full scrub deferred).
  - Root `CLAUDE.md` / `next.config.mjs` have no owning child AGENTS.md for the headers/gitignore infra changes — recording them in `ROADMAP.md` is sufficient; do not invent a new AGENTS.md.

- [x] **F2 — Verify**
  - `npx tsc --noEmit` clean.
  - `npm run lint` — no NEW problems vs. the established non-zero baseline.
  - `npm run build` succeeds (this is where the new `next.config.mjs headers()` and CSP string are validated).
  - `npm run test` — no NEW failures vs. the known-unstable baseline (~11 pre-existing failing files per Roadmap Priority 4); confirm the new `phone-match.test.ts` passes and `booking-helpers.test.ts` still loads (import resolves).
  - `grep -rn "slice(-9)" src/app/api/bookings src/app/api/book` — returns nothing (all last-9 comparisons gone).
  - `grep -rn "verifyBookingAccess\|matchesSearchCriteria" src tests` — returns nothing.
  - `grep -rn "Консультация" src` — returns nothing.
  - `grep -rn "\$transaction" src/app/api` — appears in `book`, `bookings/update-time`, `bookings/[id]`.
  - `git ls-files app.db public/uploads` — returns nothing (untracked); `ls app.db public/uploads` — files still present on disk.

## Acceptance Criteria
- [x] **Item 1:** all 5 routes (`cancel`, `update-time`, `update-procedure`, `bookings/[id]`, `bookings/all`) verify ownership via `phonesMatchE164` (full E.164), no `.slice(-9)` remains; `book/route.ts` stores new guest `User.phone` as E.164 and looks guests up by the same normalized value; the two dead helpers are deleted and the test file trimmed; `phonesMatchE164` has passing unit tests including the no-country-code non-regression case and the cross-country-code rejection.
- [x] **Item 2:** `app.db` and the 21 `public/uploads/*` files are `git rm --cached`'d (untracked) but still on disk; `.gitignore` has `public/uploads/` (no redundant `app.db` line); `Somique Beauty Design System/uploads/` and `prisma/app.db` untouched; no history rewrite.
- [x] **Item 3:** `next.config.mjs` sets CSP (`unsafe-inline` script/style, analytics + Google-image + same-origin-frame allowlists), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` globally; `middleware.ts`/`layout.tsx` untouched; `HomepagePreview` iframe and analytics still function (manual check).
- [x] **Item 4:** `book`, `bookings/update-time`, `bookings/[id]` perform their conflict check + write inside one `prisma.$transaction`; no `@@unique`/migration added.
- [x] **Item 5:** fallback service is named `"General Service"`; the reuse/auto-create mechanism, duration 60, price 0 are unchanged.
- [x] `tsc`/`build` clean; `lint`/`test` no new failures vs. baseline; DOX (`src/lib/AGENTS.md`, `src/app/api/AGENTS.md`, `tests/AGENTS.md`, `ROADMAP.md`) updated; the 6th Priority-3 item left OPEN.

## Constraints & Risks
- **History not scrubbed (Item 2):** past commits still contain the old `app.db` bytes (a real but empty SQLite file — 0 rows in `User`, schema/migration state only, no live PII) and all previously-uploaded images. Removing them from history is a separate, riskier, explicitly-requested task (filter-repo/BFG + force-push) — NOT in this pass.
- **CSP `unsafe-inline` (Item 3):** a deliberate, known weakening flagged above. Full nonce-based CSP is the future follow-up. Also: if the user later runs `npm run dev`, the HMR websocket is same-origin and covered by `connect-src 'self'`; if a dev-only CSP warning appears, `ws:`/dev exceptions are a dev concern, not a prod change — do not loosen prod CSP for it.
- **No backfill (Item 1):** pre-existing `User.phone` rows keep their raw formatting; compare-time E.164 normalization keeps them matching. A returning guest whose OLD row has a raw phone may, on a re-book, fail the normalized `findFirst` lookup and get a second `User` row — a minor, acceptable data-duplication edge (not a security issue; verification still works against whichever row the appointment is attached to).
- **SQLite write locking (Item 4):** interactive `$transaction` serializes writes at the engine level; under heavy concurrency a `SQLITE_BUSY`/timeout is theoretically possible, but salon-scale concurrency is tiny — acceptable. This is the first `$transaction` in the codebase.
- **Do NOT** touch `bookings/update-procedure/route.ts` for Item 4 (it intentionally does no conflict check), `middleware.ts`/`layout.tsx` for Item 3, `canModifyBooking`/`normalizeString`/`normalizePhone`/`UserAccessCriteria` in `booking-helpers.ts`, or the `Somique Beauty Design System/uploads/` git status.
- **No dev server / stagewise checkpoint:** stop after implementation for the user's manual test — (1) as a guest, cancel/reschedule a booking using the phone with and without `+48`, confirm it verifies; confirm a phone that only shares the last 9 digits of a different-country number no longer passes; (2) `git status` shows `app.db`/`public/uploads` no longer tracked but images still load at `/uploads/...`; (3) load the site, confirm the CSP header is present (devtools), analytics still loads, and the admin Settings homepage-preview iframe still renders; (4) attempt two overlapping bookings, confirm one wins with a 409; (5) with zero services and no procedure selected, confirm the fallback service is now "General Service".
