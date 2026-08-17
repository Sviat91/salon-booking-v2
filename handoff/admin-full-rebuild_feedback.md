# Admin panel rebuild — reviewer feedback

## Stage 1 — Shared infra (Sheet/Dialog/Switch/SubNav)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/admin/shared/{Sheet,Dialog,Switch,SubNav}.tsx`.

- Props match plan exactly. Switch dimensions/tokens match production `src/components/ui/switch.tsx` byte-for-byte. SubNav layout classes near-identical to `DatabaseSubNav.tsx`, correctly swapping Next.js routing/i18n for local props.
- Sheet/Dialog are reasonable simplified equivalents of the real `@base-ui/react`-based primitives (missing enter/exit transitions — acceptable, plan calls these "minimal inert").
- No `fetch`/`localStorage`. Not wired into any page yet (grep-confirmed).
- All 4 files well under 500 lines (34/33/43/31).
- Plan checkboxes scoped correctly to only the 4 "Shared infra needed" items.
- Build verified clean by orchestrator directly (`npm run build` in `demo-widget/`) since reviewer had no Bash access this pass.

No issues found.

---

## Stage 2 — Calendar (Month/Week/Day views, 3 modals, master filter)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/admin/pages/CalendarPage/{index,CalendarToolbar,MasterSelectDropdown,MonthView,WeekView,DayView,AppointmentModal,ViewAppointmentModal,BulkSettingsModal,calendarUtils}.tsx|ts`, plus `mockAdminData.ts` (extended, backward-compatible) and deletion of the old flat `CalendarPage.tsx`.

### Passed
- All 8 plan checklist items genuinely satisfied (not just claimed): functional Month/Week/Day toggle, real month grid with day→Day-view jump, Day view reusing `PIXELS_PER_MINUTE = 1.5`, `ViewAppointmentModal`/`AppointmentModal`/`BulkSettingsModal` all real-shaped and verified inert (Save/Delete/Apply terminate in `onClose` only, no mutation of `mockAdminData`), `MasterSelectDropdown` genuinely filters appointments across all 3 views, "Edit Schedule" stays inert.
- No `fetch`/`localStorage` anywhere in the new files.
- `mockAdminData.ts` type extension confirmed backward-compatible by direct read of `DashboardPage.tsx`/`MastersPage.tsx` (not just trusting the coder's claim).
- All files well under 500 lines (largest 132).
- Plan checkboxes scoped correctly to only the Calendar section.
- `bg-red-600`/`text-red-600` explicit-color workaround for Delete buttons justified: verified no `--destructive` CSS var exists anywhere in the repo; broken `text-destructive` usages pre-exist elsewhere (`PagesPage.tsx`, `ServicesPage.tsx`, `DiscountsPage.tsx`, `AdminSidebar.tsx`, `badge.tsx`) and are correctly left untouched as out of scope for this task.
- Build verified clean by orchestrator directly (`tsc -b && vite build`, clean, only pre-existing chunk-size warning).

### Minor (fixed post-review by orchestrator, trivial)
- `AppointmentModal.tsx` used the bare `React.ReactNode` global instead of `import type { ReactNode } from 'react'` (inconsistent with the rest of `demo-widget/src/admin`, including the Stage 1 primitives). Fixed directly — added the import, changed the one usage. Re-verified build clean after the fix.

### Noted, not fixed (non-blocking, future cleanup candidate)
- `ViewAppointmentModal.tsx` hand-rolls its own "Delete booking?" confirm overlay instead of reusing the shared `Dialog` primitive from Stage 1, despite matching its prop shape. Cosmetic/DRY nit only — left as-is per surgical-scope rule (not part of this task's brief, no functional impact).

No Critical/Architectural issues at either stage.
