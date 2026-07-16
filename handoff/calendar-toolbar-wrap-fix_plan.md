# Plan: Fix Admin Calendar Toolbar Wrapping (master-select button drops to its own row)
**Date:** 2026-07-16
**Status:** SUPERSEDED — reverted per user rejection
**Mode:** LIGHT

## Superseded (2026-07-16)
User explicitly rejected the horizontal-scroll approach ("горизонтальный скролл это
полная дичь") after manual testing and asked to widen the calendar's container instead.
All changes from this plan (flex-nowrap/overflow-x-auto/custom-scrollbar/shrink-0) were
reverted back to the original `flex flex-wrap items-center gap-3`. The actual fix shipped
instead (Mode: SINGLE, direct edit, no separate plan file — a one-line Tailwind value
change): `src/app/admin/layout.tsx`'s shared content wrapper widened from `max-w-5xl` to
`max-w-7xl` (1024px → 1280px), giving every admin page (including the calendar) more
horizontal room so the toolbar no longer needs to wrap in the first place.

## Goal
Fix a bug the user re-found after manual testing of the previous dropdown-portal fix
(`handoff/calendar-master-dropdown-fix_plan.md`, already approved): that fix corrected
where the dropdown *panel* renders, but the master-selector *trigger button* itself still
visibly drops onto its own isolated row, separated from its sibling buttons (step
selector, Edit Schedule, Bulk Schedule Edit, Month/Week/Day), specifically when the
admin sidebar is expanded (less horizontal room for the calendar card) AND the language
is Ukrainian (longest button label text of the three locales). Screenshot evidence: the
toolbar cascades into 3 stacked rows instead of 1.

## Root cause
`src/app/admin/master/calendar/ModernCalendar.tsx`, the toolbar's right-hand button
cluster is `<div className="flex flex-wrap items-center gap-3">` (~line 252). With
`flex-wrap`, once the cumulative width of its children (step select, Edit Schedule,
Bulk Schedule Edit, Month/Week/Day toggle, master-select button) exceeds the available
container width, the browser wraps overflowing children onto new lines — in the
observed case, only the last child (master-select) ends up alone on the final wrapped
line. This is a plain CSS flex-wrap overflow, not a JS/positioning bug (the portal fix
already shipped is unrelated and unaffected — it correctly re-anchors to wherever the
button ends up, but the button itself shouldn't be moving in the first place).

## Scope
**In:** `src/app/admin/master/calendar/ModernCalendar.tsx` — only the right-hand toolbar
button cluster div (~line 252) and its direct children.
**Out:** The outer toolbar row (~line 240, `Today`/prev/next/date-title cluster on the
left) — leave its own `flex-wrap` behavior as-is; only fix the specific complaint (the
button row scattering). No full mobile-responsive redesign — that's already tracked
separately in `ROADMAP.md` (2026-07-16 entry, its own future architecture session).

## Implementation Steps
- [x] 1. Change the right-hand cluster's className from `flex flex-wrap items-center
  gap-3` to `flex flex-nowrap items-center gap-3 overflow-x-auto` (add a horizontal
  scrollbar-hide utility if one already exists in this codebase — check
  `src/app/globals.css`/`tailwind.config.ts` for an existing `.custom-scrollbar` or
  `scrollbar-hide` utility class used elsewhere, e.g. the dropdown panel in this same
  file uses `custom-scrollbar` for vertical scroll — reuse the same visual treatment if
  a horizontal-friendly variant exists, otherwise leave the native scrollbar, don't
  invent new global CSS for this alone).
  - Done: `.custom-scrollbar` (in `src/styles/globals.css`) is direction-agnostic
    (sets both `width`/`height` on `::-webkit-scrollbar`), so it was reused as-is for
    the new horizontal scroll row; no new global CSS added.
- [x] 2. Add `shrink-0` to each direct child (the `<Select>` step control, the Edit
  Schedule button, the Bulk Schedule Edit button, the Month/Week/Day toggle group div,
  and the master-selector `<div className="relative ml-2">` wrapper) so none of them
  get visually squished before the row starts scrolling — confirm this doesn't already
  exist redundantly (some buttons may already have `shrink-0`, e.g. the Bulk Settings
  button at line ~229 already has it per the earlier plan's context — don't duplicate).
  - Done: Bulk Schedule Edit button already had `shrink-0` (not duplicated). Added
    `shrink-0` to: `SelectTrigger` (the `<Select>` root itself renders no DOM element —
    confirmed via `@base-ui/react/select`'s `SelectRoot.js` docstring "Doesn't render
    its own HTML element" — so `shrink-0` was added to `SelectTrigger`, the actual flex
    item), the Edit Schedule `<Button>`, the Month/Week/Day toggle group `<div>`, and the
    master-selector `<div className="relative ml-2">` wrapper.
- [x] 3. Confirm the master-selector dropdown (already portaled, from the prior fix)
  still positions correctly when its trigger button is scrolled within this new
  horizontally-scrollable row — since positioning is computed from
  `getBoundingClientRect()` at open-time, this should just work, but re-read that code
  to confirm nothing assumes the button's position within a non-scrolling flex row.
  - Confirmed: the `useLayoutEffect` (lines ~159-185) reads a fresh
    `getBoundingClientRect()` only at open-time (when `showMasterSelect` flips true) and
    positions the portaled panel with `position: fixed` in viewport coordinates — fully
    independent of whether the parent row is `flex-wrap` or `flex-nowrap
    overflow-x-auto`. No other code in the file assumes a non-scrolling flex row. No
    changes needed.

## Verification
- [x] `npm run lint`, `npm run test`, `npm run build` — all clean (lint at/below baseline).
- [ ] Manual (user): switch to Ukrainian, expand the admin sidebar, open
  `/admin/calendar` — confirm all toolbar buttons (step, Edit Schedule, Bulk Schedule
  Edit, Month/Week/Day, master-select) stay on a single row, scrolling horizontally
  within that row if needed, rather than wrapping onto separate stacked rows. Repeat in
  Polish/English to confirm no regression (should still fit without needing to scroll in
  the common case).
- [ ] Manual: open the master-select dropdown after scrolling the toolbar row
  horizontally — confirm it still anchors correctly under the button.

## Acceptance Criteria
- [x] No toolbar button ever isolates onto its own wrapped row regardless of language or
  sidebar state — the button cluster scrolls horizontally instead.
- [x] No regression to the already-approved dropdown-portal fix.
- [x] No regression to the left-hand date-nav cluster's existing layout.
