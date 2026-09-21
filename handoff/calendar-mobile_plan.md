# Plan: calendar mobile redesign (Google-Calendar style)

Mode: LIGHT (orchestrator-authored). UI-only, no DB/schema/API changes.
Owner contract: `src/app/admin/AGENTS.md` (Calendar mobile bullet, line ~32) — must be updated in the last step.

## Goal

On mobile (< `lg`, 1024px — the `isMobile` prop from `useIsMobile()`), the admin/master calendar should use the whole screen like Google Calendar:

1. No card frame / page padding around the calendar (full-bleed).
2. Week view shows all 7 days at once (no horizontal scroll).
3. One compact toolbar row; a burger on the right opens a right-side settings sheet holding the view switcher (Month / Week / Day / **Agenda**), master picker (admin), minutes step, Edit Schedule, Bulk Schedule Edit.
4. New **Agenda** view: list of appointments grouped by date (like Google's "Schedule" view), for the current month.
5. Swipe left/right to go to the next/previous period.

**Desktop (>= `lg`) must be byte-for-byte unchanged in behaviour and look.** Every change is either inside an `isMobile` branch or behind `lg:` Tailwind overrides restoring the old value. (Memory: a previous fix once leaked to desktop — gate everything.)

Non-goals (do NOT do): FAB "+" button, Month-view event chips, merging with `AdminTopBar`, any desktop toolbar change, editing DayView internals, any API/DB change.

## Files touched

| File | Change | Lines now → est. |
|---|---|---|
| `src/app/admin/calendar/page.tsx` | wrapper classes: full-bleed on mobile | 52 |
| `src/app/admin/master/schedule/page.tsx` | same wrapper change | 27 |
| `src/app/admin/master/calendar/ModernCalendar.tsx` | `Agenda` view type, `effectiveView`, mobile headers, swipe hook, render AgendaView | 329 → ~370 |
| `src/app/admin/master/calendar/CalendarToolbar.tsx` | rewrite mobile branch only | 218 → ~250 |
| `src/app/admin/master/calendar/WeekView.tsx` | mobile branch → 7-col grid, delete horizontal-scroll sync code | 495 → ~440 (MUST end < 500) |
| `src/app/admin/master/calendar/AgendaView.tsx` | NEW | ~130 |
| `src/app/admin/master/calendar/useSwipeNavigation.ts` | NEW | ~35 |
| `src/locales/{pl,en,uk}.json` | new `admin.calendar.*` keys | +4 keys each |
| `src/app/admin/AGENTS.md` | update Calendar-mobile bullet | — |

## Steps

### Step 1 — Full-bleed wrapper (both pages)

The admin layout's inner container is `px-4 lg:px-6 py-4 lg:py-8` (`src/app/admin/layout.tsx`, **do not edit**) under an `AdminTopBar` of `h-16` (4rem).

In BOTH `admin/calendar/page.tsx` (the final `return`, NOT the loading spinner) and `admin/master/schedule/page.tsx`, change the outer wrapper

`flex h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden bg-card border border-border rounded-[20px] shadow-sm`

to

`flex -mx-4 -my-4 h-[calc(100dvh-4rem)] overflow-hidden bg-card lg:mx-0 lg:my-0 lg:h-[calc(100vh-8rem)] lg:min-h-[600px] lg:border lg:border-border lg:rounded-[20px] lg:shadow-sm`

Px math to keep: `-mx-4/-my-4` exactly cancels the layout's mobile `px-4 py-4`; `100dvh - 4rem` = viewport minus the 64px top bar, so the calendar fills the visible area and the main container has nothing to scroll (dvh so the iOS Safari URL bar does not clip the bottom). At `lg:` every original value is restored (`mx-0 my-0`, `100vh-8rem`, `min-h-[600px]`, border, radius, shadow). Inner `<div className="flex-1 overflow-hidden ...">` stays as is. Leave the loading-spinner branch of `calendar/page.tsx` untouched.

Verify: `grep -n "100vh-8rem" src/app/admin/calendar/page.tsx src/app/admin/master/schedule/page.tsx` still matches only via the `lg:` variant in the main return.

### Step 2 — `useSwipeNavigation.ts` (new)

`src/app/admin/master/calendar/useSwipeNavigation.ts`:

```ts
useSwipeNavigation({ enabled, onPrev, onNext }) -> { onTouchStart, onTouchEnd }
```

- `onTouchStart`: store `{x, y}` of `e.touches[0]` in a ref (single-finger only; ignore if `e.touches.length !== 1`).
- `onTouchEnd`: `dx = e.changedTouches[0].clientX - startX`, `dy` likewise. If `enabled` and `Math.abs(dx) >= 60` and `Math.abs(dx) > Math.abs(dy) * 1.5` → `dx < 0 ? onNext() : onPrev()`. Always clear the ref.
- Return stable handlers; when `!enabled` both are no-ops.
- Types: use `React.TouchEvent`.

### Step 3 — `ModernCalendar.tsx`

1. `export type ViewType = "Month" | "Week" | "Day" | "Agenda"`.
2. Restore-from-localStorage: `savedView` is cast to `ViewType` already; keep. Add `const effectiveView: ViewType = view === "Agenda" && !isMobile ? "Week" : view` (Agenda is mobile-only; a stored "Agenda" opened on desktop falls back to Week). Do NOT overwrite the stored `view` state with the fallback.
3. Add `const rangeView = effectiveView === "Agenda" ? "Month" : effectiveView` — Agenda fetches and navigates exactly like Month. Use `rangeView` in `dateRange` (both the branches and the dependency array), `navigate`, and `headerDisplay`. Use `effectiveView` for the render switch and for what is passed to `CalendarToolbar` as `view`.
4. `headerDisplay`: keep every desktop output identical. Add mobile-only shorter formats (`isMobile` in deps): Week → `${format(start,"d MMM",{locale})} – ${format(end,"d MMM",{locale})}`; Day → `format(currentDate,"EEE, d MMM",{locale})`; Month unchanged (`MMMM yyyy`).
5. Render: add `{effectiveView === "Agenda" && <AgendaView ... />}` alongside the three existing blocks (change the existing `view ===` conditions to `effectiveView ===`). Props to AgendaView: `currentDate`, `appointments`, `isAdminView`, `selectedMasterId`, `onAppointmentClick={(a) => setViewingAppointment(a)}`.
6. Swipe: `const swipe = useSwipeNavigation({ enabled: isMobile && !isEditMode, onPrev: () => navigate("prev"), onNext: () => navigate("next") })`; spread `onTouchStart`/`onTouchEnd` on the existing `<div className="flex-1 overflow-hidden relative">` content wrapper only (NOT on the modals or the root). Add `touch-pan-y` to that wrapper's className only when `isMobile`.
7. Pass `view={effectiveView}` and the existing props to `CalendarToolbar` unchanged otherwise. `setView` stays the raw setter.
8. The 15-second polling / fetch effects are untouched (they already depend on `dateRange`).

### Step 4 — `AgendaView.tsx` (new)

Props: `{ currentDate: Date; appointments: Appointment[]; isAdminView?: boolean; selectedMasterId?: string; onAppointmentClick: (a: Appointment) => void }`.

- Only appointments whose `a.date.slice(0,10)` falls in `currentDate`'s calendar month (the fetch range includes leading/trailing week days — filter them out: compare `yyyy-MM` prefix with `format(currentDate,"yyyy-MM")`).
- Sort by date then `startTime`; group by date string. Days with no appointments are not rendered (like Google).
- Layout per group (a row): left column `w-14 shrink-0`: weekday `format(day,"EEE",{locale})` in `text-[11px] uppercase text-muted-foreground` (primary colour if today) + day number `text-lg font-medium` in an `h-8 w-8` rounded circle (`bg-primary text-primary-foreground` if today). Right column `flex-1 min-w-0`: one card per appointment.
- Card (a `<button type="button">`, full width, `text-left`, `rounded-md p-2 mb-2`): background `color + "26"`, `borderLeft: 3px solid color`, `text-foreground` — per the AGENTS.md convention, where `color = a.master?.masterProfile?.color || "#8B4A58"`. Content: line 1 `font-semibold` `${a.startTime} – ${a.endTime}`; line 2 `truncate` client name (`a.client.name || t('admin.calendar.clientFallback')`); line 3 `text-xs opacity-80 truncate` service name via `resolveLocalized({ pl: a.service.name_pl, en: a.service.name_en, uk: a.service.name_uk }, language)`; line 4 only when `isAdminView && selectedMasterId === "all" && a.master?.name`: `text-xs opacity-80 truncate` master name. Click → `onAppointmentClick(a)`.
- Container: `h-full overflow-y-auto custom-scrollbar bg-background px-3 py-2 animate-in fade-in duration-200`. Empty state (no appointments in month): centered `text-sm text-muted-foreground` `t('admin.calendar.agendaEmpty')`.
- Scroll-to-today: after render, if the month contains a group with date >= today, set the scroll container's `scrollTop` to that group's `offsetTop` minus the container's `offsetTop` (ref map keyed by date; effect keyed on `format(currentDate,"yyyy-MM")` and `groups.length`). If none, leave at top. Do not use `scrollIntoView` (it can scroll ancestors).
- Use `useTranslation`, `useCurrentLanguage`, `dateFnsLocale` as WeekView does. Client component (`"use client"`).

### Step 5 — `CalendarToolbar.tsx` mobile branch (rewrite; desktop branch untouched)

Prop type: `view: ViewType` already flows through; the desktop view-toggle arrays stay `["Month","Week","Day"]` — do NOT add Agenda to the desktop toggle.

Mobile branch becomes a single compact row + a right Sheet:

- Outer: `border-b border-border/60 px-3 py-1 min-h-[3rem] shrink-0 z-10 shadow-sm` (drop the old segmented switcher row).
- Row: `flex items-center gap-1`:
  - `Button variant="ghost" size="icon"` prev / next (32px each; existing `icon` size = `size-8`).
  - Label block `flex-1 min-w-0 px-1`: `<h2 className="text-sm font-semibold truncate">{headerDisplay}</h2>`; when `isAdminView`, a second line `text-[11px] text-muted-foreground truncate` showing the selected master name (`adminMastersList?.find(m => m.id === selectedMasterId)?.name`) or `t('admin.calendar.allMasters')` when `selectedMasterId === "all"`.
  - Loading spinner: keep the existing spinning dot but `absolute` (`absolute top-1 right-1`, with the row `relative`) so it never takes layout width.
  - `Button variant="outline" size="sm"` Today with `className="h-8 px-2 text-xs shrink-0 ..."` (existing look).
  - Burger: `Button variant="ghost" size="icon"` with lucide `Menu` icon, `aria-label={t('admin.calendar.mobileControlsAria')}`, opens the sheet.
- Px check at 360px width: 24px padding + 3×32 icon buttons + ~71px Today (uk «Сьогодні» at 12px + padding) + 3×4px gaps ≈ 203px fixed → label ≥ ~133px ("28 Sep – 4 Oct" at 14px semibold ≈ 105px) — fits; keep `truncate` as the safety net.
- Sheet: `<Sheet open={showMobileControls} onOpenChange={setShowMobileControls}>` with `SheetContent side="right"` (`w-3/4 sm:max-w-sm` comes from the primitive) and `overflow-y-auto`. Header title `t('admin.calendar.mobileControlsTitle')`. Body `px-4 pb-4 flex flex-col gap-4`, in order:
  1. Section label `t('admin.calendar.viewLabel')` + a 2×2 grid of four buttons (Month / Week / Day / Agenda), active one `bg-primary text-primary-foreground`, others outline. Click → `setView(v); setShowMobileControls(false)`.
  2. (existing, admin only) `MasterSelectDropdown` block — unchanged.
  3. (existing) minutes step `Select` — `disabled={view === "Month" || view === "Agenda"}`.
  4. (existing) Edit Schedule button — add `|| view === "Agenda"` to the `disabled` condition.
  5. (existing) Bulk Schedule Edit button — unchanged.
- Remove now-unused imports (`SlidersHorizontal`); add `Menu`. `SheetContent` currently `side="bottom" className="max-h-[80vh] overflow-y-auto"` — replace, do not keep both.
- Agenda label text: `t('admin.calendar.agendaView')`.

### Step 6 — `WeekView.tsx` mobile branch → 7-column grid

Only the `isMobile` branch and the mobile-only conditionals inside the shared render helpers change. The desktop `return` (after `if (isMobile) {...}`) stays untouched.

1. Delete: `MOBILE_DAY_COL_WIDTH`, `headerScrollRef`, `bodyScrollRef`, `handleHeaderScroll`, `handleBodyScroll`, the `weekKey` scroll-reset effect (and now-unused imports — check `useEffect`, `isToday` are still used elsewhere; `isToday` is, `useEffect` is (click-outside)).
2. Rewrite the `if (isMobile) {...}` block to mirror the desktop structure but narrower: header row `flex border-b border-border shrink-0 bg-card` with gutter `w-11 shrink-0 border-r border-border` + `flex-1 grid grid-cols-7` (no `pr-2`); body scroller `flex-1 overflow-y-auto relative custom-scrollbar bg-background` with the inner `flex` of height `containerHeight + 40`, hours gutter `w-11 shrink-0 ...` with labels `text-[10px] px-1` (`HH:00`), and the grid `absolute left-0 right-0 grid grid-cols-7` at `top: 20px`, calling `timeLines()` + `days.map((day,i) => renderDayColumn(day,i))` (no `widthClass` arg any more — drop the parameter from `renderDayHeaderCell`/`renderDayColumn` if it becomes unused). Keep `{renderEditPopoverPortal()}`.
3. `renderDayHeaderCell` mobile tweaks (`isMobile` conditional classes): weekday label `text-[10px] tracking-normal` (desktop keeps `text-[11px] ... tracking-wider`); date circle `h-7 w-7 text-base` (desktop keeps `h-8 w-8 text-lg`); container `px-0` (desktop `px-1`); the edit-mode button gets `truncate px-0.5 text-[9px]` on mobile (desktop keeps `px-2 text-[10px]`).
4. `renderDayColumn` mobile tweaks:
   - Single appointment block: on mobile render only the client name, wrapping (`break-words leading-[1.15] text-[10px] font-semibold`), `p-0.5`, `left: 2px`, `width: calc(100% - 4px)`, no service line, no clock line; `overflow-hidden`; keep the tint/left-border style and `onClick`. Desktop markup unchanged.
   - Overlap group block: on mobile render a compact chip (Users icon `w-3 h-3` + count `text-[10px] font-semibold`) and a click that calls `onDayClick(day)` (go to Day view where overlaps are readable) instead of `toggleExpand` — so no expanded list is ever rendered in a ~45px column on mobile. Desktop path (expand/collapse) unchanged.
   - The rotated "Day Off" label: keep as is.
5. Px math (must hold at 360–430px viewports): gutter 44px → column width = (W−44)/7 ≈ 45px @360, 47 @375, 50 @393, 55 @430. Appointment text box ≈ col − 4 (left/right inset) − 3 (border) − 2 (padding) ≈ 36px @360 → ~6 chars per line at 10px, wraps like the Google screenshot ("Надеж/да"). Header: "MON"-style label ≈ 22px at 10px, circle 28px — both < 45px.
6. File must end **< 500 lines** (currently 495). If it ends above ~480, extract `renderDayColumn`'s appointment-block JSX into a small co-located presentational component instead of leaving it long — only if needed.

### Step 7 — i18n (pl / en / uk)

Add under `admin.calendar` in all three `src/locales/{pl,en,uk}.json` (insert right after `dayView`; keep JSON valid, same key order in all three):

- `agendaView`: en "Agenda" / pl "Agenda" / uk "Розклад"
- `agendaEmpty`: en "No appointments this month" / pl "Brak wizyt w tym miesiącu" / uk "Цього місяця записів немає"
- `viewLabel`: en "View" / pl "Widok" / uk "Вигляд"

(`mobileControlsAria`/`mobileControlsTitle` already exist — reuse; `allMasters` already exists.) Run `npm run i18n:check`.

### Step 8 — DOX update

Update `src/app/admin/AGENTS.md`, the **Calendar mobile** bullet (line ~32), to describe the new state: full-bleed wrapper (`-mx-4 -my-4 h-[calc(100dvh-4rem)]` below `lg`, original card frame restored at `lg:` in both `admin/calendar/page.tsx` and `admin/master/schedule/page.tsx`); mobile toolbar = one compact row + right-side `Sheet` (view switcher incl. Agenda, master picker, step, Edit Schedule, Bulk) — the old always-visible segmented switcher and bottom sheet are gone; `Agenda` is a mobile-only `ViewType` (`AgendaView.tsx`, month-scoped, fetches/navigates as Month via `rangeView`; `effectiveView` falls back to Week on desktop so a stored "Agenda" is harmless); `useSwipeNavigation.ts` (disabled in edit mode); `WeekView` mobile now a 7-column fit-to-width grid (`w-11` gutter, name-only wrapping blocks, overlap chips jump to Day view) — replacing the 110px horizontal-scroll + `scrollLeft` mirror description. Also add `AgendaView.tsx`/`useSwipeNavigation.ts` to that bullet's file list. Remove stale text about the removed scroll-sync. Keep it concise.

## Verification (coder runs; user checks live afterwards)

1. `npx tsc --noEmit` clean.
2. `npm run lint` clean (zero warnings).
3. `npm run test` passes (do not add new tests; none cover these views).
4. `npm run i18n:check` clean.
5. `wc -l` on every touched/created `.tsx`/`.ts` < 500.
6. `git diff --stat` shows only the files listed above (+ AGENTS.md, this plan).
7. **Do NOT run `npm run dev` or `npm run build`** (they can corrupt the user's live `.next/`), and do NOT open a browser.

## Manual checklist for the user (orchestrator will give this at the end, in Russian)

Mobile (телефон, `demo.ordiset.com`; restart the dev server first): calendar edge-to-edge, week shows 7 days, burger on the right opens the settings sheet, Agenda list, swipe, tapping an appointment opens the same modal as before. Desktop: identical to before.

## Status

- [x] Step 1 — full-bleed wrapper (calendar/page.tsx, master/schedule/page.tsx)
- [x] Step 2 — useSwipeNavigation.ts
- [x] Step 3 — ModernCalendar.tsx (Agenda, effectiveView, rangeView, mobile headers, swipe)
- [x] Step 4 — AgendaView.tsx
- [x] Step 5 — CalendarToolbar.tsx mobile branch (right Sheet, Menu icon)
- [x] Step 6 — WeekView.tsx mobile 7-col grid (ends at 483 lines, < 500, no extraction needed)
- [x] Step 7 — i18n keys agendaView/agendaEmpty/viewLabel in pl/en/uk
- [x] Step 8 — src/app/admin/AGENTS.md Calendar-mobile bullet

### Verification results
- `npx tsc --noEmit`: clean.
- `npm run lint`: 79 problems (74 errors, 5 warnings) both BEFORE (git stash) and AFTER my changes, all pre-existing repo-wide (e.g. turnstile.ts, tailwind.config.ts, missing react-hooks plugin rule). `eslint` on the touched dirs shows only pre-existing errors (DayView unused var, `_masterId`, exhaustive-deps rule definition); none in new/changed lines.
- `npm run test`: 39 files, 382 tests passed.
- `npm run i18n:check`: PASS.
- `wc -l`: ModernCalendar 357, CalendarToolbar 229, WeekView 483, AgendaView 100, useSwipeNavigation 26, calendar/page 52, schedule/page 27.
- `git status`: only listed files (+ AGENTS.md, plan) changed.
