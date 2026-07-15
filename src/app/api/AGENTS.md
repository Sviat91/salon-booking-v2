# AGENTS.md — src/app/api

## Purpose

All backend HTTP endpoints (Next.js Route Handlers). Grouped by domain: `admin/` (ADMIN/SUPERADMIN-only management), `master/` (MASTER-only own-data endpoints), `client/` (authenticated client self-service), `consents/` (public GDPR flow), plus top-level booking endpoints (`book`, `bookings`, `availability`, `day`, `procedures`, `masters`).

## Ownership

Request parsing, auth/role checks, and response shaping. Business logic (availability calculation, booking creation, consent evaluation, notifications) must stay in `src/lib/` — route handlers call into it, they don't reimplement it.

## Local Contracts

- Auth checks use `auth()` from `src/auth.ts` inside the handler (no middleware-based API protection) — check `session.user.role` explicitly per handler. `admin/` routes require `ADMIN`/`SUPERADMIN`; fine-grained admin permissions (`clients`, `gdpr` view/edit/delete) go through `src/lib/admin-permissions.ts`, never hand-rolled.
- Validate request bodies with schemas from `src/lib/validation/api-schemas.ts` (Zod) — don't inline ad-hoc validation.
- Errors: prefer `handleApiError()` / `ErrorResponses` from `src/lib/api/error-handler.ts` and `error-responses.ts` for consistent status codes, logging, and Sentry reporting. Some older routes (e.g. `book/route.ts`) still return `NextResponse.json` manually — match the file you're editing, but use the shared handler for new routes.
- Mutations to procedures or schedule data must invalidate both cache layers per `src/lib/cache.ts` (`procedures:v2:<masterId>`, `availability:<masterId>:<dates>`) — see [../../lib/AGENTS.md](../../lib/AGENTS.md).
- `cron/reminders` is invoked by an external scheduler, not a user — don't add session-based auth to it; check its existing token/secret guard before changing.
- Booking mutation routes (`book`, `bookings/update-time`, `bookings/[id]`) wrap their conflict re-check + write in a single `prisma.$transaction` to close the double-booking race window — there is no DB-level uniqueness constraint (an overlapping-range conflict check can't be expressed as a unique index). Guest/client ownership verification across all booking routes (`cancel`, `update-time`, `update-procedure`, `bookings/[id]`, `bookings/all`) is full-E.164 phone comparison via `phonesMatchE164()`, not last-9-digits.

## Work Guidance

- One `route.ts` per endpoint, HTTP-method-named exports (`GET`, `POST`, etc.) — do not add non-standard exports.
- `export const runtime = "nodejs"` where the handler needs Node APIs (Prisma, bcrypt) not available on the edge runtime.

## Verification

- `npm run test` — route-level tests live in `tests/app/api/` mirroring this tree, see [../../../tests/AGENTS.md](../../../tests/AGENTS.md).
- Any route handler that imports `@/auth` needs `vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))` in its test file (targets the guest path) — otherwise Vitest's `node` environment fails to resolve next-auth's internal `next/server` import.
- `npm run lint` (zero warnings).
