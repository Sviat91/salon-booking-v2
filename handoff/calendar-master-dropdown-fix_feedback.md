# Review: Calendar Master-Dropdown Fix
**Date:** 2026-07-16
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- Leftover `relative` wrapper class on the trigger's parent `<div className="relative ml-2">` (`ModernCalendar.tsx`) — no longer functionally needed now that the panel is portaled and positioned via `fixed`/`getBoundingClientRect()`. Harmless cosmetic leftover, not fixed (not worth a re-round for this alone).

## Passed Checks
- [x] `useLayoutEffect` (not `useEffect`) used for position computation, matching `TimePickerDropdown.tsx`'s flash-prevention reasoning.
- [x] Right-alignment clamp math checked by hand and correct in both directions (won't overflow left or right viewport edges).
- [x] Flip-above-if-no-room-below logic matches the reference pattern exactly.
- [x] `zIndex: 9999` present in both branches.
- [x] `mousedown` click-outside listener checks both trigger and panel refs, correctly added/removed, no leak.
- [x] `onMouseDown` stopPropagation present on portaled panel root.
- [x] Old `fixed inset-0` backdrop fully removed — no dueling close mechanisms.
- [x] Selection behavior (`onMasterChange` + close) unchanged for both "all masters" and per-master options.
- [x] Hover contrast fix applied to both option buttons, verified against `LanguageToggle.tsx`'s already-working identical selected+hover combination — no CSS specificity concern.
- [x] `step` Select and all other code in the file left untouched — scope respected.

## Independent orchestrator verification (2026-07-16, post-review)
Reviewer had no Bash access; re-run independently:
- `npm run lint` — 47 problems (42 errors, 5 warnings), identical to established baseline.
- `npm run test` — 20/20 files, 112/112 tests passing.
- `npm run build` — production build succeeds.

## Summary
Faithful mirror of the proven `TimePickerDropdown.tsx` portal pattern. Fixes both the clipping (portal escapes the `overflow-hidden` calendar card) and the language-dependent position fragility (JS-computed `getBoundingClientRect()` positioning, decoupled from CSS layout quirks). Hover contrast fix matches an already-shipped, working precedent. No regressions found.

## Outstanding (manual, human-only)
- Open the admin/master calendar, scroll so the toolbar sits near the bottom of the viewport, open the master-selector dropdown — confirm no clipping, correct anchoring, flip-above works if needed.
- Repeat in Ukrainian — confirm position no longer jumps/misaligns.
- Check hover state visibility on both dropdown rows in light and dark theme.
- Confirm click-outside-to-close and option-selection still work, across Month/Week/Day views.
