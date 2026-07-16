# Review: Calendar Width Lock and Spacing
**Date:** 2026-07-16
**Verdict:** APPROVED

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
- Scrollbar-width edge case (inherent to the approach, not a regression): `100vw`
  includes the vertical scrollbar's reserved space on non-overlay-scrollbar browsers
  (e.g. Windows Chrome/Firefox, ~15-17px). On tall pages where `<main>` actually scrolls,
  this could cause a few px of horizontal overflow. Plan-acknowledged tradeoff, accepted
  in favor of eliminating the collapse/expand jump. Track if a user reports it later.

## Passed Checks
- [x] `calc(100vw-240px)` formula independently verified correct — no other fixed-width
  horizontal-space consumer between the outer flex container and the target div.
- [x] `240px` confirmed to match `AdminSidebar.tsx`'s `w-60` (240px at standard 16px root
  font-size; no root font-size override anywhere in the codebase).
- [x] No `transform`/`zoom`/`contain` property in the admin component tree that would
  break `vw` unit resolution against the viewport.
- [x] Explanatory comment present, clear, instructs future maintainers to keep `240px` in
  sync with `AdminSidebar.tsx`.
- [x] `w-[calc(100vw-240px)]` valid Tailwind 3.4 arbitrary-value syntax.
- [x] Toolbar spacing changes (`gap-3`→`gap-4`, both `mx-1`→`mx-2` dividers) applied
  exactly as specified.
- [x] All prior-round `ch`-based fixed-width spans (`min-w-[24ch]`, `29ch`, `8ch`, `22ch`)
  present and untouched.
- [x] `todayBtn` untouched per explicit plan instruction.
- [x] Scope discipline — no unrelated changes in either file.

## Independent orchestrator verification (2026-07-16, post-review)
Reviewer had no Bash access; re-run independently:
- `npm run lint` — 47 problems (42 errors, 5 warnings), identical to baseline.
- `npm run test` — 20/20 files, 112/112 tests passing.
- `npm run build` — production build succeeds.

## Summary
Sixth fix round today. The `calc(100vw-240px)` approach correctly decouples the
calendar container's width from the sidebar's live/current state by anchoring to the
viewport plus a hardcoded constant, instead of the previous `max-w-full` which still
responded to live available space. Math independently verified sound. No regressions to
any of the 5 prior approved rounds in this area.

## Outstanding (manual, human-only)
- Toggle sidebar open/collapsed repeatedly — confirm calendar width is now pixel-identical
  in both states, only centering/margin shifts.
- Confirm master-selector no longer visibly jumps across pl/en/uk when toggling sidebar.
- Visually confirm the increased toolbar spacing looks right (not sparse, not cramped).
