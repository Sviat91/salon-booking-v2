# Review: m3-select-fix
**Date:** 2026-07-01
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `src/components/ui/select.tsx` `SelectItem` (line 81): `data-highlighted:bg-accent data-highlighted:text-accent-foreground` replaced exactly with `data-highlighted:bg-primary/10 dark:data-highlighted:bg-primary/15`; rest of the className string is untouched.
- [x] Shared `--accent` / `--accent-foreground` tokens in `src/styles/globals.css` (lines 389-390, 436-437) are unchanged — confirmed still pointing at `--color-primary`/`--md-primary-container`, not touched by this fix.
- [x] `src/app/support/page.tsx`: `subjectLabels` map added inside the component (lines 23-31) after `t` is available; `<SelectValue>{(v: string) => subjectLabels[v] ?? v}</SelectValue>` (line 255) matches each `SelectItemText` value exactly, including the intentional duplicate mappings for `cancellation`→`booking` topic text and `payment`→`other` topic text (pre-existing i18n bug, correctly left out of scope, correctly mirrored in the label map).
- [x] `src/app/admin/master/calendar/ModernCalendar.tsx` (line 201): `<SelectValue>{(v: string) => \`${v} min\`}</SelectValue>` — correct, `step` is a required numeric state, no empty-case handling needed, as specified.
- [x] `src/app/admin/master/calendar/AppointmentModal.tsx` — Master select (lines 201-203): render-prop correctly falls back to `"-- Choose Master --"` for falsy value and looks up `masters` by id, matching `SelectItemText` content exactly.
- [x] `src/app/admin/master/calendar/AppointmentModal.tsx` — Service select (lines 225-231): correctly special-cases `"custom"`, looks up `services` and formats `${s.name} (${s.duration}m)`, matching the corresponding `SelectItemText` (line 235) exactly.
- [x] `src/app/admin/master/calendar/AppointmentModal.tsx` — Client select (lines 264-270): correctly special-cases `"custom"`, looks up `clients`, and reproduces the `${c.name ?? ''}${c.phone ? ...}` format matching the `SelectItemText` (line 274) rendering logic (both handle nullable `name`/`phone` the same way).
- [x] `src/components/profile/EditAppointmentModal.tsx` — Procedure select (lines 175-177): render-prop looks up `proceduresData?.items` by id and returns `name_pl`, matching the `SelectItemText` at line 182; uses `any` typing consistent with the untyped inline `.map((procedure) => ...)` below it, per the plan's explicit instruction not to introduce a new interface.
- [x] All 6 call sites now use a render-prop function; grep confirms zero remaining self-closing `<SelectValue />` anywhere in `src/`.
- [x] No files outside the 5 listed in the plan were modified — no unrelated edits, no scope creep into the two explicitly-out-of-scope items (duplicate Subject dropdown i18n content, missing `SelectItemIndicator` checkmark).
- [x] `npm run build` (clean `.next` cache, 73 pages) and `npm run lint` (61 problems, matching baseline) both independently confirmed passing by the orchestrator.

## Summary
The implementation matches the plan precisely at all 5 files and all 6 `SelectValue` call sites, with no scope creep and no leftover raw-value fallback bugs. The highlight fix in `select.tsx` is exactly the specified class swap, and the shared `--accent` token in `globals.css` was correctly left untouched, preserving `dropdown-menu.tsx`/`navigation-menu.tsx` behavior as required. Each render-prop function's returned text was cross-checked against its sibling `SelectItemText` content and confirmed to match, including edge cases (empty/custom sentinel values, nullable client name/phone). Build and lint were independently verified clean by the orchestrator. No critical or minor issues found — approved as-is.
