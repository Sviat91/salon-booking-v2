# Plan: Master calendar — bulk-editor master indicators, page-title cleanup, toolbar tablet wrap

**Date:** 2026-08-05
**Status:** In Progress

## Goal

Three user-reported UI fixes in the shared admin/master calendar: (A) `BulkSettingsModal` calendar indicators must reflect the masters actually checked in "Apply to masters" (multi-colored dots for 2+), (B) `/admin/master/schedule` must stop rendering its own `<h1>`/`<p>` above the calendar (the topbar already supplies the title), (C) the desktop `CalendarToolbar` must stop ragged-wrapping at ~1024–1300px by moving the Month/Week/Day toggle from row 2 to row 1.

---

## Architecture Decisions

### A. Where the per-master schedule data comes from

- `BulkSettingsModal` already self-fetches its own month overrides — that stays the mechanism, but it is **split by view**:
  - `isAdminView === false` (master editing own schedule): unchanged path — `fetchMonthOverrides` (no `masterId` param, session-scoped route) + the `templates` prop.
  - `isAdminView === true`: a **new hook** `useMasterSchedules` fetches `overrides` + `template` for **every** id in `targetMasterIds` in parallel, keyed by master id. The `templates` prop and the outer `selectedMasterId` no longer drive indicators at all in admin view (`selectedMasterId` keeps its one remaining job: seeding the initial checkbox selection).
- The hook is a **separate file** (`useMasterSchedules.ts`), not inlined, for two reasons: `BulkSettingsModal.tsx` is already 422/500 lines, and the fetch has non-obvious correctness requirements (stale-response guard, stable effect key from a `Set`-derived array) that deserve isolation.
- No API changes. Both endpoints already accept `?masterId=` and are already called with exactly these shapes by `ModernCalendar.fetchData()`.

### B. Type widening (`{id,name}` → carries color)

- One exported type in `ModernCalendar.tsx`: `AdminMasterListItem = { id: string; name: string; masterProfile?: { color?: string | null } | null }`.
- **Nested** (`masterProfile.color`), not flattened to `color`, deliberately: it is the literal shape `GET /api/admin/calendar/masters` already returns, so `admin/calendar/page.tsx` needs a `useState` type change and **zero mapping code**; it also matches the `a.master?.masterProfile?.color` convention already used by Month/Week/DayView.
- `CalendarToolbar` / `MasterSelectDropdown` only read `.name`; widening is source-compatible for them (type-only import, no runtime cycle — `CalendarToolbar` already does `import type { ViewType } from "./ModernCalendar"`).

### C. Pure logic extracted for testability

- The override-beats-template resolution is lifted into `calendar-utils.ts` as `resolveDayScheduleState(...) → "working" | "dayoff" | null`. It reproduces today's three-helper behaviour **exactly** (verified case by case, see step A2), so the single-master path stays pixel-identical while the multi-master path reuses the same rule per master.
- This is the only piece of this work that is unit-testable (no component tests exist anywhere in `tests/`), so it gets one small no-mock test file.

### ⚠️ Judgment calls to sanity-check before coder runs

1. **Dot shape encodes state, not color:** working = `rounded-full` circle, day off = `rounded-[1px]` square, both 6px, both filled with the master's own colour. Rationale: at 6px an outline/ring is not legible and opacity-dimming reads as "loading"; shape survives any admin-picked hex including pale ones. A native `title` tooltip on the day cell spells out `"<Name>: Working"` / `"<Name>: Day Off"` per master (reuses existing keys `admin.calendar.workingBtn` / `admin.calendar.dayOffBtn` — **no new i18n keys anywhere in this plan**).
2. **In multi-master mode the red day-off cell background is dropped** (dots only). A whole-cell red wash cannot answer "whose day off?" and would contradict the dots. Single-master mode keeps it verbatim.
3. **Single checked master keeps the green `--md-success` dot, not that master's colour** — per the explicit requirement "no behaviour change for the 0/1 case". Consequence: checking a 2nd master flips dot colours from green to per-master colours. Intentional; flagged because it is a visible inconsistency.
4. **Dot cap = 4, then a `+` glyph.** Cell is ~49px wide (modal left pane ≈ 368px inner / 7 cols, `gap-1`); 4 × 6px + 3 × 2px gap = 30px, plus `+` ≈ 36px — fits inside ~45px usable. Full list still available via the `title` tooltip. No wrapping to a 2nd dot row (would collide with the date number in a 40px-tall cell).
5. **(C) The view toggle goes into row 1's *right* cluster, i.e. `[Today ‹ › Header ⟳] … [Month|Week|Day] [All Masters ▾]`** — not into the left nav group. Rationale: keeps the master dropdown anchored far-right exactly where it is today, leaves the left group's diff at zero, and matches the Google-Calendar convention of view controls on the right. Toggle + dropdown are wrapped in one `flex items-center gap-4 shrink-0` div so that **if** row 1 itself has to wrap they move down together as a unit instead of splitting.
6. **Row 1 wrap is accepted, not designed away.** Worst realistic case (Day view + admin + Polish, e.g. `wtorek, 4 sierpnia 2026`) measures ≈ 990px of content inside a 1024px viewport minus `px-4` — it fits, but with almost nothing to spare, so a longer header string will wrap row 1. That wrap is clean (two coherent groups) and is strictly better than today's row-2 ragged 3rd line. Do **not** add a third breakpoint/conditional to chase it; do **not** shrink the existing `min-w-[8ch]` / `min-w-[24ch]` / `min-w-[29ch]` anti-jitter spans.
7. **`pluralize` de-duplication** (step A5) is scope-adjacent but mandated by `src/app/admin/AGENTS.md` L29 ("import from `calendar-utils.ts`, don't re-declare") and we are already adding an import from that module. The two implementations are byte-identical.

---

## Implementation Steps

### Sub-task A — BulkSettingsModal: per-master schedule indicators

- [x] **Step A1: Widen the admin master-list type end-to-end (4 files + 1 page).**
  - Files: `src/app/admin/master/calendar/ModernCalendar.tsx`, `CalendarToolbar.tsx`, `MasterSelectDropdown.tsx`, `BulkSettingsModal.tsx`, `src/app/admin/calendar/page.tsx`
  - Details:
    - `ModernCalendar.tsx`: after the existing `export type Override = ...` (≈L35) add
      `export type AdminMasterListItem = { id: string; name: string; masterProfile?: { color?: string | null } | null }`.
      Replace the inline prop type `adminMastersList?: {id:string, name:string}[]` (≈L57) with `adminMastersList?: AdminMasterListItem[]`. Nothing else in this file changes — it only forwards the prop (≈L214 toolbar, ≈L288 modal).
    - `CalendarToolbar.tsx`: change L9 to `import type { ViewType, AdminMasterListItem } from "./ModernCalendar"`; prop `adminMastersList?: AdminMasterListItem[]` (L27).
    - `MasterSelectDropdown.tsx`: add `import type { AdminMasterListItem } from "./ModernCalendar"`; prop `adminMastersList: AdminMasterListItem[]` (L10). Body untouched (reads `.name` only).
    - `BulkSettingsModal.tsx`: same import; prop `adminMastersList?: AdminMasterListItem[]` (L24).
    - `src/app/admin/calendar/page.tsx`: `import ModernCalendar, { type AdminMasterListItem } from "@/app/admin/master/calendar/ModernCalendar"`; `useState<AdminMasterListItem[]>([])` (L7). **No mapping** — `/api/admin/calendar/masters` already returns `{ id, name, masterProfile: { color, avatarUrl } }`; the extra `avatarUrl` is structurally compatible and simply unused.
  - Do not touch `src/app/admin/master/schedule/page.tsx` here — the master's own view passes no master list.

- [x] **Step A2: Add the pure day-state resolver to `calendar-utils.ts`.**
  - Files: `src/app/admin/master/calendar/calendar-utils.ts`
  - Details: append (keep the file's existing plain-function, no-default-export style):
    ```ts
    export type DayScheduleState = "working" | "dayoff" | null

    export function resolveDayScheduleState(
      dateStr: string,                                        // "yyyy-MM-dd"
      dayOfWeek: number,                                      // date-fns getDay(): 0=Sun
      overrides: { date: string; isDayOff: boolean }[],
      templates: { dayOfWeek: number; isDayOff: boolean }[]
    ): DayScheduleState
    ```
    Logic, in this precedence order: an override matching `dateStr` wins → `isDayOff ? "dayoff" : "working"`; else a template matching `dayOfWeek` → `isDayOff ? "dayoff" : "working"`; else `null`.
  - This is behaviour-preserving against today's `isCalendarDayOff` + `hasScheduleSet` + `hasWorkingTemplate` trio: override-working → dot; override-dayoff → red bg, no dot; template-working → dot; template-dayoff → red bg, no dot; neither → nothing. Keep the parameter types structural (as written above) so `Override`/`Template` from `ModernCalendar` satisfy them without importing them.

- [x] **Step A3: New hook `useMasterSchedules.ts` (admin view only).**
  - Files: `src/app/admin/master/calendar/useMasterSchedules.ts` (new, target ≤ 90 lines)
  - Details:
    - No `"use client"` directive (matches `src/hooks/useIsMobile.ts`); it is only ever imported by a client component.
    - `import type { Override, Template } from "./ModernCalendar"` (already exported there).
    - Public API:
      ```ts
      export type MasterSchedule = { overrides: Override[]; templates: Template[] }

      export function useMasterSchedules(opts: {
        masterIds: string[]
        month: Date
        apiPrefix: string
        enabled: boolean
      }): { schedules: Record<string, MasterSchedule>; refetch: () => void }
      ```
    - Internals:
      - `const idsKey = [...masterIds].sort().join(",")` computed inline every render, and `const monthKey = format(startOfMonth(month), "yyyy-MM")`. **The effect depends on `idsKey`/`monthKey` (strings), never on the `masterIds` array or the `month` Date object** — the caller derives `masterIds` from a `Set` (new array identity every render), so depending on the array would refetch forever. Silence the lint rule the same way `ModernCalendar.tsx` already does: `// eslint-disable-next-line react-hooks/exhaustive-deps` with a one-line comment saying why.
      - `refetch()` = `setReloadKey(k => k + 1)`; `reloadKey` is in the effect deps.
      - Effect body: if `!enabled || idsKey === ""` → `setSchedules({})` and return.
      - Window: `from = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")`, `to = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")` — identical to the window `fetchMonthOverrides` uses today (dots must render for leading/trailing days of the 6-week grid).
      - `Promise.all(ids.map(async id => …))`; inside each mapper `Promise.all([fetch(\`${apiPrefix}/schedule/overrides?from=${from}&to=${to}&masterId=${id}\`), fetch(\`${apiPrefix}/schedule/template?masterId=${id}\`)])`, then `.json()` both.
      - Parse exactly as the existing code does: overrides → `{ ...o, date: typeof o.date === 'string' ? o.date.substring(0, 10) : format(new Date(o.date), 'yyyy-MM-dd'), intervals: JSON.parse(o.intervals) }`; templates → `{ ...t, intervals: JSON.parse(t.intervals) }`.
      - Wrap each mapper body in `try/catch` returning `{ overrides: [], templates: [] }` for that id, so one failing/malformed master never blanks the whole grid.
      - Stale-response guard: `let cancelled = false` in the effect, `return () => { cancelled = true }`, and only `setSchedules(next)` when `!cancelled`. Build `next` as a fresh `Record<string, MasterSchedule>` and replace state wholesale (never merge — unchecking a master must drop its data).
      - No loading flag is exposed: the modal renders "no mark" for a master with no data yet, which is also the correct steady state for a master with nothing scheduled. Do not add a spinner.

- [x] **Step A4: Rewire `BulkSettingsModal` indicators to `targetMasterIds`.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details:
    1. Update the file's top doc comment (≈L27–31) — it currently claims the modal fetches its own overrides for "the displayed month" full stop; it must now describe both paths (session-scoped self-fetch for a master's own view, per-checked-master fetch via `useMasterSchedules` in admin view).
    2. `fetchMonthOverrides` becomes **non-admin only**: first line `if (isAdminView) { setMonthOverrides([]); return }`. Delete the `selectedMasterId === "all"` early return and the `const q = …&masterId=…` suffix (the `/api/master/schedule/overrides` route derives the master from the session). Deps → `[apiPrefix, isAdminView]`. Leave the `useEffect` that calls it as-is.
    3. Keep `initialMasters` / `targetMasterIds` / `toggleMaster` / `allSelected` / `toggleAllMasters` exactly as they are — `selectedMasterId` is still read there and that is now its only use.
    4. Call the hook right after the `targetMasterIds` state:
       `const { schedules, refetch: refetchSchedules } = useMasterSchedules({ masterIds: Array.from(targetMasterIds), month: currentMonth, apiPrefix, enabled: isAdminView })`
    5. `const targetMasters = adminMastersList.filter(m => targetMasterIds.has(m.id))` — filtering the prop list (rather than mapping the `Set`) gives a **stable, name-ascending dot order** across days and re-renders.
    6. Delete `isCalendarDayOff`, `hasScheduleSet`, `hasWorkingTemplate` and replace them with one mark builder:
       ```ts
       type DayMark = { id: string; name: string; color: string | null; state: "working" | "dayoff" }

       const dayMarks = (d: Date): DayMark[] => { … }
       ```
       - `dateStr = format(d, "yyyy-MM-dd")`, `dow = getDay(d)`.
       - `isAdminView` → for each `m` of `targetMasters`, `resolveDayScheduleState(dateStr, dow, schedules[m.id]?.overrides ?? [], schedules[m.id]?.templates ?? [])`; keep only non-`null` results as `{ id: m.id, name: m.name, color: m.masterProfile?.color || "#166534", state }`.
       - `!isAdminView` → `resolveDayScheduleState(dateStr, dow, monthOverrides, templates)`; return `[]` when `null`, else `[{ id: "self", name: "", color: null, state }]`.
       - Fallback hex is `"#166534"` (the `MasterProfile.color` DB default, `prisma/schema.prisma` L58, same literal as `MasterForm.tsx` L261 / `MastersClient.tsx` L113). Note: the calendar *views* use `#8B4A58` for appointment blocks — that is a different concern (event tint, not master identity); do not use it here.
    7. In `renderCalendar()`'s day loop replace `isDayOffDay` / `hasOverride` / `hasTemplate` / `hasSchedule` with:
       ```ts
       const marks = dayMarks(d)
       const singleMark = marks.length <= 1 ? marks[0] : undefined   // undefined when 0 or 2+
       ```
       - Cell `className`: swap `isDayOffDay` for `singleMark?.state === 'dayoff'` in the existing red-container line — **string unchanged otherwise**: `text-[var(--md-on-error-container)] bg-[var(--md-error-container)] hover:brightness-95`.
       - Existing single green dot: condition becomes `!isDisabled && singleMark?.state === 'working'`, markup/classes unchanged (`absolute bottom-0.5 w-1.5 h-1.5 rounded-full`, `bg-primary-foreground` when selected else `bg-[var(--md-success)]`). It deliberately ignores `singleMark.color`.
       - New multi block, rendered only when `!isDisabled && marks.length >= 2`:
         ```jsx
         <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center gap-[2px] px-0.5">
           {marks.slice(0, 4).map(m => (
             <span
               key={m.id}
               className={`h-1.5 w-1.5 shrink-0 ${m.state === 'dayoff' ? 'rounded-[1px]' : 'rounded-full'} ${isSelected ? 'ring-1 ring-primary-foreground/70' : ''}`}
               style={{ backgroundColor: m.color ?? undefined }}
             />
           ))}
           {marks.length > 4 && <span className="text-[8px] leading-none font-bold text-muted-foreground">+</span>}
         </div>
         ```
       - Add to the day `<button>`: `title={marks.length >= 2 ? marks.map(m => `${m.name}: ${m.state === 'dayoff' ? t('admin.calendar.dayOffBtn') : t('admin.calendar.workingBtn')}`).join(', ') : undefined}`.
       - Everything else in the cell (disabled/past/today/selected classes, the date-number `<span>`, `toggleDate`, the 42-day padding) is untouched.
    8. `handleSave`: after `await onSave(...)` and `setSelectedDates(new Set())`, call **both** `await fetchMonthOverrides(currentMonth)` and `refetchSchedules()` — each self-gates on `isAdminView`, so no branching is needed at the call site.
  - Explicitly out of scope in this file: the "Apply to masters" checkbox list markup, the Action-Overview panel, the intervals editor, `onSave`'s signature, and every non-admin code path's visual output.

- [x] **Step A5: Remove the duplicated local `pluralize` from `BulkSettingsModal.tsx`.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details: delete the module-level `function pluralize(...)` (≈L32–36) and import it from `./calendar-utils` alongside `resolveDayScheduleState` — the implementation there is identical. Required by `src/app/admin/AGENTS.md` L29. The single call site (≈L282, shift count) is unchanged.

- [x] **Step A6: Line-budget check for `BulkSettingsModal.tsx`.** (441 lines, under 470 — no extraction needed)
  - Details: baseline is 422 lines; the steps above are ≈ +25 net. If the file lands **above 470 lines**, extract only the day `<button>` (the whole `days.map` callback body) into a new co-located `BulkDayCell.tsx` taking explicit props (`date`, `isSelected`, `isDisabled`, `isToday`, `marks`, `onToggle`) — do not restructure anything else to save lines, and do not extract if the file is under 470.

### Sub-task B — remove the redundant page title on `/admin/master/schedule`

- [x] **Step B1: Confirm the topbar already titles this route (read-only, no edit expected).** (confirmed via adminNavItems.ts — no edit made)
  - Files: `src/components/admin/adminNavItems.ts`, `src/components/admin/AdminTopBar.tsx`
  - Details: `getPageTitleKey("/admin/master/schedule", "MASTER")` → `getNavItemsForRole("MASTER")` → `masterNavItems` → first `isNavItemActive` hit is `{ labelKey: "admin.nav.schedule", href: "/admin/master/schedule" }` (L128–132; the preceding `/admin/master` entry is `exact: true` so it does not swallow the path). `AdminTopBar.tsx` L16/L33 renders it. **Already correct — add no mapping, change neither file.** If the coder's own re-read contradicts this, stop and report instead of inventing a mapping.

- [x] **Step B2: Strip the local heading and match `admin/calendar/page.tsx`'s container.**
  - Files: `src/app/admin/master/schedule/page.tsx`
  - Details: replace the returned JSX (L16–32) with the two-div structure used by `src/app/admin/calendar/page.tsx` L35–49, so the card owns the full height directly:
    ```jsx
    <div className="flex h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden bg-card border border-border rounded-[20px] shadow-sm">
      <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
        <ModernCalendar … />
      </div>
    </div>
    ```
    Keep the `<ModernCalendar>` props (`masterId`, `availableSlotColor`, `dayOffColor`, `workingHourStart`, `workingHourEnd`) and their `(config as any)` casts **byte-for-byte** — the hex-literal rule in `src/app/admin/AGENTS.md` L39 applies. Drop the outer `flex flex-col gap-6` wrapper, the `<h1>`/`<p>` block, and the inner card's old classes (`flex-1 bg-card border rounded-[20px] shadow-sm … min-h-[500px]`) in favour of the parity classes above.
  - Then remove the resulting orphans in the same file: `const t = getServerT()` (L8) and `import { getServerT } from "@/lib/i18n-server"` (L5) — grep confirms `t(` is used nowhere else in this file. Leave `auth`, `getTenantConfig`, `redirect` and the MASTER role guard untouched (`src/app/admin/AGENTS.md` L13).

- [x] **Step B3: Leave the locale files alone.**
  - Details: `admin.calendar.scheduleAndCalendarTitle` / `scheduleAndCalendarDesc` (`src/locales/{pl,en,uk}.json` L171–172) have no other consumer after B2, but **do not delete them** — three-file locale edits for two unused strings is not worth the merge risk, and the title copy may be wanted back in the topbar later. Do not add new keys either.

### Sub-task C — CalendarToolbar tablet-width wrapping

- [x] **Step C1: Move the Month/Week/Day toggle from row 2 into row 1's right cluster.**
  - Files: `src/app/admin/master/calendar/CalendarToolbar.tsx` (desktop branch only, L142–217)
  - Details: row 1 (L144) keeps `flex flex-wrap items-center justify-between gap-y-3 gap-x-4` and keeps its left nav group (L145–154) **unchanged**. Replace row 1's second child (the bare `{isAdminView && … <MasterSelectDropdown/>}`, L156–162) with a wrapper holding the toggle first, then the dropdown:
    ```jsx
    <div className="flex items-center gap-4 shrink-0">
      {/* view-toggle block moved verbatim from row 2 (old L198–214) */}
      {isAdminView && adminMastersList && onMasterChange && (
        <MasterSelectDropdown … />
      )}
    </div>
    ```
    The toggle block moves **verbatim** — same `flex rounded-full border border-border bg-transparent p-0.5 gap-0.5` container, same per-pill classes, same `min-w-[8ch]` inner span, same `setView` handler, same `["Month","Week","Day"]` map. No class edits, no size changes, no new conditionals. The wrapper is always rendered (in the master's own view it contains just the toggle, which then sits at the row's right edge).

- [x] **Step C2: Drop the now-dangling divider in row 2.**
  - Files: same file
  - Details: remove the second `<div className="h-6 w-px bg-border" />` (old L196, the one that separated Bulk Settings from the toggle). **Keep** the first divider (old L177, between the minutes Select and the Edit button). Row 2 keeps `flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-3` and now holds exactly: minutes Select · divider · Edit-mode button · Bulk Settings button (≈ 640px of content — comfortable at every ≥1024px width).

- [x] **Step C3: Leave the mobile branch untouched.**
  - Details: `if (isMobile)` (L52–140) already has its own always-visible full-width segmented toggle plus the bottom-`Sheet` controls. Change nothing there, and do not touch `src/hooks/useIsMobile.ts` or add a new breakpoint hook/media query.

### Cross-cutting

- [x] **Step D: Tests — one no-mock unit test for the new pure helper.**
  - Files: `tests/app/admin/master/calendar/calendar-utils.test.ts` (new)
  - Details: `describe('resolveDayScheduleState')` with exactly these cases: (1) matching override, `isDayOff: false` → `"working"`; (2) matching override, `isDayOff: true` → `"dayoff"`; (3) override present **and** a contradicting template for the same weekday → the override wins (both directions, 2 assertions); (4) no override, working template → `"working"`; (5) no override, day-off template → `"dayoff"`; (6) neither → `null`; (7) an override for a *different* date is ignored. Import via `@/app/admin/master/calendar/calendar-utils` — no `vi.mock` of anything (the module is Prisma-free and pure; its only `ModernCalendar` import is `import type`, erased at transform time). Do not attempt to test the hook or any component — no component-test harness exists in this repo.
  - Verify with `npx vitest run tests/app/admin/master/calendar/calendar-utils.test.ts`, then the full `npm run test` (baseline is green: keep it green, add no skips).

- [x] **Step E: DOX pass.**
  - Files: `src/app/admin/AGENTS.md`, `tests/AGENTS.md`
  - Details:
    - `src/app/admin/AGENTS.md` L29 (calendar conventions bullet): add `useMasterSchedules.ts` to the enumerated list of files this folder holds, and state the new contract — *`BulkSettingsModal`'s day indicators are keyed off the in-modal `targetMasterIds` checkboxes (not the toolbar's `selectedMasterId`): 0/1 target keeps the green-dot + red-cell single-master rendering, 2+ targets render one per-master colour dot per day (circle = working, square = day off, cap 4 + `+`, names in the cell `title`) and drop the red cell wash; `resolveDayScheduleState()` in `calendar-utils.ts` is the single override-beats-template rule shared by both paths.*
    - `src/app/admin/AGENTS.md` L32 ("Calendar mobile" bullet) says *"desktop keeps its two-row toolbar verbatim"* — now stale about row composition. Amend to note that desktop row 1 = date nav + view toggle + master dropdown, row 2 = step select + Edit + Bulk (still two rows; the toggle moved up in 2026-08 to stop row 2 ragged-wrapping at ~1024–1300px).
    - `tests/AGENTS.md` Local Contracts: one dated bullet recording the first `tests/app/admin/**` mirror test and that it needs no mocks by design.
    - Nothing else changes ownership/structure: no new route, no schema change, no nav change, so `src/app/api/AGENTS.md`, `prisma/AGENTS.md` and the root `CLAUDE.md` Child DOX Index stay as-is (report this explicitly at closeout).

---

## Acceptance Criteria

- [ ] `npm run lint` passes with **zero** warnings (project runs ESLint at zero tolerance; watch the `react-hooks/exhaustive-deps` disable comment in the new hook and any now-unused import).
- [ ] `npm run test` passes, including the new `calendar-utils.test.ts`; no pre-existing test starts failing and nothing is skipped.
- [ ] Follows project conventions: no new dependency (`date-fns`, `react-i18next`, `lucide-react`, `sonner` are all already in `package.json`); Tailwind utilities only, no new UI library; existing `--md-*` CSS-var colour language kept; hex literals stay literal (never `var(...)`) per `src/app/admin/AGENTS.md` L39.
- [ ] Every touched file stays under 500 lines. Report before/after counts for `BulkSettingsModal.tsx` (baseline 422), `CalendarToolbar.tsx` (218), `ModernCalendar.tsx` (328), `MasterSelectDropdown.tsx` (118), `calendar-utils.ts` (46), and the new `useMasterSchedules.ts`.
- [ ] **A:** opening Bulk Schedule Edit from `/admin/calendar` in "All Masters" mode and checking 2+ masters shows per-master coloured dots on days those masters work / have days off — where **today it shows nothing at all**. Checking exactly 1 master shows the old green-dot/red-cell rendering. Unchecking all shows no marks. Dot data refreshes when the modal's month is paged and after "Apply Settings".
- [ ] **A:** the master's-own path (`/admin/master/schedule` → Bulk Schedule Edit, `isAdminView === false`) renders **identically to before** — no dot/colour/background change, still no "Apply to masters" section.
- [ ] **B:** `/admin/master/schedule` renders no `<h1>`/`<p>` above the calendar card; the topbar still reads the localized "Schedule" title; the card occupies the same height box as `/admin/calendar`'s.
- [ ] **C:** desktop toolbar row 2 holds exactly 4 items (select · divider · Edit · Bulk) and row 1 holds nav + view toggle + master dropdown; the mobile branch diff is empty.
- [ ] No API route file is added, renamed, or has its response shape changed.

## Constraints & Risks

**Must not be touched**
- `CalendarToolbar.tsx`'s `if (isMobile)` branch (L52–140) and `src/hooks/useIsMobile.ts`.
- `BulkSettingsModal`'s non-admin (`isAdminView === false`) rendering output, its `onSave` signature, and `ModernCalendar.saveBulkOverrides`.
- Any file under `src/app/api/**`, `prisma/**`, or `src/locales/**`.
- `MonthView.tsx` / `WeekView.tsx` / `DayView.tsx` (read them for the colour-language precedent only) and `AppointmentModal`/`ViewAppointmentModal`.
- The `(config as any)` casts and hex-literal props in `admin/master/schedule/page.tsx`.

**Do not run**
- `npm run dev` or any long-running server, and **not** `npm run build` — the user keeps a dev server running and a concurrent build corrupts `.next/`. Verification is `npm run lint` + `npm run test` only.
- No browser/visual tool for sub-task C (or any of this) — the user verifies visually from screenshots.

**Risks**
1. **Refetch loop (highest risk).** `masterIds` arrives as `Array.from(Set)` — a fresh array identity on every render. If the hook's effect depends on that array (or on the `month` `Date`), it will fetch → setState → re-render → fetch forever, hammering two requests per master. The `idsKey`/`monthKey` string deps in step A3 are the mitigation and must not be "cleaned up" into array deps by a later lint fix.
2. **Request fan-out.** 2 requests × N checked masters per month page. With "Apply to All Masters" on a large salon that is a burst (e.g. 10 masters → 20 requests). Accepted: it only happens inside an explicitly-opened modal, both endpoints are single indexed Prisma queries, and it mirrors what `ModernCalendar` already does per master. Do **not** add caching/debouncing in this change.
3. **Stale overwrite.** Rapid checkbox toggling can land an older response after a newer one; the `cancelled` cleanup flag handles it. Also required: replace the `schedules` record wholesale so an unchecked master's dots actually disappear.
4. **Type widening ripple.** `AdminMasterListItem` is consumed by four components; a missed site is a `tsc` error the coder cannot see without a build. Mitigation: after editing, grep `adminMastersList` and `{id: string, name: string}` / `{id:string, name:string}` across `src/` and confirm no narrow literal survives, and that no file's `.masterProfile` access is unguarded (it is optional).
5. **Row-1 crowding (C).** Accepted, see judgment call #6 — worst case is a clean two-line row 1, not the current ragged row 2.
6. **Modal cell contrast.** A master colour close to `--md-primary` on a *selected* (primary-background) day cell could vanish; the `ring-1 ring-primary-foreground/70` on selected-cell dots is the mitigation. If the user dislikes the ring, the fallback is to render dots at `bottom-0.5` over a `bg-primary-foreground/20` pill — do **not** implement that pre-emptively.
7. **Unrelated pre-existing issue (mention only, do not fix):** `BulkSettingsModal`'s "Target Masters" overview row shows `targetMasterIds.size === adminMastersList.length` as "All Masters" — when `adminMastersList` is empty *and* the size is 0 the `> 0` guard already covers it, so there is no bug; noted so the reviewer doesn't chase it.

## Manual verification for the user (RU, short)

1. `/admin/calendar` → выбрать «Все мастера» → «Массовое редактирование графика» → отметить 2–3 мастеров: в календаре модалки должны появиться цветные точки (кружок = рабочий день, квадратик = выходной), цвет = цвет мастера. Наведение на день — подсказка с именами.
2. Там же снять все галочки → точки исчезают; отметить ровно одного → снова старый вид (зелёная точка / красный фон).
3. Полистать месяцы вперёд/назад в модалке — точки должны перерисовываться под каждый месяц; после «Применить настройки» — обновляться сразу.
4. `/admin/master/schedule` (вход мастером) → заголовок «Grafik» только в верхней панели, над календарём его нет; календарь по высоте как на `/admin/calendar`. Массовое редактирование там же — вид как раньше, без цветных точек.
5. Ширина окна: проверить `1024`, `1100`, `1200`, `1280`, `1440` px на обоих экранах — переключатель «Месяц/Неделя/День» должен стоять в первой строке справа, перед выпадающим списком мастеров; вторая строка (шаг · Редактировать · Массовое) не должна ломаться на третью строку. В режиме «День» (самый длинный заголовок даты) на 1024px допустим аккуратный перенос первой строки в две — рваной третьей строки быть не должно.
6. Мобильный вид (< 1024px) — без изменений.

---

# Round 2 — day marks must always be the master's own colour

**Date:** 2026-08-05
**Status:** In Progress
**Classification:** Critical/Architectural correction to round 1's shipped behaviour (round 1 above is the record of what shipped and was reviewed APPROVED — do not re-do or revert it; only the pieces named below change).
**Scope:** `src/app/admin/master/calendar/BulkSettingsModal.tsx` only (+ one DOX sentence). `calendar-utils.ts`, `useMasterSchedules.ts`, `ModernCalendar.tsx`, `CalendarToolbar.tsx`, sub-tasks B and C: **no change**.

## Round 2 goal

In admin view, every checked master's day mark must render in that master's own `masterProfile.color` for **any** selection size (including exactly one), day-off days must be encoded per master in that colour instead of a generic red cell wash, and the "Apply to specialists" checklist must show each master's colour next to their name.

## What round 1 got wrong (verified against the current 441-line file)

Round 1's cell rendering branches on **mark count**, not on **view path**. Current lines:

| Line(s) | Current code | Which path it actually affects |
| --- | --- | --- |
| L173–174 | `const marks = dayMarks(d)` / `const singleMark = marks.length <= 1 ? marks[0] : undefined` | both |
| L182 | `title={marks.length >= 2 ? … }` | admin only in practice (self path never has 2 marks) |
| L185 | `!isDisabled && singleMark?.state === 'dayoff' && !isSelected ? "text-[var(--md-on-error-container)] bg-[var(--md-error-container)] hover:brightness-95"` | **both** ← bug 2 |
| L192–195 | `singleMark?.state === 'working'` → dot `bg-[var(--md-success)]` (or `bg-primary-foreground` when selected) | **both** ← bug 1 |
| L197–209 | per-master colour dots, `marks.length >= 2`, circle=working / `rounded-[1px]` square=day off, cap 4 + `+` | admin only |

Consequences the user hit:
- One master checked → `marks.length === 1` → `singleMark` is set → `marks[0].color` is **discarded** and the hardcoded `--md-success` green renders. Anna (violet `masterProfile.color`) therefore drew green dots, and Marek's green dots were green by coincidence, not by lookup.
- One master checked + day off → flat `--md-error-container` red cell, no colour, no dot, no name → nothing identifies the master.
- 2+ masters checked + day off → a 6px `rounded-[1px]` square. Round 1 judgment call #1 bet on shape-at-6px carrying the "day off" meaning; the user reports it does not read that way. Treat shape-alone-at-6px as **insufficient** from here on.

Data plumbing is already correct — do not "fix" it: `GET /api/admin/calendar/masters` (`src/app/api/admin/calendar/masters/route.ts` L16–22) selects `masterProfile: { color, avatarUrl }`; `src/app/admin/calendar/page.tsx` L7 stores it as `AdminMasterListItem[]` with zero mapping; `dayMarks()` (L123–139) already resolves `m.masterProfile?.color || "#166534"` per master. **`dayMarks` needs no change at all** — only the JSX that consumes it. `resolveDayScheduleState()` (`calendar-utils.ts` L48–61) also fits as-is: no new helper, no new parameter, no new test surface there.

## Round 2 architecture decisions

### R2-A. Branch on path, never on count

`isAdminView` is the only legitimate discriminator. The self path (`isAdminView === false`) can produce at most one mark and keeps its green dot / red wash **verbatim**; the admin path renders per-master marks for `marks.length >= 1`. Derive three values instead of `singleMark`:

```ts
const selfMark = isAdminView ? undefined : marks[0]
const workingMarks = isAdminView ? marks.filter(m => m.state === 'working') : []
const offMarks = isAdminView ? marks.filter(m => m.state === 'dayoff') : []
```

This makes the two rendering systems mutually exclusive **by construction** (each list is empty on the other path), so no cell can ever mix a generic green dot with a per-master dot. The partition is a two-`filter` one-liner — deliberately **not** extracted into a helper or a test: there is no branching logic worth a unit test, and no component-test harness exists in this repo (round 1, step D).

### R2-B. Visual scheme: dot = working, **split strike bar** = day off (Variant B, with Variant A's split applied to the bar)

Decision, for both 1 and N checked masters:

- **Working master** → unchanged from round 1: a 6px filled circle in the master's colour, in the existing dot row at `absolute bottom-0.5`, cap 4 + `+` glyph. Only *working* masters occupy this row now, so the cap is hit less often than in round 1.
- **Day-off master** → a **single 3px-tall horizontal bar across the vertical centre of the cell** (`absolute left-1 right-1 top-1/2 -translate-y-1/2`), painted *over* the date number so the day literally reads as crossed out. The bar is a `flex` container split into one `flex-1` segment per off master, each segment filled with that master's colour: 1 off master = a solid bar in their colour (exactly the user's Variant B); N off masters = the bar divided equally between their colours (exactly the user's Variant A "split the colouring between them", applied to the stripe instead of the cell).

Why this and not the cell-fill (Variant A verbatim):

1. **Hue can no longer encode state.** Master colours are admin-picked and include green and red. A day-off cell washed in Marek's green would read as "available/working" to any viewer — the exact inverse of the truth. Once colour means *identity*, state must be carried by **form**: dot vs strike. A fill has no form.
2. **A multi-colour fill fights the cell's own states.** The cell already uses `bg-primary` (selected) and `ring-2 ring-primary bg-primary/10` (today). A per-master gradient can only be applied as an inline `style`, which beats every Tailwind background class regardless of order, so selected/today cells would silently lose their background. The bar is a **child element** — its inline `backgroundColor` touches nothing on the cell. **Rule for this round: no inline `style` on the day `<button>` itself, ever.**
3. **Text contrast.** A saturated fill (or 2–3 stacked fills) behind a 14px digit can make the date unreadable for dark admin-picked hexes; a 3px bar never changes the cell's contrast, it just strikes it.
4. **`MonthView.tsx` L158's `dayOffColor + '40'` cell tint is not a precedent here** — that works precisely because `dayOffColor` is one tenant-wide red used for every master. It cannot be generalised to N identity hues.
5. **One split bar, not N stacked bars.** Stacked stripes (the literal "many stripes" reading) don't scale: at 40px cell height with a centred digit there is room for ~2–3 before the digit is buried, and there's no graceful cap. Elastic `flex-1` segments scale to any N (≈37px inner width ÷ N), never grow the cell, never eat more of the digit, and need no cap or `+` overflow glyph.
6. **Day-off masters get no dot.** The bar carries them; adding a dot too would double-encode and crowd the 4-dot row. The dot row therefore has one exact meaning: "who works this day".

Coexistence is inherent: working masters live at `bottom-0.5`, off masters live at the centre line. Two masters, one working + one off on the same date → one coloured dot **and** a bar in the other's colour, both fully visible.

### R2-C. Checklist swatch = the same filled dot, not a ring

Each "Apply to specialists" row gets a 10px filled circle in `m.masterProfile?.color || "#166534"` before the `<User>` icon. Same colour **source** as `/admin/masters`' avatar ring (`MastersClient.tsx` L110–114, `boxShadow: 0 0 0 3px ${master.masterProfile?.color ?? "#166534"}`), but presented as a filled dot rather than a ring so it is *shape-identical to the calendar's working dot* — the admin reads "violet dot = Anna" in the list and recognises the same violet dot on Anna's working days. A `ring-1 ring-border` keeps very pale colours from disappearing on the card background.

### R2-D. Tooltip covers the 1-master case too

`title` becomes `isAdminView && !isDisabled && marks.length > 0`, still built from the existing `admin.calendar.workingBtn` / `admin.calendar.dayOffBtn` keys (verified present in all three locales: `pl/en/uk.json` L177 + L183). **Zero new i18n keys in round 2**, same as round 1. Gating on `!isDisabled` is a micro-fix of a round-1 leftover: today a greyed-out past/other-month cell still gets a tooltip describing schedule state it doesn't render.

## ⚠️ Round 2 judgment calls to sanity-check (review these before the coder runs)

1. **The scheme itself (R2-B): filled dot = working, split 3px strike bar = day off.** Picked over the cell-fill variant for the five reasons above; the hue-can't-encode-state argument (#1) is the load-bearing one. If you'd rather have the fill, this is the one decision to overturne**before** coding — everything else in round 2 is mechanical.
2. **The bar is drawn over the date digit on purpose.** 3px over a ~14px digit is standard strikethrough legibility, and "crossed out" is the whole point. If the user finds the digit hard to read, the pre-agreed fallback is to move the bar to a second row just above the dots (`absolute bottom-2.5 left-1 right-1`) — visually weaker ("underline" instead of "crossed out"), so **do not implement pre-emptively**.
3. **No legend is added under the calendar.** It would need new copy (or an awkward reuse of button labels) and crowds an already dense modal; the per-day `title` tooltip already names every master and state. If the user still can't read the marks after this round, the escalation is a one-line legend using only `admin.calendar.workingBtn`/`dayOffBtn` + the two glyphs — again, not now.
4. **No segment cap and no `min-width` on bar segments.** 10 off masters → ~3.7px bands; 20 → a 1.8px smear. Accepted (a smear still says "everyone is off", and the tooltip lists names) in exchange for zero overflow logic.
5. **`ring-1 ring-primary-foreground/70` is reused on the bar** when the cell is selected, exactly as round 1 does for dots, for the master-colour-vs-`bg-primary` contrast case.
6. **Round 1's `rounded-[1px]` square disappears entirely.** No caller, doc, or test may keep referring to it (see step R4/R7).
7. **The self path is not touched.** L185's `--md-error-container` wash and L192–195's `--md-success` dot stay in the code, reachable only when `isAdminView === false`. Do not "unify" them; the master's own view has no master-selection concept.
8. **No `BulkDayCell.tsx` extraction** — projected final size ≈ 458 lines (441 + ~17), under round 1's own 470 trigger. Step R5 keeps the conditional escape hatch if the coder's actual count lands higher.

## Round 2 implementation steps

- [x] **Step R1: Colour swatch in the "Apply to specialists" checklist.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details: inside the `adminMastersList.map(m => …)` row (currently L338–347), replace the label's name span (L346)
    ```tsx
    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{m.name}</span>
    ```
    with
    ```tsx
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: m.masterProfile?.color || "#166534" }} />
      <User className="w-3.5 h-3.5" />{m.name}
    </span>
    ```
    Nothing else in the label changes: same `<input type="checkbox">`, same `checked={targetMasterIds.has(m.id)}` / `onChange={() => toggleMaster(m.id)}`, same wrapper classes, same "Apply to all" row above it. `User` is already imported (L7); `AdminMasterListItem` already carries `masterProfile.color` (round 1, step A1) — no new import, no new prop, no plumbing.
  - Same fallback literal `"#166534"` as `dayMarks` (L132) and `MastersClient.tsx` L113. Do not introduce a shared constant for it in this round (three call sites in two files, all already literal — a new export is more churn than value).

- [x] **Step R2: Replace the count-based cell rendering with path-based rendering.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`, inside `renderCalendar()`'s `days.map` (currently L166–212)
  - Details, in order:
    1. Replace L173–174:
       ```ts
       const marks = dayMarks(d)
       const singleMark = marks.length <= 1 ? marks[0] : undefined   // undefined when 0 or 2+
       ```
       with
       ```ts
       const marks = dayMarks(d)
       const selfMark = isAdminView ? undefined : marks[0]            // self path: 0 or 1 mark, never more
       const workingMarks = isAdminView ? marks.filter(m => m.state === 'working') : []
       const offMarks = isAdminView ? marks.filter(m => m.state === 'dayoff') : []
       ```
    2. L182 `title` → gate on path and on `!isDisabled`, keep the same message builder and the same two i18n keys:
       ```tsx
       title={isAdminView && !isDisabled && marks.length > 0 ? marks.map(m => `${m.name}: ${m.state === 'dayoff' ? t('admin.calendar.dayOffBtn') : t('admin.calendar.workingBtn')}`).join(', ') : undefined}
       ```
    3. L185: `singleMark?.state === 'dayoff'` → `selfMark?.state === 'dayoff'`. **The class string is unchanged** (`text-[var(--md-on-error-container)] bg-[var(--md-error-container)] hover:brightness-95`), as are the `!isDisabled` / `!isSelected` guards and every other line of the `className` template (L183–188). This single-token edit is what removes the generic red wash from admin view.
    4. L192–195: `singleMark?.state === 'working'` → `selfMark?.state === 'working'`; markup and classes unchanged (`absolute bottom-0.5 w-1.5 h-1.5 rounded-full`, `bg-primary-foreground` when selected else `bg-[var(--md-success)]`). Update the comment above it to say it is the master's-own-view dot (self path only).
    5. Replace the whole multi block (L197–209, comment included) with these two blocks, in this DOM order — the bar must come **after** the date-number `<span>` (L190) so it paints over the digit; no `z-index`, no `pointer-events` overrides:
       ```tsx
       {/* Admin view: one dot per checked master WORKING that day, in that master's colour */}
       {!isDisabled && workingMarks.length > 0 && (
         <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center gap-[2px] px-0.5">
           {workingMarks.slice(0, 4).map(m => (
             <span
               key={m.id}
               className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'ring-1 ring-primary-foreground/70' : ''}`}
               style={{ backgroundColor: m.color ?? undefined }}
             />
           ))}
           {workingMarks.length > 4 && <span className="text-[8px] leading-none font-bold text-muted-foreground">+</span>}
         </div>
       )}

       {/* Admin view: DAY OFF = strike bar across the cell, split into one segment per off master */}
       {!isDisabled && offMarks.length > 0 && (
         <div className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 flex h-[3px] overflow-hidden rounded-full ${isSelected ? 'ring-1 ring-primary-foreground/70' : ''}`}>
           {offMarks.map(m => (
             <span key={m.id} className="flex-1" style={{ backgroundColor: m.color ?? undefined }} />
           ))}
         </div>
       )}
       ```
    6. Do **not** touch: `dayMarks` (L121–139) and its `DayMark` type, `targetMasters` (L62), the hook call (L55–60), `fetchMonthOverrides` (L67–91), `toggleDate`, the 42-day padding (L147–157), the weekday header row (L161–165), the `<button>`'s disabled/today/selected classes, `handleSave`, the Action Overview panel (L272–307, including its own `--md-success`/`text-destructive` usage), and the intervals editor.

- [x] **Step R3: Update the file's top doc comment (L30–39).**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details: the admin-view bullet must now state the rendering contract, not just the data source — per checked master, in that master's own colour, for any selection size: working = bottom dot (cap 4 + `+`), day off = centre strike bar split per off master; and that the green-dot / red-wash rendering is the master's-own-view path only. Keep it to the existing ~10-line comment block; do not turn it into a design essay.

- [x] **Step R4: Ripple grep — prove no leftovers of the old scheme.**
  - Files: read-only sweep, no edits expected
  - Details: run and report each result:
    - `rg -n "singleMark" src/` → must be **empty**.
    - `rg -n "rounded-\[1px\]" src/` → must be empty (round 1's day-off square existed only here).
    - `rg -n "md-success|md-error-container" src/app/admin/master/calendar/BulkSettingsModal.tsx` → must return **exactly three** hits, all pre-existing and all correct: the self-path day-off cell class (≈L185), the self-path working dot (≈L194), and the Action Overview "shifts" row (≈L301, unrelated to master selection). No hit may sit inside an `isAdminView`-reachable mark render.
    - `rg -n "marks.length >= 2" src/` → must be empty.
    - `git diff --stat src/locales` → must be empty (no new/changed i18n keys).
  - If any grep contradicts the above, stop and report instead of improvising.

- [x] **Step R5: Line-budget check (conditional extraction only).** (460 lines, under 470 — no extraction needed)
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details: baseline 441 lines, round 2 is ≈ +17 net (≈ 458). Run `wc -l` and report it. If it lands **above 470**, then and only then extract the day `<button>` (the entire `days.map` callback body) into a new co-located `BulkDayCell.tsx` with explicit props `{ date, isSelected, isDisabled, isToday, selfMark, workingMarks, offMarks, title, onToggle }` — the parent keeps `dayMarks`, the partition, the tooltip string and the 42-day loop; the child is presentational only, imports `format` from `date-fns`, calls no hook (**no `useTranslation()` inside it** — the `title` arrives pre-built). Move every class string byte-for-byte. If the file is at or under 470, do not extract and do not restructure anything to save lines.

- [x] **Step R6: Tests — keep the suite green, add none.**
  - Files: none new
  - Details: round 2 adds no pure logic (`resolveDayScheduleState` is untouched; the new code is two `Array.filter` calls and JSX), and this repo has no component/DOM test harness — so no new test file. Run `npm run test` (must stay green, including round 1's `tests/app/admin/master/calendar/calendar-utils.test.ts`, nothing skipped) and `npm run lint` (zero warnings; watch for the now-unused `singleMark` and any accidentally orphaned import). Do **not** run `npm run dev` or `npm run build`.

- [x] **Step R7: DOX pass — replace the stale contract sentence.**
  - Files: `src/app/admin/AGENTS.md` (L29, the calendar-conventions bullet)
  - Details: round 1's final sentence there now documents behaviour that no longer exists ("0/1 target keeps the green-dot + red-cell single-master rendering, 2+ targets render one per-master colour dot per day (circle = working, square = day off …)"). Delete that sentence and put in its place a statement of the round-2 contract: indicators are keyed off the in-modal `targetMasterIds` checkboxes and split by **path, never by count**; the master's-own view (`isAdminView === false`) keeps the single `--md-success` dot + `--md-error-container` day-off cell wash; admin view renders every checked master in that master's own `masterProfile.color` (fallback `#166534`) for any selection size ≥ 1 — working = 6px filled dot in the bottom row (cap 4 + `+`), day off = a 3px strike bar across the cell centre split into one equal segment per off master — because hue encodes master identity, state must be encoded by form (dot vs strike), never by colour; the same colour appears as a swatch beside each name in the "Apply to specialists" checklist and as the avatar ring on `/admin/masters`; `resolveDayScheduleState()` in `calendar-utils.ts` remains the single override-beats-template rule for both paths. Keep the rest of L29 (file enumeration, `--md-*-container` convention, event-tint rule, `.custom-scrollbar`) as-is — and add `BulkDayCell.tsx` to that enumeration **only** if step R5 actually created it.
  - No other doc changes: no new route, model, nav entry, or test file, so `src/app/api/AGENTS.md`, `prisma/AGENTS.md`, `tests/AGENTS.md` and the root `CLAUDE.md` Child DOX Index stay untouched (state this explicitly at closeout).

## Round 2 acceptance criteria (additions — round 1's still apply)

- [ ] With **exactly one** master checked in `/admin/calendar` → Bulk Schedule Edit, that master's working days show a dot in **their** `masterProfile.color` (violet for Anna, green for Marek), never `--md-success` green-by-default, and their day-off days show a solid bar in the same colour with **no** red cell wash.
- [ ] `rg -n "singleMark|rounded-\[1px\]|marks.length >= 2" src/` returns nothing; `--md-success` / `--md-error-container` survive in `BulkSettingsModal.tsx` at exactly three self-path/overview sites (step R4).
- [ ] A date where one checked master works and another is off renders **both** the working dot (bottom) and the off bar (centre), each in the right master's colour.
- [ ] N checked masters off on the same date → one bar split into N equal colour segments, in the same stable name-ascending order as the dots (both derive from `targetMasters`, which filters `adminMastersList`).
- [ ] Each "Apply to specialists" row shows a colour dot matching that master's avatar ring on `/admin/masters`.
- [ ] Cell `title` names every checked master with a state on that day, for 1 master as well as many; disabled (past / other-month) cells have no `title`.
- [ ] The master's-own path (`/admin/master/schedule` → Bulk Schedule Edit) is **visually unchanged from round 1**: green `--md-success` dot on working days, `--md-error-container` wash on days off, no swatches, no bars, no tooltip.
- [ ] The day cell is still `h-10 w-full` and the grid still renders exactly 42 cells — no height/width/`gap` change anywhere.
- [ ] No inline `style` on the day `<button>` itself (only on child dot/bar/swatch spans), so `bg-primary` (selected) and `ring-2 ring-primary bg-primary/10` (today) still win as before.
- [ ] Zero new i18n keys (`git diff --stat src/locales` empty); zero API/Prisma/locale file changes; no new dependency.
- [ ] `BulkSettingsModal.tsx` under 500 lines (report the count; ≈458 expected, extraction only if >470 per step R5).
- [ ] `npm run lint` zero warnings, `npm run test` green.

## Round 2 constraints & risks

**Must not be touched**
- The `isAdminView === false` rendering output (L185 wash, L192–195 dot) and everything round 1 already shipped in sub-tasks B and C.
- `dayMarks` / `DayMark` / `targetMasters` / `useMasterSchedules` / `resolveDayScheduleState` — all already correct for this round.
- `src/app/api/**`, `prisma/**`, `src/locales/**`, `MonthView.tsx` / `WeekView.tsx` / `DayView.tsx`, `MastersClient.tsx` (read-only reference for the colour convention).
- The modal's layout skeleton: cell size, `grid-cols-7 gap-1`, the 42-day padding, the right pane, `handleSave`.

**Do not run**
- `npm run dev`, any long-running server, or `npm run build` (the user's dev server is live; a concurrent build corrupts `.next/`). Verification is `npm run lint` + `npm run test` + greps only. No browser tool — the user verifies from screenshots.

**Risks**
1. **Pale master colours.** A near-white `masterProfile.color` gives a barely visible dot/bar (and would equally give a near-invisible avatar ring on `/admin/masters` today). The checklist swatch gets `ring-1 ring-border`; the calendar marks stay ring-free by design (a ring on a 6px dot / 3px bar reads as noise) and rely on the `title` tooltip. Accepted, pre-existing class of problem — do not add contrast-computation logic.
2. **Strike bar over the digit.** Intended, but it is the one thing that could read as "cluttered" at 40px. Fallback documented in judgment call #2; do not implement it pre-emptively.
3. **Many off masters** → thin colour bands (no cap, judgment call #4). If the user complains, the fix is a cap + `+` glyph mirroring the dot row, not a redesign.
4. **Selected-cell contrast** — mitigated by the shared `ring-1 ring-primary-foreground/70` on both dot and bar.
5. **File headroom after this round** ≈ 458/500. The *next* change to `BulkSettingsModal.tsx` will very likely need the `BulkDayCell.tsx` extraction spec'd in step R5 — note it at closeout so the next round doesn't discover it late.
6. **Stale doc drift** — `src/app/admin/AGENTS.md` L29 is the only place round 1's square-dot rule was written down; missing step R7 leaves a doc that actively contradicts the code.
7. **Behaviour flip to expect (not a bug):** admin view no longer shows the familiar green dot / red cell at all. An admin used to round 1's rendering will see the colour language change the moment they check one master. That is the requested fix.

## Round 2 manual verification for the user (RU, short)

1. `/admin/masters` — запомнить цвета обводок аватаров: Marek (зелёный), Anna (фиолетовый).
2. `/admin/calendar` → «Все мастера» → «Массовое редактирование графика»: в списке «Zastosuj do specjalistów» у каждого имени слева — кружок его цвета (зелёный у Marek, фиолетовый у Anny).
3. Отметить **только Anna** → на её рабочих днях точки должны быть **фиолетовыми** (не зелёными!), а на выходных — фиолетовая полоса-«зачёркивание» по центру дня. Красной заливки дня быть не должно.
4. Отметить **только Marek** → точки и полосы зелёные (его цвет), поведение то же.
5. Отметить **обоих** → на дне, где один работает, а второй выходной: внизу точка цвета работающего + по центру полоса цвета отдыхающего. Если выходной у обоих — одна полоса, поделённая пополам: половина зелёная, половина фиолетовая.
6. Навести курсор на такой день — подсказка перечисляет всех: «Anna: Dzień wolny, Marek: Pracuje». На серых (прошлых / чужого месяца) днях подсказки нет.
7. Снять все галочки → никаких точек и полос.
8. Полистать месяцы и нажать «Применить настройки» → метки перерисовываются под новый месяц / сразу после сохранения.
9. `/admin/master/schedule` (вход мастером) → «Массовое редактирование графика»: всё как было — зелёная точка на рабочих днях, красная заливка на выходных, никаких цветных полос и кружков в списке (списка мастеров там нет).

---

# Round 3 — stacked day-off lines + hard 5-master selection cap

**Date:** 2026-08-05
**Status:** In Progress
**Classification:** Minor/UX refinement of round 2's shipped day-off mark, plus one new bounded product constraint (max 5 target masters). Rounds 1 and 2 above shipped and were reviewed APPROVED — do not re-do, revert or re-touch anything in them beyond the exact lines named below.
**Scope:** `src/app/admin/master/calendar/BulkSettingsModal.tsx`, `calendar-utils.ts` (one exported constant), `src/locales/{pl,en,uk}.json` (**one** new key), `src/app/admin/AGENTS.md` (one sentence), and — only if the line budget trips — a new `BulkDayCell.tsx`. `useMasterSchedules.ts`, `ModernCalendar.tsx`, `CalendarToolbar.tsx`, `MonthView/WeekView/DayView`, every API route, Prisma, and sub-tasks B and C: **no change**.

## Round 3 goal

Two independent fixes in the bulk editor: (1) a day off renders as **N thin full-width horizontal lines stacked vertically**, one per off master, each line entirely in that one master's colour — replacing round 2's single 3px bar split into side-by-side colour segments; (2) target-master selection is **hard-capped at 5**, with unchecked rows disabled once 5 are picked and "Apply to all specialists" disabled + explained whenever the salon has more than 5 masters.

## What the user reported (round 2 verification)

Round 2's bar works, but the *split* does not read: two masters off the same day produce one line that is half violet / half green, and the eye parses "one bar with two halves" rather than "two masters are off". Verbatim ask: make the marks thinner and stack them one under another; and cap how many masters one edit may target — *"5 masters, ok, let's just limit editing to a maximum of 5 masters at a time — then we can properly cross out top-to-bottom with stripes, and the dots should fit too, three more dots should fit there fine without crowding."* Confirmed in a follow-up: the cap is exactly **5**, and when the salon has more than 5 masters the "Apply to all specialists" checkbox must be **disabled with an explanation**, never silently truncated to the first 5.

Two things to read out of that quote, because they settle the two judgment calls below: the user explicitly wants the stripes to *cross the day top-to-bottom* (so the stack stays over the date digit, R3-B), and explicitly expects **5 dots to fit** in the working row (so the cap-4 + `+` overflow glyph goes away, R3-C).

## Current state of `BulkSettingsModal.tsx` (re-read fresh, 460 lines)

Round 1's and round 2's line numbers are both stale. These are the real ones:

| Line(s) | Current code | Round 3 action |
| --- | --- | --- |
| L13 | `import { resolveDayScheduleState, pluralize } from "./calendar-utils"` | extend with `MAX_TARGET_MASTERS` |
| L16–18 | `type Interval` / `Override` / `Template` | untouched |
| L30–44 | file doc comment (admin bullet at L37–43 describes the split bar) | rewrite the admin bullet |
| L57–58 | `initialMasters` (≤ 1 id) / `targetMasterIds` state | untouched |
| L60–65 | `useMasterSchedules` call | untouched |
| L67 | `targetMasters = adminMastersList.filter(...)` | untouched (stable name-ascending order for both dots and lines) |
| L98–103 | `toggleMaster` | + cap guard |
| L105 | `allSelected` | untouched; three derived values added beside it |
| L107–113 | `toggleAllMasters` | + `canApplyToAll` guard |
| L126–144 | `DayMark` type + `dayMarks()` | untouched |
| L178–181 | `marks` / `selfMark` / `workingMarks` / `offMarks` | untouched |
| L189 | cell `title` (admin path, `!isDisabled`, all marks) | untouched |
| L192 | self-path day-off `--md-error-container` wash | untouched |
| L200–202 | self-path `--md-success` dot | untouched |
| L204–216 | admin working dots, `slice(0, 4)` + `+` glyph | `slice(0, MAX_TARGET_MASTERS)`, delete the `+` glyph |
| L218–225 | admin day-off **split bar** (`flex h-[3px] overflow-hidden` + `flex-1` segments) | replaced by the stacked-line stack |
| L238–241 | `handleSave` guard `isAdminView && targetMasterIds.size === 0` | untouched (the cap needs no save-time validation) |
| L301–310 | Action Overview "Docelowi specjaliści" row | untouched — verified correct under the cap, see R3-G |
| L343–351 | "Apply to all specialists" checkbox row | + `disabled` + `title` + disabled styling |
| L353–368 | per-master checklist rows (`adminMastersList.map`) | + per-row `disabled` + `title` + disabled styling; + inline hint below the list |

## Round 3 geometry (the math, as in rounds 1–2)

**Cell box — unchanged, and it must stay unchanged.** Modal `max-w-3xl` = 768px; right pane `md:w-[320px]`; left pane ≈ 448px − 2×`p-6` = 400px; inner `bg-muted/40 … p-4` → 368px; `grid-cols-7 gap-1` → (368 − 6×4)/7 ≈ **49.1px** wide, `h-10` = **40px** tall.

Vertical bands already occupied inside those 40px:
- **Date digit** — `text-sm` = 14px glyphs in a 20px line box, centred by `flex items-center` → line box y = 10…30; actual digit ink (cap height ≈ 0.7em ≈ 10px, sitting on the baseline) ≈ **y = 13…23**.
- **Working-dot row** — `absolute bottom-0.5` + `h-1.5` → **y = 32…38**.
- Free: y = 0…13 above the digit ink, y = 23…32 between the digit and the dot row.

**Stacked lines = 2px line + 2px gap, block centred (`top-1/2 -translate-y-1/2`).** Block height = 2N + 2(N−1) = **4N − 2**:

| off masters (N) | block height | block spans (y) | lines crossing the digit ink (13…23) | clearance to the dot row (y=32) |
| --- | --- | --- | --- | --- |
| 1 | 2px | 19…21 | 1 | 11px |
| 2 | 6px | 17…23 | 2 | 9px |
| 3 | 10px | 15…25 | 2 | 7px |
| 4 | 14px | 13…27 | 2 | 5px |
| **5 (worst case under the cap)** | **18px** | **11…29** | **2 of 5** (lines at 15–17 and 19–21) | **3px** |

So the worst case uses 18 of 40px, never reaches the dot row, and leaves roughly 6 of the digit's 10px ink height visible through the 2px gaps — the number reads as **struck through, not erased**. Rejected alternatives, for the record: 3px lines + 2px gaps = 23px at N=5 (only 1px above the dot row, and 3 of 5 lines land on the glyph); 2px + 1px gaps = 14px at N=5 (fits, but the 1px gaps close up optically and the stack reads as one thick bar again — the exact problem we are fixing); 1px lines render inconsistently at fractional device-pixel ratios. 2px is also strictly thinner than round 2's 3px bar, which is literally the user's "make them thinner" ask, and at N=1 a 2px line still reads as a strikethrough.

**Working dots at N=5.** Row content box ≈ 49.1 − 2×2 (`px-0.5`) ≈ **45.1px**. 5 × 6px dots + 4 × 2px gaps = **38px** → fits with ~7px to spare. This is exactly the user's "three more dots should fit there fine without crowding" (round 1 sized the row for 4 + a `+`; 5 is cheaper than 4 + glyph, which measured ≈36px).

## Round 3 architecture decisions

### R3-A. One full-width line per off master, stacked — never a line split between masters

Replace round 2's `flex h-[3px] overflow-hidden` + `flex-1` segments with a `flex flex-col gap-[2px]` stack of `h-[2px]` children, each child fully painted in one master's colour:

```tsx
{/* Admin view: DAY OFF = one thin full-width line per off master, stacked top-to-bottom */}
{!isDisabled && offMarks.length > 0 && (
  <div className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 flex flex-col gap-[2px] ${isSelected ? 'rounded-[3px] bg-primary-foreground/85 p-[1px]' : ''}`}>
    {offMarks.map(m => (
      <span key={m.id} className="h-[2px] rounded-full" style={{ backgroundColor: m.color ?? undefined }} />
    ))}
  </div>
)}
```

Why this reads better than the split bar: one line = one master is a **1:1 mapping the eye can count**, whereas a bar cut into coloured halves is one object the eye must *decompose*, and the cut position carries no meaning. A ledger/barcode of N stripes also degrades honestly — adding a master adds a stripe, it does not resize and re-slice the marks that were already there, so the visual identity of each master's own stripe (full width, their hue) is stable across days and across selections.

Everything else about the block is deliberately inherited from round 2 so the diff stays surgical: same `left-1 right-1` insets (≈41px of line), same `top-1/2 -translate-y-1/2` centring, same position **after** the date-number `<span>` in DOM order (paints over the digit, no `z-index`, no `pointer-events` override), same inline `backgroundColor` on the child spans only, same `offMarks` source and therefore the same stable name-ascending order as the dots (both derive from `targetMasters`, which filters `adminMastersList`). `overflow-hidden` is dropped — it existed only to clip the round-2 segments to their rounded container; each line now rounds itself.

Note on the flex mechanics: in a `flex-col` container the default `align-items: stretch` makes each `<span>` span the full container width without any `w-full`. Do not add `w-full`/`flex-1` — `flex-1` on a column child would make lines *grow to fill the container height*, which is exactly the bug this decision removes.

### R3-B. The stack stays centred, over the digit

The task allowed reconsidering placement if 5 stacked lines buried the digit. Per the geometry table they do not: at N=5 only 2 of the 5 lines land on the glyph and ~60% of the glyph height stays visible in the gaps. And the user's own wording (*"properly cross out top-to-bottom with stripes"*) asks for exactly this. There is also nowhere better to put it: the only free bands are 13px above the digit ink and 9px between the digit and the dot row — neither holds an 18px block, and moving the stack there would turn "crossed out" into "underlined", which round 2 already identified as the weaker reading (round 2 judgment call #2).

Kept from round 2 verbatim: **no inline `style` on the day `<button>` itself, ever** — only on child mark elements — so `bg-primary` (selected) and `ring-2 ring-primary bg-primary/10` (today) keep winning.

### R3-C. Working-dot cap 4 → 5, the `+` overflow glyph is deleted; the line stack stays uncapped

With Part 2's hard cap, `workingMarks.length ≤ targetMasters.length ≤ targetMasterIds.size ≤ 5` by construction, so `workingMarks.length > 4` is no longer an overflow case worth an indicator — it is simply "all five work today", and the row has room for all five (38px of 45.1px). The `+` glyph therefore becomes dead UI and goes; `slice(0, 4)` becomes `slice(0, MAX_TARGET_MASTERS)`.

Keeping the `slice` (rather than deleting it too) is deliberate and asymmetric with the line stack, which gets no cap:
- The dot row is laid out **horizontally against a hard ~45px budget** with `shrink-0` dots — an unexpected 6th dot would spill outside the cell and break the grid's optical rhythm. `slice(0, MAX_TARGET_MASTERS)` bounds the DOM for one token's cost.
- The line stack is laid out **vertically inside a 40px box** and grows only 4px per master, symmetrically about the centre; it would not reach the dot row until N=9, which the cap makes unreachable. It needs no `slice`, and adding one would imply an overflow story that cannot happen.

### R3-D. Selected-cell contrast: a light backing plate, not a ring

Round 2 put `ring-1 ring-primary-foreground/70` on the bar when the day is selected, so a master colour close to `bg-primary` stays visible. Neither obvious port of that works on a stack:
- **Ring on each line** — a 1px ring around a 2px line is half the line's thickness in a competing colour; with 2px gaps, adjacent rings touch and the whole stack turns into a light block with faint colour hints.
- **Ring on the stack container** — reproduces round 2 exactly at N=1, but for N≥2 it only outlines the block while the 2px gaps still show `bg-primary`, so it fixes nothing where the problem actually is.

So on selected cells the container becomes a **backing plate**: `rounded-[3px] bg-primary-foreground/85 p-[1px]`. The inter-line gaps and a 1px margin all around become light, giving every line a light ground regardless of hue — it solves the N≥2 case a ring cannot, for +2px of block height (N=5 → 20px, y = 10…30, still 2px clear of the dot row). Unselected cells (the overwhelmingly common case) get no plate and no ring, i.e. unchanged from round 2. The **working dots keep their `ring-1 ring-primary-foreground/70` verbatim** — a ring works fine on a 6px round dot and that rendering already shipped and was approved.

### R3-E. The cap is one constant, in `calendar-utils.ts`, enforced in both the JSX and the state updaters

`export const MAX_TARGET_MASTERS = 5` lives in `calendar-utils.ts`, not in `BulkSettingsModal.tsx`. Reason: if step R3-8's conditional `BulkDayCell.tsx` extraction fires, the child needs the same constant for the dot `slice`, and a child importing it from its own parent would be a circular module import. `calendar-utils.ts` is already this folder's shared-primitive module (`src/app/admin/AGENTS.md` L29: "import from here, don't re-declare"), is already imported by `BulkSettingsModal.tsx` at L13, and is 61 lines.

Enforcement sits in **both** places:
- JSX `disabled` attributes — what the admin sees.
- `toggleMaster` / `toggleAllMasters` early-return guards — one line each. A disabled input cannot fire `onChange`, so these are strictly redundant *today*; they are still required because the ≤5 invariant is what licenses deleting the `+` overflow glyph (R3-C) and leaving the line stack uncapped, and the invariant must not depend on a JSX attribute a future edit could drop. This is an invariant guard, not defensive error handling for an impossible input.

The cap is **client-side UX only**: `onSave` / `ModernCalendar.saveBulkOverrides` / the bulk API keep accepting any number of master ids and get **no** validation in this round.

### R3-F. Exactly one new i18n key (the first in three rounds)

Searched before deciding: nothing reusable exists. `admin.calendar.bulk.selectMasterAlert` is the *minimum* ("select at least one specialist"); the only "maksymalnie" strings in `pl.json` are a name-length validation message (L956) and the GDPR erasure SLA (L1282); there is no limit/maximum key anywhere in `admin.calendar.*`. Rounds 1–2 deliberately hit zero new keys, but a hard usage limit that greys out a control the admin is actively clicking **must say why** — a silent `disabled` is the worst possible outcome here, and reusing a label like `applyToAllMastersLabel` as a tooltip explains nothing. So one key is genuinely justified:

`admin.calendar.bulk.maxMastersHint`, inserted in all three locales immediately after `applyToAllMastersLabel` (L240 in **all** of `pl.json`, `en.json`, `uk.json` — that line already ends with a comma, so no comma surgery on neighbours):

- pl: `"maxMastersHint": "Maksymalnie {{max}} specjalistów jednocześnie",`
- en: `"maxMastersHint": "Maximum {{max}} specialists at a time",`
- uk: `"maxMastersHint": "Максимум {{max}} спеціалістів одночасно",`

Interpolation is `{{max}}`, **not** `{{count}}` — `count` triggers i18next's plural-suffix resolution (`key_one`/`key_few`/`key_many`) and this string has none; the cap is a fixed 5, so no plural logic is wanted at all. Interpolating rather than hardcoding "5" keeps the number single-sourced in `MAX_TARGET_MASTERS`.

One string serves both lock reasons (row locked because 5 are already picked; "apply to all" locked because the salon has more than 5) because it states **the rule**, which is what the admin needs in either situation.

Delivery of the signal, in ascending strength:
1. `title={…}` on the **`<label>`**, never on the `<input>` — a disabled form control receives no pointer events, so a `title` on the input itself may never surface a tooltip, while the wrapping label is not disabled and does.
2. `opacity-50 cursor-not-allowed` on locked rows (the codebase's standard disabled affordance, e.g. `EditProcedurePanel.tsx` L280, `ContactMasterPanel.tsx` L121).
3. An always-visible `text-xs text-muted-foreground` hint line under the checklist whenever the limit is actionable — i.e. `adminMastersList.length > MAX_TARGET_MASTERS || targetLimitReached`. Same style as this modal's existing `noIntervalsAdded` hint (L404). It is conditional rather than permanent so a two-master salon never sees a rule that can't bind it; the cost is one ~16px growth of the panel at the moment the 5th box is checked, which is inside an already-`overflow-y-auto` column and shifts nothing else.

### R3-G. "Apply to all" is disabled, not hidden; the Action-Overview summary needs no change

Disabled-and-explained beats hidden: hiding a control the admin has used before, with no trace, reads as a bug; a greyed checkbox carrying the reason in its tooltip and the hint line below reads as a rule. The checkbox also stays semantically meaningful — it just cannot be satisfied while the salon has more than 5 masters.

The Action Overview row (L301–310) is:

```tsx
{targetMasterIds.size === adminMastersList.length && targetMasterIds.size > 0 ? t('admin.calendar.allMasters') : targetMasterIds.size}
```

Verified correct under the cap with **no wording change**: when `adminMastersList.length ≤ 5`, selecting everyone still makes `size === length` → "Wszyscy specjaliści", which is still literally true; when `adminMastersList.length > 5`, `size` tops out at 5 < `length`, so the equality can never hold and the row shows the number (`5`) — exactly right, because "all" would be a lie. Do not touch this row.

## ⚠️ Round 3 judgment calls to sanity-check (review these before the coder runs)

1. **Stacked-line geometry: 2px line + 2px gap, block centred, 18px max at N=5 (R3-A + the geometry table).** ← *flagged for review.* The whole round rests on this pitch. Thinner gaps make the stack read as one bar again (the bug being fixed); thicker lines collide with the working-dot row at N=5. If you want a different pitch, change it here — the JSX is two arbitrary values (`gap-[2px]`, `h-[2px]`) and nothing else in the plan depends on the numbers.
2. **The stack still crosses the date digit at N=5, obscuring ~40% of the glyph (R3-B).** ← *flagged for review.* Justified by the geometry (only 2 of 5 lines land on the glyph) and by the user's explicit "cross out top-to-bottom with stripes". The alternative — move the block into the 9px band between the digit and the dot row — does not fit an 18px stack and downgrades "crossed out" to "underlined". If the user reports the digit is unreadable on all-off days, the escalation is to drop to `gap-[1px]` at N≥4 only; **do not** implement that pre-emptively.
3. **Working-dot cap 4 → 5 and the `+` glyph deleted (R3-C).** ← *flagged for review.* Only sound *because* Part 2 makes 5 the hard ceiling, so it must ship in the same change as the cap, never before it. 5 dots measure 38px in a 45.1px row. If the cap is ever raised above 5, the `+` glyph has to come back.
4. **The dot row keeps a `slice`, the line stack gets none** — asymmetric on purpose, reasoning in R3-C. A reviewer will notice; this is the answer.
5. **Selected-cell light backing plate instead of round 2's ring (R3-D).** Fallback if the user finds the plate ugly: delete the plate classes and put `ring-1 ring-primary-foreground/70` back on the stack container (round 2's exact class), accepting that inter-line gaps show `bg-primary`. Do **not** ship both.
6. **One new i18n key (R3-F)** — the first across three rounds, and a deliberate break from rounds 1–2's zero-new-keys record. A silent `disabled` is not an acceptable alternative; if the reviewer insists on zero keys, the change to make is dropping Part 2's UX signalling, not weakening it.
7. **Disable, don't hide, "Apply to all specialists" when the salon has >5 masters (R3-G).**
8. **No server-side cap.** The bulk API still accepts any master-id array. Out of scope; no route file is touched in this round.
9. **`BulkDayCell.tsx` extraction is conditional and measured, not preemptive (step R3-8).** Baseline is 460 lines and round 3 is ≈ +13 net → ≈ **473**, i.e. probably just over round 1's standing 470 trigger. The coder measures after the functional edits and extracts only if the count actually exceeds 470. Do not compress or restructure working code to duck under the trigger.

## Round 3 implementation steps

- [x] **Step R3-1: Add the cap constant to `calendar-utils.ts`.**
  - Files: `src/app/admin/master/calendar/calendar-utils.ts` (61 lines → ~64)
  - Details: after the file's existing doc comment (L3) and before `groupOverlappingAppointments` (L5), add:
    ```ts
    /** Hard UI cap on how many masters one bulk schedule edit may target — keeps BulkSettingsModal's stacked day marks legible (5 lines ≈ 18px in a 40px cell, 5 dots ≈ 38px in a ~45px row). */
    export const MAX_TARGET_MASTERS = 5
    ```
  - Nothing else in this file changes. `resolveDayScheduleState`, `pluralize`, `parseTime`, `groupOverlappingAppointments` and the `import type { Appointment }` line stay byte-for-byte.

- [x] **Step R3-2: Add the new i18n key to all three locales.**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: insert one line immediately **after** `"applyToAllMastersLabel": …` (L240 in all three files, already comma-terminated) inside `admin.calendar.bulk`:
    - `pl.json`: `        "maxMastersHint": "Maksymalnie {{max}} specjalistów jednocześnie",`
    - `en.json`: `        "maxMastersHint": "Maximum {{max}} specialists at a time",`
    - `uk.json`: `        "maxMastersHint": "Максимум {{max}} спеціалістів одночасно",`
  - Match the surrounding 8-space indentation exactly. Add **no other key**, rename nothing, and do not touch `scheduleAndCalendarTitle`/`scheduleAndCalendarDesc` (round 1 step B3 deliberately left them).

- [x] **Step R3-3: Enforce the cap in state and derive the UI flags.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details, in order:
    1. L13 → `import { resolveDayScheduleState, pluralize, MAX_TARGET_MASTERS } from "./calendar-utils"` (same line, no new import statement).
    2. `toggleMaster` (L98–103) gains one branch — an unchecked box at the cap is a no-op:
       ```ts
       const toggleMaster = (id: string) => {
         const newSet = new Set(targetMasterIds)
         if (newSet.has(id)) newSet.delete(id)
         else if (newSet.size >= MAX_TARGET_MASTERS) return
         else newSet.add(id)
         setTargetMasterIds(newSet)
       }
       ```
    3. Immediately after `allSelected` (L105, **unchanged**) add:
       ```ts
       const targetLimitReached = targetMasterIds.size >= MAX_TARGET_MASTERS
       const canApplyToAll = adminMastersList.length > 0 && adminMastersList.length <= MAX_TARGET_MASTERS
       const isRowLocked = (id: string) => targetLimitReached && !targetMasterIds.has(id)
       const limitHint = t('admin.calendar.bulk.maxMastersHint', { max: MAX_TARGET_MASTERS })
       ```
    4. `toggleAllMasters` (L107–113) gains `if (!canApplyToAll) return` as its first statement; the existing `allSelected ? new Set() : new Set(adminMastersList.map(m => m.id))` body is otherwise unchanged (it can now only run when the list is ≤ 5, so it can never exceed the cap).
    5. Do **not** touch `initialMasters` (L57, seeds at most one id), `targetMasterIds`'s declaration (L58), the `useMasterSchedules` call (L60–65), `targetMasters` (L67), or `handleSave` (L233–253) — its `targetMasterIds.size === 0` guard and the Apply button's `disabled` expression (L451) stay exactly as they are, since the checkbox-level cap makes >5 unreachable.

- [x] **Step R3-4: Lock the checklist UI at 5 and explain why.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`, inside the `isAdminView &&` block (L337–371)
  - Details:
    1. "Apply to all specialists" row (L343–351): put `title` on the `<label>` and make its interactive classes conditional; add `disabled` to the input. Keep `checked={allSelected}` and `onChange={toggleAllMasters}` and the label text as they are:
       ```tsx
       <label title={!canApplyToAll ? limitHint : undefined} className={`flex items-center gap-3 p-3 rounded-lg transition-colors border border-transparent shadow-sm ${canApplyToAll ? "cursor-pointer hover:bg-muted hover:border-border/50" : "cursor-not-allowed opacity-50"}`}>
         <input
           type="checkbox"
           className="h-4 w-4 accent-primary rounded cursor-pointer"
           checked={allSelected}
           disabled={!canApplyToAll}
           onChange={toggleAllMasters}
         />
         <span className="font-semibold text-foreground">{t('admin.calendar.bulk.applyToAllMastersLabel')}</span>
       </label>
       ```
    2. Per-master rows (L355–366): same treatment via `isRowLocked(m.id)`. The colour swatch + `<User>` + name span from round 2 (L362–365) is **unchanged**:
       ```tsx
       <label key={m.id} title={isRowLocked(m.id) ? limitHint : undefined} className={`flex items-center gap-3 text-sm p-2.5 rounded transition-colors ${isRowLocked(m.id) ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/60"}`}>
         <input
           type="checkbox"
           className="h-4 w-4 accent-primary rounded cursor-pointer"
           checked={targetMasterIds.has(m.id)}
           disabled={isRowLocked(m.id)}
           onChange={() => toggleMaster(m.id)}
         />
       ```
    3. Immediately **after** the scrollable list `</div>` (L368) and still inside the `bg-muted/40` box (before L369's `</div>`), add the hint line:
       ```tsx
       {(adminMastersList.length > MAX_TARGET_MASTERS || targetLimitReached) && (
         <p className="text-xs text-muted-foreground mt-2 pl-1">{limitHint}</p>
       )}
       ```
    4. Do not change the section header (L339–341), the list container's classes (L353, including `max-h-[160px] overflow-y-auto … custom-scrollbar`), or the `space-y-3`/`space-y-6` wrappers.

- [x] **Step R3-5: Replace the split day-off bar with the stacked lines.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`, L218–225 (the `offMarks` block inside `renderCalendar()`'s `days.map`)
  - Details: replace those 8 lines (comment included) with exactly:
    ```tsx
    {/* Admin view: DAY OFF = one thin full-width line per off master, stacked top-to-bottom */}
    {!isDisabled && offMarks.length > 0 && (
      <div className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 flex flex-col gap-[2px] ${isSelected ? 'rounded-[3px] bg-primary-foreground/85 p-[1px]' : ''}`}>
        {offMarks.map(m => (
          <span key={m.id} className="h-[2px] rounded-full" style={{ backgroundColor: m.color ?? undefined }} />
        ))}
      </div>
    )}
    ```
    - Keep it in the same DOM position (last child of the day `<button>`, after the date-number `<span>` at L197 and after the working-dot block) — that is what paints it over the digit.
    - `flex h-[3px]`, `overflow-hidden`, `flex-1` and `ring-1 ring-primary-foreground/70` all disappear from this block. Do **not** add `w-full`, `flex-1`, `z-index`, or `pointer-events` anywhere in it.
    - `offMarks` itself (L181), `dayMarks` (L128–144), the `DayMark` type (L126) and the cell `title` (L189) are untouched.

- [x] **Step R3-6: Raise the working-dot cap to 5 and delete the `+` glyph.**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`, L204–216
  - Details: two edits inside the existing block, nothing else:
    - L207: `{workingMarks.slice(0, 4).map(m => (` → `{workingMarks.slice(0, MAX_TARGET_MASTERS).map(m => (`
    - Delete L214 entirely (`{workingMarks.length > 4 && <span className="text-[8px] leading-none font-bold text-muted-foreground">+</span>}`).
    - The container classes (L206), the per-dot classes including `ring-1 ring-primary-foreground/70` when selected (L210), and the inline `backgroundColor` (L211) stay byte-for-byte.

- [x] **Step R3-7: Update the file's top doc comment (L30–44).**
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`
  - Details: the admin-view bullet (L37–43) still describes "a strike bar across the cell's vertical centre, split into one segment per off master" and "cap 4 + `+`" — both now false. Rewrite that bullet to state: per checked master, in that master's own colour, for any selection size; working = a dot in the bottom row (up to `MAX_TARGET_MASTERS`, no overflow glyph — the selection cap makes one impossible); day off = one 2px full-width line per off master, stacked at the cell's vertical centre over the date digit; and that selection is hard-capped at `MAX_TARGET_MASTERS` (from `calendar-utils.ts`), which is what bounds both marks. Keep the master's-own-view bullet (L33–36) verbatim, keep the comment block at roughly its current ~14 lines, and do not turn it into a design essay.

- [x] **Step R3-8: Line budget — conditional `BulkDayCell.tsx` extraction.** (472 lines after R3-3…R3-7, above 470 — extracted; parent 441 lines, `BulkDayCell.tsx` 64 lines)
  - Files: `src/app/admin/master/calendar/BulkSettingsModal.tsx`, possibly new `src/app/admin/master/calendar/BulkDayCell.tsx`
  - Details: baseline 460 lines; round 3 is ≈ +13 net (≈ **473**, range 470–478). Run `wc -l` **after** steps R3-3…R3-7 and report the number.
    - If the count is **≤ 470**: do nothing, do not extract, do not restructure anything to save lines.
    - If the count is **> 470**: extract the day `<button>` — the entire `days.map` callback body (currently L171–228) — into a new co-located `BulkDayCell.tsx`, as a **pure move**:
      - Props: `{ date: Date; isSelected: boolean; isDisabled: boolean; isToday: boolean; selfMark?: DayMark; workingMarks: DayMark[]; offMarks: DayMark[]; title?: string; onToggle: () => void }`.
      - Move the `DayMark` type out of the component body (L126) into `BulkDayCell.tsx` and `export type DayMark`; `BulkSettingsModal.tsx` then does `import BulkDayCell, { type DayMark } from "./BulkDayCell"`. Do **not** have the child import anything from `BulkSettingsModal.tsx` (circular import); `MAX_TARGET_MASTERS` comes from `calendar-utils.ts` in both files, which is why step R3-1 put it there.
      - The parent keeps `dayMarks()`, the `selfMark`/`workingMarks`/`offMarks` partition, the `title` string construction, `toggleDate`, and the 42-day padding loop. The child is presentational only: it imports `format` from `date-fns`, calls **no hook** (no `useTranslation()` — `title` arrives pre-built), and every class string moves byte-for-byte.
      - Target: parent ≈ 425 lines, child ≈ 75 lines. Report both counts and add `BulkDayCell.tsx` to the DOX file enumeration in step R3-10.

- [x] **Step R3-9: Tests — keep the suite green, add none; then the ripple greps.**
  - Files: none new
  - Details:
    - No new test file: round 3 adds no pure logic (`resolveDayScheduleState` untouched; `MAX_TARGET_MASTERS` is a constant, `isRowLocked`/`canApplyToAll` are one-expression derivations of component state), and this repo still has no component/DOM test harness (round 1, step D).
    - Run `npm run test` — must stay green including `tests/app/admin/master/calendar/calendar-utils.test.ts`, nothing skipped — and `npm run lint` (zero warnings; watch for an orphaned `+`-glyph leftover or an unused `allSelected`/`targetLimitReached`). Do **not** run `npm run dev` or `npm run build`.
    - Ripple greps, run and report each:
      - `rg -n "flex-1" src/app/admin/master/calendar/BulkSettingsModal.tsx` → must be **empty** (the split-bar segments were the only use).
      - `rg -n "h-\[3px\]|overflow-hidden" src/app/admin/master/calendar/BulkSettingsModal.tsx` → no `h-[3px]`; `overflow-hidden` may only survive at the Action-Overview panel (≈L289) and the modal shell, never inside a day cell.
      - `rg -n "slice\(0, 4\)|> 4 &&" src/` → must be empty.
      - `rg -n "MAX_TARGET_MASTERS" src/` → exactly one declaration (`calendar-utils.ts`) plus its uses in `BulkSettingsModal.tsx` (and `BulkDayCell.tsx` if step R3-8 fired). No literal `5` cap left anywhere in the JSX.
      - `rg -n "maxMastersHint" src/` → 3 locale hits + 1 code hit (the `limitHint` const). `git diff --stat src/locales` → exactly 3 files, +1 line each.
      - `rg -n "md-success|md-error-container" src/app/admin/master/calendar/BulkSettingsModal.tsx` → still **exactly three** hits (self-path wash, self-path dot, Action-Overview shifts row), same as round 2's step R4.
    - If any grep contradicts the above, stop and report instead of improvising.

- [x] **Step R3-10: DOX pass.**
  - Files: `src/app/admin/AGENTS.md` (L29, the calendar-conventions bullet)
  - Details: that bullet currently documents round 2's shipped scheme — "working = 6px filled dot in the bottom row (cap 4 + `+`), day off = a 3px strike bar across the cell centre split into one equal segment per off master". Replace **only** that clause with the round-3 contract: working = a 6px filled dot per working master in the bottom row (up to `MAX_TARGET_MASTERS`, no overflow glyph); day off = one 2px full-width line per off master, stacked with 2px gaps at the cell's vertical centre over the date digit (one line per master, never a line split between masters — a segmented bar does not read); and target-master selection is hard-capped at `MAX_TARGET_MASTERS` (exported from `calendar-utils.ts`, currently 5) — the 6th unchecked row is disabled and "Apply to all specialists" is disabled with an `admin.calendar.bulk.maxMastersHint` tooltip whenever the salon has more than 5 masters, which is exactly what bounds both mark rows. Keep everything else in L29 (the file enumeration, the `--md-*-container` convention, the event-tint rule, `.custom-scrollbar`, the hue-encodes-identity/form-encodes-state sentence, the swatch/avatar-ring sentence, the `resolveDayScheduleState` sentence) as-is; extend the `calendar-utils.ts` parenthetical to include `MAX_TARGET_MASTERS`, and add `BulkDayCell.tsx` to the enumeration **only** if step R3-8 actually created it.
  - No other doc changes: no new route, model, nav entry, or test file, so `src/app/api/AGENTS.md`, `prisma/AGENTS.md`, `tests/AGENTS.md` and the root `CLAUDE.md` Child DOX Index stay untouched (state this explicitly at closeout).

## Round 3 acceptance criteria (additions — rounds 1 and 2 still apply, except where round 3 supersedes them)

- [ ] Two masters off the same day render **two separate full-width 2px lines, stacked vertically**, each entirely in one master's colour — no line is ever split between two colours. `rg -n "flex-1" src/app/admin/master/calendar/BulkSettingsModal.tsx` is empty.
- [ ] Five masters off the same day render 5 stacked lines (18px block) that stay inside the 40px cell, do not touch the working-dot row, and leave the date digit readable through the gaps.
- [ ] Line order matches dot order — the same stable name-ascending `targetMasters` order, unchanged from round 2.
- [ ] A day where 3 masters work and 2 are off shows 3 coloured dots at the bottom **and** a 2-line stack at the centre.
- [ ] With 5 masters checked and all working, the dot row shows **5 dots and no `+` glyph**, all inside the cell.
- [ ] Checking a 6th master is impossible: with 5 checked, every unchecked row's checkbox is `disabled`, greyed (`opacity-50 cursor-not-allowed`), and its label carries the `maxMastersHint` tooltip. Unchecking one immediately re-enables the rest.
- [ ] Already-checked rows stay freely uncheckable at the cap (only *unchecked* rows lock).
- [ ] With **more than 5** masters in the salon, "Apply to all specialists" is `disabled` + greyed + tooltipped and never selects anything; with **5 or fewer** it works exactly as before (select all / deselect all).
- [ ] The hint line appears under the checklist exactly when `adminMastersList.length > 5` or 5 are checked, and is absent otherwise.
- [ ] Action Overview "Docelowi specjaliści" is unchanged in code and still correct: "Wszyscy specjaliści" only when the salon has ≤5 masters and all are checked, otherwise the number.
- [ ] `targetMasterIds.size` can never exceed 5 by any route (checkbox, "apply to all", or the `selectedMasterId` seed).
- [ ] Exactly **one** new i18n key (`admin.calendar.bulk.maxMastersHint`) in exactly 3 files, using `{{max}}` and not `{{count}}`; `git diff --stat src/locales` shows 3 files, +1 line each.
- [ ] `MAX_TARGET_MASTERS` is declared once, in `calendar-utils.ts`, and no bare `5`/`4` cap literal survives in the modal's JSX.
- [ ] The day cell is still `h-10 w-full`, the grid still `grid-cols-7 gap-1` with 42 cells, and there is still **no inline `style` on the day `<button>` itself** — only on child line/dot/swatch spans.
- [ ] The master's-own path (`/admin/master/schedule` → Bulk Schedule Edit) is **visually and structurally unchanged**: green `--md-success` dot, `--md-error-container` day-off wash, no master checklist, no cap UI, no tooltip.
- [ ] `BulkSettingsModal.tsx` under 500 lines (report the count; ≈473 expected → extraction fires per step R3-8, and if it does, report both file counts).
- [ ] `npm run lint` zero warnings, `npm run test` green, nothing skipped. No API route, Prisma schema, `MonthView/WeekView/DayView`, `useMasterSchedules.ts`, `ModernCalendar.tsx` or `CalendarToolbar.tsx` file is modified.

## Round 3 constraints & risks

**Must not be touched**
- The `isAdminView === false` rendering output (L192 wash, L200–202 dot) — still completely out of scope, there is no master-selection concept there.
- `dayMarks` / `DayMark` (except the mechanical move in step R3-8's conditional extraction) / `targetMasters` / `useMasterSchedules.ts` / `resolveDayScheduleState` / the cell `title` builder.
- `handleSave`, `onSave`'s signature, `ModernCalendar.saveBulkOverrides`, the Apply button's `disabled` expression, and the Action-Overview panel.
- Round 1's sub-tasks B and C (page title, toolbar rows) and round 2's checklist colour swatch.
- `src/app/api/**`, `prisma/**`, `MonthView.tsx` / `WeekView.tsx` / `DayView.tsx`, `MastersClient.tsx`.
- The modal's layout skeleton: cell size, `grid-cols-7 gap-1`, the 42-day padding, the `max-h-[160px]` checklist scroll box, the right pane's width.
- `src/locales/**` beyond the single `maxMastersHint` key in the three files (no reordering, no reformatting, no deleting round 1's orphaned `scheduleAndCalendarTitle`/`Desc`).

**Do not run**
- `npm run dev`, any long-running server, or `npm run build` — the user's dev server is live and a concurrent build corrupts `.next/`. Verification is `npm run lint` + `npm run test` + the step R3-9 greps only. No browser tool; the user verifies from screenshots.

**Risks**
1. **2px lines on low-DPI displays.** A 2px CSS line is safe (it is not a hairline), but the 2px *gaps* are what carry the "N separate marks" reading — if a browser/zoom level rounds them down, the stack can still merge visually at N≥4. Zoom-independent mitigation is not available without growing the cell; accepted, and judgment call #2's `gap-[1px]`-at-N≥4 escalation is explicitly the *wrong* direction if this happens (the fix would be fewer masters, which the cap already encourages).
2. **Selected-cell plate aesthetics (R3-D).** The light plate is a new visual element that only appears on selected all-off days; the user may read it as a "highlight box". Fallback is spelled out in judgment call #5 — one class-string change, no logic.
3. **Digit legibility at N=5** — the round's main subjective risk. Geometry says ~60% of the glyph stays visible; screenshots will settle it. Do not pre-emptively soften it.
4. **The dot-cap change is coupled to the selection cap.** Deleting the `+` glyph is only safe while `MAX_TARGET_MASTERS ≤ 5` *and* the checkbox-level enforcement holds. If a reviewer removes either the `disabled` attributes or the `toggleMaster` guard, the dot row silently overflows the cell. Both must land together.
5. **Salons with many masters lose "apply to all" entirely.** With 8 masters an admin must now run two bulk edits (5 + 3). That is the user's explicit decision, not an oversight — but it is a real workflow regression for large salons, so the hint copy is the only thing telling them why. Do not soften it into "selects the first 5".
6. **Cap is client-side only.** A crafted request can still target more than 5 masters; the API is deliberately unchanged. Note it at closeout; do not fix it in this round.
7. **First new i18n key in this workstream.** All three locale files must get it, with matching indentation and a valid trailing comma — a JSON syntax slip here breaks every admin screen at runtime, and `tsc`/`lint` will not catch it. Verify by eye and via `git diff src/locales`.
8. **Extraction risk (step R3-8).** If the file crosses 470 and `BulkDayCell.tsx` is created, the danger is class-string drift during the move and an accidental circular import. It must be a pure move: no renamed classes, no re-ordered JSX, no hook inside the child, and the child importing only from `date-fns` and `calendar-utils.ts`.

## Round 3 manual verification for the user (RU, short)

1. `/admin/calendar` → «Все мастера» → «Массовое редактирование графика». В списке «Zastosuj do specjalistów» отметить **двух** мастеров, у которых один и тот же выходной (в тестовых данных — воскресенья): в дне должны быть **две отдельные тонкие полоски, одна под другой**, каждая целиком своего цвета (одна зелёная, одна фиолетовая). Половинчатой полосы «слева зелёное / справа фиолетовое» быть не должно.
2. Дата под полосками должна оставаться читаемой — полоски перечёркивают цифру, но не закрашивают её.
3. Если у мастеров разные состояния в один день (один работает, другой отдыхает) — внизу точка работающего, по центру полоска отдыхающего, как и раньше.
4. Отметить **5 мастеров** (если их столько есть): на дне, где все 5 выходные — 5 полосок друг под другом, всё внутри клетки, точки внизу не задеты. На дне, где все 5 работают — **5 точек в ряд, без значка «+»**.
5. Попробовать отметить **6-го** мастера: галочка должна быть неактивной (серой), при наведении — подсказка «Maksymalnie 5 specjalistów jednocześnie». Под списком — та же подсказка текстом.
6. Снять одну галочку из пяти → остальные снова становятся активными и 6-го можно отметить (в пределах 5).
7. Уже отмеченного мастера при 5 отмеченных **можно** снять в любой момент — блокируются только неотмеченные.
8. Если в салоне **больше 5** мастеров: чекбокс «Zastosuj do wszystkich specjalistów» должен быть неактивным и серым, с подсказкой, и ничего не выделять при клике. Если мастеров **5 или меньше** — работает как раньше (отметить всех / снять всех).
9. В сводке справа «Docelowi specjaliści»: «Wszyscy specjaliści» показывается только когда в салоне ≤5 мастеров и отмечены все; при большем количестве мастеров там просто число (максимум 5).
10. Кликнуть по дню с полосками, чтобы он стал выбранным (фиолетовый фон): полоски должны остаться видимыми (появится светлая подложка под ними).
11. `/admin/master/schedule` (вход мастером) → «Массовое редактирование графика»: всё как было — зелёная точка на рабочих днях, красная заливка на выходных, никакого списка мастеров и никаких ограничений.
