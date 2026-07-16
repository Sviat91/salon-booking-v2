# Plan: Fix Admin Calendar Master-Selector Dropdown (position + clipping + hover)
**Date:** 2026-07-16
**Status:** In Progress
**Mode:** LIGHT

## Goal
Fix two bugs reported by the user in the admin calendar's master-selector dropdown
(`src/app/admin/master/calendar/ModernCalendar.tsx`, used by both `/admin/calendar` and
the master's own calendar):
1. The dropdown panel gets clipped by the calendar card's `overflow-hidden` wrapper when
   it would extend past the card's bottom edge, and its position visibly breaks
   (jumps left, misaligned) specifically observed with the longer Ukrainian nav-item text
   — a CSS `position: absolute`-inside-`overflow-hidden` layout fragility.
2. The hover state on dropdown list items (`hover:bg-muted`) is barely visible in both
   light and dark themes.

## Root cause
The dropdown (currently `<div className="absolute right-0 top-full ...">`, lines ~268-287
of `ModernCalendar.tsx`) is nested inside the component's outermost wrapper
(`<div className="flex flex-col h-full w-full ... overflow-hidden relative">`, line 190),
which needs `overflow-hidden` to keep the calendar card's rounded corners. Any
`position: absolute` descendant that would render past that wrapper's bounds gets clipped
— this explains the "doesn't overlay the calendar" complaint. Combined with the toolbar's
`flex-wrap` layout and language-dependent text width, the absolute positioning is fragile
enough to visibly misplace under Ukrainian.

This exact class of bug was already fixed once in this codebase for
`src/components/TimePickerDropdown.tsx` (ROADMAP, 2026-07-13: "попап выбора времени
открывался в случайном месте экрана... теперь через портал в document.body"). Apply the
same proven pattern here instead of re-diagnosing the precise CSS interaction.

## Scope
**In:** `src/app/admin/master/calendar/ModernCalendar.tsx` — only the master-selector
dropdown block (trigger button + its panel), roughly lines 252-291.
**Out:** Any other dropdown/select in this file (the `step` `<Select>` uses the shared
`ui/select.tsx` primitive, not this ad-hoc pattern — leave untouched). No calendar-width
change (discussed with user; the portal fix resolves both complaints without it).

## Implementation Steps
- [x] 1. Add `useRef`/`useLayoutEffect` state for the master-selector trigger button and
  dropdown panel, and a computed `dropdownStyle` (`React.CSSProperties`), mirroring
  `TimePickerDropdown.tsx`'s pattern exactly:
  - `btnRef` on the trigger `<button>`.
  - `dropdownRef` on the portaled panel.
  - `useLayoutEffect` on `[showMasterSelect]` that computes `getBoundingClientRect()` from
    `btnRef`, and sets `position: fixed`, right-aligned to the button (`left` computed so
    the panel's right edge matches the button's right edge, clamped so it never goes
    off-screen left), `top` below the button with a small gap, flip-above logic if
    insufficient space below (same `spaceBelow` check as `TimePickerDropdown.tsx`), and a
    high `zIndex` (9999, matching the existing pattern).
- [x] 2. Replace the current `<div className="fixed inset-0 z-40" onClick={...} />`
  backdrop + `<div className="absolute right-0 top-full ...">` panel with:
  `{showMasterSelect && createPortal(<div ref={dropdownRef} style={dropdownStyle}
  onMouseDown={(e) => e.stopPropagation()} className="...">...</div>, document.body)}`
  and a `mousedown` document listener (open-state effect) that closes the dropdown when
  the click target is outside both `btnRef` and `dropdownRef` — same approach as
  `TimePickerDropdown.tsx`'s `handleClickOutside`. Preserve existing classes for the
  panel's visual chrome (`bg-card border border-border rounded-xl shadow-xl`, the
  `max-h-[300px] overflow-y-auto custom-scrollbar` inner scroll region) — only the
  positioning mechanism changes, not the look.
- [x] 3. Fix hover contrast on both dropdown option buttons (the "all masters combined"
  option and the per-master `.map()` options): change `hover:bg-muted` to
  `hover:bg-primary hover:text-primary-foreground`, matching the already-established
  client-facing pattern in `src/components/LanguageToggle.tsx` (line ~98). Keep the
  existing "currently selected" resting-state style (`bg-primary/20 text-primary
  font-medium`) — just ensure the hover state remains clearly visible when hovering over
  the selected item too (test visually if possible, otherwise reason about class
  precedence/specificity so hover always wins visually).
- [x] 4. Import `createPortal` from `react-dom` (already a dependency, used by
  `TimePickerDropdown.tsx`).

## Verification
- [x] `npm run lint`, `npm run test`, `npm run build` — all clean (lint at/below baseline).
- [ ] Manual (user, both themes, pl/en/uk): open `/admin/calendar` (or master calendar),
  open the master-selector dropdown in each view (Month/Week/Day) near the bottom of the
  viewport where clipping was most visible, confirm the panel renders fully, anchored
  correctly under the button, in all 3 languages, and the hover state on list items is
  clearly visible in both light and dark theme.

## Acceptance Criteria
- [ ] Dropdown never gets clipped by the calendar card, regardless of scroll position or
  language.
- [ ] Dropdown always anchors visually under/near its trigger button, in all 3 languages.
- [ ] Hover state on dropdown items is clearly visible in both themes.
- [ ] No regression to click-outside-to-close behavior or the existing selected-item
  styling.
