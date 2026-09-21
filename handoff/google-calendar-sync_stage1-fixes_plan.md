# Plan: Google Calendar sync — Stage 1 review fixes

Orchestrator-authored addendum to `handoff/google-calendar-sync_plan.md` (Stage 1 already implemented). Source: `handoff/google-calendar-sync_feedback.md` (read it first). Scope = ONLY the fixes below; do NOT start Stage 2, do NOT add unrelated changes. Follow the repo AGENTS.md chain; read every file fully before editing it. Files < 500 lines. Mark each checkbox here when done and append a results section at the bottom.

Migration rule: the Stage 1 migration `prisma/migrations/20260921120000_google_calendar_push` may or may not have been applied by the user — **do NOT edit it**. Put every schema change of this addendum into ONE new additive migration folder `prisma/migrations/20260921130000_google_calendar_push_fixes/migration.sql` (hand-written SQL, `ADD COLUMN` only, nullable/defaulted), update `prisma/schema.prisma` to match, and confirm with `npx prisma validate` + `npx prisma generate` (+ the scratch-shadow-DB `prisma migrate diff` check you used before). Never touch the user's real database file, never run `migrate dev`/`reset`.

## F1 (Critical) — admin PUT changes `masterId`

- [x] `CalendarSyncTask`: add nullable `staleCalendarId String?` and `staleGoogleEventId String?` (new migration). If the model has no `updatedAt DateTime @updatedAt`, add it in the same migration (needed by F2; ADD COLUMN with a default of CURRENT_TIMESTAMP-equivalent following how the existing migration handles it).
- [x] `enqueueAppointmentSync(appointmentId, opts?: { previousMasterId?: string; previousGoogleEventId?: string | null })`. When both are supplied, resolve the previous master's `googleCalendarId` (from `MasterProfile` by `userId`) **before returning** and write `staleCalendarId`/`staleGoogleEventId` on the UPSERT row. On re-upsert of an existing row, only overwrite the stale fields when new values are supplied (never clear them on an unrelated later enqueue). If the previous master had no calendar id, do not set them.
- [x] `src/app/api/admin/calendar/appointments/[id]/route.ts` PUT: when `finalMasterId !== existing.masterId && existing.googleEventId`, call `enqueueAppointmentSync(id, { previousMasterId: existing.masterId, previousGoogleEventId: existing.googleEventId })` (still fire-and-forget, after the write). Check whether the master PUT/PATCH routes or any other route can also reassign `masterId` (grep `masterId:` in appointment `update` data) and apply the same call there.
- [x] `push.ts` `processSyncTask`: if the task has stale fields → first `deleteEvent(staleCalendarId, staleGoogleEventId)` (404/410 already = success); on a retryable failure keep the task (backoff) with stale fields intact; on success set `Appointment.googleEventId = null` **only if it currently equals `staleGoogleEventId`**, clear the stale fields on the task, then continue with the normal upsert against the NEW master's calendar (insert, since `googleEventId` is now null). If the new master has no calendar id: after the stale delete succeeds, finish the task successfully without inserting.
- [x] Unit tests (F9) cover: stale delete runs before insert; stale delete failure keeps the task; stale fields preserved across a second enqueue.

## F2 — lost-update race in the outbox (M1)

- [x] `drainOutbox`: every completion/drop/backoff write for a task must be conditional on the row being unchanged since it was read: completion & drop → `deleteMany({ where: { id, updatedAt: task.updatedAt } })`; backoff/failure update → `updateMany({ where: { id, updatedAt: task.updatedAt }, data: … })`. If 0 rows affected, the task was rewritten meanwhile → leave it for the next tick (log at debug level only). Also make the `Appointment.googleEventId` write after a successful insert tolerate P2025 (appointment already deleted) without throwing.

## F3 — retryability classification (M2)

- [x] `auth.ts`: `getAccessToken()` must distinguish (a) key not configured/parse failure (non-retryable, keep current null/`no_token` behaviour), (b) token endpoint transient failure — network error, timeout, HTTP 5xx or 429 → **retryable** (throw a `GoogleApiError` with a retryable status such as 503 and code `token_unavailable`, or return a typed result — pick one and apply consistently), (c) token endpoint 4xx other than 429 (bad key / `invalid_grant`) → non-retryable, master marked error as today.
- [x] `client.ts` `isRetryable`: also retryable = HTTP 403 whose Google error reason is `rateLimitExceeded`, `userRateLimitExceeded` or `quotaExceeded` (parse `error.errors[0].reason` from the JSON body defensively; never log the body). Keep 401/other 403/404 as non-retryable.

## F4 — drain guards must be `globalThis` singletons (M3)

- [x] Move `draining` and `kickScheduled` in `outbox.ts` into a `Symbol.for('salon.googleCalendar.outbox')` holder on `globalThis` (same pattern as `scheduler.ts`). Do NOT introduce deterministic Google event ids (documented as a known residual risk instead: an insert whose follow-up DB write fails may be retried and duplicated; add one sentence to `src/lib/AGENTS.md`).

## F5 — hard user deletes must delete the Google events (M4, "gap b")

- [x] Extend `enqueueAppointmentDelete` input with optional `calendarId?: string` (used instead of the DB lookup when supplied, because the master's profile may already be gone).
- [x] `src/app/api/admin/database/clients/[id]/route.ts` (client delete): before `user.delete`, `findMany` that client's appointments where `googleEventId` is not null (select `id`, `masterId`, `googleEventId`); after the delete succeeds, `enqueueAppointmentDelete` for each (fire-and-forget).
- [x] `src/app/admin/masters/actions.ts` (`deleteMaster`): before the delete, snapshot the master's `googleCalendarId` and all appointments (as master) with `googleEventId` not null; after the delete succeeds enqueue a delete per appointment passing the snapshotted `calendarId`.
- [x] `src/app/api/admin/admins/[id]/route.ts`: apply the client-style handling for appointments where that user is the **client** (an ADMIN can be a booking client); grep `prisma.user.delete`/`deleteMany` across `src/` and handle any other site that cascades appointment deletion the same way — list what you found in the results section.
- [x] Add these sites to the "paths that must enqueue" list in the DOX (`src/lib/AGENTS.md` and/or `src/app/api/AGENTS.md`, wherever the Stage 1 list lives).

## F6 — `src/lib/consent-service.ts` at exactly 500 lines (M5)

- [x] Extract a self-contained function group (e.g. `exportConsentData` or the erase helpers) into a sibling module (e.g. `src/lib/consent-export.ts`), re-export from `consent-service.ts` so no import path elsewhere changes, and restore normal multi-line formatting where the coder squeezed the one-line `if`. Result must be comfortably < 500 lines (aim ≤ 470). All existing tests must still pass unchanged.

## F7 — calendar-id rules (M6) and enable backfill (M7)

- [x] `config.ts` `normalizeCalendarId`: reject the literal `primary` (case-insensitive) with the same validation-error path as other invalid ids (+ unit test).
- [x] `setMasterCalendarId` (`connect.ts` or wherever it lives): if another master's `MasterProfile.googleCalendarId` already equals the normalized id → return a new error code (e.g. `CALENDAR_ID_IN_USE`) mapped to HTTP 409 in all three route groups; add the user-facing message key in **pl/en/uk** (`admin.googleCalendar.*`, check `npm run i18n:check`) and surface it in `MasterCalendarField.tsx` via the existing error-toast path (`t(apiErrorKey(code))` convention — follow how the neighbouring error codes are mapped).
- [x] `google-calendar-settings/route.ts` PATCH: on a `googleCalendarEnabled` false→true transition (compare with the stored value before update), enqueue `enqueueBackfillForMaster` for every master that has a `googleCalendarId` (fire-and-forget).

## F8 — per-task error isolation (M8)

- [x] `drainOutbox`: wrap each task's whole body (including the `masterProfile.updateMany` status write and the backoff update) in its own try/catch so one failing task never abandons the remaining tasks in the tick.

## F9 — tests (M9)

- [x] New pure/mocked test files under `tests/lib/google-calendar/`: `client.test.ts` (mocked `fetch`: insert/patch/delete URLs incl. `encodeURIComponent` of calendar/event ids; delete treats 404/410 as success; 204 handling; `isRetryable` matrix incl. 403 `rateLimitExceeded`), `auth.test.ts` (JWT header/claims/signature shape and base64url — use a throw-away RSA key generated in the test with `node:crypto`; cache reuse and expiry; token-endpoint 5xx → retryable, 400 → non-retryable, missing key → non-retryable), `outbox.test.ts` and `push.test.ts` (mocked prisma: DELETE-wins upsert; stale-field preservation; conditional delete/backoff by `updatedAt`; per-task isolation; stale-delete-before-insert), plus `tests/api/google-calendar-settings.test.ts` (or the repo's existing route-test location/convention — check `tests/AGENTS.md`): GET never returns the key (only `hasKey`), non-admin gets 403, master route cannot set another master's calendar. Mock `@/auth` the way the existing route tests do (`vi.mock('@/auth', …)`), never import next-auth for real.
- [x] Update `tests/AGENTS.md` if it lists test files/areas.

## Verification (coder)

1. `npx tsc --noEmit` clean; `npx prisma validate`, `npx prisma generate`; shadow-DB `migrate diff` shows no drift for the new migration.
2. `npx vitest run` — all green (report the new totals).
3. `npm run i18n:check` passes.
4. `npx eslint` on every touched/new file: no NEW errors (repo-wide lint is red at baseline).
5. `wc -l` on every touched/new file < 500; `consent-service.ts` ≤ ~470.
6. Grep proofs: every `prisma.appointment.(create|update|updateMany|delete|deleteMany)` and every `prisma.user.delete` in `src/` is still followed/preceded by the right enqueue handling; `push.ts`/`outbox.ts` do not enqueue a push for their own writes.
7. Do NOT run `npm run dev`/`npm run build`, no browser, no `git stash`, no commit.

## Results (coder, 2026-09-21)

All F1-F9 implemented. Verification:
- `npx tsc --noEmit`: clean. `npx prisma validate`: valid. `npx prisma generate`: ok.
- Scratch shadow-DB `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`: "No difference detected" (scratchpad DB only, user DB untouched). New migration: `prisma/migrations/20260921130000_google_calendar_push_fixes/migration.sql` (2x `ADD COLUMN`, Stage 1 migration untouched). `CalendarSyncTask.updatedAt` already existed, so nothing added for it.
- `npx vitest run`: 46 files / 473 tests, all green (new: client 24, auth 10, outbox 15, push 8, settings-route 10; config test updated for `primary`).
- `npm run i18n:check`: PASS (1188 keys).
- `npx eslint` on all touched/new files under google-calendar, consent-*, masters/actions, admins/clients routes, apiErrorKey: no output (clean).
- `wc -l`: largest touched file is `outbox.ts` 241; `consent-service.ts` 342 (extracted `consent-identity.ts` 112, `consent-export.ts` 70; re-exports keep import paths).
- Grep proofs: `push.ts` has no `enqueue*` calls; `outbox.ts` drain writes only `calendarSyncTask`/`masterProfile`. Every `prisma.user.delete` in `src/` is handled (below); appointment create/update/delete sites unchanged and still enqueue.

### User-delete / cascade sites found
- `admin/masters/actions.ts` `deleteMaster` - handled (snapshot calendarId + events, enqueue with `calendarId`).
- `api/admin/database/clients/[id]` DELETE - handled.
- `api/admin/admins/[id]` DELETE - handled (as client).
- `api/auth/register` (`tx.user.deleteMany`) and `api/client/link-bookings` (`tx.user.deleteMany`) delete guest users only AFTER moving their appointments to the real account (`appointment.updateMany` in the same tx), so nothing cascades; they already call `enqueueSyncForUsers`. No change.
- Not covered (per plan scope): a deleted master/admin's appointments where they were the CLIENT of a booking with another master; and master appointments of a deleted admin.

### Deviations / notes
1. F1: `upsertTask` now also sets `masterId` on re-upsert of an existing row (previously it kept the old masterId, which would break reassignment).
2. F1: stale fields are NOT cleared on the task by a separate write (that write would bump `updatedAt` and defeat F2's guard). They are removed when the drain deletes the completed task; a retry re-runs the stale delete, which is idempotent (404/410 = success, conditional null of `googleEventId`).
3. F1 extension: a DELETE task that overwrote an UPSERT carrying stale fields also runs the stale delete first (else the old master's event would be orphaned); it skips the duplicate delete when `googleEventId === staleGoogleEventId`.
4. F2: on P2025 after a successful insert, `push.ts` also best-effort deletes the just-created event (avoids an orphan with client PII); plan only required not throwing.
5. F3: chose the typed-throw variant: `auth.ts` exports `TokenUnavailableError`; `client.ts` maps it to `GoogleApiError(503,'token_unavailable')` (avoids a circular import). `admin/google-calendar-settings/test/route.ts` now catches it and returns 502 `GOOGLE_API_ERROR` (required, since `getAccessToken` can now throw).
6. F7: the error message key follows the existing convention `errors.CALENDAR_ID_IN_USE` (added to `KNOWN_ERROR_CODES` and pl/en/uk), not `admin.googleCalendar.*` (no such namespace exists). `MasterCalendarField.tsx` needed no change: it already renders `t(apiErrorKey(code))`. There are two PUT surfaces (admin masters route, master route), both mapped to 409; the settings route does not set calendar ids.
7. F9: the settings route returns 401 (not 403) for non-admins; tests assert the real behaviour. Route tests live at `tests/app/api/admin/google-calendar-settings.test.ts` (mirror convention).
8. DOX updated: `src/lib/AGENTS.md`, `src/app/api/AGENTS.md`, `prisma/AGENTS.md`, `tests/AGENTS.md`.
9. No test added for `setMasterCalendarId` uniqueness itself (only its 409 mapping is tested).
