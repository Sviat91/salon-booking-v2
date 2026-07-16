# Review: Calendar Toolbar Fixed-Width
**Date:** 2026-07-16
**Verdict:** APPROVED

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
- `ch`-buffer margin was thin for Cyrillic strings in a proportional font (1ch buffer on
  the 21/26-char UK strings). **Addressed directly by the orchestrator post-review**
  (no re-round needed): bumped `min-w-[22ch]` → `24ch` (edit/done-editing),
  `min-w-[27ch]` → `29ch` (bulk settings), `min-w-[20ch]` → `22ch` (All Masters static
  label) for extra headroom. Month/Week/Day tabs (`min-w-[8ch]`, 1ch buffer over a 7-char
  max on already-short words) left as-is — low risk.

## Passed Checks
- [x] `src/app/admin/layout.tsx` content wrapper: `mx-auto w-[1280px] max-w-full px-6
  py-8` — fixed target width, `max-width: 100%` only shrinks on narrow viewports, never
  grows past 1280px. Sidebar toggle can no longer stretch the container, only re-center.
- [x] Locale string lengths independently re-verified against `src/locales/{en,pl,uk}.json`
  — all match the plan's reference data exactly.
- [x] Static-vs-dynamic master-name branch correctly handled: the min-width/text-center
  span applies only inside the `selectedMasterId === "all"` branch; the branch rendering
  a real DB master name is completely untouched (AD-A3 respected).
- [x] `inline-block` (not plain `inline`) used consistently so `min-w` actually applies.
- [x] Month/Week/Day tabs: min-width applied to the inner label span only, active/inactive
  pill styling on the outer button unmerged/untouched.
- [x] Toolbar right-hand cluster remains `flex flex-wrap items-center gap-3` — no
  regression to the earlier approved (post-revert) toolbar structure.
- [x] Dropdown-portal fix (from the prior approved round) untouched — positioning,
  click-outside handling, portal render all byte-for-byte consistent.

## Independent orchestrator verification (2026-07-16, post-review + buffer bump)
- `npm run lint` — 47 problems (42 errors, 5 warnings), identical to baseline.
- `npm run test` — 20/20 files, 112/112 tests passing.
- `npm run build` — production build succeeds.

## Summary
Fifth fix round today in this file/area. Implementation matches the plan precisely;
reviewer's one flagged risk (thin Cyrillic buffer) was cheap to address directly rather
than requiring another full round-trip. No regressions to any of the prior approved
fixes in this file (dropdown portal, flex-wrap toolbar structure).

## Outstanding (manual, human-only)
- Switch pl/en/uk on the admin calendar toolbar — confirm button widths stay constant,
  text centered, no reflow (including the freshly-widened Cyrillic buffers).
- Toggle sidebar open/collapsed — confirm calendar width stays constant, only re-centers.
- Select a real (possibly long) master name — confirm normal display, no forced padding.
