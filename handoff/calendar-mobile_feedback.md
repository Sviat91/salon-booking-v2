# Review: calendar-mobile

**Date:** 2026-09-21 · **Verdict:** APPROVED (no Critical/Architectural issues; 4 Minor, all fixed by the orchestrator directly — fully-understood one-line fixes, no planner/coder round-trip needed).

Note: the reviewer agent has no Write tool; the orchestrator saved its findings here.

## Critical/Architectural
None.

## Minor/Syntax (all fixed)
- [x] `AgendaView.tsx` — stale scroll position on a month with no upcoming group (past month kept the previous month's `scrollTop`). Fix: `scrollTop = el ? el.offsetTop : 0`.
- [x] `AgendaView.tsx` — effect keyed on `groups.length` re-scrolled to today whenever a polled/edited booking changed the day-group count. Fix: keyed on `[monthKey, hasGroups]`; container is now `relative`, so `el.offsetTop` is used directly (no `container.offsetTop` subtraction).
- [x] `useSwipeNavigation.ts` — a second finger returned early without clearing the start point, so the first finger's later `touchend` measured from a stale origin. Fix: clear `start.current` in that branch; added `onTouchCancel` (wired in `ModernCalendar.tsx`).
- [x] `CalendarToolbar.tsx` — the loading spinner (`absolute top-1 right-1`) overlapped the burger button. Fix: zero-width slot between the label and Today; spinner hangs off its right edge.

## Verified by the reviewer
- Desktop unchanged: both page wrappers (`-mx-4 -my-4 h-[calc(100dvh-4rem)]` → every original value restored at `lg:`), `CalendarToolbar` desktop path (view toggle still Month/Week/Day), `WeekView` desktop return path and shared-helper classes (all mobile tweaks behind `isMobile ? … : <original>`).
- Mobile px math holds: 7 columns = (W−44)/7 ≈ 45/47/50/55px at 360/375/393/430; toolbar row ≈ 207px fixed at 360px, leaving ≈ 145px for the label.
- Hook order (`useSwipeNavigation` before the `!isMounted` early return), no orphan refs/imports after the scroll-sync deletion, no `Record<ViewType,…>`/switch broken by widening `ViewType`, `effectiveView`/`rangeView` logic correct and `view` state never overwritten, swipe disabled in edit mode and not attached to modals, i18n keys identical order in pl/en/uk, all files < 500 lines, `src/app/admin/AGENTS.md` accurate.

## Orchestrator re-check after fixes
- `npx tsc --noEmit` clean.
- `npx eslint` on the 7 touched files: 3 errors, all pre-existing in `ModernCalendar.tsx` (`_masterId` unused; two `eslint-disable react-hooks/exhaustive-deps` comments for a rule the config doesn't define) — none in lines changed by this work.
- Line counts: WeekView 483, ModernCalendar 358, CalendarToolbar 233, AgendaView 105, useSwipeNavigation 35.

APPROVED
