# Plan: mobile week view — navigate to Day only via the header date

Mode: LIGHT (orchestrator-authored). UI-only. Follow-up to `handoff/calendar-mobile_plan.md` (already implemented + approved).
Owner contract: `src/app/admin/AGENTS.md` (Calendar mobile bullet).

## Problem (user feedback, live test)

On mobile Week view, tapping anywhere on a day's grid column jumps into Day view, and tapping an overlap-group chip also jumps into Day view. Accidental taps are annoying. Wanted:

- Tapping the **date in the column header** (weekday + number) → open that day (Day view).
- Tapping the **grid** must NOT navigate anywhere.
- Tapping an **appointment** → opens it (already works, unchanged).
- Tapping a **group of overlapping appointments** → the group expands in place to list its appointments (like desktop); tapping a row opens that appointment.

**Desktop (>= `lg`) must stay byte-for-byte unchanged** (desktop keeps its hover grid-click → Day, no clickable header, existing expand panel). Every change is inside an `isMobile` branch. Everything else in the calendar (Month, Day, Agenda, toolbar, swipe) is out of scope.

## Files

| File | Change |
|---|---|
| `src/app/admin/master/calendar/WeekView.tsx` | header date button (mobile), remove mobile grid-click, mobile group → expand via new component. Currently 483 lines — MUST stay < 500 (the extraction below makes it shrink) |
| `src/app/admin/master/calendar/WeekMobileGroup.tsx` | NEW presentational component |
| `src/app/admin/AGENTS.md` | fix the Calendar-mobile bullet wording |

## Steps

### Step 1 — Header date tap (WeekView `renderDayHeaderCell`)

Currently the two `<span>`s (weekday label, date circle) are direct children of the header cell `div`. Keep them exactly as they are, but:

- Extract the two spans into a local `const label = (<>…the two spans…</>)`.
- Render `{isMobile ? <button type="button" onClick={() => onDayClick(day)} disabled={isEditMode} aria-label={format(day, "EEEE, d MMMM", { locale })} className="flex flex-col items-center touch-manipulation disabled:cursor-default">{label}</button> : label}`.
- On desktop the DOM must be identical to today (the fragment adds no wrapper). The `isEditMode` edit button below stays as is. Tapping the date in edit mode does nothing (`disabled`) — same as the old grid-click, which was disabled in edit mode.
- No day is excluded (past days and day-off days are tappable — the user may want to look at past appointments).

### Step 2 — Remove mobile grid navigation (`renderDayColumn`)

The overlay `{!isEditMode && !isPastDay && !status.isDayOff && (<div className="absolute inset-0 z-[1] cursor-pointer hover:bg-primary/5 ..." onClick={() => onDayClick(day)} />)}` → add `&& !isMobile` to its condition. Desktop unchanged.

### Step 3 — `WeekMobileGroup.tsx` (new) and use it

Client component, props:

```ts
{
  group: Appointment[]          // length >= 2
  top: number                   // px, same value the caller computed
  expanded: boolean
  onToggle: () => void
  onAppointmentClick: (a: Appointment) => void
}
```

Uses `useTranslation` and `useCurrentLanguage`/`resolveLocalized` only if needed (see below). `color = group[0].master?.masterProfile?.color || "#8B4A58"`.

- Wrapper: `absolute rounded-md` with `style={{ top: `${top}px`, left: "2px", width: "calc(100% - 4px)" }}`, `zIndex` via class: `z-30` when expanded else `z-10`. `onClick={(e) => { e.stopPropagation(); onToggle() }}`, `cursor-pointer`.
- Collapsed: exactly the current mobile chip (Users icon `w-3 h-3 shrink-0` + count `text-[10px] font-semibold`, `p-0.5 flex items-center gap-0.5 rounded-md backdrop-blur-sm text-foreground`, tint `color + "26"`, `borderLeft: 3px solid color`).
- Expanded: a panel `bg-card border border-border rounded-md shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200`; one row per appointment: `p-1 border-b last:border-b-0 border-border cursor-pointer`, `borderLeft: 3px solid <that appointment's master color || "#8B4A58">`, `onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}`. Row content, compact for a ~45px column: line 1 `text-[10px] font-semibold` = `a.startTime`; line 2 `text-[10px] leading-[1.15] break-words` = `a.client.name || t('admin.calendar.clientFallback')`. No service line, no icons (px math: column ≈ 45px @360px; text width ≈ 45 − 4 (inset) − 3 (border) − 8 (p-1) ≈ 30px → names wrap over 2–3 lines, same as the single-appointment blocks).
- Tapping the panel background (not a row) collapses (bubbles to wrapper `onToggle`); tapping outside is already handled by WeekView's existing document `mousedown` click-outside effect, which resets `expanded`.

In `WeekView.tsx` replace the whole `if (isMobile) { const groupColor … return (<div … onDayClick(day) …/>) }` block inside `renderDayColumn`'s `groups.map` with:

```tsx
if (isMobile) {
  return (
    <WeekMobileGroup
      key={`group-${groupIdx}`}
      group={group}
      top={top}
      expanded={isExpanded}
      onToggle={() => toggleExpand(dateStr, groupIdx)}
      onAppointmentClick={onAppointmentClick}
    />
  )
}
```

`isExpanded`, `top`, `toggleExpand`, `dateStr` already exist in that scope. Import `WeekMobileGroup`. After the swap, check for now-unused imports in `WeekView.tsx` (`Users` is still used by the desktop group chip — keep). Desktop group/expand markup untouched.

### Step 4 — DOX

`src/app/admin/AGENTS.md`, Calendar-mobile bullet: replace the wording "overlap chips jump to Day view" (or equivalent) with: mobile Week never navigates from the grid; the header date (weekday + number, a `<button>` on mobile only, disabled in edit mode) opens Day; an appointment block opens the appointment modal; an overlap group is `WeekMobileGroup.tsx` — a count chip that expands in place into a compact list (start time + name per row), each row opens the appointment. Add `WeekMobileGroup.tsx` to the file list. Keep it concise; remove any stale text.

## Verification (coder)

1. `npx tsc --noEmit` clean.
2. `npx eslint` on the touched files: only pre-existing errors allowed (repo-wide `npm run lint` is already red at baseline with `Definition for rule 'react-hooks/exhaustive-deps' was not found` and `_masterId` unused in `ModernCalendar.tsx` — do NOT try to fix those; just make sure you add no new ones).
3. `npm run test` passes.
4. `wc -l` on `WeekView.tsx` and `WeekMobileGroup.tsx` < 500.
5. `git diff --stat` shows only the 3 files above (plus pre-existing unrelated modifications: `.gitignore`, `MARKETING_PLAN.md`, and earlier calendar-mobile files).
6. Do NOT run `npm run dev` / `npm run build`; do NOT open a browser; do NOT use `git stash`.

## Status

- [x] Step 1 — header date button (mobile only, disabled in edit mode; fragment keeps desktop DOM identical)
- [x] Step 2 — mobile grid-click overlay removed (`&& !isMobile`)
- [x] Step 3 — `WeekMobileGroup.tsx` created and wired into `WeekView.tsx`
- [x] Step 4 — DOX: Calendar-mobile bullet reworded; `WeekMobileGroup.tsx` added to the calendar file list

### Verification results

1. `npx tsc --noEmit` — clean (no output).
2. `npx eslint` on WeekView.tsx + WeekMobileGroup.tsx — no output (no errors/warnings).
3. `npm run test` — 39 files, 382 tests passed.
4. `wc -l` — WeekView.tsx 498, WeekMobileGroup.tsx 52 (both < 500; WeekView is close to the limit).
5. `git diff --stat` — only `src/app/admin/AGENTS.md` and `WeekView.tsx` modified, plus new untracked `WeekMobileGroup.tsx`.
6. No dev/build, no browser, no git stash.
