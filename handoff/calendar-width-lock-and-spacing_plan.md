# Plan: Truly Lock Calendar Width to Sidebar-Expanded State + Toolbar Spacing
**Date:** 2026-07-16
**Status:** In Progress
**Mode:** LIGHT

## Goal
Two follow-ups after the user tested the previous `w-[1280px] max-w-full` fix:
1. The calendar still visibly stretches when the sidebar collapses and shrinks when it
   expands. Root cause: `max-w-full` is itself a responsive constraint — it clamps to
   whatever space is actually available, so on a viewport where the sidebar-expanded
   available width is *already* below 1280px, the container still tracks available space
   between the two sidebar states, reproducing the exact "stretch/shrink" behavior the
   user is trying to eliminate. A real fix must not depend on the *live* available space
   at all — it must always compute the same target width regardless of the sidebar's
   current state.
2. Toolbar groups (step selector | Edit Schedule / Bulk Schedule Edit | Month/Week/Day |
   All Masters) feel visually cramped in the top-right corner now that the container is
   wider. Increase the gaps between these groups for breathing room.

Also noted but explicitly NOT changed: the "Today" button (top-left) is being kept as-is
— it's the standard calendar-app "jump to today" pattern (Google Calendar, Outlook, etc.
use the same unlabeled-by-date button); the current date is already shown via the
adjacent month/year title and via the highlighted date cell in the grid itself. This was
explained to the user directly; only revisit if they push back after seeing it again. Do
not touch `todayBtn` in this round.

Also noted: the master-selector "jumping" the user still sees across all languages is a
*symptom* of issue 1 (container width instability), not a separate bug — fixing 1 should
resolve it, since the toolbar's own width stops changing. No separate code path for this.

## Root cause detail (issue 1)
`src/app/admin/layout.tsx`'s content wrapper is currently `mx-auto w-[1280px]
max-w-full px-6 py-8`. `max-w-full` resolves against the *parent's* actual width, which
is `100vw - <live sidebar width>` — and the sidebar's live width toggles between `w-60`
(240px, expanded) and `w-[72px]` (collapsed) per `src/components/admin/AdminSidebar.tsx`
line ~83. Whenever 1280px exceeds the currently-available space (which it apparently
does even in the expanded-sidebar case, per the user's screenshot), `max-w-full` clamps
down to fill exactly what's available — meaning the effective width still depends on
which sidebar state is active. To be *truly* independent of the sidebar's live state,
the target width must be derived from the viewport (`100vw`) directly via `calc()`,
using the sidebar's EXPANDED width as a constant (not its current/live width) — this
way, the computed target is identical in both sidebar states, and the collapsed state
simply reveals extra blank margin instead of growing the content.

## Implementation Steps
- [x] 1. In `src/app/admin/layout.tsx`, replace `mx-auto w-[1280px] max-w-full px-6
  py-8` with `mx-auto w-[calc(100vw-240px)] max-w-full px-6 py-8`. The `240px` must
  match `AdminSidebar.tsx`'s expanded width (`w-60` = 15rem = 240px) exactly — add a
  short comment above this line explaining the `240px` is a deliberate constant mirroring
  the sidebar's EXPANDED width, not its live/current state, so future edits to
  `AdminSidebar.tsx`'s `w-60` value must be mirrored here. Keep `max-w-full` as a
  defensive fallback only (it should never actually trigger in normal use, since
  `calc(100vw-240px)` is mathematically always ≤ the real available width in both
  sidebar states — expanded gives exactly this value, collapsed gives strictly more).
  Reasoning check before implementing: confirm there is no OTHER horizontal-space
  consumer between the outer flex container and this div (re-read
  `src/app/admin/layout.tsx` in full — currently just `<aside>` + a flex-1 column
  containing `<AdminTopBar>` + `<main>`, no extra fixed-width siblings) so `100vw -
  240px` is actually the correct available-width formula and not missing a term.
- [x] 2. In `src/app/admin/master/calendar/ModernCalendar.tsx`, increase spacing in the
  toolbar's right-hand button cluster (~line 252, `<div className="flex flex-wrap
  items-center gap-3">`) — change `gap-3` to `gap-4` or `gap-5` (coder's judgment on
  which reads better, err toward `gap-4` as a moderate, safe increase — this is a
  cosmetic call, not worth overthinking). Also widen the vertical divider margins (the
  `<div className="h-6 w-px bg-border mx-1" />` separators between groups, ~2 occurrences
  in this cluster) from `mx-1` to `mx-2` for clearer group separation. Do not restructure
  which controls belong to which group — only adjust spacing values.

## Verification
- [x] `npm run lint`, `npm run test`, `npm run build` — all clean (lint at/below
  baseline).
- [ ] Manual (user): toggle the sidebar open/collapsed repeatedly — confirm the calendar
  card's width now stays completely constant (pixel-identical) in both states, only its
  horizontal centering/margin changes.
- [ ] Manual: confirm the master-selector button no longer visibly shifts/jumps when
  toggling the sidebar, across all 3 languages (should follow automatically from the
  width fix).
- [ ] Manual: visually confirm the increased toolbar spacing looks less cramped without
  looking sparse/disconnected.

## Acceptance Criteria
- [ ] Calendar container width is mathematically identical in both sidebar states —
  verified not just visually but by the `calc()` formula being independent of the
  sidebar's live DOM state.
- [ ] Toolbar groups have clearer visual separation via increased gap/divider spacing.
- [ ] No regression to the fixed-width toolbar button work from the prior round.
