# Plan: i18n Remediation — Admin & Master Dashboard
**Date:** 2026-07-15
**Status:** Complete

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
- [x] A1: Confirm AD-4 in place (`lang` cookie written by client, `getServerT()` server
  helper). If Part-1 Phase 0 didn't land it, do it here first.
- [x] A2: Create the `admin.*` namespace skeleton in all 3 files
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: Add the sub-groups from AD-A1 as empty-but-structured objects; fill keys as
    each area below is done. Keep `admin.panel` (existing). Run `i18n-check` after each area.

### Group B — Shared admin chrome (highest reuse; do first)
- [x] B1: `src/components/admin/adminNavItems.ts` + `AdminSidebar.tsx` + `AdminTopBar.tsx`
  - Nav labels (Dashboard, Services, Masters, Admins, Database, Settings, Calendar, etc.)
    → `admin.nav.*`. `adminNavItems.ts` is not a component: expose i18n KEYS in the data
    and translate at render in the client sidebar/topbar.
- [x] B2: `src/components/admin/StatCard.tsx`, `AppointmentStatusBadge.tsx`,
  `AdminTopBar.tsx` — labels/tooltips/status text → `admin.*` / reuse `profile.status*`.
  (StatCard stays a pure props component — label/sub come pre-translated from server
  callers per AD-A2; AppointmentStatusBadge became `"use client"` since it computes its
  own label and is shared by both a server and a client caller.)
- [x] B3: `src/components/admin/SmtpInstructions.tsx`, `EmailSettingsForm.tsx`,
  `SocialSettingsForm.tsx` — form labels/help text → `admin.settings.*`.

### Group C — Dashboard & layout
- [x] C1: `src/app/admin/page.tsx` (SERVER) — "Overview", "Today", "This week", "Revenue",
  "Masters", "…masters active", "…vs last week", "This month", "Quick Actions",
  "Manage Services/Masters", "Salon Settings" → `getServerT()` + `admin.dashboard.*`.
  (Added `getServerLanguage()` to `i18n-server.ts` and a new `dateFnsLocale()` helper in
  `src/lib/utils/date-fns-locale.ts` so the dashboard's `date-fns format()` weekday/month
  also renders in the active locale.)
- [x] C2: `src/app/admin/layout.tsx`, `src/app/admin/database/layout.tsx`,
  `src/app/admin/database/DatabaseSubNav.tsx` — headings/nav → `admin.*`.
  (`admin/layout.tsx` itself has no literal UI text — pure composition — left untouched.)
- [x] C3: `src/app/admin/TodaysAppointmentsTable.tsx` — column headers/empty states.

### Group D — Services (admin + master)
- [x] D1: `src/app/admin/services/{page.tsx,ServicesClient.tsx,ServiceForm.tsx,actions.ts}`
  - Client components → `useTranslation`; `actions.ts` returned messages → `getServerT()`.
    Namespace `admin.services.*`. (`confirm("Delete this service?")` was the Polish-diacritic
    hit — now `t('admin.services.deleteConfirm')`.)
- [x] D2: `src/app/admin/master/services/{page.tsx,MasterServicesClient.tsx,MasterServiceForm.tsx}`
  - Master-role service management → `admin.services.*` (shared keys where identical).

### Group E — Masters & Admins management
- [x] E1: `src/app/admin/masters/{page.tsx,MastersClient.tsx,MasterForm.tsx,actions.ts}`
  → `admin.masters.*`.
- [x] E2: `src/app/admin/admins/{page.tsx,AdminsClient.tsx,AdminForm.tsx}` → `admin.admins.*`.
  (`page.tsx` in both has no literal UI text — left untouched.)

### Group F — Database & GDPR admin
- [x] F1: `src/app/admin/database/{page.tsx,clients/page.tsx,clients/ClientsTable.tsx}` →
  `admin.database.*`. (`page.tsx` files are pure redirect/data-loader, no literal text;
  client date rendering now uses `localeFor()`.)
- [x] F2: `src/app/admin/database/gdpr/{page.tsx,GdprTable.tsx}` → `admin.gdpr.*`.
  `src/app/api/admin/database/gdpr/**` left unchanged — its `error` strings are never
  rendered to the admin today (withdraw/erase fail silently client-side on `!res.ok`, a
  pre-existing behavior out of this pass's scope to change); revisit in Group I if that
  UX changes.
- [x] F3: `src/app/admin/db-browser/{page.tsx,DbBrowserClient.tsx}` → `admin.database.*`.
  (Prisma table/column names shown in this SUPERADMIN-only tool are technical identifiers,
  not translated, per AD-A3.)

### Group G — Settings (general / email / social / notifications)
- [x] G1: `src/app/admin/settings/{page.tsx,SettingsForm.tsx,FormFields.tsx,LogoEditor.tsx,
  BackgroundSection.tsx,SuperAdminCredentials.tsx,HomepagePreview.tsx,actions.ts}` →
  `admin.settings.*`. (New `admin.settings.general.*` sub-namespace; zod hex-color/brand-name
  messages now built via a `buildSettingsSchema(t)` factory called inside the server action,
  same pattern as services/masters actions.ts.)
- [x] G2: `src/app/admin/settings/email/page.tsx` + `src/app/admin/settings/social/page.tsx`
  + `src/app/admin/settings/notifications/{page.tsx,NotificationSettingsForm.tsx}` →
  `admin.settings.*`. (Inline `<a>`/`<code>` markup in notification hint text uses `<Trans>`
  from react-i18next, same pattern established in `SmtpInstructions.tsx`.)

### Group H — Calendar (admin + master, all client)
- [x] H1: `src/app/admin/calendar/page.tsx` and master calendar:
  `src/app/admin/master/calendar/{ModernCalendar,DayView,WeekView,MonthView,
  AppointmentModal,ViewAppointmentModal,BulkSettingsModal}.tsx` → `admin.calendar.*`.
  - Details: weekday/month labels use `date-fns` `format(..., { locale: dateFnsLocale(lang) })`
    via the new `src/lib/utils/date-fns-locale.ts` helper (AD-3). Status labels reuse
    `profile.status*` / `admin.appointments.*`. `admin/calendar/page.tsx` itself had no
    literal text beyond a loading spinner — left untouched.
- [x] H2: `src/app/admin/master/{page.tsx,AppointmentsList.tsx,schedule/page.tsx}` →
  `admin.appointments.*` / `admin.calendar.*`.

### Group I — Admin-triggered API error messages (AD-1 for admin consumers)
- [x] I1: Ensure admin fetch consumers map API `{ code }` → `t(apiErrorKey(code))` rather
  than showing raw `error` text (e.g. services/masters/admins CRUD, schedule overrides).
  Added `SMTP_NOT_CONFIGURED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_FILE_TYPE`,
  `FILE_TOO_LARGE` to `errors.*`/`apiErrorKey.ts`; added `code` to `/api/upload` and
  `/api/admin/email-settings/test` responses (the two routes with distinct,
  worth-preserving messages). Other admin/master API routes that only ever returned a
  generic `error` string now resolve through the `apiErrorKey(code) → 'errors.generic'`
  fallback client-side rather than rendering the raw string — this satisfies the
  no-raw-English-error requirement without needing to touch every route handler.
  **Review follow-up (2026-07-16):** reviewer found 3 remaining raw-error leaks missed by
  the initial sweep — `DbBrowserClient.tsx`, `SuperAdminCredentials.tsx`,
  `AppointmentModal.tsx`. Fixed: `DbBrowserClient.tsx` and `AppointmentModal.tsx` dropped
  their `d.error`/raw fallback entirely (their underlying routes only ever return generic,
  not-user-actionable messages, and `AppointmentModal`'s required-field errors are already
  guarded by client-side `isValid()` before submit is possible) — always show the
  translated generic message now. `SuperAdminCredentials.tsx` got the full `code` treatment
  since "current password incorrect" vs "email already in use" are genuinely distinct,
  useful outcomes: added `code` to every branch of
  `/api/admin/superadmin/credentials/route.ts` (`UNAUTHORIZED`, `INVALID_PAYLOAD`,
  new `NO_PASSWORD_SET`/`INVALID_CURRENT_PASSWORD`/`EMAIL_ALREADY_IN_USE`,
  `VALIDATION_ERROR`, `BAD_REQUEST`) and wired the client through
  `apiErrorKey()` + `t()`. New codes added to `KNOWN_ERROR_CODES` and `errors.*` in all 3
  locale files. Also fixed `src/lib/utils/date-fns-locale.ts` importing `Language` from
  `@/lib/i18n` (client singleton) instead of `@/lib/i18n-shared` (server-safe) — was
  type-only so harmless at runtime, but violated the documented server/client boundary.

### Group J — Verification
- [x] J1: `node scripts/i18n-check.mjs` → identical key sets; no missing referenced keys
  in admin files. PASS (1062 keys × 3 locales, 869 referenced keys all resolve).
- [x] J2: `npm run lint` (42 errors/5 warnings, all pre-existing baseline — verified via a
  throwaway `git worktree` diff against `HEAD`, zero net-new errors; 7 pre-existing
  `react/no-unescaped-entities` errors were incidentally fixed by replacing literal
  quote/apostrophe text with `t()` calls) + `npm run test` (112/112 passing) +
  `npm run build` (production build succeeds).
  - **Infra bug found and fixed during this pass**: `getServerT()` (`src/lib/i18n-server.ts`)
    originally re-exported constants from the client `src/lib/i18n.ts` singleton, which
    transitively imports `react-i18next`'s `initReactI18next` (calls `React.createContext`
    at module-eval time). Pulling that into a Server Component's module graph broke Next's
    "Collecting page data" build phase (a restricted React build without `createContext`)
    for every route reachable through a `getServerT()`-using layout/page — surfaced first
    on `/admin/database/**`. Fixed by extracting the pure language constants
    (`Language`, `DEFAULT_LANGUAGE`, `isValidLanguage`, `LANGUAGE_NAMES`, `localeFor`) into
    a new dependency-free `src/lib/i18n-shared.ts`; `src/lib/i18n.ts` now does
    `export * from './i18n-shared'` (100% unchanged public API, zero other call sites
    touched) and `i18n-server.ts` imports only from `i18n-shared.ts` plus a private
    `i18next.createInstance()` (no `react-i18next` binding) for `getFixedT()`.
- [x] J3: Manual matrix — deferred to the user per this session's process step 8 (no dev
  server run by the agent); see the report's "manual verification" list for the exact
  screens/languages to check.

## Acceptance Criteria
- [x] Full `admin.*` namespace present and identical across pl/en/uk (`i18n-check` green).
- [x] Every admin/master screen renders with no hardcoded English literal (re-grep for
      Latin UI literals in `src/app/admin/**` and `src/components/admin/**`).
- [x] Server-component admin text respects the `lang` cookie via `getServerT()`.
- [x] Admin CRUD errors localized via `code`.
- [x] Dates/times in admin render in the active locale.
- [x] `npm run lint` + `npm run test` pass; DOX pass done for `src/app/admin/AGENTS.md`
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
