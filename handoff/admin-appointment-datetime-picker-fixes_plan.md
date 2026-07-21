# Plan: Admin Appointment Date/Time Picker Fixes (Group 1 follow-up)

**Date:** 2026-07-21
**Status:** In Progress

## Goal
Fix three live-testing bugs found in the admin/master calendar appointment create/edit modal (`AppointmentModal.tsx`) after Group 1: (1) the new time-slot `Select` popup grows to full page height instead of a bounded, internally-scrolling list; (2) `DatePickerDropdown`'s calendar popup overflows/clips the modal because it is not portaled; (3) the date picker gives no indication of the selected master's day-offs — every day looks equally selectable.

## Scope note — verified before planning (two prompt assumptions corrected)
- **`DatePickerDropdown` has only TWO real consumers, not the ~5 the earlier plan listed.** A repo-wide grep (`DatePickerDropdown`) returns exactly: `src/app/admin/master/calendar/AppointmentModal.tsx` and `src/components/profile/EditAppointmentModal.tsx` (plus the definition). `BulkSettingsModal`/`WeekView`/`DayView` do **not** import it. Both real consumers must be re-verified for the portal rewrite (Bug 2), and only `AppointmentModal` gets the new day-off feature (Bug 3); `EditAppointmentModal` omits the new optional props and stays byte-for-byte identical in behavior.
- **`getAvailableDays()` cannot exclude a specific appointment.** Its signature is `getAvailableDays(fromISO, untilISO, minDuration, opts?: { debug?, masterId? })` (`src/lib/availability.ts:34`). Unlike `getDaySlots()` (which Group 1 gave an `excludeAppointmentId` param), `getAvailableDays()`'s per-day `hasWindow` uses `fetchBusyRanges(masterId, date)` with **no** exclusion (`availability.ts:83`). The prompt says not to change its signature — so the edit-mode "don't disable my own date" edge case is handled in the client wrapper, not in `getAvailableDays()` (see AD4).

---

## Root Causes

### Bug 1 — unbounded time-slot dropdown
`src/components/ui/select.tsx`'s shared `SelectContent` renders `SelectPrimitive.Popup` with `overflow-auto` but **no `max-h-*` constraint** (line 65). With many options (dozens of 15-min slots across a working day) the popup grows to fit every item, spilling past the viewport with no internal scroll. This is the SAME shared component used by the master/service/client Selects, so the cap must stay sane for both small (2–10 item) and large (this time list) usages.

### Bug 2 — date-picker calendar overflows/clips the modal
`src/components/DatePickerDropdown.tsx` renders its calendar as a plain `absolute top-12 left-0 z-50` div inside its own `<div className="relative">` wrapper — it is **not portaled**. Nested inside the modal's `overflow-visible` card, it paints on top of the later-in-flow notes textarea and Cancel/Save buttons, and when it extends below the viewport there is no way to scroll to reach it. The proven precedent in the same codebase is `src/components/TimePickerDropdown.tsx`, which `createPortal`s its popup to `document.body` with `position: fixed` coordinates computed from the trigger's `getBoundingClientRect()`.

### Bug 3 — date picker ignores the master's day-offs
`DatePickerDropdown` has zero availability awareness: every day button renders identically and is fully clickable (`DatePickerDropdown.tsx:55-68`), so an admin only discovers a day-off *after* picking the date and seeing "No available times" in the time field. Day-off data must come from `getAvailableDays()` (which already correctly combines `Schedule` + `DateOverride` + busy-range checks), reused via a new authed endpoint — not reimplemented client-side.

---

## Architecture Decisions

### AD1 — Bug 1 max-height value
Add **`max-h-80`** to the `SelectPrimitive.Popup` className in `select.tsx` (keep the existing `overflow-auto`; the pair gives internal scroll only when content exceeds the cap). `max-h-80` = 20rem = 320px. Items are `px-2 py-1.5 text-sm` (~32px each) inside the popup's `p-1` (4px) padding → ~9–10 slot rows visible before scrolling — "small and neat" per the user. It is safe for every other consumer: the master/service/client lists have far fewer items than fit under 320px, so they render fully and never trigger a scrollbar (identical look to today). No other class changes; do not touch scrollbar styling, the `z-[200]` values (a separate recently-applied stacking fix), or the Positioner.

### AD2 — Bug 2 portal + positioning (mirror `TimePickerDropdown`)
Rewrite only `DatePickerDropdown`'s popup rendering to match `TimePickerDropdown` exactly:
- `createPortal(<popup/>, document.body)` so it escapes the modal's `overflow-visible` card and the outer `overflow-y-auto` wrapper.
- Add `btnRef` on the trigger button; compute position in a **`useLayoutEffect` keyed on `[open]`** (not `useEffect` — prevents the unpositioned first-paint flash, per TimePicker's comment) from `btnRef.getBoundingClientRect()`. Use `position: fixed`, `zIndex: 9999` (above the modal's `z-[60]` and the Select's `z-[200]`, matching TimePicker's `9999`). Open below (`top: rect.bottom + 4`) when `window.innerHeight - rect.bottom - 8 >= ~340` (the calendar card's approx height: header + weekday row + up to 6 rows of `h-8` buttons + `p-3`), else open above (`bottom: window.innerHeight - rect.top + 4`).
- Keep the popup's fixed **`w-[280px]`** in `className` (the month grid needs a fixed width; do NOT match trigger width). Clamp `left` to `[8, window.innerWidth - 288]` so the 280px popup never runs off the right edge (a minimal, justified deviation from TimePicker, whose 140px popup was narrow enough not to need it).
- Split refs like TimePicker: keep the wrapper/trigger `ref` AND add a separate `dropdownRef` on the portaled popup; `handleClickOutside` closes only when the target is inside **neither**. Add `onMouseDown={(e) => e.stopPropagation()}` to the portaled popup (prevents ancestor "click outside" listeners — e.g. a parent popover — from seeing an in-popup click as outside and closing before the day's `onClick` fires).
- The month grid is small and fixed-size, so **no internal scroll / `max-h` on the popup body is needed** (TimePicker only caps its *long* time list; the calendar has at most 6 week rows). This mirrors TimePicker's decision appropriately for a fixed-size grid.

### AD3 — Bug 3 data source: two new authed "days" endpoints (parallel to Group 1's "slots")
Reuse `getAvailableDays()` via two thin authed wrappers, exactly mirroring Group 1's `/availability/slots` pair so the modal can call `${apiPrefix}/availability/days` uniformly:
- `GET /api/master/availability/days?from=YYYY-MM-DD&until=YYYY-MM-DD&duration=N` — auth `MASTER`; `masterId = session.user.id`.
- `GET /api/admin/calendar/availability/days?from=YYYY-MM-DD&until=YYYY-MM-DD&duration=N&masterId=<required>` — auth `ADMIN`/`SUPERADMIN`; `masterId` from query (400 if missing or `"all"`).
Both return `getAvailableDays(from, until, duration, { masterId })` → `{ days: [{ date, hasWindow }] }`, with `{ days: [] }` on catch.
**Why not reuse public `/api/availability`?** Same reasons Group 1 rejected `/api/day/[date]` for slots: it is unauthenticated (public booking) and derives `minDuration` from a `procedureId`, not an arbitrary custom duration. A dedicated authed route per role is the clean parallel.

### AD3b — Bug 3 shared-component prop shape + a client fetch wrapper
- `DatePickerDropdown` gains **two optional, backward-compatible props**:
  - `disabledDates?: Set<string>` — `YYYY-MM-DD` strings to render greyed + non-clickable (native `disabled`, muted styling, no `onChange`). When omitted → today's behavior exactly (every day pickable) → `EditAppointmentModal` unaffected.
  - `onVisibleMonthChange?: (fromISO: string, untilISO: string) => void` — fired in a `useEffect` on mount and whenever the internal `currentMonth` changes, passing `startOfMonth`/`endOfMonth` as `yyyy-MM-dd`. Lets a parent fetch day-off data for exactly the month being viewed (the grid only renders the current month's days). Omitted → no-op.
- New client component **`src/app/admin/master/calendar/AppointmentDateSelect.tsx`** (mirrors `AppointmentTimeSelect.tsx`; keeps `AppointmentModal.tsx` under 500 lines). It renders `DatePickerDropdown` internally, owns `disabledDates` state, receives `onVisibleMonthChange` from it, and fetches `${apiPrefix}/availability/days?from&until&duration[&masterId]` for the visible month, building `disabledDates = new Set(days.filter(d => !d.hasWindow).map(d => d.date))`. `duration` = the entry's current `durationMin` (same value the time-slot fetch uses — "does this master have ANY window long enough for this service that day"). Mirror Group 1's no-master gate: when `isAdminView && !masterId` → do not fetch, pass `disabledDates={undefined}` (all days enabled). For a MASTER's own calendar (`isAdminView=false`) always fetch, omitting the `masterId` query param so the endpoint uses `session.user.id`.

### AD4 — Bug 3 edit-mode edge case ("don't trap the admin on their own date")
`getAvailableDays()`'s `hasWindow` includes the appointment being edited in the busy set (no exclude-self), so a master's day that is full *because of this very appointment* would report `hasWindow=false` and wrongly grey out the appointment's own current date. **Decision:** in `AppointmentDateSelect`, when in edit mode, remove the original appointment's date from the computed set (`disabledDates.delete(originalDate)`) so the appointment's own date is never disabled — consistent with Group 1's exclude-self guarantee for the time slot. This does mean the rare case of an appointment sitting on a genuine schedule day-off would still show that date as selectable; that is the deliberate, safer trade, because cleanly distinguishing "genuine day-off" from "working-but-full" would require threading `excludeAppointmentId` into `getAvailableDays()`, which is explicitly out of scope this round. In practice you cannot normally book onto a day-off, so allowing the admin to keep/edit an appointment on its own date is the less surprising behavior than blocking the edit.

### AD5 — No auto-clearing of a now-invalid date on master change
`AppointmentDateSelect` only supplies `disabledDates` (visual + non-clickable); it does **not** clear an already-selected `ent.date` when a master switch makes that date a day-off. That case is already correctly gated by Group 1: the time field re-fetches for the new master, finds no slots, clears `startTime`, and `isValid()` blocks Save — while the greyed date in the picker guides the admin to re-pick. (Master reassignment during edit is Group 3, still pending, so this interaction is only reachable in create mode today.) Keeping date-clearing out avoids a surprising "my date vanished" while still preventing an invalid save.

---

## Implementation Steps

### Step 1 — Bug 1: cap the shared Select popup height
- [x] **1.1** Files: `src/components/ui/select.tsx`
  - In `SelectContent`, add `max-h-80` to the `SelectPrimitive.Popup` `className` string (line 65), keeping the existing `overflow-auto`. Change nothing else in this file. (Grep confirms the shared `SelectContent` is used by master/service/client Selects in `AppointmentModal.tsx`, `EditAppointmentModal.tsx`, and many admin forms — all have few enough items to render fully under 320px, so this is a pure improvement everywhere.)

### Step 2 — Bug 3 backend: two authed "days" endpoints
- [x] **2.1** Files: `src/app/api/master/availability/days/route.ts` (new)
  - `export const runtime = "nodejs"`. `GET`: `auth()`; require `session.user.id && session.user.role === "MASTER"` (401 otherwise). Read `from`, `until`, `duration`. Validate `from` AND `until` match `^\d{4}-\d{2}-\d{2}$` (400 otherwise). `duration = Math.max(5, Number(durationParam) || 0)`. Return `NextResponse.json(await getAvailableDays(from, until, duration, { masterId: session.user.id }))`; `catch` → `NextResponse.json({ days: [] })`. Model exactly on `src/app/api/master/availability/slots/route.ts`.
- [x] **2.2** Files: `src/app/api/admin/calendar/availability/days/route.ts` (new)
  - Same as 2.1 but auth `SUPERADMIN`/`ADMIN`, and `masterId` comes from the query (400 if missing or `"all"`). Call `getAvailableDays(from, until, duration, { masterId })`. Model exactly on `src/app/api/admin/calendar/availability/slots/route.ts`.

### Step 3 — Bug 2 + Bug 3: rewrite `DatePickerDropdown`
- [x] **3.1 (Bug 2 — portal)** Files: `src/components/DatePickerDropdown.tsx`
  - Add imports `useLayoutEffect` (from `react`) and `createPortal` (from `react-dom`). Add `btnRef` (on the trigger `<button>`), a `dropdownRef` (on the portaled popup), and a `dropdownStyle` state, mirroring `TimePickerDropdown`.
  - Compute `dropdownStyle` in a `useLayoutEffect` keyed on `[open]` from `btnRef.current.getBoundingClientRect()`: `position: 'fixed'`, `zIndex: 9999`, below/above flip using an estimated height of ~340px, and `left` clamped to `[8, window.innerWidth - 288]`. Keep the popup's `w-[280px]` in `className`.
  - Wrap the existing calendar popup markup in `createPortal(<div ref={dropdownRef} style={dropdownStyle} onMouseDown={(e) => e.stopPropagation()} className="... w-[280px]"> ... </div>, document.body)` and drop the old `absolute top-12 left-0 z-50` positioning classes.
  - Update `handleClickOutside` to close only when the target is inside **neither** the wrapper `ref` nor `dropdownRef` (mirror TimePicker's `insideTrigger`/`insideDropdown` check). Keep everything else (month state, nav chevrons, day rendering) as-is.
- [x] **3.2 (Bug 3 — disabled prop)** Files: `src/components/DatePickerDropdown.tsx`
  - Extend the props type to `{ date, onChange, disabledDates?: Set<string>, onVisibleMonthChange?: (fromISO: string, untilISO: string) => void }`.
  - In the day `.map()`, compute `isDisabled = disabledDates?.has(dateStr) ?? false`. When disabled, render the day `<button>` with native `disabled`, muted styling (e.g. `text-muted-foreground opacity-40 cursor-not-allowed`, no hover), and no effect from `onClick` (guard so it never calls `onChange`). Enabled days and the selected-day styling stay exactly as today.
  - Add a `useEffect` keyed on `[currentMonth]` that calls `onVisibleMonthChange?.(format(startOfMonth(currentMonth), 'yyyy-MM-dd'), format(endOfMonth(currentMonth), 'yyyy-MM-dd'))` — fires on mount and each month navigation. (`startOfMonth`/`endOfMonth`/`format` are already imported.)

### Step 4 — Bug 3 client wrapper: `AppointmentDateSelect`
- [x] **4.1** Files: `src/app/admin/master/calendar/AppointmentDateSelect.tsx` (new)
  - Client component. Props: `apiPrefix: string`, `isAdminView: boolean`, `masterId: string`, `durationMin: number`, `value: string`, `onChange: (date: string) => void`, `excludeOriginalDate?: string` (the appointment's own date in edit mode; omitted otherwise).
  - State: `disabledDates: Set<string> | undefined`, `visibleRange: { from: string; until: string } | null`. `noMaster = isAdminView && !masterId`.
  - Effect keyed on `[apiPrefix, isAdminView, masterId, durationMin, visibleRange]`: if `noMaster || !visibleRange || !durationMin` → `setDisabledDates(undefined)` and return. Else fetch `${apiPrefix}/availability/days?from=${from}&until=${until}&duration=${durationMin}${masterId ? `&masterId=${masterId}` : ""}`, build `new Set(days.filter(d => !d.hasWindow).map(d => d.date))`, then if `excludeOriginalDate` `set.delete(excludeOriginalDate)` (AD4), and `setDisabledDates(set)`. Guard with a `cancelled` flag like `AppointmentTimeSelect`. On error → `setDisabledDates(undefined)`.
  - Render `<DatePickerDropdown date={value} onChange={onChange} disabledDates={disabledDates} onVisibleMonthChange={(from, until) => setVisibleRange({ from, until })} />`.
  - No new i18n strings (the disabled state is purely visual). Keep the file focused, well under 500 lines.

### Step 5 — Wire into `AppointmentModal`
- [x] **5.1** Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Add `import AppointmentDateSelect from "./AppointmentDateSelect"`. Remove the now-unused `import { DatePickerDropdown } from "@/components/DatePickerDropdown"` (line 10) only if nothing else in the file still uses it (it does not — it is used solely for the per-entry date field).
  - Replace the per-entry `<DatePickerDropdown date={ent.date} onChange={(val) => updateEntry(ent.id, 'date', val)} />` (lines 349-352) with `<AppointmentDateSelect apiPrefix={apiPrefix} isAdminView={isAdminView} masterId={formMasterId} durationMin={ent.duration} value={ent.date} onChange={(val) => updateEntry(ent.id, 'date', val)} excludeOriginalDate={mode === "edit" ? originalDate : undefined} />`. (`originalDate` already exists at line 153.)
  - No other changes: `isValid()`, the time field, save/error handling stay as Group 1 left them.

### Step 6 — DOX pass
- [x] **6.1** Files: `src/app/admin/AGENTS.md`, `src/app/api/AGENTS.md`
  - In `src/app/admin/AGENTS.md`, extend the existing `AppointmentTimeSelect` Work-Guidance bullet to also mention `AppointmentDateSelect.tsx` (fetches `${apiPrefix}/availability/days`, greys out the selected master's day-off dates via `DatePickerDropdown`'s optional `disabledDates`/`onVisibleMonthChange` props; edit mode never disables the appointment's own date).
  - In `src/app/api/AGENTS.md`, note the `availability/days` authed endpoints alongside `availability/slots` (thin wrappers over `getAvailableDays()`/`getDaySlots()`; this also closes the Group 1 reviewer's deferred DOX note for the slots routes).
  - Keep edits concise; refresh Child DOX Index entries only if a new durable boundary was created (none is — these are additive files in existing folders).

---

## Verification (automated)
```
npx tsc --noEmit
npm run lint
npm run i18n:check        # no new keys expected; run to confirm nothing broke
npx vitest run
npm run build
```
`tests/lib/availability.test.ts` must stay green (no `availability.ts` change this round). No new i18n keys are added — Bug 1/2 add none; Bug 3's disabled state is purely visual.

## Manual verification (user — test live in the browser)
Do these as an ADMIN unless noted. No automated/e2e run needed.

**Bug 1 — time dropdown is small and scrolls**
1. Open the admin calendar, click an empty slot to start a new booking, pick a master and a normal working date.
2. Open "Час початку" (Start Time). The list should now be a **compact box (~9-10 rows tall)** that **scrolls internally** if there are more times — it must NOT run off the bottom of the screen.
3. Open the Master, Service, and Client dropdowns too — they should look exactly as before (short lists, no scrollbar, nothing shrunk or cut off).

**Bug 2 — date calendar no longer clips the modal**
4. In the same modal, open "Дата" (Date). The month calendar should float cleanly **on top of everything**, fully visible — it must NOT overlap the "Примітки" (Notes) box or the Cancel/Save buttons, and it must NOT get cut off below the screen.
5. Click the ‹ / › arrows to change months, then click a day — the calendar stays open while switching months and closes when you pick a day. Clicking outside it closes it.
6. Scroll the modal down until the Date field is near the bottom, then open the calendar — it should open **upward** so it stays on screen.

**Bug 3 — day-offs are visible in the date picker**
7. Pick a master who has at least one day off. Open the Date calendar: that master's **day-off days appear greyed out and cannot be clicked**; working days look normal and are clickable.
8. Change the selected master to someone with a different schedule — reopen the calendar; the greyed days should update to the new master's day-offs.
9. Before choosing any master (admin view), open the Date calendar — **all days remain selectable** (nothing to check against yet).

**Edit mode must NOT regress (the trickiest Group 1 interaction)**
10. Open an existing appointment → Edit. Its current Date and Start Time are pre-filled and valid; you can Save immediately with no changes.
11. In edit, open the Date calendar — the appointment's **own current date is NOT greyed out** even on a busy day; other day-offs still show greyed.
12. Move the appointment to a different working day and time, Save — it moves correctly, and the old slot frees up.

**Master's own calendar (log in as a MASTER)**
13. Repeat steps 2, 4, 7, 10-12 on your own calendar (no master dropdown). Time list is compact/scrolling, the date calendar floats correctly, your own day-offs are greyed, and editing your own appointment keeps its date/time valid.

## Acceptance Criteria
- [x] `npx tsc --noEmit`, `npm run i18n:check`, `npx vitest run`, and `npm run build` all pass. `npm run lint` fails, but only on ~40 pre-existing errors in unrelated files (untouched by this plan, already present on disk before this session, e.g. `src/lib/availability.ts`'s unused `t2m` import from the earlier Group 1 work, `src/components/layout/Header.tsx`, `tailwind.config.ts`, etc.) — all files touched by this plan (`select.tsx`, `DatePickerDropdown.tsx`, the two new `availability/days` routes, `AppointmentDateSelect.tsx`, `AppointmentModal.tsx`) are individually lint-clean (verified with `npx eslint <file>`).
- [x] Bug 1: the shared `Select` popup is capped at `max-h-80` with internal scroll; other Selects look unchanged.
- [x] Bug 2: `DatePickerDropdown` is portaled to `document.body`, positioned like `TimePickerDropdown`, and never clips/overlaps modal content in either consumer.
- [x] Bug 3: the modal's date picker greys out (non-clickable) the selected master's day-off dates via `getAvailableDays()`-backed data; no master selected → all days enabled; edit mode never disables the appointment's own date.
- [x] `EditAppointmentModal` (the other `DatePickerDropdown` consumer) behaves identically to before.
- [x] Files stay under 500 lines; no library imported that isn't already in `package.json`.
- [x] DOX pass done (`src/app/admin/AGENTS.md`, `src/app/api/AGENTS.md`).

## Constraints & Risks
- **Do NOT touch Groups 2-5** of `handoff/admin-appointment-scheduling-fixes_plan.md` (server-side double-booking guard, master reassignment, delete confirmation dialog, notification-settings copy) — still pending and unrelated.
- **Do NOT build** the "add appointment from Week/Month toolbar" feature — the user deferred it.
- **Do NOT change** `getDaySlots()`/`getAvailableDays()` logic or signatures — `getAvailableDays()` is used as-is (new consumer only); the edit-mode edge case is handled client-side (AD4).
- **Do NOT modify** `TimePickerDropdown.tsx` — only read/mirror its portal pattern; it is still used by other calendar components.
- **`DatePickerDropdown` and `select.tsx` are SHARED** — both new `DatePickerDropdown` props are optional (other consumers unaffected), and the `max-h-80` cap only takes visible effect when a list would otherwise overflow (which only this new time list does today). Re-verify `EditAppointmentModal` after the `DatePickerDropdown` rewrite.
- **Timezone:** unchanged from Group 1 — `getAvailableDays()` returns plain `YYYY-MM-DD` day keys (Warsaw-local), matched directly against `format(d, "yyyy-MM-dd")` in the calendar grid; no timezone re-conversion.
- **No schema/migration changes.**
- **Positioning caveat (mirrors TimePicker):** the portaled calendar is positioned once on open from the trigger's viewport rect; if the user scrolls the modal while it is open it won't reposition — acceptable, matching the existing `TimePickerDropdown` behavior, and it closes on outside click/selection.
