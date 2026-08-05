# Review: master-calendar-bulk-header

**Date:** 2026-08-05
**Verdict:** APPROVED

## Critical/Architectural Issues
(none found)

## Minor/Syntax Issues
(none found)

## Passed Checks
- [x] **Refetch-loop guard** (`src/app/admin/master/calendar/useMasterSchedules.ts:17-62`) — `idsKey`/`monthKey` are computed as plain strings every render, and the effect's dependency array is `[idsKey, monthKey, enabled, apiPrefix, reloadKey]` — never the raw `masterIds` array or `month` Date object.
- [x] **Stale-response guard** — `cancelled` flag set in the effect, checked before `setSchedules(next)`, cleanup sets `cancelled = true`. `schedules` is replaced wholesale, so unchecking a master correctly drops its dots.
- [x] **Non-admin path pixel-identical** — `fetchMonthOverrides` early-returns when `isAdminView`; `dayMarks()` for `!isAdminView` uses `monthOverrides`/`templates` (existing self-fetched state), not the new hook's data. `useMasterSchedules` is internally gated by `enabled: isAdminView`, firing no request in the non-admin path.
- [x] **Single-vs-multi dot behavior** — 0/1 checked master keeps old green-dot/red-cell rendering; 2+ renders per-master colored dots (circle=working/square=dayoff, cap 4 + "+"), red cell wash correctly dropped in the 2+ case.
- [x] **Type widening** — `AdminMasterListItem` threaded cleanly through `ModernCalendar.tsx` → `CalendarToolbar.tsx` → `MasterSelectDropdown.tsx` → `BulkSettingsModal.tsx` → `admin/calendar/page.tsx`, zero mapping code, zero remaining narrow literals. `AppointmentModal.tsx`'s local `masters` state confirmed genuinely separate/unrelated.
- [x] **CalendarToolbar restructure** — Month/Week/Day toggle moved verbatim into row 1's right cluster; dangling second divider removed from row 2; `if (isMobile)` branch untouched.
- [x] **page.tsx (sub-task B)** — `getServerT`/`t` import fully removed; JSX matches `admin/calendar/page.tsx`'s container pattern; all `(config as any)` prop casts preserved byte-for-byte.
- [x] **Line limits** — `BulkSettingsModal.tsx` 441, `CalendarToolbar.tsx` 219, `ModernCalendar.tsx` 329, `MasterSelectDropdown.tsx` 119, `calendar-utils.ts` 61, `useMasterSchedules.ts` 65. All under 500.
- [x] **Lint** — new `react-hooks/exhaustive-deps` "rule not found" error on `useMasterSchedules.ts` mirrors the pre-existing broken plugin-registration issue already present twice in `ModernCalendar.tsx` (orchestrator-confirmed via `npm run lint` diff against baseline: 45→46 problems, the +1 being exactly this). Not a new category of problem.
- [x] Pure resolver `resolveDayScheduleState` implements the override-beats-template precedence exactly; new test file covers all 8 specified cases with no mocks.
- [x] DOX updates in `src/app/admin/AGENTS.md` and `tests/AGENTS.md` accurate.
- [x] No API route added/renamed/changed; no locale file touched; all "must not touch" constraints respected.

## Summary
Implementation matches the plan with high fidelity across every high-risk area. `npm run test` (34 files / 299 tests) and `npm run lint` (46 problems, baseline was 45, +1 expected pre-existing-pattern repeat) both verified directly by the orchestrator. No issues found. Manual visual verification by the user is the remaining step (dots in Bulk Editor, header removal on `/admin/master/schedule`, toolbar wrapping at 1024-1440px).

## Round 2 Review

**Date:** 2026-08-05
**Verdict:** APPROVED

### Critical/Architectural Issues
(none found)

### Minor/Syntax Issues
(none found)

### Passed Checks
- [x] Branch is strictly on `isAdminView` (`selfMark`/`workingMarks`/`offMarks`, BulkSettingsModal.tsx:179-181) — `singleMark` fully removed, zero hits repo-wide.
- [x] No inline `style` on the day `<button>` itself — only on child dot/bar/swatch `<span>` elements (lines 211, 222, 363); `bg-primary`/today-ring classes on the button are unaffected.
- [x] Day-off strike bar (lines 219-225): positioned `top-1/2 -translate-y-1/2` over the date digit, `flex-1` per-off-master segments each with their own `backgroundColor`, no cap (matches plan spec — bar intentionally has no cap unlike the dot row).
- [x] Working-dot row (lines 205-216) unchanged from round 1 except keyed off `workingMarks`; cap-4 + "+" glyph intact.
- [x] Self path (`isAdminView === false`) pixel-identical to pre-round-2: `--md-error-container` wash (line 192) and `--md-success` dot (line 201) preserved verbatim, no swatch/bar/tooltip reachable.
- [x] Checklist swatch (R1, lines 362-365): filled circle in `m.masterProfile?.color || "#166534"`, `ring-1 ring-border`, checkbox behavior untouched.
- [x] Tooltip (line 189) gated on `isAdminView && !isDisabled && marks.length > 0`, uses existing `admin.calendar.workingBtn`/`dayOffBtn` i18n keys (confirmed present in pl.json:177/183); no locale files touched.
- [x] Line count: 460 lines, under the 470 extraction trigger and 500 hard limit.
- [x] `src/app/admin/AGENTS.md` L29 rewritten to describe the round-2 path-based contract; no leftover mention of round-1's count-based/square-dot scheme.
- [x] Ripple grep clean: `singleMark`, `rounded-\[1px\]`, `marks.length >= 2` all zero matches in `src/`; `md-success`/`md-error-container` in BulkSettingsModal.tsx appear at exactly 3 sites (192, 201, 317), all self-path/Action-Overview, none in admin-view mark rendering.
- [x] `npm run lint` (46 problems, unchanged from post-round-1 baseline) and the new-relevant test file (`calendar-utils.test.ts`, 8/8 passing) independently re-verified by the orchestrator.

### Summary
Round 2's implementation matches the plan precisely across every load-bearing check: the rendering split is genuinely by view path (not mark count), the self path is byte-identical to its pre-round-2 form, the new strike-bar/dot/swatch mechanisms use only child-element inline styles (preserving `bg-primary`/today-ring on the button), and the DOX doc was updated to match. No new i18n keys, no API/Prisma/locale changes, file stays well under the line budget. Remaining step is the user's manual visual verification per the plan's RU checklist.

## Round 3 Review

**Date:** 2026-08-05
**Verdict:** APPROVED

### Critical/Architectural Issues
(none found)

### Minor/Syntax Issues
(none found)

### Passed Checks
- [x] **Cap enforcement is real** (`BulkSettingsModal.tsx` `toggleMaster`/`toggleAllMasters`) — both guards live in the state mutators (`newSet.size >= MAX_TARGET_MASTERS return`, `!canApplyToAll return`), not only in JSX `disabled`.
- [x] **Stacked lines, not a split bar** (`BulkDayCell.tsx`) — `flex flex-col gap-[2px]` of individual `h-[2px]` full-width spans, each own `backgroundColor`. No `flex-1` in the day-off code; repo-wide `flex-1` hits are all unrelated pre-existing layout panes.
- [x] **No inline `style` on the day `<button>`** — only on child dot/line/swatch spans.
- [x] **Working-dot cap raised to 5, `+` glyph deleted** — `slice(0, MAX_TARGET_MASTERS)`; zero hits for `> 4 &&` / `slice(0, 4)`.
- [x] **`MAX_TARGET_MASTERS` single source of truth** — declared once in `calendar-utils.ts`, imported everywhere used, no bare literal cap left.
- [x] **`BulkDayCell.tsx` extraction is clean** — no hooks, `title` arrives pre-built as a prop, imports only `date-fns`/`calendar-utils.ts` (no circular import from `BulkSettingsModal.tsx`), `DayMark` type exported from and imported from the new file.
- [x] **Self path (`isAdminView === false`) untouched** — byte-identical green dot / red wash, gated purely on `selfMark`.
- [x] **i18n**: `admin.calendar.bulk.maxMastersHint` present in all three locales with `{{max}}` (not `{{count}}`), the only new key.
- [x] **Selected-cell backing plate** for the line stack (`rounded-[3px] bg-primary-foreground/85 p-[1px]`) present as specified.
- [x] **Line budget**: `BulkSettingsModal.tsx` 441, `BulkDayCell.tsx` 64 — both well under 500.
- [x] `src/app/admin/AGENTS.md` L29 describes the round-3 contract accurately, lists `BulkDayCell.tsx`.
- [x] Ripple checks clean: `slice(0,4)`, `> 4 &&`, `h-[3px]`, `singleMark`, `rounded-[1px]` all zero; `md-success`/`md-error-container` exactly 3 combined hits across both files, all self-path/overview.
- [x] `npm run lint` (46 problems, unchanged baseline) and `npm run test` (299/299 passing) independently re-verified by the orchestrator.

### Summary
Round 3 fixes both reported issues cleanly: day-off is now one full-width colored line per off-master (stacked, not a split segment), and target-master selection is hard-capped at 5 with real state-level enforcement plus a clear disabled/tooltip signal. The 470-line trigger fired as anticipated, producing a clean, hook-free `BulkDayCell.tsx` extraction with no circular imports. Self-path rendering remains byte-identical throughout. No issues found; ready for the user's manual visual verification.
