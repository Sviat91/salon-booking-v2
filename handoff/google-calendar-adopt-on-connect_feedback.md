# Review: Google Calendar adopt-on-connect

**Date:** 2026-09-22
**Verdict:** APPROVED

## Critical/Architectural Issues

(none)

## Minor/Syntax Issues

(none)

Not blocking, informational only:
- The adoption loop awaits `prisma.appointment.update` sequentially per appointment inside a
  `for` loop rather than batching/parallelizing — fine given expected backfill sizes (single
  master, `SYNC_WINDOW_DAYS` window), not a correctness issue.
- Reviewer is read-only and could not independently execute `npx tsc --noEmit` /
  `npx vitest run`; relied on the coder's reported clean/green results plus static reading of
  types and mock shapes, which matched `client.ts`'s real `listEvents` return type.

## Passed Checks

- [x] `fetchExistingEventIds` paginates correctly, skips cancelled events, matches by
      `SALON_APPOINTMENT_KEY`, and never throws out of `enqueueBackfillForMaster` (internal
      try/catch, degrades to empty map)
- [x] Adoption (`appointment.update` setting `googleEventId`) happens before `upsertTask` is
      queued, so `processSyncTask` PATCHes instead of inserting (confirmed via `push.ts:86`
      reading `appointment.googleEventId` fresh at drain time)
- [x] No regression when `calendarId` is absent (skips Google call), `listEvents` throws (falls
      back to insert-everything), or zero appointments exist (early return, unchanged from before)
- [x] New tests exercise the real code path with mocks only at the Prisma/`listEvents` boundary;
      correctly assert adoption (`update` called once with matched id, 2 UPSERT tasks queued),
      fallback (`update` never called, still 2 UPSERT tasks), and skip-when-no-calendar behavior
- [x] `clearMasterEventIds` and `setMasterCalendarId` callers in `connect.ts` are unmodified and
      their existing call order correctly enables the new adopt-on-reconnect flow
- [x] Change is scoped to `outbox.ts`, its test file, and one appended sentence in
      `src/lib/AGENTS.md`, matching the plan's stated scope and out-of-scope list
- [x] `MAX_PAGES` local const mirrors `pull.ts`'s pattern with no naming/import collision;
      `listEvents` call signature matches `client.ts`'s actual export

## Summary

The implementation matches the plan precisely: `fetchExistingEventIds` is a well-guarded,
never-throwing helper that paginates and builds a `salonAppointmentId -> googleEventId` map, and
`enqueueBackfillForMaster` correctly adopts matched appointments by writing `googleEventId`
before queuing the normal UPSERT task, which causes `processSyncTask` to PATCH rather than INSERT
(verified against the actual `push.ts` read-fresh logic). All three risk scenarios from the plan
(no calendarId, `listEvents` failure, zero appointments) preserve prior behavior without
regression. The three new tests are meaningful, not over-mocked. Scope was respected. No critical
or minor issues found.
