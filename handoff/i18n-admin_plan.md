# Plan: i18n Remediation — Admin & Master Dashboard
**Date:** 2026-07-15
**Status:** In Progress

> Part 3 of 3. **Prerequisites: `i18n-audit_plan.md` Phase 0 (esp. AD-4 language cookie
> + `getServerT`) AND ideally the client plan (Part 2) done/verified first.** This is the
> LARGEST part: the entire `/admin` tree is currently hardcoded in **ENGLISH** with ZERO
> i18n infrastructure (no admin file imports `useTranslation`; the only admin key today
> is `admin.panel`).

## Goal
The admin (SUPERADMIN/ADMIN) and master dashboards render fully in pl/en/uk, driven by a
new `admin.*` locale namespace, with a server-component-safe translation mechanism.

## Scope
**In:** `src/app/admin/**` (~48 files) and `src/components/admin/**` (8 files).
**Out:** business logic in `actions.ts` server actions (translate only user-facing
returned messages/labels, not logic); privacy/terms; email templates.

## Architecture Decisions
Inherits AD-1..AD-6. Admin-specific:
- **AD-A1 — New `admin.*` namespace, sub-grouped by area** to stay navigable:
  `admin.nav.*, admin.dashboard.*, admin.services.*, admin.masters.*, admin.admins.*,
  admin.database.*, admin.gdpr.*, admin.settings.*, admin.calendar.*, admin.appointments.*,
  admin.common.*` (buttons like Save/Cancel/Delete/Add reuse existing `common.*` where
  possible). Source language for translation is the current **English** text.
- **AD-A2 — Client vs Server split (from AD-4):**
  - 28 admin files are `"use client"` (forms, tables, clients, calendar views, modals) →
    wire `useTranslation()` directly. This holds the BULK of admin UI text.
  - The remaining server components (e.g. `admin/page.tsx` dashboard, `admin/layout.tsx`,
    `admin/master/page.tsx`, `admin/master/schedule/page.tsx`, and `*/page.tsx` data
    loaders) → use `getServerT()` (AD-4) for their inline text, OR push inline text down
    into their existing client children. Prefer pushing-down where a client child already
    exists; use `getServerT()` for genuinely server-rendered copy (e.g. dashboard
    StatCard `label`/`sub` strings, "Overview", "Quick Actions").
  - `actions.ts` server actions returning user-facing strings → `getServerT()`.
- **AD-A3 — Data-derived text stays as data** (master names, service names from DB,
  procedure names via `procedure-translator`) — do NOT translate via `admin.*`.

## Implementation Steps

### Group A — Infrastructure & namespace scaffold
- [ ] A1: Confirm AD-4 in place (`lang` cookie written by client, `getServerT()` server
  helper). If Part-1 Phase 0 didn't land it, do it here first.
- [ ] A2: Create the `admin.*` namespace skeleton in all 3 files
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: Add the sub-groups from AD-A1 as empty-but-structured objects; fill keys as
    each area below is done. Keep `admin.panel` (existing). Run `i18n-check` after each area.

### Group B — Shared admin chrome (highest reuse; do first)
- [ ] B1: `src/components/admin/adminNavItems.ts` + `AdminSidebar.tsx` + `AdminTopBar.tsx`
  - Nav labels (Dashboard, Services, Masters, Admins, Database, Settings, Calendar, etc.)
    → `admin.nav.*`. `adminNavItems.ts` is not a component: expose i18n KEYS in the data
    and translate at render in the client sidebar/topbar.
- [ ] B2: `src/components/admin/StatCard.tsx`, `AppointmentStatusBadge.tsx`,
  `AdminTopBar.tsx` — labels/tooltips/status text → `admin.*` / reuse `profile.status*`.
- [ ] B3: `src/components/admin/SmtpInstructions.tsx`, `EmailSettingsForm.tsx`,
  `SocialSettingsForm.tsx` — form labels/help text → `admin.settings.*`.

### Group C — Dashboard & layout
- [ ] C1: `src/app/admin/page.tsx` (SERVER) — "Overview", "Today", "This week", "Revenue",
  "Masters", "…masters active", "…vs last week", "This month", "Quick Actions",
  "Manage Services/Masters", "Salon Settings" → `getServerT()` + `admin.dashboard.*`.
- [ ] C2: `src/app/admin/layout.tsx`, `src/app/admin/database/layout.tsx`,
  `src/app/admin/database/DatabaseSubNav.tsx` — headings/nav → `admin.*`.
- [ ] C3: `src/app/admin/TodaysAppointmentsTable.tsx` — column headers/empty states.

### Group D — Services (admin + master)
- [ ] D1: `src/app/admin/services/{page.tsx,ServicesClient.tsx,ServiceForm.tsx,actions.ts}`
  - Client components → `useTranslation`; `actions.ts` returned messages → `getServerT()`.
    Namespace `admin.services.*`. (ServicesClient/ServiceForm carry the Polish-diacritic
    hits flagged in the audit — verify none are missed.)
- [ ] D2: `src/app/admin/master/services/{page.tsx,MasterServicesClient.tsx,MasterServiceForm.tsx}`
  - Master-role service management → `admin.services.*` (shared keys where identical).

### Group E — Masters & Admins management
- [ ] E1: `src/app/admin/masters/{page.tsx,MastersClient.tsx,MasterForm.tsx,actions.ts}`
  → `admin.masters.*`.
- [ ] E2: `src/app/admin/admins/{page.tsx,AdminsClient.tsx,AdminForm.tsx}` → `admin.admins.*`.

### Group F — Database & GDPR admin
- [ ] F1: `src/app/admin/database/{page.tsx,clients/page.tsx,clients/ClientsTable.tsx}` →
  `admin.database.*`.
- [ ] F2: `src/app/admin/database/gdpr/{page.tsx,GdprTable.tsx}`,
  `src/app/api/admin/database/gdpr/**` user-facing strings → `admin.gdpr.*`.
- [ ] F3: `src/app/admin/db-browser/{page.tsx,DbBrowserClient.tsx}` → `admin.database.*`.

### Group G — Settings (general / email / social / notifications)
- [ ] G1: `src/app/admin/settings/{page.tsx,SettingsForm.tsx,FormFields.tsx,LogoEditor.tsx,
  BackgroundSection.tsx,SuperAdminCredentials.tsx,HomepagePreview.tsx,actions.ts}` →
  `admin.settings.*`.
- [ ] G2: `src/app/admin/settings/email/page.tsx` + `src/app/admin/settings/social/page.tsx`
  + `src/app/admin/settings/notifications/{page.tsx,NotificationSettingsForm.tsx}` →
  `admin.settings.*`.

### Group H — Calendar (admin + master, all client)
- [ ] H1: `src/app/admin/calendar/page.tsx` and master calendar:
  `src/app/admin/master/calendar/{ModernCalendar,DayView,WeekView,MonthView,
  AppointmentModal,ViewAppointmentModal,BulkSettingsModal}.tsx` → `admin.calendar.*`.
  - Details: weekday/month labels should use the locale-aware formatters (AD-3), not
    hardcoded names. Status labels reuse `profile.status*` / `admin.appointments.*`.
- [ ] H2: `src/app/admin/master/{page.tsx,AppointmentsList.tsx,schedule/page.tsx}` →
  `admin.appointments.*` / `admin.calendar.*`.

### Group I — Admin-triggered API error messages (AD-1 for admin consumers)
- [ ] I1: Ensure admin fetch consumers map API `{ code }` → `t(apiErrorKey(code))` rather
  than showing raw `error` text (e.g. services/masters/admins CRUD, schedule overrides).
  Add any admin-specific codes to `errors.*`.

### Group J — Verification
- [ ] J1: `node scripts/i18n-check.mjs` → identical key sets; no missing referenced keys
  in admin files.
- [ ] J2: `npm run lint` (zero warnings) + `npm run test`.
- [ ] J3: Manual matrix (document in handoff): visit each admin + master screen in pl and
  uk; confirm no English leakage and correct date locale.

## Acceptance Criteria
- [ ] Full `admin.*` namespace present and identical across pl/en/uk (`i18n-check` green).
- [ ] Every admin/master screen renders with no hardcoded English literal (re-grep for
      Latin UI literals in `src/app/admin/**` and `src/components/admin/**`).
- [ ] Server-component admin text respects the `lang` cookie via `getServerT()`.
- [ ] Admin CRUD errors localized via `code`.
- [ ] Dates/times in admin render in the active locale.
- [ ] `npm run lint` + `npm run test` pass; DOX pass done for `src/app/admin/AGENTS.md`
      and `src/components/AGENTS.md` (record the new i18n contract for admin).

## Constraints & Risks
- **Biggest risk = server components.** `getServerT()` depends on the `lang` cookie
  actually being set client-side (AD-4). If the cookie is absent (first visit, cookie
  disabled), server text falls back to `DEFAULT_LANGUAGE` (pl) — acceptable, but verify.
- **Hydration:** do not read the cookie in client components for initial render (keep the
  existing DEFAULT_LANGUAGE-then-sync pattern) to avoid SSR/CSR mismatch; the cookie is
  for SERVER rendering only.
- **Volume:** ~56 files, hundreds of strings. Execute Group-by-Group as separate commits;
  run `i18n-check` + lint after each group. This is the part most likely to need multiple
  coder/reviewer cycles — keep groups atomic.
- **English source, not Polish:** translators must produce pl AND uk from English here
  (unlike the client side where pl was the source). Ensure real, correct Polish/Ukrainian
  copy — no machine-literal leftovers.
- **Do not** translate DB-derived names or `actions.ts` business logic — only the
  user-facing message strings.
- Keep every file < 500 lines; some admin files may already be near the limit — split
  rather than bloat when adding `useTranslation` wiring.
- Stagewise: this Part alone may span several verification checkpoints; stop between
  groups for user review if requested.
