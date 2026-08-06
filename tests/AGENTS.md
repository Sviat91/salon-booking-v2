# AGENTS.md — tests

## Purpose

Vitest test suite. `tests/app/api/**` mirrors `src/app/api/**` for route-handler tests; `tests/lib/**` mirrors `src/lib/**`; `tests/api/routes.test.ts` is an older top-level suite that predates the `tests/app/api/` mirror structure.

## Ownership

Test files only. Fixtures/mocks are inline per-file (`vi.mock(...)`), no shared fixture directory today beyond `tests/setup/env.ts`.

## Local Contracts

- `tests/setup/env.ts` seeds required env vars before any test runs — new tests get this for free via `vitest.config.ts`'s `setupFiles`, don't re-seed env vars per-file.
- Route handler tests mock `@/lib/prisma` rather than hitting a real DB — see [../prisma/AGENTS.md](../prisma/AGENTS.md).
- New route tests should follow the `tests/app/api/**` mirror path, not `tests/api/`.
- (2026-07-13) Removed `tests/config/`, `tests/api/multi-master.test.ts`, `tests/lib/google-sheets.procedures.test.ts`, and `tests/lib/google/*.test.ts` — all covered code (`src/config/masters*.ts`, `src/lib/google/*`) had already been deleted from `src/`, so these suites only ever failed on import. ~11 other files still fail for unrelated, pre-existing reasons (real code, stale/broken test bodies) — not yet triaged, see `ROADMAP.md` Priority 4.
- (2026-07-14) `tests/lib/booking-helpers.test.ts` had its `verifyBookingAccess`/`matchesSearchCriteria` describe blocks removed (the two functions were deleted from `src/lib/booking-helpers.ts` as dead code) — only the `canModifyBooking` block remains (still part of the pre-existing failing baseline, stale signature). New `tests/lib/utils/phone-match.test.ts` covers the new `phonesMatchE164()` helper.
- (2026-07-15) The ~11 pre-existing failing files (~80 tests) were triaged and fixed. Root cause of the shared infra failure: `@/auth` (next-auth beta) transitively imports `next/server` in a way Vitest's `node` environment can't resolve — fixed by `vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))` in every test that imports a route handler which imports `@/auth` (`tests/app/api/book/consent-gate.test.ts`, `tests/app/api/consents/{erase,export,withdraw}.test.ts`, `tests/api/routes.test.ts`). This is the standard pattern for testing auth-importing routes going forward — it targets the guest (`auth() → null`) path, which is what all of these routes' tests exercise. `tests/lib/availability.categories.test.ts` was deleted (tested permanently-removed Google-Sheets category-exception availability) and the two Google-Calendar-backed `POST /api/book` smoke tests were dropped from `tests/api/routes.test.ts` (superseded by `consent-gate.test.ts`, which now covers the DB-based book route end-to-end including the `$transaction` conflict re-check). `tests/lib/availability.test.ts`, `tests/lib/utils/phone-normalization.test.ts`, `tests/lib/utils/string-normalization.test.ts`, `tests/lib/booking-helpers.test.ts`, `tests/app/api/support/contact.test.ts`, and `tests/api/routes.test.ts` were rewritten to match current source contracts (stale imports/signatures, removed features). For `availability.test.ts`, the pattern is: `vi.mock('@/lib/schedule-utils', async (importActual) => ({ ...(await importActual()), readWeeklyFromDb: vi.fn(), readOverridesFromDb: vi.fn(), fetchBusyRanges: vi.fn() }))` — keeps the pure helpers real, mocks only the three DB readers. Suite is now green: 18 files / 101 tests, 0 failures, 0 skips.
- (2026-08-03) New `tests/lib/auth-guards.test.ts` covers `checkLoginGuards()` (`src/lib/auth-guards.ts`) with `vi.mock('@/lib/cache', ...)` + `vi.mock('@/lib/turnstile', ...)` only — no Prisma mock needed. `src/auth.ts`'s `authorize()` itself stays untested by design: `@/auth` is not importable under Vitest (the `next/server` constraint documented above and in `src/app/api/AGENTS.md` L34), which is exactly why the login rate-limit/Turnstile logic was extracted into this separately-testable module.
- (2026-07-27) Discounts feature: new `tests/lib/discounts/{eligibility,shared,authz}.test.ts` and `tests/app/api/discounts/preview/route.test.ts`. `eligibility.test.ts` and `shared.test.ts` need **no mocks by design** (the modules under test are Prisma-free/pure) — `authz.test.ts` mocks `@/lib/prisma` following the `pages-owner.test.ts` pattern. The Telegram bot's `'PROMO'` wizard step is deliberately **not** covered by a grammy test harness (none exists yet) — its logic is pure delegation to `evaluateDiscount()`/`explainCode()`, which `eligibility.test.ts` covers exhaustively (every `CodeStatus` value maps 1:1 to the bot's `bot.promo.*` message keys); the bot flow itself is verified manually. Every test whose route/service touches an `Appointment` row was extended with `discount`/`discountService`/`discountRedemption`/`masterProfile`/`masterService` mocks per `prisma/AGENTS.md`'s "a schema change requires updating mocks" rule — see `booking-service.test.ts`, `book/consent-gate.test.ts`, `client/appointments/route.test.ts`, `master/appointments/route.test.ts`, `procedures/route.test.ts`, `api/routes.test.ts`.
- (2026-08-05) New `tests/app/admin/master/calendar/calendar-utils.test.ts` — the first `tests/app/admin/**` mirror test (mirroring `src/app/admin/**` rather than `src/app/api/**`). Covers `resolveDayScheduleState()` (override-beats-template resolution used by `BulkSettingsModal`'s calendar dots) and needs **no mocks by design** (the module under test is Prisma-free/pure; its only cross-file import is `import type`, erased at transform time).
- (2026-08-05) New `tests/lib/content/photo-ids.test.ts` — covers `derivePhotoIds()`/`reorderPhotosByIds()` (`src/lib/content/photo-ids.ts`), no mocks by design (the module under test is pure/React-free/Prisma-free).
- (2026-08-06) New `tests/lib/og-image.test.ts`, no mocks by design; it is also the only place `sharp`'s native binding is exercised by the suite (a real temp PNG round-trip).

## Work Guidance

- One test file per route/module, named `<thing>.test.ts` or `route.test.ts` inside a path-mirrored folder.

## Verification

- `npm run test` (full suite) or `npx vitest run tests/some.test.ts` for a single file.
