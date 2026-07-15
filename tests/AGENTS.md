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

## Work Guidance

- One test file per route/module, named `<thing>.test.ts` or `route.test.ts` inside a path-mirrored folder.

## Verification

- `npm run test` (full suite) or `npx vitest run tests/some.test.ts` for a single file.
