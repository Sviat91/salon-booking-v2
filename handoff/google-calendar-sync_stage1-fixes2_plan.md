# Plan: Google Calendar sync — Stage 1 fixes, round 2

Orchestrator-authored, small. Source: `handoff/google-calendar-sync_recheck_feedback.md` (read it first; items R1–R8). Scope = ONLY the items below; do NOT start Stage 2; no schema/migration changes at all in this round. Follow the repo AGENTS.md chain; read every file fully before editing it. Files < 500 lines. Tick boxes here and append a results section at the bottom.

## R1 — keep the FIRST stale pair on double reassignment

- [x] `src/lib/google-calendar/outbox.ts` `enqueueAppointmentSync`: when `opts.previousGoogleEventId` is supplied AND an existing `CalendarSyncTask` row for the appointment already carries a `staleGoogleEventId` **equal to** `opts.previousGoogleEventId` (i.e. the same Google event is still waiting to be deleted from its original calendar), keep the existing `staleCalendarId`/`staleGoogleEventId` unchanged instead of overwriting them with the new previous master's calendar (which would be a calendar the event was never created in). Otherwise behave exactly as today. Implement without widening the race the F2 `updatedAt` guard closes (read the task, then upsert; the upsert's own `updatedAt` bump is fine). Preserve: stale pair still preserved on a later enqueue that supplies no `opts`.

## R2 — `deleteMaster` must also cover appointments where the master was the CLIENT

- [x] `src/app/admin/masters/actions.ts` `deleteMaster`: snapshot appointments with `googleEventId` not null where `OR: [{ masterId: id }, { clientId: id }]` (select `id`, `masterId`, `googleEventId`, `clientId`). After the delete succeeds enqueue a delete per row: rows with `masterId === id` → pass the snapshotted `calendarId` (as today); rows where the deleted user was only the client (`masterId !== id`) → pass `masterId: row.masterId` and NO `calendarId` (that other master's profile still exists, so the normal lookup works).

## R3 — admin delete must also cover appointments where the admin was a MASTER

- [x] `src/app/api/admin/admins/[id]/route.ts` DELETE: snapshot the target user's `MasterProfile.googleCalendarId` (if any) before deleting, and snapshot appointments with `googleEventId` not null where `OR: [{ clientId: id }, { masterId: id }]`; after the delete succeeds enqueue a delete per row using the same rule as R2 (`masterId === id` → snapshotted `calendarId`; otherwise `masterId: row.masterId`, no `calendarId`). Do not change the route's existing (pre-existing) role handling.
- [x] While there, re-check `src/app/api/admin/database/clients/[id]/route.ts` for the same "user may also be a master" case and apply the identical rule if the route can delete such a user; otherwise leave it and say why in the results.

## R4 — document, do not fix

- [x] Add ONE sentence to the Google-calendar section of `src/lib/AGENTS.md` (append to the existing line/bullet about `setMasterCalendarId`/known limits; keep it short): uniqueness of a calendar id across masters is a check-then-write in `setMasterCalendarId` with no DB unique index, so two truly concurrent saves of the same id can both succeed — accepted (admin/master-only action, very low probability).

## R7 — tests

- [x] `tests/lib/google-calendar/outbox.test.ts`: (a) a DELETE upsert over an UPSERT row leaves the stale fields untouched (`arg.update` has no `staleCalendarId`/`staleGoogleEventId` keys); (b) the R1 scenario A→B→C keeps the first stale pair (`staleCalendarId` = A's calendar, same event id) and a different `previousGoogleEventId` DOES overwrite it.
- [x] `tests/lib/google-calendar/push.test.ts`: (c) DELETE-with-stale where `googleEventId !== staleGoogleEventId` deletes both events; (d) the stale delete returning 404 and 410 counts as success and the task continues to the insert.
- [x] A small test for `setMasterCalendarId` (`connect.ts`): unchanged id → no uniqueness query; another master's id → `CALENDAR_ID_IN_USE`; free id → writes. Mock prisma like the neighbouring tests.
- [x] Tests for R2/R3 ordering where cheap to mock (snapshot before delete; enqueue only after a successful delete; `masterId === id` rows carry the snapshotted `calendarId`); if the existing route-test conventions make this impractical, skip and say so in the results.

## R8 — coerce Google error fields

- [x] `src/lib/google-calendar/client.ts` (~line 83): when extracting `error.errors[0].reason` and the error `message`, use them only if `typeof x === 'string'`, otherwise treat as absent. Add a one-line test case to `client.test.ts` (non-string reason → not retryable, no throw).

## Explicitly NOT doing (orchestrator decisions — do not implement)

R5 (backfill on key-added-later), R6 (redundant `primary` check stays), any `@@unique` on `googleCalendarId`, any migration.

## Verification (coder)

1. `npx tsc --noEmit` clean.
2. `npx vitest run` all green (report totals).
3. `npm run i18n:check` passes.
4. `npx eslint` on every touched/new file: no NEW errors.
5. `wc -l` on every touched/new file < 500.
6. Do NOT run dev/build/prisma migrate, no browser, no git stash, no commit.

## Results (coder)

All items done; nothing blocked.

- R1: `enqueueAppointmentSync` now reads the existing task (`calendarSyncTask.findUnique`, select stale fields) before the upsert; if its `staleGoogleEventId === opts.previousGoogleEventId` (and a stale calendar is present) it skips the previous-master lookup and writes no stale fields, so the first pair survives. Otherwise unchanged. The F2 `updatedAt` guard on the drain is untouched (the upsert's own bump still applies).
- R2: `deleteMaster` snapshots `OR: [{masterId:id},{clientId:id}]` (select id, masterId, googleEventId, clientId). `masterId === id` rows use the snapshotted `calendarId` (skipped if the profile had none, same as before); other rows pass `masterId: row.masterId`, no `calendarId`.
- R3: `admins/[id]` DELETE snapshots the profile calendar id and both appointment sides, same rule as R2. Role handling untouched. `admin/database/clients/[id]` DELETE left unchanged: it 404s unless the target's role is `CLIENT`, so it can never delete a master/admin user.
- R4: one sentence appended to the google-calendar bullet in `src/lib/AGENTS.md`.
- R8: `client.ts` coerces `reason`/`message` with `typeof === 'string'`; test added in `client.test.ts`.
- R7 tests: outbox (DELETE leaves stale fields untouched; A->B->C keeps first pair; different event id overwrites), push (DELETE-with-stale deletes both; 404/410 stale delete then insert), new `connect.test.ts`, new `tests/app/api/admin/user-delete-google-calendar.test.ts` (snapshot -> delete -> enqueue order, `masterId === id` row carries snapshotted `calendarId`, other row carries `masterId`, no enqueue on failed delete; covers both the admins DELETE route and `deleteMaster`).

Deviation/notes:
- push.test 404/410 case: `deleteEvent` is mocked there and the real one swallows 404/410 (already asserted in `client.test.ts`), so the test models it as a resolved delete and checks the insert follows.
- No AGENTS.md changes beyond R4 (the R2/R3 rule is a small extension of the existing "Paths that must enqueue" sentence; left as is).

Verification:
1. `npx tsc --noEmit`: clean (no output).
2. `npx vitest run`: 48 files, 486 tests passed, 0 failed.
3. `npm run i18n:check`: PASS.
4. `npx eslint` on all 9 touched/new files: no output (clean).
5. `wc -l`: max 282 (all < 500).
6. No dev/build/migrate, no browser, no stash, no commit. No schema/migration changes.
