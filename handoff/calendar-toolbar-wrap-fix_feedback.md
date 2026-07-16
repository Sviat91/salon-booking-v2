# Review: Calendar Toolbar Wrap Fix
**Date:** 2026-07-16
**Verdict:** APPROVED (original scroll-based approach) — then SUPERSEDED same day

## Superseded (2026-07-16)
User tested the horizontal-scroll fix and rejected it as bad UX ("горизонтальный скролл
это полная дичь"), requesting the calendar's container be widened instead. All
flex-nowrap/overflow-x-auto/custom-scrollbar/shrink-0 changes described below were
reverted back to `flex flex-wrap items-center gap-3`. Replacement fix: widened
`src/app/admin/layout.tsx`'s shared content wrapper from `max-w-5xl` to `max-w-7xl`
(direct edit, Mode: SINGLE, no separate agent round — a one-line Tailwind value change).
Re-verified after revert + width change: `npm run lint` 47 problems (baseline), `npm run
test` 112/112, `npm run build` succeeds.

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
None found.

## Passed Checks
- [x] Right-hand cluster changed to `flex flex-nowrap items-center gap-3 overflow-x-auto custom-scrollbar`; `flex-wrap` fully removed from this element, no contradictory co-occurrence.
- [x] `.custom-scrollbar` (`src/styles/globals.css:162-165`) confirmed direction-agnostic — pure `::-webkit-scrollbar` styling, no `overflow-x`/`overflow-y` declarations — valid reuse for horizontal scroll.
- [x] `shrink-0` correctly placed on `SelectTrigger` (verified `<Select>` itself renders no DOM element via `src/components/ui/select.tsx`), Edit Schedule button, Month/Week/Day toggle group, master-selector wrapper. Bulk Schedule Edit button's pre-existing `shrink-0` not duplicated.
- [x] No regression to the dropdown-portal fix — `useLayoutEffect` positioning logic byte-for-byte unchanged; portal renders to `document.body`, structurally immune to the new `overflow-x-auto` ancestor.
- [x] Left-hand date-nav cluster untouched, matching plan's "Out" scope.
- [x] File remains well under the 500-line limit.

## Independent orchestrator verification (2026-07-16, post-review)
Reviewer had no Bash access; re-run independently:
- `npm run lint` — 47 problems (42 errors, 5 warnings), identical to baseline.
- `npm run test` — 20/20 files, 112/112 tests passing.
- `npm run build` — production build succeeds.

## Summary
Third fix round in this file today (i18n admin pass → dropdown-portal fix → this toolbar-wrap fix), reviewed against both prior changes for regressions — none found. Buttons no longer isolate onto their own wrapped row; the cluster scrolls horizontally instead, regardless of language or sidebar state.

## Outstanding (manual, human-only)
- Switch to Ukrainian, expand sidebar, open `/admin/calendar` — confirm all toolbar buttons stay on one row (scrolling if needed, not wrapping).
- Repeat in Polish/English — should fit without scrolling in the common case.
- Scroll the row horizontally, open the master-select dropdown — confirm it still anchors correctly under the button.
