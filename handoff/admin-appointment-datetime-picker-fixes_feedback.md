# Review: Admin Appointment Date/Time Picker Fixes
**Date:** 2026-07-21
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] Bug 1: `max-h-80` added to `SelectPrimitive.Popup` in `select.tsx`; verified against all `SelectContent` consumers (CalendarToolbar duration selects, support-page topic select, AppointmentModal/EditAppointmentModal master/service/client selects) — none affected, only the dozens-of-times `AppointmentTimeSelect` list will ever scroll.
- [x] Bug 2: `DatePickerDropdown.tsx` faithfully mirrors `TimePickerDropdown.tsx`'s portal pattern (createPortal to document.body, useLayoutEffect keyed on `[open]`, dual refs in click-outside check, `stopPropagation` on mousedown, fixed positioning with z-index 9999, above/below flip), with the plan's justified `left` clamp deviation correctly implemented for the wider 280px popup.
- [x] Bug 3 endpoints (`master/availability/days`, `admin/calendar/availability/days`): correct role auth, date-format validation, duration clamping, `getAvailableDays()` call shape, `runtime = "nodejs"`, and safe `{ days: [] }` error fallback — modeled exactly on the existing `slots` routes.
- [x] `AppointmentDateSelect.tsx`: correct `disabledDates` construction, correct AD4 edit-mode exclusion direction, correct `noMaster` gate, correct effect dependencies, and a working `cancelled`-flag race guard.
- [x] `DatePickerDropdown.tsx` disabled-day rendering uses native `disabled`, blocks `onClick`, applies muted styling without breaking selected-day styling; `onVisibleMonthChange` fires on mount and both navigation directions.
- [x] `EditAppointmentModal.tsx` (the other `DatePickerDropdown` consumer) is untouched and unaffected — new props are optional and never passed.
- [x] `AppointmentModal.tsx` wiring is correct and complete; old `DatePickerDropdown` import fully removed with no dangling references.
- [x] The claimed `isSameMonth`/`isSameDay` import removal is a genuine, harmless cleanup — confirmed unused in the rewritten file.
- [x] Spot-checked touched files (`DatePickerDropdown.tsx`, `AppointmentDateSelect.tsx`, both new routes) are lint-clean — no `any` types, no stray `console.log`, no unused imports.
- [x] No out-of-scope work found: Groups 2-5 of the other plan and the toolbar "add appointment" feature were not touched.
- [x] DOX pass on `src/app/admin/AGENTS.md` and `src/app/api/AGENTS.md` is accurate and concise.
- [x] All touched files stay well under the 500-line limit.

## Summary
This is a careful, faithful implementation of the plan. The portal rewrite mirrors `TimePickerDropdown.tsx` precisely, including its documented rationale (useLayoutEffect over useEffect, dual-ref click-outside handling, stopPropagation), with only the plan's explicitly justified positioning deviation (left-edge clamping for the wider calendar popup). The trickiest logic — AD4's edit-mode "don't disable my own date" exclusion — is implemented in the correct direction and verified against the plan's exact wording. The two new authed endpoints are clean, minimal mirrors of the existing `slots` routes. Backward compatibility for `EditAppointmentModal` is genuinely preserved since the new props are optional and never passed. No scope creep, no orphaned code, no lint or type issues found in the touched files. Approved as-is.
