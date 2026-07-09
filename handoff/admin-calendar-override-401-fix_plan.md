# Plan: Fix admin-view single-day override 401 (DayView/WeekView/MonthView)

**Date:** 2026-07-09
**Status:** In Progress
**Mode:** LIGHT (orchestrator-written plan; established pattern replication, no architectural decisions)

## Goal
Fix a deferred bug (logged 2026-07-01, deferred until after the M3 redesign): when an ADMIN/SUPERADMIN views a specific master's calendar via `/admin/master/calendar` in admin mode and toggles a day off / adds or edits a shift interval **directly inline** (not via the Bulk Settings modal), the request 401s. Root cause confirmed by the orchestrator via direct code read: `DayView.tsx`, `WeekView.tsx`, and `MonthView.tsx` each have their own `updateServer` function that hardcodes `fetch("/api/master/schedule/overrides/bulk", ...)` — a MASTER-role-only route (`src/app/api/master/schedule/overrides/bulk/route.ts` line ~24: `session.user.role !== "MASTER"` → 401). None of the three accept or use the `apiPrefix`/`isAdminView`/`selectedMasterId` props. `BulkSettingsModal.tsx` and `AppointmentModal.tsx` — siblings rendered by the same `ModernCalendar.tsx` — already do this correctly and successfully hit the ADMIN-scoped route (`src/app/api/admin/calendar/schedule/overrides/bulk/route.ts`) when in admin view. This plan replicates that already-working pattern into the three broken files. Zero new logic, zero new endpoints — pure prop-threading.

## Architecture Decisions
- The admin-scoped route (`src/app/api/admin/calendar/schedule/overrides/bulk/route.ts`) requires either `masterId` (string) or `masterIds` (array) in the body and checks `role === "SUPERADMIN" || role === "ADMIN"`. The master-scoped route ignores unknown body fields (no `.strict()` on its zod schema) and checks `role === "MASTER"`. So the same body shape (`{ dates, isDayOff, intervals, masterId }`) is safe to send to either route — `masterId` is simply ignored by the master-scoped route when undefined/present.
- `ModernCalendar.tsx` already computes the exact same value for this in its own `saveBulkOverrides` (line 175): `masterId: selectedMasterId !== "all" ? selectedMasterId : undefined`. Replicate this expression verbatim in each view's `updateServer`.
- Default prop values must match `ModernCalendar.tsx`'s own defaults exactly so behavior is unchanged for the master's own dashboard (non-admin view): `apiPrefix = "/api/master"`, `isAdminView = false`, `selectedMasterId = "all"`.

## Implementation Steps

- [x] Step 1: `src/app/admin/master/calendar/DayView.tsx`
  - Add to `DayViewProps` interface (after `dayOffColor: string`, before `onAddClick`): `apiPrefix?: string`, `isAdminView?: boolean`, `selectedMasterId?: string`.
  - Add matching defaults to the destructured function signature: `apiPrefix = "/api/master"`, `isAdminView = false`, `selectedMasterId = "all"`.
  - In `updateServer` (line ~104): change `fetch("/api/master/schedule/overrides/bulk", {` to `fetch(\`${apiPrefix}/schedule/overrides/bulk\`, {`.
  - In the same fetch's body (line ~107): change `JSON.stringify({ dates: [dStr], isDayOff, intervals })` to `JSON.stringify({ dates: [dStr], isDayOff, intervals, masterId: selectedMasterId !== "all" ? selectedMasterId : undefined })`.

- [x] Step 2: `src/app/admin/master/calendar/WeekView.tsx`
  - Same three changes as Step 1, applied to `WeekViewProps` (line ~9-23) and `updateServer` (line ~117-130).

- [x] Step 3: `src/app/admin/master/calendar/MonthView.tsx`
  - Same three changes as Step 1, applied to `MonthViewProps` (line ~9-20) and `updateServer` (line ~69-82).

- [x] Step 4: `src/app/admin/master/calendar/ModernCalendar.tsx`
  - Pass `apiPrefix={apiPrefix}`, `isAdminView={isAdminView}`, `selectedMasterId={selectedMasterId}` to the `<MonthView>` render (~line 292-303), `<WeekView>` render (~line 305-319), and `<DayView>` render (~line 323-337) — mirroring exactly how these three props are already passed to `<BulkSettingsModal>` (line ~342-350) and `<AppointmentModal>` (line ~353-360) a few lines below.

- [x] Step 5: Verify
  - Run `npm run lint` (zero-warning tolerance), `npm run build`, `npm run test` — confirm no new failures vs. the established baseline (60 lint problems / 107 failed test baseline, unrelated pre-existing failures).
  - Grep all three view files to confirm `"/api/master/schedule/overrides/bulk"` (hardcoded string) no longer appears — only the template-literal `` `${apiPrefix}/schedule/overrides/bulk` `` form should remain.
  - Confirm via live `git diff` that `getDayStatus`, `groupOverlappingAppointments`, `toggleOff`/`addShift`/`removeShift`/`updateShift`, all `useState`, and the click-outside effect in each of the three files are untouched — only the props interface, the destructured signature, and the two lines inside `updateServer` change.
  - Confirm master's own dashboard (`isAdminView` defaults to `false`, `apiPrefix` defaults to `/api/master`) behavior is unchanged: with no props passed (or explicit defaults), the fetch URL and body are byte-identical to before this fix.

  **Implementation note / deviation:** Literally destructuring `isAdminView = false` in `DayView`/`WeekView`/`MonthView` (as step 1-3 specified) produced 3 new `@typescript-eslint/no-unused-vars` lint errors, since `isAdminView` is never read inside these three files (only `apiPrefix` and `selectedMasterId` are used in `updateServer`). To keep the lint baseline at exactly 60 problems (0 new failures), `isAdminView?: boolean` was kept in each `*ViewProps` interface (satisfying `ModernCalendar.tsx`'s prop-passing and future consistency with `BulkSettingsModal`/`AppointmentModal`), but omitted from the destructured function parameters in `DayView.tsx`, `WeekView.tsx`, and `MonthView.tsx` since it's genuinely unused there. This does not change behavior — TypeScript/React allow passing extra optional props to a component without destructuring them.

## Acceptance Criteria
- [x] `npm run lint` clean; `npm run build` succeeds; `npm run test` no new failures vs. baseline.
- [x] No hardcoded `"/api/master/schedule/overrides/bulk"` string remains in `DayView.tsx`, `WeekView.tsx`, or `MonthView.tsx`.
- [x] All three files accept and correctly default `apiPrefix`/`isAdminView`/`selectedMasterId`, matching `BulkSettingsModal.tsx`'s and `AppointmentModal.tsx`'s existing prop shape and defaults. (`isAdminView` present in interface, intentionally not destructured — see Step 5 note.)
- [x] `ModernCalendar.tsx` passes all three props to `MonthView`, `WeekView`, and `DayView` (currently missing; already correct for `BulkSettingsModal`/`AppointmentModal`).
- [x] Master's own `/admin/master/calendar` dashboard (non-admin view) behavior is unchanged — verified via reading the default values match pre-fix hardcoded behavior exactly.
- [x] No other logic (day-status computation, click-outside handling, appointment grouping, shift add/remove/update handlers) changed — verified via live `git diff`.

## Constraints & Risks
- **DO NOT** touch the admin-scoped or master-scoped route handlers (`src/app/api/admin/calendar/schedule/overrides/bulk/route.ts`, `src/app/api/master/schedule/overrides/bulk/route.ts`) — both are already correct; the bug is purely in the calling components not threading the existing `apiPrefix` prop.
- **DO NOT** change `saveBulkOverrides` in `ModernCalendar.tsx` (line ~172, used by `BulkSettingsModal`) — it already works correctly and is the reference pattern being replicated.
- This is a functional bug fix, not a visual/M3 pass — no className changes are in scope here. Do not opportunistically restyle these files while touching them.
- **No dev server / stagewise checkpoint:** stop after implementation for the user's manual test — as an ADMIN, open a specific master's calendar in Day/Week/Month view via `/admin/master/calendar` (admin mode, not "All" masters), toggle a day off or add/edit/remove a shift interval directly (not via the Bulk Settings modal), and confirm it saves without a 401. Also verify the master's own dashboard (logging in as MASTER) still works unchanged.
