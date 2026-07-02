# AGENTS.md — tests

## Purpose

Vitest test suite. `tests/app/api/**` mirrors `src/app/api/**` for route-handler tests; `tests/lib/**` mirrors `src/lib/**`; `tests/config/` covers `src/config/`; `tests/api/` is an older top-level suite (`multi-master.test.ts`, `routes.test.ts`) that predates the `tests/app/api/` mirror structure.

## Ownership

Test files only. Fixtures/mocks are inline per-file (`vi.mock(...)`), no shared fixture directory today beyond `tests/setup/env.ts`.

## Local Contracts

- `tests/setup/env.ts` seeds required env vars (incl. legacy `GOOGLE_APPLICATION_CREDENTIALS_JSON`/`GOOGLE_CALENDAR_ID`/`GOOGLE_SHEET_ID` defaults that no longer have live consumers in `src/`) before any test runs — new tests get this for free via `vitest.config.ts`'s `setupFiles`, don't re-seed env vars per-file.
- Route handler tests mock `@/lib/prisma` rather than hitting a real DB — see [../prisma/AGENTS.md](../prisma/AGENTS.md).
- `tests/lib/google/*.test.ts` and `tests/lib/google-sheets.procedures.test.ts` are named after a `lib/google/` module that no longer exists in `src/lib` (consent logic now lives in `src/lib/consent-service.ts`); treat the directory name as legacy, not a pointer to current source layout.
- New route tests should follow the `tests/app/api/**` mirror path, not `tests/api/`.

## Work Guidance

- One test file per route/module, named `<thing>.test.ts` or `route.test.ts` inside a path-mirrored folder.

## Verification

- `npm run test` (full suite) or `npx vitest run tests/some.test.ts` for a single file.
