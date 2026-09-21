# Review: Google Calendar sync — Stage 1 (push only)

**Date:** 2026-09-21 · **Verdict:** CHANGES REQUESTED (1 Critical/Architectural, several Minor).
Note: the reviewer agent has no Write tool; the orchestrator saved its findings here (condensed). Fixes are specified in `handoff/google-calendar-sync_stage1-fixes_plan.md`.

## Critical/Architectural
- **C1 — admin PUT can change `masterId` and orphan the Google event** (`src/app/api/admin/calendar/appointments/[id]/route.ts:119-138`, `src/lib/google-calendar/outbox.ts:31-37`, `prisma/schema.prisma:246`). The outbox UPSERT carries only the new `masterId`; `@@unique([appointmentId])` means a DELETE for the old event cannot coexist. Old master's calendar keeps a stale event (client name + phone). Recommended: nullable `staleCalendarId` + `staleGoogleEventId` on `CalendarSyncTask`; PUT passes `previousMasterId`/`previousGoogleEventId`; `processSyncTask` deletes the stale event first (404/410 = success), nulls `googleEventId`, then upserts into the new master's calendar; stale fields survive re-upserts unless new values are supplied.

## Minor/Syntax
- **M1 — outbox lost-update race** (`outbox.ts:145-150`, `31-37`, `54-79`): drain deletes the row by `id` after network I/O; a concurrent upsert/DELETE overwrite is lost (event orphaned with PII). Fix: `deleteMany({ where: { id, updatedAt } })` + same guard on failure-path update/drop.
- **M2 — token endpoint outage is non-retryable** (`auth.ts:71-74,88-90`, `client.ts:27-40`): transient 5xx/network/timeout from `oauth2.googleapis.com` maps to `GoogleApiError(401,'no_token')` → dropped after one try. Fix: distinguish "not configured" from "token fetch failed" (retryable). Also treat 403 with `rateLimitExceeded`/`userRateLimitExceeded` as retryable.
- **M3 — `draining`/`kickScheduled` are module-level, not `globalThis`** (`outbox.ts:9-10`): separate bundles (instrumentation vs route handlers) can run two drains concurrently → duplicate events. Fix: `Symbol.for` globalThis holder like `scheduler.ts`.
- **M4 — gap (b): hard-deleting a User cascades appointments without Google delete** (`src/app/admin/masters/actions.ts:202`, `src/app/api/admin/database/clients/[id]/route.ts:82`, `src/app/api/admin/admins/[id]/route.ts:52`): client PII stays in Google forever. Fix: snapshot appointments with `googleEventId` (+ master's `calendarId`) before the delete, enqueue deletes after; extend `enqueueAppointmentDelete` with optional `calendarId`.
- **M5 — `src/lib/consent-service.ts` is exactly 500 lines** (limit: under 500): extract a sibling module.
- **M6 — `primary` accepted as calendar id** (`config.ts:37`); nothing prevents two masters sharing one id. Fix: reject `primary`; uniqueness check in `setMasterCalendarId`.
- **M7 — enabling sync (false→true) does not backfill already-connected masters** (`google-calendar-settings/route.ts:69-70`).
- **M8 — per-task error isolation incomplete in `drainOutbox`** (`outbox.ts:157-166`): a throwing `masterProfile.updateMany`/backoff `update` aborts the whole tick loop. Fix: per-task try/catch.
- **M9 — thin tests** (only `config` + `event-mapping`): add `client`, `auth`, `outbox`, `push` tests (mocked fetch/prisma) and one settings-route secrets test.

## Passed
Secrets encryption/never returned/never logged; route authorisation (server-side ADMIN/SUPERADMIN; MASTER only own id); calendar-id validation + `encodeURIComponent`; RS256 JWT (base64url, iat/exp, scope, aud), token cache, timeouts; insert/patch/delete endpoints, 204 + 404/410 handling; event mapping with `SCHEDULE_TZ`, title `<client> — <procedure>`, description, `extendedProperties.private`; booking safety (no I/O inside `$transaction`, all enqueue sites fire-and-forget, all 17 mutation sites wired); inert when unconfigured, boot never throws, `Symbol.for` scheduler singleton; backfill future-only; migration purely additive and matches schema; i18n key parity; DOX (root `CLAUDE.md` line 59 corrected, Key Files table updated).

CHANGES REQUESTED
