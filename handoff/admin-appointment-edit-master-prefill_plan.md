# Plan: Fix admin appointment-edit modal — master not pre-filled, Save permanently disabled

**Date:** 2026-07-21
**Status:** Complete

## Root cause
`GET /api/admin/calendar/appointments` (`src/app/api/admin/calendar/appointments/route.ts:58`) selects only `master: { select: { masterProfile: { select: { color: true } } } }` — no `id`, no `name`. This feeds `ModernCalendar.tsx`'s `Appointment` list, which is passed straight into `AppointmentModal.tsx` as `initialAppointment` when the admin clicks "Edit" on an appointment (`isAdminView=true`, `mode="edit"`).

`AppointmentModal.tsx:40-42` derives the form's master field from `initialAppointment.masterId || initialAppointment.master?.id || ""` — both are always `undefined` today, so `formMasterId` initializes to `""`. The master `<Select>` is intentionally `disabled={mode === "edit"}` (reassigning master during edit is out of scope, not what's broken), but `isValid()` (line 164) requires `isAdminView && formMasterId` to be truthy — since it's always empty, the Save button (`admin.masters.saveChangesBtn`) is permanently disabled for every admin edit of any appointment via the combined/admin calendar view. This blocks ALL admin edits (reschedule, notes, etc.), not just master reassignment.

Scope: pre-fill the current master so the (still-disabled, still-uneditable) select shows the right name and `isValid()` passes. Do NOT make the master select editable during edit mode — that's a separate product decision the user only mused about, not requested.

## Steps

- [x] Step 1: Include `id`/`name` in the master select.
  - File: `src/app/api/admin/calendar/appointments/route.ts`
  - Change line 58 from:
    ```ts
    master: { select: { masterProfile: { select: { color: true } } } },
    ```
    to:
    ```ts
    master: { select: { id: true, name: true, masterProfile: { select: { color: true } } } },
    ```

- [x] Step 2: Widen the `Appointment` type to match.
  - File: `src/app/admin/master/calendar/ModernCalendar.tsx`
  - Change (around line 30):
    ```ts
    master?: { masterProfile?: { color?: string | null } }
    ```
    to:
    ```ts
    master?: { id: string, name: string | null, masterProfile?: { color?: string | null } }
    ```

- [x] Step 3: Verify (do not change code) that `AppointmentModal.tsx:40-42`'s existing `initialAppointment.master?.id` fallback and the disabled `<Select>`'s display logic (`masters.find(m => m.id === v)?.name ?? v`, line 206) now resolve correctly given the wider type/data — no code change needed there, just confirm by reading.

- [x] Step 4: Check whether `MonthView.tsx`/`WeekView.tsx`/`DayView.tsx` (siblings in the same directory) declare their own local copies of the `Appointment`/master type rather than importing `ModernCalendar.tsx`'s — if so, apply the same widening there for consistency. If they import the shared type, no change needed.

- [x] Step 5: Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. No i18n or schema changes this round — `npm run i18n:check` not required but fine to run.

## Constraints
- Do NOT enable master reassignment during edit (`disabled={mode === "edit"}` stays as-is) — out of scope.
- Do NOT touch `mode === "copy"` behavior (master select already enabled there, already worked once data is present).
- Do NOT touch `/api/master/appointments` (the master's own non-admin calendar) — `isAdminView=false` there, `formMasterId` isn't required by `isValid()`, not affected by this bug.
- Purely additive Prisma `select` fields + type widening — no schema/migration changes.

## Manual verification (user)
1. Restart/refresh the admin calendar (all-specialists view).
2. Click an existing appointment → Edit. The specialist field should now show the correct (greyed-out/disabled) specialist name instead of the empty placeholder.
3. Change the date/time and click "Зберегти зміни" — it should now be clickable and save successfully.
4. Confirm the appointment moved to the new date/time in the calendar.
