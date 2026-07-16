# Plan: Fixed-Width Toolbar Buttons + Stable Calendar Container Width
**Date:** 2026-07-16
**Status:** In Progress
**Mode:** LIGHT

## Goal
Two related polish fixes the user found after testing the previous width fix
(`src/app/admin/layout.tsx`'s `max-w-5xl` → `max-w-7xl`):
1. Toolbar buttons in the admin calendar currently size themselves to their own text
   content, so switching language (or collapsing the sidebar, which changes available
   width and can trigger/un-trigger wrapping) visibly reflows/resizes the whole toolbar.
   Reserve a fixed width per button/label — sized to fit the longest of the 3 locale
   variants — so only the text inside changes (and is centered) when language switches;
   the button footprint itself stays constant.
2. The admin content container (`max-w-7xl mx-auto`) is a *responsive* cap: it grows to
   fill available space up to 1280px. Collapsing the sidebar frees up space, which can
   push the calendar past the point where it was already filling 100% of the (smaller)
   available width up to the full 1280px cap — visibly "stretching" instead of just
   re-centering, which the user finds jarring (they want it to look like it did with the
   original `max-w-5xl`, before the toolbar-width bug forced a wider cap: constant width,
   sidebar toggle just changes how it's centered, never how big it is).

## Non-scope
`src/components/admin/AdminSidebar.tsx` nav items do **not** need this treatment — the
sidebar `<aside>` is already a hardcoded fixed width (`w-60` open / `w-[72px]`
collapsed, `src/components/admin/AdminSidebar.tsx:83`), completely decoupled from label
text length; labels use `truncate whitespace-nowrap overflow-hidden`
(`AdminSidebar.tsx:41`) so a long translation truncates with ellipsis rather than
reflowing the sidebar. No code change needed here — confirmed by reading the component,
not by assumption.

## Reference data (exact strings/lengths pulled from src/locales/{en,pl,uk}.json)
- Edit/Done-editing toggle button (`admin.calendar.editSchedule`/`doneEditing`): EN "Edit
  Schedule" (13) / "Done Editing" (12); PL "Edytuj grafik" (13) / "Zakończ edycję" (14);
  UK "Редагувати графік" (17) / "Завершити редагування" (21) ← longest.
- Bulk Schedule Edit button (`admin.calendar.bulkSettings`): EN "Bulk Schedule Edit"
  (18); PL "Zbiorcza edycja grafiku" (23); UK "Масове редагування графіка" (26) ← longest.
- Month/Week/Day tabs (`monthView`/`weekView`/`dayView`): all short (3-7 chars across all
  3 locales) — still worth reserving modest fixed width per the user's "every label"
  instruction, but low visual-impact risk either way.
- All Masters trigger (`admin.calendar.allMasters`): EN "All Masters" (11); PL "Wszyscy
  specjaliści" (19) ← longest; UK "Всі спеціалісти" (15).

## Implementation Steps
- [x] 1. In `src/app/admin/master/calendar/ModernCalendar.tsx`, on each button's TEXT
  SPAN (the `<span className="hidden sm:inline">...</span>` elements — not the whole
  button, so the icon+padding aren't forced wider than needed) add `inline-block
  text-center` plus a generous `min-w-[Nch]` sized for that button's longest locale
  variant (use `ch` units, not hardcoded px, so it scales with font-size and needs no
  pixel-measurement guesswork):
  - Edit/Done-editing span: `min-w-[22ch]` (covers UK's 21-char "Завершити редагування"
    with 1ch buffer).
  - Bulk Schedule Edit span: `min-w-[27ch]` (covers UK's 26-char string with 1ch buffer).
  - Month/Week/Day tab labels: `min-w-[8ch]` each (covers the 7-char max with buffer) —
    apply to each tab button's text, not the group wrapper.
  - All Masters / per-master-name trigger span: `min-w-[20ch]` (covers PL's 19-char
    string with 1ch buffer). Note this button's content is DYNAMIC (either "All Masters"
    text OR a selected master's name pulled from the DB, per AD-A3 — do not apply the
    same treatment to actual master names, only to the static "all masters" label case;
    reason about how the JSX branches (`selectedMasterId === "all" ? ... : ...`) before
    deciding where exactly to put the min-width so a long DB master name doesn't get
    awkwardly padded/truncated by a translation-sized reservation meant for the static
    label).
- [x] 2. In `src/app/admin/layout.tsx`, change the content wrapper from `mx-auto
  max-w-7xl px-6 py-8` to a genuinely fixed target width with a narrow-viewport safety
  net: `mx-auto w-[1280px] max-w-full px-6 py-8`. This makes the container ALWAYS exactly
  1280px wide (centering within whatever space the sidebar leaves) once the viewport is
  wide enough, instead of responsively growing/shrinking with available space — the
  `max-w-full` only kicks in as a shrink-to-fit fallback on genuinely narrow viewports
  (true mobile/narrow-window handling is separately tracked in `ROADMAP.md`, out of
  scope here).

## Verification
- [x] `npm run lint`, `npm run test`, `npm run build` — all clean (lint at/below
  baseline).
- [ ] Manual (user): switch between pl/en/uk on the admin calendar toolbar — confirm
  button widths stay visually constant, text is centered within each, no layout
  reflow/jump.
- [ ] Manual: toggle the sidebar open/collapsed — confirm the calendar's overall width no
  longer visibly grows when collapsing; it should stay the same size and just re-center.
- [ ] Manual: confirm a real (possibly long) master name selected in the All Masters
  dropdown still displays correctly (no awkward forced padding from the min-width meant
  for the static label).

## Acceptance Criteria
- [ ] Toolbar button footprints are constant across all 3 languages; only inner text
  changes and is centered.
- [ ] Sidebar collapse/expand no longer changes the calendar's rendered width, only its
  centering.
- [ ] No regression to the dynamic master-name display case.
- [x] `npm run lint` + `npm run test` + `npm run build` pass.
