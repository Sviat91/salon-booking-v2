# AGENTS.md — src/lib

## Purpose

Core business logic and services: booking availability, consent/GDPR handling, caching, notifications (email + Telegram), encryption, validation schemas, and misc utilities. This is the layer API routes and pages call into — it owns the rules, not the callers.

## Ownership

Anything framework-agnostic: DB access via Prisma, external service clients (email, Telegram, Turnstile), and pure logic. No `"use client"` code and no direct `NextRequest`/`NextResponse` handling here (that belongs in `src/app/api/`).

## Local Contracts

- `cache.ts` wraps Upstash Redis with an in-memory TTL fallback (`cacheGet`/`cacheSet`/`cacheDel`/`rateLimit`/`cacheSetNX`) — always invalidate **both** layers when mutating procedures or schedule data; a stale in-memory hit survives a Redis-only invalidation.
- `availability.ts` is the single source of truth for bookable slots — combines `Schedule`, `DateOverride`, and existing `Appointment` rows. Don't recompute availability logic elsewhere.
- `encryption.ts` is mandatory for any secret at rest (OAuth client secrets, SMTP password, `User.passwordEncrypted` for master password recovery) — never store or log a plaintext secret from `TenantConfig`. It **requires** `AUTH_SECRET` and throws at import if missing/empty (no insecure fallback key).
- `notifications/` (`index.ts` dispatcher + `email.ts` + `telegram.ts`): public functions never throw — failures are caught and written to `NotificationLog`, not surfaced to the caller. Keep that contract when adding a new notification type.
- `validation/`: `client-validators.ts` has zero dependencies (safe for client bundles); `api-schemas.ts` (Zod) is server-only and is what route handlers should parse request bodies with.
- `admin-permissions.ts` is the only place that parses/grants the `clients`/`gdpr` permission JSON on `User.adminPermissions` — route handlers and admin pages call `getPermissionsForRole()`, they don't parse the JSON themselves.
- `api/error-handler.ts` + `api/error-responses.ts` are the shared error contract for route handlers — see [../app/api/AGENTS.md](../app/api/AGENTS.md).
- Files must stay under 500 lines — `consent-service.ts` (13KB), `booking-helpers.ts` (10KB), `notifications/index.ts` (13KB) are the largest; split further growth into new files rather than extending these.
- Guest phone ownership verification/matching uses full-E.164 comparison via `phonesMatchE164()` in `utils/phone-normalization.ts` (normalizes both sides, never last-9-digits suffix matching). `booking-helpers.ts` no longer holds the dead `verifyBookingAccess`/`matchesSearchCriteria` access helpers — they were unused in production and have been removed.

## Work Guidance

- New environment-dependent config reads go through `env.ts` where one exists for that variable, not scattered `process.env` reads.

## Verification

- `npx vitest run tests/lib/**` covers consent-service (still under the legacy `tests/lib/google/` path name), `utils/`, and `validation/` — extend co-located tests under `tests/lib/` when adding logic here. See [../../tests/AGENTS.md](../../tests/AGENTS.md).
