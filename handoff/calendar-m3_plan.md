# Stage 3 — Calendar Visual Restyle (M3 tonal, warm-rose)

**STATUS: approved by user 2026-07-05, implementation starting now.**

## Context

Continuing the Somique Beauty Design System alignment initiative (admin panel first, per [[project_m3_redesign_scope]]). Stage 1 (sidebar/topbar) and Stage 2 (dashboard) are done and user-approved. This is Stage 3: restyle the shared calendar component system (`ModernCalendar.tsx` + `WeekView`/`DayView`/`MonthView`) to match `Somique Beauty Design System/ui_kits/admin/CalendarPage.jsx`'s tonal M3 look, **without touching any interactive/data logic** — styling-only changes, given the user's trust is currently low after a runtime bug shipped in Stage 2 (a Server Component called a function exported from a `"use client"` file). All 7 calendar files are already confirmed `"use client"`, so that specific bug class doesn't apply here, but the plan still emphasizes minimal-touch, className/style-value-only edits.

## Two corrections made during research (do not re-litigate, already verified against source)

- **`availableSlotColor`/`dayOffColor` are NOT dead generic defaults — they're live, real `TenantConfig` DB fields** (`prisma/schema.prisma`, exposed as color pickers in `src/app/admin/settings/SettingsForm.tsx:355-362`, already correctly wired in `master/schedule/page.tsx`). Do NOT rewire them to `--md-success`/`--md-error` CSS vars — only update the two literal hex **defaults** (`#22c55e`→`#21A67A`, `#ef4444`→`#BA1A1A`, matching the M3 token's light-mode hex) since every consumer does `color + '40'`-style hex+alpha string concatenation, which breaks silently (browser-only, not caught by build) if given a `var(...)` string instead of a literal hex.
- **Mockup's master-filter chips use `border-radius: 8` (rounded-lg), not pill** — verified directly from `CalendarPage.jsx` source. Only the "+ New" FAB and the segmented view-toggle get pill treatment.

## Approach

### 1. `ModernCalendar.tsx` (387 lines)
- Prop defaults: `availableSlotColor = "#22c55e"` → `"#21A67A"`; `dayOffColor = "#ef4444"` → `"#BA1A1A"`.
- Emoji → Lucide icons: add `Globe, User` to existing `lucide-react` import. Three spots (dropdown trigger label, "All Masters (Combined)" row, per-master row) — wrap label in `<span className="flex items-center gap-1.5"><Globe/User className="w-3.5 h-3.5"/>text</span>`, replacing the 🌐/👤 emoji.
- Month/Week/Day segmented toggle: wrapper `"flex rounded-md border border-border bg-transparent"` → `"flex rounded-full border border-border bg-transparent p-0.5 gap-0.5"`; drop the per-index corner/divider className logic (and the now-unused `idx` param, to avoid an ESLint unused-var failure); every button gets static `rounded-full`; active branch gets `shadow-sm` added.
- Master dropdown panel: emoji swap only, leave `bg-primary/20 text-primary` active-row and `custom-scrollbar` as-is.
- Net line delta ~0 (value substitutions only).

### 2. `WeekView.tsx` (443), `DayView.tsx` (407), `MonthView.tsx` (292)
Styling-value substitutions only — no JSX restructuring, no handler/state changes, no new elements.

**Rule 1 — hardcoded red/green pills → M3 container tokens** (mirrors `badge.tsx`'s existing `success`/`destructive` variants):
- `bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400` → `bg-[var(--md-error-container)] text-[var(--md-on-error-container)]` (WeekView:186,241; DayView:182; MonthView:233,274); paired `hover:bg-red-200` → `hover:brightness-95`.
- Plain `text-red-400`/`text-red-500 dark:text-red-400` (MonthView:155, DayView:145) → `text-destructive` (registered Tailwind key).
- `bg-green-500/20 text-green-600 dark:text-green-400` / `bg-green-500/10 border border-green-500/30 ... text-green-600 dark:text-green-400` → `bg-[var(--md-success-container)] text-[var(--md-on-success-container)]` (WeekView:188; MonthView:250-254, drop the border utility); paired hover → `hover:brightness-95`.
- Note for QA: `--md-success-container` has no `.dark` override in `m3-tokens.css` (pre-existing, same as `badge.tsx`'s `success` variant already ships with) — expected, not a new bug.

**Rule 2 — appointment/event blocks: solid 80%-alpha fill + white text → soft tonal tint + dark text + left accent border** (matches mockup: `bg:#FFD9DC, borderLeft:3px solid #8B4A58`; also safer for arbitrary admin-picked master colors than forced white text):
| File:Line | Change |
|---|---|
| WeekView:376-377, 416-417 | drop `text-white` → add `text-foreground`; `ring-green-500/50`→`ring-primary/40`; `color+"CC"`→`color+"26"`; replace `borderColor`/`borderWidth:'1px'` with `borderLeft:"3px solid "+color` |
| DayView:306-307 | drop `text-white`→`text-foreground`; `color+"CC"`→`color+"26"`; keep `borderLeftColor:color`, shrink `border-l-4`→`border-l-[3px]` |
| DayView:383-384 | `color+"26"`, `text-foreground`, `borderLeft:"3px solid "+color` |
| MonthView:167-168 | `text-foreground`, `color+"26"`, `borderLeft:"3px solid "+color` |
| MonthView:183-188 | `text-foreground` (label), `text-muted-foreground` (chevron icon), same bg/border swap |

The 2 already-correct dark-text/`bg-card`/colored-border spots (WeekView:403, DayView:352) are left untouched. Same-line bonus: the disconnected `"#166534"` fallback color (8 identical occurrences of `masterProfile?.color ||`, including untouched spots) → `"#8B4A58"` (`--md-primary`), zero extra risk since already on the touched lines.

**Rule 3 — WeekView's available-interval block ignores the `availableSlotColor` prop entirely** (WeekView:324-329, unlike DayView's already-correct inline-style equivalent at DayView:260-266): drop `bg-green-500/10 border-l-4 border-green-500` from className, add `style={{backgroundColor: availableSlotColor+'1A', borderLeftColor: availableSlotColor}}`, shrink `border-l-4`→`border-l-[3px]`.

**Rule 4 — DayView "+ New Booking" CTA** (DayView:200-206): `rounded-md` → `rounded-full` (matches app's pill-CTA language + mockup FAB).

**Explicitly not touched**: the red "now" time-indicator dot/line (`WeekView:352-353`, `DayView:281-282`) — conventional current-time marker, not part of the enumerated mismatches.

Line-count impact: flat or slightly shrinking (no new markup).

### 3. `src/styles/globals.css` — define `.custom-scrollbar`
Referenced 6x across 4 files, defined nowhere (pure no-op today — purely additive fix, cannot regress anything). Add near existing scrollbar-related rules:
```css
.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }
```
Uses the app's own tenant/theme-aware `--border` token instead of the mockup's literal rose RGB.

### 4. Page wrapper files
- **`admin/master/schedule/page.tsx`** (line 21): `rounded-xl` → `rounded-[20px]` only (its `bg-card` already resolves to the mockup's exact `#FFF0F1`). Keep existing `border`/`shadow-sm` (matches this app's own card convention elsewhere, even though the mockup has neither).
- **`admin/calendar/page.tsx`** (lines 35-36) — this is also where the broken negative-margin hack gets resolved: replace `"flex h-[calc(100vh-4rem)] min-h-[600px] overflow-hidden -mx-4 -mt-4 bg-background"` with `"flex h-[calc(100vh-4rem)] min-h-[600px] overflow-hidden bg-card rounded-[20px]"` (drop `-mx-4 -mt-4`/`bg-background`, add `bg-card rounded-[20px]`); drop the now-redundant `border-t border-border` on the inner div (line 36). Result: renders as a rounded `#FFF0F1` card inside the normal `max-w-5xl` column, same contained pattern as `master/schedule/page.tsx`.

**Layout width — deferred, not part of this stage.** `admin/layout.tsx:16`'s shared `<div className="mx-auto max-w-5xl px-6 py-8">` wraps every `/admin/*` page (grep-confirmed only occurrence in the repo). No child can escape a parent's `max-w`+`mx-auto` via negative margins — true full-viewport-width would require moving that wrapper out of the shared layout into each page individually, which touches every admin page's render path. The change above only fixes the *broken* CSS (mismatched negative margins), not the original *goal* (true edge-to-edge). Present this distinction explicitly to the user when reporting Stage 3 results — don't let them think "full width" was achieved if only "no-longer-broken, contained-width" was.

### 5. Modals — deferred entirely this stage
`AppointmentModal.tsx`/`ViewAppointmentModal.tsx`/`BulkSettingsModal.tsx` not touched, to keep blast radius on the grid/view files actually asked for ("calendar grid styling"). Found-but-not-fixed, worth a future pass: `BulkSettingsModal.tsx` has the identical red/green hardcoded pattern (lines 168/177/265/267) and one stray emoji (`👤 {m.name}` line 312).

### Explicitly out of scope (found, flag to user, do not touch)
- `WeekView`/`DayView`/`MonthView`'s inline day-off/shift-edit handlers hardcode `/api/master/schedule/overrides/bulk` regardless of the `apiPrefix` prop — a pre-existing functional bug (admin-view inline edits may hit the wrong endpoint). Unrelated to visual styling.
- Day-status-resolution and overlap-grouping logic duplicated near-identically across all 3 view files — pre-existing architecture debt.
- `src/app/admin/master/schedule/ScheduleManager.tsx` appears unused/dead (not imported by `master/schedule/page.tsx`) — worth double-checking in a future cleanup.

## Order of implementation (lowest-risk/most-isolated first)
1. [x] `src/styles/globals.css` — `.custom-scrollbar` (purely additive).
2. [x] `MonthView.tsx` (smallest file).
3. [x] `DayView.tsx`.
4. [x] `WeekView.tsx` (largest/most edit sites).
5. [x] `ModernCalendar.tsx` (prop defaults, icons, toggle, dropdown) — before step 6, since the page-wrapper fix depends on the new defaults.
6. [x] `admin/calendar/page.tsx` + `admin/master/schedule/page.tsx` (wrapper/radius/prop cleanup, last).
7. [x] `tsc --noEmit` + `lint` + emoji grep run (see Implementation Notes below); `npm run build`/dev server intentionally NOT run by the coder agent, per orchestrator instruction — left to the orchestrator.
8. [x] **Follow-up (post-review gap) — Rule 5 stale literal-hex call-site fallbacks.** Apply the addendum below: swap the remaining old `#22c55e`/`#ef4444` literals for `#21A67A`/`#BA1A1A` at the 3 call sites (`admin/calendar/page.tsx:44-45`, `admin/master/schedule/page.tsx:24-25`, `admin/settings/page.tsx:23-24`), then re-run `tsc --noEmit` + `lint` + the addendum grep.

## Implementation Notes (coder agent, post-implementation)

**Status: all 6 file changes implemented as specified.**

**One minor deviation from literal line-by-line spec (justified):** DayView.tsx had a nested `text-white/80` span (the appointment-status label, inside the same single-appointment block converted by Rule 2's DayView:306-307 entry) that the plan's line-by-line table didn't explicitly list. Since the parent block's text color changed from `text-white` to `text-foreground` (dark-on-light tonal scheme), leaving this nested override as literal white would make the status label nearly invisible — directly contradicting Rule 2's stated purpose. Fixed by changing it to `text-muted-foreground`, mirroring the exact pattern the plan itself specifies for the analogous MonthView:183-188 chevron-icon case (`text-white/80` → muted-foreground treatment). No other nested `text-white` spans were found in the WeekView/DayView blocks — those inherit color from their parent via unstyled child elements plus `opacity-*` utilities, so no other fixes were needed.

**`"#166534"` fallback color:** replaced with `"#8B4A58"` at all 8 occurrences across WeekView.tsx (377×2, 403, 417×2 — counting each `masterProfile?.color || "#166534"` substring), DayView.tsx (307, 352, 384), MonthView.tsx (168, 183), including the two "already-correct, otherwise untouched" spots (WeekView:403, DayView:352) per the plan's explicit "same-line bonus" instruction.

**Verification output:**
- `npx tsc --noEmit` → clean, zero output/errors.
- `npm run lint` → 60 problems (55 errors, 5 warnings), all pre-existing and unrelated to this stage's files (confirmed via `git stash` diff: repo had 61 problems/56 errors before this stage's changes). The one-error delta is a pre-existing WeekView.tsx `'availableSlotColor' is defined but never used` error that got *fixed* as a side effect of implementing Rule 3 (WeekView now actually consumes the prop). Zero new lint errors introduced.
- `grep -rn "🌐\|👤" src/app/admin/master/calendar/` → 1 hit: `BulkSettingsModal.tsx:312` (`👤 {m.name}`). This is the exact stray emoji the plan's "Modals — deferred entirely this stage" section already flagged as found-but-explicitly-out-of-scope; the 4 files this plan actually covers (ModernCalendar/WeekView/DayView/MonthView) are emoji-free.
- `npm run build` — not run, per explicit orchestrator instruction to leave it to the orchestrator.

## Addendum (post-review, 2026-07-05) — Rule 5: stale literal-hex fallbacks at call sites

**Status: DONE (implements Order-of-implementation step 8).** Added after the reviewer flagged a Critical scoping gap in `calendar-m3_feedback.md`.

**Coder verification (2026-07-05):**
- `grep -rn "#22c55e\|#ef4444" src/` → zero hits (confirmed clean after the 3 edits).
- `npx tsc --noEmit` → clean, zero output.
- `npm run lint` → same 60 problems (55 errors, 5 warnings) as documented pre-existing baseline in this plan's Implementation Notes; none in the 3 edited files. Zero new errors/warnings introduced.

**The gap.** Section 1/Section 4 changed `ModernCalendar.tsx`'s prop *defaults* (`#22c55e`→`#21A67A`, `#ef4444`→`#BA1A1A`, now live at `ModernCalendar.tsx:35-36`) but never accounted for the fact that call sites still hardcode the OLD literal hex, which overrides/short-circuits the new defaults and silently defeats the M3 color goal on the exact pages this stage restyles. Re-verified against current source (line numbers re-checked in this session, not trusted from the feedback) — a repo-wide grep confirms these are the **only** 6 remaining occurrences of `#22c55e`/`#ef4444` anywhere under `src/`.

**Constraint (unchanged from the "Two corrections" section) — keep it literal hex, NEVER `var(...)`.** These are real `TenantConfig` DB fields consumed downstream via `color + 'NN'` hex+alpha string concatenation (e.g. `availableSlotColor+'1A'`, `dayOffColor+'40'`). Any `var(...)` substitution breaks that concatenation silently in-browser (not caught by build/tsc). All replacements below are plain value swaps of one literal hex for another.

**Fix — swap every remaining `"#22c55e"`→`"#21A67A"` and `"#ef4444"`→`"#BA1A1A"` at these three spots. Value substitution only — no logic, no structure, no prop rewiring:**

1. `src/app/admin/calendar/page.tsx:44-45` — explicit literal props passed into `<ModernCalendar>` (admin combined-calendar page, a primary consumer; because the props are passed explicitly, `ModernCalendar`'s new default never applies here, so the literal MUST be updated at the call site):
   - `availableSlotColor="#22c55e"` → `availableSlotColor="#21A67A"`
   - `dayOffColor="#ef4444"` → `dayOffColor="#BA1A1A"`
   - Note: deleting these two props to fall through to the new defaults would also work, but updating the literals in place is the lower-risk, minimal-diff choice and keeps this call site shaped like the sibling schedule page. Prefer the literal swap.

2. `src/app/admin/master/schedule/page.tsx:24-25` — DB-field fallback used when the `TenantConfig` value is null/empty:
   - `availableSlotColor={(config as any).availableSlotColor as string || "#22c55e"}` → `... || "#21A67A"}`
   - `dayOffColor={(config as any).dayOffColor as string || "#ef4444"}` → `... || "#BA1A1A"}`

3. `src/app/admin/settings/page.tsx:23-24` — **IN SCOPE (decision below).** The fallback that seeds the `fullConfig` object passed to `<SettingsForm config={fullConfig} />`, which feeds the two color pickers at `SettingsForm.tsx:355-362` (`<ColorRow defaultValue={config.availableSlotColor} />` / `config.dayOffColor`):
   - `availableSlotColor: c.availableSlotColor as string || "#22c55e",` → `... || "#21A67A",`
   - `dayOffColor: c.dayOffColor as string || "#ef4444",` → `... || "#BA1A1A",`

**Decision on `admin/settings/page.tsx` — IN SCOPE for this stage, not deferred.** It is the same stale-hex-fallback pattern feeding the same two DB fields, and it is the most *upstream* (seed) of the three: when the DB field is null and an admin saves the settings form without touching the color, whatever the picker renders as its default becomes the value written back to `TenantConfig`. That written value then flows through `schedule/page.tsx`'s `config.availableSlotColor || ...` (now non-null, so the fallback there no longer fires) and onto the calendar. Fixing only the two calendar call sites while leaving the settings seed stale would let the very next settings-save re-persist the old `#22c55e`/`#ef4444` into the DB and re-defeat the M3 goal. The change is the identical trivial 2-literal substitution with the same near-zero risk, so it belongs in the same atomic follow-up rather than a separate future pass. It stays literal hex — the `ColorRow` only renders the swatch/default, so there is no new var/concat concern introduced.

**Explicitly NOT changed by this addendum:** no `var(...)` anywhere; no rewiring of `availableSlotColor`/`dayOffColor` to `--md-success`/`--md-error`; no other settings/schedule/ModernCalendar logic, markup, or props. Literal-value swaps only, at the 6 lines enumerated above.

**Verification for this addendum:**
- `grep -rn "#22c55e\|#ef4444" src/` → must return **zero** hits after the three edits (these are currently the only 6 occurrences in the repo).
- `npx tsc --noEmit` + `npm run lint` → no new errors/warnings (pure string-literal changes).
- Manual: with `TenantConfig.availableSlotColor`/`dayOffColor` empty/null, confirm both `/admin/calendar` and `/admin/master/schedule` render the M3 tonal green/red (`#21A67A`/`#BA1A1A`), and the `/admin/settings` "Calendar Settings" color pickers show `#21A67A`/`#BA1A1A` as their default swatches.

## Verification

**Automated (one-shot only — do NOT start a dev server, per standing rule):**
- `npx tsc --noEmit`
- `npm run lint` (repo runs with `--max-warnings=0`)
- `npm run build` (also re-runs lint + type-check repo-wide; all 7 calendar files are confirmed `"use client"` so the prior Server/Client boundary bug class doesn't apply here, but this is still the standard one-shot gate)
- `grep -rn "🌐\|👤" src/app/admin/master/calendar/` — should return zero results after the icon swap

**Manual in-browser checklist** (both `/admin/calendar` and `/admin/master/schedule`, user to run after we resume):
- [ ] All 3 view modes render on both pages, light mode, then repeat in dark mode.
- [ ] Dark mode specifically: new rounded segmented-toggle active pill; success/error container pills (day-off/shift badges) vs. existing `Badge` component elsewhere for consistency; appointment-block tint is subtler but left-border still clearly differentiates masters (expected trade-off).
- [ ] Admin view (`/admin/calendar`) master-filter dropdown: emoji gone, `Globe`/`User` icons render, filtering still works (behavior unchanged).
- [ ] Appointment-block legibility with a **light/pastel** master color specifically (edit a master's color to e.g. `#FDE68A`, confirm tonal-tint+dark-text stays readable — the scenario the old white-text-on-solid-fill approach would've broken).
- [ ] `.custom-scrollbar` renders (thin 5px thumb) in master-filter dropdown panel and Week/Day scroll areas, both themes.
- [ ] `admin/calendar/page.tsx` renders as a rounded card within normal column width — no full-bleed, no broken-margin artifact even at wide viewport.
- [ ] Edit-mode day-off/shift toggling on Week/Month still works end-to-end (functional smoke test riding on the style change).
- [ ] Note to user: the pre-existing `apiPrefix` bug in inline day-off editors is still present, unaffected either way — informational only.

### Critical files
- `src/app/admin/master/calendar/ModernCalendar.tsx`
- `src/app/admin/master/calendar/WeekView.tsx`
- `src/app/admin/master/calendar/DayView.tsx`
- `src/app/admin/master/calendar/MonthView.tsx`
- `src/styles/globals.css`
- `src/app/admin/calendar/page.tsx`
- `src/app/admin/master/schedule/page.tsx`
- `src/app/admin/settings/page.tsx` (addendum / Rule 5 only)
