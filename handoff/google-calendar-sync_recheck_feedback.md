# Re-review: Google Calendar sync — Stage 1 fixes (F1–F9)

**Date:** 2026-09-21 · **Verdict:** CHANGES REQUESTED (no Critical/Architectural; 3 Minor to fix, rest optional).
Note: the reviewer agent has no Write tool; the orchestrator saved its findings here (condensed). Reviewer read files by hand and ran nothing; the coder's tsc/vitest/lint results were re-verified by the orchestrator (see fixes2 plan).

## Critical/Architectural
None. C1 (stale-event design), M1–M3, M5, M7–M9 confirmed correct and complete.

## Minor — to fix
- **R1** double reassignment A→B→C before the drain runs orphans the event in A's calendar (`outbox.ts:76-89`, admin PUT `[id]/route.ts:138-144`): second enqueue overwrites the stale pair with `(B-calendar, E)`. Fix: if the existing task's `staleGoogleEventId` already equals `opts.previousGoogleEventId`, keep the existing stale pair. + test.
- **R2** `deleteMaster` (`masters/actions.ts:208-211`) snapshots only `masterId: id`; appointments where the deleted master was the **client** cascade with Google events left in other masters' calendars. Fix: snapshot `OR: [{ masterId: id }, { clientId: id }]`; `masterId: id` rows → pass snapshotted `calendarId`; `clientId: id` rows → pass `masterId: e.masterId`, no `calendarId` (that master's profile still exists).
- **R3** admin delete (`admins/[id]/route.ts:53-56`) snapshots only `clientId`; an admin with a `MasterProfile` and appointments as `masterId` cascades events. Fix: snapshot both, snapshot the profile's `googleCalendarId` first, pass it as `calendarId` for `masterId` rows.

## Minor — optional / decided
- **R4** uniqueness check in `setMasterCalendarId` is a check-then-write race with no DB backstop → orchestrator decision: **accept** (admin/master-only, very low probability), document as known limitation in `src/lib/AGENTS.md`; no `@@unique`.
- **R5** key added later while sync already enabled → tasks dropped as `no_token` earlier are not backfilled → orchestrator decision: **not fixing** (connecting/changing a master's calendar id already triggers her backfill).
- **R6** `primary` check in `normalizeCalendarId` is redundant (`CALENDAR_ID_RE` already requires `@`) → harmless, leave.
- **R7** test gaps → fix: DELETE upsert leaves stale fields untouched; R1 scenario; DELETE-with-stale where `googleEventId !== staleGoogleEventId`; 404/410 on the stale delete; `setMasterCalendarId` uniqueness.
- **R8** non-string `reason`/`message` from Google passed through un-coerced (`client.ts:83`) → fix: coerce with `typeof === 'string'`.

## Passed
Stale flow end-to-end incl. DELETE-overwrites-UPSERT; deviation "stale fields cleared by deleting the finished task" accepted; reassignment only via admin PUT; conditional writes can neither lose nor hang a task; token errors (typed `TokenUnavailableError` → retryable 503; both `getAccessToken` callers handle it); `globalThis` drain guards; delete ordering (snapshot → delete → enqueue, failed delete enqueues nothing); `primary`/uniqueness/enable-backfill; per-task try/catch; `consent-service.ts` 342 lines with all importers' symbols still exported; additive migration matching schema; i18n parity (`CALENDAR_ID_IN_USE` under `errors.*`); tests assert what they claim; booking flows still never await Google I/O; no secret leakage.

CHANGES REQUESTED
