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

---

## Stage 2b — Calendar bug-fix pass (dark-theme lines, header/grid alignment, step selector)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/index.css`, `demo-widget/tailwind.config.ts`, `demo-widget/src/admin/pages/CalendarPage/{WeekView,DayView,CalendarToolbar,index}.tsx`.

User reported (with screenshot of the real production calendar as reference): dark-theme grid lines rendered bright white instead of subtle, the day-header column dividers drifted out of alignment with the grid body's dividers, and the toolbar's minute-step selector did nothing.

### Root causes (diagnosed by orchestrator before dispatch, verified against compiled CSS)
1. `tailwind.config.ts` defined semantic colors as bare `var(--x)` strings — Tailwind 3.4 cannot generate opacity-modifier classes (`border-border/60`, `bg-muted/40`, etc.) from a bare `var()` color. Confirmed via grepping the built `dist/assets/*.css`: these classes generated no CSS at all, so affected elements fell back to inherited `currentColor` (near-white in dark mode).
2. Day-header row and hour-grid body were separate containers, header guessing scrollbar width via `pr-2` (8px) while the body's real browser scrollbar consumed a different amount — column boundaries drifted, worse to the right.
3. The step/interval selector button had no `onClick` at all — purely decorative, unlike production's functional 5/10/15/30/60-minute control.

### Fix
1. Converted `index.css` CSS custom properties from hex to space-separated RGB triplets, wrapped `tailwind.config.ts`'s color map in `rgb(var(--x) / <alpha-value>)` (standard shadcn/Tailwind pattern) — root-cause fix, also correctly resolves the same silent-no-op bug on every other already-built page (Services/Discounts/Masters/Pages/Settings/shared primitives), not just Calendar. Audited and rewrapped all 13 raw `var(--x)` usages elsewhere in `index.css`; confirmed zero raw usages remain in either `.css` or `.tsx` (independently grepped by both orchestrator-dispatched coder and reviewer).
2. Restructured `WeekView.tsx`/`DayView.tsx` so the header row lives inside the same scrolling container as the grid body, pinned via `position: sticky` — guarantees identical column-width math instead of guessing scrollbar width.
3. Lifted `step` state to `CalendarPage/index.tsx` (`useState(15)`, no localStorage per this demo's no-persistence policy), wired a real native `<select>` (5/10/15/30/60) into `CalendarToolbar.tsx`, and made `WeekView.tsx`/`DayView.tsx` gridlines follow production's formula (`24 * Math.floor(60/step) + 1` lines, hour lines solid, sub-hour lines dashed).

### Verification
- Reviewer (static-only, no Bash access this pass) confirmed all RGB triplets valid, Tailwind wrapping correct, zero raw `var()` leaks, sticky-header restructure preserves click-to-open/appointment-click/now-line/hour-labels, step wiring correct end-to-end, Month-view disabling preserved.
- Orchestrator independently ran `git status`/`git diff --stat` (exactly the 6 claimed files, no extraneous changes) and `npm run build` (clean) to close the gap left by the reviewer's missing Bash access.

No Critical/Architectural or Minor issues found.

---

## Stage 2c — Calendar hour range restricted to 08:00–21:00
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/admin/pages/CalendarPage/{calendarUtils,WeekView,DayView}.tsx`.

User requested the Week/Day grid show 08:00–21:00 instead of the full 00:00–23:00. Added shared `START_HOUR = 8` / `END_HOUR = 21` constants in `calendarUtils.ts`; `HOURS` now produces `[8..20]` (13 labels), `CONTAINER_HEIGHT = 13 * 60 * PIXELS_PER_MINUTE`. Hour labels, the step-based gridlines, the "now" red line, and appointment-block positioning were all re-derived relative to `START_HOUR` so all four share one coordinate system.

Reviewer traced the arithmetic by hand (concrete examples: 14:30 now-line lands at the same pixel as a 14:30 appointment block; 07:00/22:00 correctly fall outside the visible bounds and hide the now-line) — no drift between the four position calculations. Confirmed `MonthView.tsx`, `CalendarToolbar.tsx`, all three modals, `MasterSelectDropdown.tsx`, `index.tsx`, and `mockAdminData.ts` untouched; `PIXELS_PER_MINUTE` unchanged. Orchestrator independently confirmed via `git diff --stat` that only the 3 claimed files changed, and ran `npm run build` clean.

No issues found.
