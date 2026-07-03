# Stage 2 — Admin Dashboard M3 Alignment

## Context

The user's overarching goal (stated directly, not just inferred): bring the **whole admin panel** visually in line with the `Somique Beauty Design System/` reference — whatever exists there, build to match it; whatever doesn't exist there, extend it in the same style so the app feels cohesive. Existing tenant theming (background/colors/logo, customizable via the admin Settings panel through `TenantConfig`) must keep working exactly as before.

Stage 1 (sidebar collapse + TopBar) is done and approved. This is **Stage 2: the two admin dashboard pages** (`/admin` for SUPERADMIN/ADMIN, `/admin/master` for MASTER), matching them to the reference's `DashPage` (`Somique Beauty Design System/ui_kits/admin/index.html` / `DashboardPage.jsx`): 4 tonal M3 stat cards + a "Today's appointments" table with master-name pills and status-dot badges. Per the user's standing preference, this is a single self-contained stage — Calendar/Services/Masters/Settings pages are separate future stages, out of scope here.

The two dashboards currently diverge significantly: `admin/page.tsx` shows all-time totals in plain white cards with icons and has no appointments table at all; `admin/master/page.tsx` shows hand-rolled (non-`Card`) stat divs and a real, interactive `AppointmentsList` (cancel button + confirm dialog) styled with hardcoded, non-theme Tailwind colors. Both need to converge on the same tonal-card visual language without losing `AppointmentsList`'s real functionality.

## Key findings from research

- **Reusable primitives already exist** — don't reinvent: `src/components/ui/card.tsx` (generic Card), `src/components/ui/badge.tsx` (has `success`/`warning`/`destructive` variants using `--md-success-container`/`--md-tertiary-container`/`--md-error-container` — an exact match for the mockup's status-chip colors).
- **`bg-secondary`, `bg-muted`, and `bg-accent` all key off the same single tenant field** (`--color-primary` in `src/styles/globals.css`) — they only differ in their fallback constant. So building the 4 stat cards on top of tenant-customizable tokens would make 3 of them collapse to an identical color the moment a tenant changes their primary brand color. **Decision: use the raw `--md-primary-container` / `--md-secondary-container` / `--md-tertiary-container` / `--md-surface-container-high` vars directly** (light/dark aware, fixed across tenants) — exactly the same pattern `badge.tsx` already uses for status colors. This is a pre-existing, accepted tradeoff in the codebase, not a new one.
- **`src/styles/m3-tokens.css`'s `.dark` block is missing `--md-tertiary`, `--md-on-tertiary`, `--md-tertiary-container`, `--md-on-tertiary-container`, `--md-error-container`, `--md-on-error-container`.** Verified against the reference `Somique Beauty Design System/colors_and_type.css` — without these, dark mode falls back to the *light-mode* amber/red values (bright card + near-black text in an otherwise-dark UI). This affects the new Revenue stat card and every "Pending"/error badge, including the pre-existing `badge.tsx` `warning`/`destructive` variants used elsewhere today (e.g. `GdprTable.tsx`). Fixing it is a pure CSS-token addition, not a schema/TenantConfig change.
- **The admin dashboard's "Revenue" figure is dead code today** — verified via grep: no route anywhere ever sets an appointment's `status` to `"COMPLETED"` (only `"PENDING"` → `"CONFIRMED"` → `"CANCELLED"`/`"CANCELLED_BY_MASTER"` occur). The current `where: { status: "COMPLETED" }` filter means Revenue always shows `0 zł`. **Flagging explicitly**: this stage will change the filter to `status: { notIn: ["CANCELLED", "CANCELLED_BY_MASTER"] }` so the number is actually meaningful — a small behavior change beyond pure restyling, called out for visibility rather than silently changed.
- **No shared `Table` primitive exists.** The closest precedent is `src/app/admin/database/gdpr/GdprTable.tsx`'s hand-rolled table styling — the new table will follow that same pattern rather than introducing a new primitive.

## Approach

### 1. `src/styles/m3-tokens.css` — add missing dark-mode tokens
Append to the existing `.dark { ... }` block (values copied verbatim from the reference `colors_and_type.css`, not invented):
```css
--md-tertiary: #FFBA3F;
--md-on-tertiary: #412D00;
--md-tertiary-container: #5E4200;
--md-on-tertiary-container: #FFDFA3;
--md-error-container: #93000A;
--md-on-error-container: #FFDAD6;
```

### 2. `src/components/ui/badge.tsx` — add one variant
Add `accent: "bg-accent text-accent-foreground"` to the existing `cva` variants, for the master-name pill (no existing variant maps to `bg-accent`).

### 3. `src/components/admin/StatCard.tsx` (new)
Presentational component (no `"use client"` needed), shared by both dashboard pages. Props: `label`, `value`, `sub?`, `tone: "primary" | "secondary" | "tertiary" | "surface-high"`. Maps `tone` to the matching raw `--md-*-container`/`--md-on-*-container` pair via Tailwind arbitrary values. `rounded-2xl`, flat (no shadow/border), matching the mockup exactly — built standalone rather than wrapping the generic `Card` (whose base classes impose `bg-card`/`shadow-sm`/`ring-1`, which the mockup's flat tonal cards don't have).

### 4. `src/components/admin/AppointmentStatusBadge.tsx` (new)
Shared status → visual mapping, used by both the new table and `AppointmentsList.tsx` (replacing its hand-rolled `getStatusColor()`), so the mapping isn't duplicated:
```
PENDING              → variant="warning",     "Pending"
CONFIRMED            → variant="success",     "Confirmed"
CANCELLED / CANCELLED_BY_MASTER (startsWith)  → variant="destructive", "Cancelled"
fallback (e.g. COMPLETED) → variant="muted",  status text
```
Includes a small leading dot colored via the matching solid `--md-success`/`--md-tertiary`/`--md-error` var, matching the mockup's status pills.

### 5. `src/app/admin/TodaysAppointmentsTable.tsx` (new)
Receives `appointments` as a prop (Prisma query stays in `page.tsx`, matching the existing convention — `admin/master/page.tsx` fetches and passes to `AppointmentsList` the same way). Renders a `rounded-2xl border border-border bg-card` wrapper, header row ("Today's appointments" + "`N` total"), then a table: Time / Client / Service / Master (`Badge variant="accent"`) / Price / Status (`AppointmentStatusBadge`). Empty state reuses the existing dashed-border "No appointments" pattern.

### 6. `src/app/admin/page.tsx` — rewrite
- Replace `getStats()` with: today's appointments (full objects, for stat sub-caption + table, **all statuses**, matching the mockup's own count-includes-cancelled behavior), this-week count + last-week count (delta), this-month revenue using the corrected status filter, and masters list (id + name, for the "Olga · Yuliia"-style sub-caption).
- Replace the icon-card stat grid with 4 `<StatCard tone=... />`.
- Replace `<h1>Dashboard</h1>` + description with an uppercase "Overview" label + date subtitle (mirrors the mockup, and removes duplication with `AdminTopBar`'s already-rendered page title — the exact overlap flagged as a cleanup candidate in the Stage 1 handoff notes).
- Add `<TodaysAppointmentsTable appointments={...} />` below the stat cards.
- **Drop "System Status"** (hardcoded fake "Database connected"/"Auth active" dots — not in the mockup, not backed by any real check, net UX negative).
- **Keep "Quick Actions"**, moved below the table, restyled as pill buttons via `Link` + `buttonVariants({variant: "outline"})` instead of plain arrow-prefixed text links.
- Drop now-unused `lucide-react` stat-icon imports.

### 7. `src/app/admin/master/page.tsx` — restyle only
- Keep existing Prisma queries unchanged (visual-only for this page — don't touch working query logic that wasn't asked about).
- Replace the 3 hand-rolled stat `<div>`s with `<StatCard tone="primary"/"secondary"/"tertiary" />` (no natural 4th metric for a single master, so `surface-high` is unused here).
- Same "Overview" + date header treatment as `admin/page.tsx`, for visual parity.
- No change to the `<AppointmentsList appointments={todayAppointments} />` call site.

### 8. `src/app/admin/master/AppointmentsList.tsx` — swap status styling only
Remove `getStatusColor()` and its hand-rolled pill; render `<AppointmentStatusBadge status={app.status} />` instead. No change to the cancel button, confirm dialog, `fetch`/`router.refresh()` logic, or `tel:` link — this is real, working functionality with no equivalent in the static mockup, so it's restyled in place rather than converted to a non-interactive table.

## Order of implementation
1. [x] `m3-tokens.css` dark-token fix (foundation, so everything after is already dark-correct)
2. [x] `badge.tsx` `accent` variant
3. [x] `StatCard.tsx` + `AppointmentStatusBadge.tsx` (shared, needed by both pages)
4. [x] `TodaysAppointmentsTable.tsx`
5. [x] `admin/page.tsx` (higher-risk: new queries + revenue-filter behavior change)
6. [x] `admin/master/page.tsx` (lower-risk, mechanical restyle)
7. [x] `admin/master/AppointmentsList.tsx` (small, isolated)

## Implementation status: COMPLETE

All 7 files implemented per plan. `npm run lint` stayed at 61/0-new baseline (no errors from new/modified files). `npm run build` succeeded with no type errors. Manual in-browser verification (checklist items 1-4 under Verification) still needs to be done by the user.

## Verification

**Automated:** `npm run lint` (must stay at the 61/0-new baseline), `npm run build`.

**Manual, in-browser — both light and dark mode:**
1. `/admin` as SUPERADMIN/ADMIN: 4 stat cards show correct tonal colors and correct date-scoped numbers (today / this-week+delta / month-revenue-in-zł / active-masters-with-names); Revenue is no longer stuck at `0 zł`; "Today's appointments" table renders with master pills + status dots in the right colors; **specifically check the amber Revenue card and any "Pending" badge in dark mode** (the exact regression the token fix addresses); Quick Actions links navigate correctly; System Status is gone.
2. `/admin/master` as MASTER: 3 stat cards restyled; `AppointmentsList` cancel button + confirm dialog still works end-to-end (cancel an appointment, confirm the pill turns to the destructive/red style); `tel:` link still present.
3. Toggle tenant color customization in admin Settings and confirm existing tenant-driven UI still responds, while the 4 dashboard stat-card tones intentionally stay fixed (expected tradeoff, not a bug).
4. Narrow viewport check for the stat-card grid's responsive fallback.

## Critical files
- `src/app/admin/page.tsx`
- `src/app/admin/master/page.tsx`
- `src/app/admin/master/AppointmentsList.tsx`
- `src/styles/m3-tokens.css`
- `src/components/ui/badge.tsx`
- New: `src/components/admin/StatCard.tsx`, `src/components/admin/AppointmentStatusBadge.tsx`, `src/app/admin/TodaysAppointmentsTable.tsx`
