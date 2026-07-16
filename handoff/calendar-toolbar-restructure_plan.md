# Plan: Two-Row Calendar Toolbar (Master Filter Top-Right, Centered Controls Row) + Today Date
**Date:** 2026-07-16
**Status:** In Progress
**Mode:** LIGHT

## Goal
Restructure the admin calendar toolbar (`src/app/admin/master/calendar/ModernCalendar.tsx`,
~lines 240-352) after the user tested the current one-row-that-wraps layout and found it
still wraps (the master-selector still falls to its own row) and looks unbalanced (the
step/edit/bulk/view-toggle row is left-packed with a large empty gap on the right). Two
changes:

1. **Move the master-selector ("All Masters") into the top row**, on the right side,
   next to the Today/prev/next/date-title cluster (which currently has a lot of unused
   space to its right) — using `justify-between` so nav sits left, master-filter sits
   right, on ONE row.
2. **The remaining controls (minutes-step, Edit Schedule, Bulk Schedule Edit,
   Month/Week/Day toggle) become their own second row, horizontally centered** (not
   left-packed) with slightly more generous gaps between the groups, since removing the
   master-selector from this row frees up significant width and should let it comfortably
   fit on one line at the calendar's now-locked width.
3. **Add today's actual date next to/inside the "Today" button.** The user was confused
   that "Today" plus a bare month title ("July 2026") doesn't tell you which day is
   "today" without hunting for the small highlighted circle in the grid — add the real
   current date (locale-formatted, matching the `dateFnsLocale`/`format` pattern already
   used for `headerDisplay` at ~line 211) so it's unambiguous at a glance.

## Current structure (for reference, lines may have shifted — re-read live)
```
<div class="... flex flex-wrap gap-y-3 gap-x-4 items-center justify-between px-4 ...">  {/* outer row, currently ONE row that wraps */}
  <div class="flex items-center gap-4">                        {/* left: nav cluster */}
    <Button>Today</Button>
    <div>{prev}{next}</div>
    <h2>{headerDisplay}</h2>
    <div>{spinner}</div>
  </div>
  <div class="flex flex-wrap items-center gap-4">               {/* right: everything else */}
    <Select>{step}</Select>
    <divider/>
    <Button>Edit Schedule</Button>
    <Button>Bulk Schedule Edit</Button>
    <divider/>
    <div>{Month/Week/Day pills}</div>
    {isAdminView && (<div class="relative ml-2">{master-selector trigger + portal dropdown}</div>)}
  </div>
</div>
```

## Target structure
```
<div class="min-h-[4rem] py-2 border-b border-border/60 px-4 shrink-0 z-10 transition-colors shadow-sm">
  {/* Row 1: nav (left) + master filter (right) */}
  <div class="flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
    <div class="flex items-center gap-4">                        {/* unchanged nav cluster, PLUS today's date */}
      <Button>Today <span class="...">· {todayDisplay}</span></Button>
      <div>{prev}{next}</div>
      <h2>{headerDisplay}</h2>
      <div>{spinner}</div>
    </div>
    {isAdminView && adminMastersList && onMasterChange && (
      <div class="relative">{master-selector trigger + portal dropdown — MOVED HERE, drop the ml-2 since justify-between handles spacing}</div>
    )}
  </div>

  {/* Row 2: view/edit controls, centered */}
  <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-3">
    <Select>{step}</Select>
    <divider/>
    <Button>Edit Schedule</Button>
    <Button>Bulk Schedule Edit</Button>
    <divider/>
    <div>{Month/Week/Day pills}</div>
  </div>
</div>
```

## Implementation Steps
- [x] 1. Add a `todayDisplay` value (e.g. via `useMemo`, mirroring the existing
  `headerDisplay` `useMemo` pattern at ~line 211: `format(new Date(), 'd MMM', { locale:
  dateFnsLocale(language) })`, deps `[language]`). Render it inside/next to the "Today"
  button — e.g. as a `<span>` after the translated label, visually de-emphasized (lower
  opacity or `text-muted-foreground`) so the button doesn't look cluttered, something
  like `{t('admin.calendar.todayBtn')} <span class="opacity-70 ml-1">· {todayDisplay}</span>`.
  Keep the button's existing `onClick={() => navigate("today")}` and outer classes as-is.
- [x] 2. Restructure the outer toolbar div per the "Target structure" above: split into
  two explicit rows. Row 1 keeps `justify-between` (nav left, master-filter right — do
  NOT wrap the whole row's contents in extra unneeded divs beyond what's shown). Row 2
  gets `justify-center` and drops the master-selector entirely (moved to row 1). Keep
  `flex-wrap` on both rows as a defensive fallback for pathologically narrow viewports —
  this is not about reintroducing wrapping as the primary mechanism, it's a safety net,
  matching how row 1 already behaves.
  - Move the ENTIRE master-selector block (trigger button + its `createPortal(...)`
    dropdown — do not split them, they must stay together since the trigger's `ref` is
    what the portal's positioning `useLayoutEffect` reads) from its current location
    (last item of the old right cluster) into row 1's right side. Change its wrapper div
    from `className="relative ml-2"` to `className="relative"` (the `ml-2` was for
    spacing within the old flex row; `justify-between` on row 1 now handles that spacing
    — an explicit `ml-2` here would be redundant/wrong).
  - Do NOT touch the master-selector's internal JSX (the static-vs-dynamic branch, the
    `min-w-[22ch]` span, the portal/dropdown contents) — only its position in the tree
    and its wrapper's className move.
  - Row 2's gaps: use `gap-x-6` (up from the current `gap-4`) between the groups now that
    there's more breathing room and fewer items sharing the row — coder's judgment if a
    slightly different value reads better once actually laid out, but `gap-x-6` is the
    intended target, don't go below `gap-4` or above `gap-8` without a strong reason.

## Constraints
- The master-selector dropdown's positioning logic (`useLayoutEffect` computing
  `getBoundingClientRect()` from `masterSelectBtnRef`) must NOT be touched — it reads the
  button's live position wherever it ends up in the DOM/layout, so moving the button in
  the JSX tree is safe and requires no changes to that logic. Just don't break the ref
  attachment or portal call while moving the block.
- Do not change any translation keys, the `ch`-based min-widths from the prior approved
  round, or any button's click behavior — this round is purely structural
  (row placement) + the one new `todayDisplay` addition.
- File stays under the repo's 500-line limit (currently well under; this change doesn't
  add many lines).

## Verification
- [x] `npm run lint`, `npm run test`, `npm run build` — all clean (lint at/below
  baseline).
- [ ] Manual (user): confirm the master-selector now sits in the top-right, on the same
  row as Today/nav/date, with visible breathing room (using the space that was
  previously empty).
- [ ] Manual: confirm the second row (step/edit/bulk/view-toggle) is now centered with
  even spacing, not left-packed with a lopsided right gap.
- [ ] Manual: confirm the "Today" button now shows the actual current date, correctly
  localized in pl/en/uk.
- [ ] Manual: confirm the master-selector dropdown still opens/closes/positions
  correctly and selection still works, now that its trigger lives in row 1.

## Acceptance Criteria
- [ ] Toolbar is two clean, purposeful rows: nav+filter on top, view/edit controls
  centered below.
- [ ] No regression to dropdown positioning, translations, or the fixed-width spans from
  prior rounds.
- [ ] Today button communicates the actual current date.
