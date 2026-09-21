# Review: calendar-week-taps

**Date:** 2026-09-21 · **Verdict:** APPROVED (no Critical/Architectural, no required Minor fixes).

Note: the reviewer agent has no Write tool; the orchestrator saved its findings here.

## Critical/Architectural
None.

## Minor (optional, no change required)
- `WeekMobileGroup.tsx` — an expanded panel near the bottom of the grid can extend below the inner block; the body scroller is `overflow-y-auto`, so it stays reachable by scrolling.
- `WeekView.tsx` is 498 lines (limit 500) — any further addition needs another extraction.

## Verified
- Desktop unchanged: `renderDayHeaderCell` uses a fragment (no wrapper on desktop), grid-click overlay only removed on mobile (`&& !isMobile`), desktop group expand/collapse block untouched.
- Mobile: header date is a `<button>` only on mobile, `disabled` in edit mode, calls `onDayClick(day)`; grid never navigates; single appointment still opens; group toggles via `toggleExpand(dateStr, groupIdx)`; row tap opens the appointment with `stopPropagation` (no double toggle); `WeekMobileGroup` stays inside `containerRef`'s subtree (no portal), so the existing document-mousedown click-outside still collapses it.
- React: one top-level hook in `WeekMobileGroup`, keys correct, no unused imports left in `WeekView`.
- Layout: expanded panel `z-30` above single blocks (`z-10`) and the today line (`z-20`).
- Files: `WeekView.tsx` 498, `WeekMobileGroup.tsx` 52 (< 500); `src/app/admin/AGENTS.md` accurate, no stale "chips jump to Day view" text.

## Orchestrator re-check
`npx tsc --noEmit` clean; `npm run test` 39 files / 382 tests pass (coder run); eslint on the two touched files clean.

APPROVED
