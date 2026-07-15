# Plan: Consolidate triplicated 24h-guard logic into `canModifyBooking()`

**Date:** 2026-07-15
**Status:** Complete
**Mode:** LIGHT (orchestrator-written; clear scope, no architectural decisions, low-medium risk)

## Goal
Replace the byte-for-byte-duplicated 24-hour modification guard in 3 live API routes with calls to the existing (currently unused/orphaned) `canModifyBooking()` helper, and fix its NaN/invalid-date edge case while doing so (it becomes reachable, previously-dead code).

## Background
`src/lib/booking-helpers.ts`'s `canModifyBooking(startTime: Date)` was orphaned in a June 2026 refactor that deleted its only caller (`booking-modification-helpers.ts`, old Google-Calendar-era mock code). Since then, the same 24h-check math has been re-implemented inline, identically, in 3 routes:
- `src/app/api/bookings/cancel/route.ts`
- `src/app/api/bookings/update-time/route.ts`
- `src/app/api/bookings/update-procedure/route.ts`

Each computes `dateISO` → `apptTimestamp`/`hoursUntil` → `if (hoursUntil < 24)` identically, differing only in the returned error message/code (cancel: "Nie można anulować..." / `TOO_LATE_TO_CANCEL`; the other two: "Nie można zmienić..." / `TOO_LATE_TO_MODIFY`).

Separately, `canModifyBooking()` has an edge case: `hoursUntilAppointment` becomes `NaN` for an invalid `Date`, and `NaN < 24` is `false` in JS, so it incorrectly falls through to `canModify: true` for garbage input. This was previously harmless (dead code, no caller), but since this plan makes it live/reachable, it should be fixed as part of this change.

## Scope
- **In scope:** the 3 route files above, `src/lib/booking-helpers.ts` (one-line NaN guard), `tests/lib/booking-helpers.test.ts` (update 2 assertions that currently document the old broken behavior).
- **Out of scope:** no change to error messages/codes/status (each route keeps its own distinct text), no change to any other route, no change to the UI-side `canModify` computation in `bookings/all/route.ts:153-155` (that's a separate, read-only display computation for the booking-management list, not a write guard — touching it is unrelated scope creep).

## Implementation Steps

- [x] **1 — Fix the NaN edge case in `canModifyBooking()`**
  - File: `src/lib/booking-helpers.ts`
  - Change the condition from `if (hoursUntilAppointment < 24)` to `if (!Number.isFinite(hoursUntilAppointment) || hoursUntilAppointment < 24)`. Keep the same return shape/reason text — only the guard condition changes.

- [x] **2 — `cancel/route.ts`: replace inline math with `canModifyBooking()`**
  - Add import: `import { canModifyBooking } from "@/lib/booking-helpers"`.
  - Replace:
    ```ts
    const dateISO        = formatInTimeZone(appointment.date, TZ, "yyyy-MM-dd")
    const apptTimestamp  = new Date(`${dateISO}T${appointment.startTime}:00`).getTime()
    const hoursUntil     = (apptTimestamp - Date.now()) / (1000 * 60 * 60)

    if (hoursUntil < 24) {
    ```
    with:
    ```ts
    const dateISO  = formatInTimeZone(appointment.date, TZ, "yyyy-MM-dd")
    const apptDate = new Date(`${dateISO}T${appointment.startTime}:00`)
    const { canModify } = canModifyBooking(apptDate)

    if (!canModify) {
    ```
  - Keep the existing `return NextResponse.json({ error: "Nie można anulować...", code: "TOO_LATE_TO_CANCEL" }, { status: 400 })` body unchanged.

- [x] **3 — `update-time/route.ts`: same replacement**
  - Add the same import. Apply the same before/after transformation (variable names already match — no `apptTimestamp`/`hoursUntil` used elsewhere in this file, confirm before deleting). Keep the existing `TOO_LATE_TO_MODIFY` error body unchanged.

- [x] **4 — `update-procedure/route.ts`: same replacement**
  - Add the same import. Apply the same transformation. Keep the existing `TOO_LATE_TO_MODIFY` error body unchanged.

- [x] **5 — Update the 2 stale test assertions**
  - File: `tests/lib/booking-helpers.test.ts`
  - `'should handle invalid date format'` (invalid `Date`) and `'should handle a NaN date value'` (`new Date(NaN)`): change both expectations from `.toBe(true)` to `.toBe(false)`, and update/remove the inline comments that currently document the old (now-fixed) behavior.

- [x] **6 — Verify no other file references the deleted local variable names**
  - Grep `apptTimestamp\b` and `hoursUntil\b` across the 3 route files after editing to confirm nothing downstream in each file still references them (e.g. in logging or a later conflict check) — if something does, adapt (e.g. derive from `apptDate.getTime()` inline) rather than leaving a dangling reference.

- [x] **7 — DOX + verify**
  - `src/lib/AGENTS.md`: update the note (added in the Priority-4 test-suite pass) that `canModifyBooking` was previously unused — it is now live, called from `cancel`/`update-time`/`update-procedure`.
  - Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx vitest run` — expect all clean, all 18 test files still passing (with the 2 updated assertions now reflecting the fixed behavior).

## Acceptance Criteria
- [x] All 3 routes call `canModifyBooking()` instead of duplicating the hours-until-appointment math; each keeps its own distinct error message/code.
- [x] `canModifyBooking()` returns `canModify: false` for an invalid/NaN `Date`.
- [x] `tests/lib/booking-helpers.test.ts` reflects the fixed behavior (no test documents a "known broken" case anymore).
- [x] `tsc`/`build`/`lint`/`test` all clean, no new failures.

## Constraints & Risks
- **Low risk, well-contained:** the 3 routes' surrounding logic (phone verification, conflict checks, response shapes) is untouched — only the 24h-guard block changes.
- **No dev server** — user tests manually after implementation: (1) try to cancel/reschedule a booking normally (>24h away) — should still work; (2) try on a booking <24h away — should still be blocked with the same Polish error message as before.
