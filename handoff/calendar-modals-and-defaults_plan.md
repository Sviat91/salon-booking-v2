# Calendar modals cleanup + darkCardColor default fix

**STATUS: implemented 2026-07-05. All Part A and Part B changes applied; tsc/lint/build verified; emoji grep returns zero results.**

## Context

Two unrelated fixes bundled together per user request in the same session as the Stage 3 calendar restyle:

1. Finish the "found but deferred" cleanup flagged during Stage 3: 3 calendar modals (`AppointmentModal`/`ViewAppointmentModal`/`BulkSettingsModal`) still have hardcoded Tailwind `red-*`/`green-*` colors and stray emoji, unlike the already-restyled `WeekView`/`DayView`/`MonthView`/`ModernCalendar`.
2. Fix a wrong default value: `darkCardColor`'s default (used by the Settings page's "Reset to M3 defaults" button, and to auto-seed a brand-new `TenantConfig` row) is `#211A1B`, but the user determined (by testing in their own live tenant settings) that `#22160f` matches the actual design mockup and looks correct. This must stay a **default**, not a hardcoded value — the color picker/customization mechanism is untouched, only the default value changes.

## Part A — darkCardColor default fix

Two files hold this default (confirmed identical value `#211A1B` in both, both wrong):

- `src/lib/tenant.ts:18` — `DEFAULT_CONFIG.darkCardColor` — used to auto-seed a new `TenantConfig` DB row when none exists yet (fresh install).
- `src/app/admin/settings/SettingsForm.tsx:24` — `M3_DARK_DEFAULTS.darkCardColor` — used by the "Reset to M3 defaults" button in the Settings UI (dark theme section).

Change both: `'#211A1B'` → `'#22160f'`. Do not touch anything else in either file — the customization mechanism (color picker, save action, per-tenant override) is correct and untouched; only the default hex value changes.

**Not in scope**: `prisma/schema.prisma:197` has `darkCardColor String @default("#2A2A2A")` — a THIRD, differently-wrong value. This is dead code in practice: `getTenantConfig()` in `tenant.ts` always explicitly passes the full `DEFAULT_CONFIG` object when creating a new row, so this raw DB-column default is never actually read by the app. Changing it would require a Prisma migration for zero functional benefit — skip it, mention it exists as a harmless pre-existing inconsistency in the final report.

## Part B — Calendar modals cleanup

Apply the exact same M3-token substitution pattern already used and approved in `WeekView.tsx`/`DayView.tsx`/`MonthView.tsx` this session (see `src/app/admin/AGENTS.md`'s documented convention: raw `--md-*-container` for pill/badge backgrounds, `text-destructive` for plain destructive text since it's a registered Tailwind key mapped to the tenant-customizable `--color-error`, `--md-success`/`--md-success-container` arbitrary-value syntax for success since no `success` Tailwind key is registered).

### `src/app/admin/master/calendar/BulkSettingsModal.tsx`

Add `Users, Clock, User` to the existing `lucide-react` import (currently `ChevronLeft, ChevronRight, X, Plus, Trash2, Info`).

1. **Line 168** (day-off cell background in the date-picker grid — pill/background context, mirrors Rule 1 from the Stage 3 plan):
   `"text-red-500 bg-red-500/10 hover:bg-red-500/15 border-red-500/30"` → `"text-[var(--md-on-error-container)] bg-[var(--md-error-container)] hover:brightness-95"` (drop the border accent — no border was used in the Week/Day/Month Rule 1 precedent either).

2. **Line 177** (tiny solid status dot, 6px — NOT a pill background, needs the vivid/solid token not the pale container token or it'll be invisible at that size):
   `"bg-green-500"` → `"bg-[var(--md-success)]"`.

3. **Line 265** (plain destructive text + inline dot in the legend — mirrors Rule 1's "plain text → `text-destructive`" precedent exactly, e.g. `MonthView:155`):
   `<span className="text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Day Off</span>`
   → `<span className="text-destructive flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive"></span> Day Off</span>`

4. **Line 267** (plain success text + inline dot — no registered `text-success`/`bg-success` Tailwind key exists, so use the arbitrary-value M3 solid token directly, same as line 177):
   `<span className="text-green-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {intervals.length} Shift{intervals.length !== 1 ? 's' : ''}</span>`
   → `<span className="text-[var(--md-success)] flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--md-success)]"></span> {intervals.length} Shift{intervals.length !== 1 ? 's' : ''}</span>`

5. **Line 290** (section header emoji, not previously flagged but same category as the fix below): `🏢 Apply To Masters` → replace the emoji with a `Users` icon:
   `<span className="text-sm font-semibold flex items-center gap-2">🏢 Apply To Masters</span>` → `<span className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Apply To Masters</span>`

6. **Line 312** (per-master row emoji, the one already flagged in Stage 3 — matches `ModernCalendar.tsx`'s exact existing per-master-row pattern):
   `<span>👤 {m.name}</span>` → `<span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{m.name}</span>`

7. **Line 322** (section header emoji, not previously flagged, same category): `🕒 Schedule Configuration` → replace with `Clock` icon:
   `<span className="text-sm font-semibold flex items-center gap-2">🕒 Schedule Configuration</span>` → `<span className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Schedule Configuration</span>`

8. **Line 333** (plain destructive text label — same `text-destructive` precedent as line 265):
   `<span className="font-semibold text-red-500">Mark as Day Off</span>` → `<span className="font-semibold text-destructive">Mark as Day Off</span>`

### `src/app/admin/master/calendar/ViewAppointmentModal.tsx`

**Line 119**: the Delete button already has `variant="destructive"` applied (which already correctly uses the design system's destructive color via `button.tsx`'s cva variant), but a redundant hardcoded className overrides it:
```
<Button 
  variant="destructive" 
  className="flex-1 gap-2 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border-none shadow-none" 
```
Fix: remove the hardcoded color/border/shadow overrides, keep only the layout utilities:
```
<Button 
  variant="destructive" 
  className="flex-1 gap-2" 
```
No other change needed — `variant="destructive"` alone now renders correctly per the button component's own (already-correct) styling.

### `src/app/admin/master/calendar/AppointmentModal.tsx`

**No changes** — checked, already clean, no hardcoded red/green or emoji found.

## Explicitly not touched
- No logic/handler/state changes anywhere — this is styling-value and emoji-to-icon substitutions only, exactly like the Stage 3 pattern.
- `prisma/schema.prisma`'s stale `#2A2A2A` default (see Part A note above).

## Verification
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `grep -rn "🏢\|🕒\|👤\|🌐" src/app/admin/master/calendar/` — should return zero results after this pass (previously only `BulkSettingsModal.tsx:312` had a hit).
- Manual (user, in-browser): open "Bulk Settings" modal, verify day-off cells/dots/legend use the softer M3 tones (not bright red/green) and icons instead of emoji; open an appointment and click "Delete", verify the button still looks properly destructive-styled (just via the variant, not hardcoded); go to Settings → dark theme section → click "Reset to M3 defaults" and confirm "Dark Card" picker shows `#22160f`.

### Critical files
- `src/lib/tenant.ts`
- `src/app/admin/settings/SettingsForm.tsx`
- `src/app/admin/master/calendar/BulkSettingsModal.tsx`
- `src/app/admin/master/calendar/ViewAppointmentModal.tsx`
