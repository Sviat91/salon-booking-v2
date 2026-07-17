# Plan: Structural multi-language fields for user-generated content

**Date:** 2026-07-17
**Status:** In Progress
**Roadmap item:** Priority 5 — "Мультиязычные поля для пользовательского контента" (last open item)

## Goal
Give `Service.name` and `MasterProfile.bio` per-locale storage (`_pl`/`_en`/`_uk`) with a fallback-aware resolver, per-tenant enabled-locale gating in the admin authoring UI, and localized display across the app — preserving all existing (Polish) data.

## Scope (locked with user — do not re-litigate)
- Exactly 3 locales: `pl` (default), `en`, `uk` — the app's existing `SUPPORTED_LANGUAGES`.
- Per-language **columns**, not a translations table.
- In-scope fields: **`Service.name` and `MasterProfile.bio` only.**
- OUT of scope: no new `Service.description` column (explicitly rejected).
- Per-tenant language toggle via a new `TenantConfig.enabledLocales` JSON field; gates which per-locale inputs render in admin forms (single-locale tenant → one plain input, not tabs).

---

## Architecture Decisions

### 1. Column layout
- `Service`: replace `name String` with `name_pl String` (NOT NULL — the default/canonical value), `name_en String?`, `name_uk String?`.
- `MasterProfile`: replace `bio String?` with `bio_pl String?`, `bio_en String?`, `bio_uk String?` (all nullable — bio is optional today).
- `TenantConfig`: add `enabledLocales String @default("[\"pl\",\"en\",\"uk\"]")` (JSON string array, subset of the 3 locales).
- Suffix is `_uk` (not `_ua`) everywhere, to match `SUPPORTED_LANGUAGES`/`Language`. The stray `name_ua` in `src/types/api-responses.ts` gets renamed to `name_uk` (see Group C).

### 2. Resolution helper (new `src/lib/localized-content.ts`, framework-free)
A single pure resolver, importable from both client and server (no React/i18next deps, same rationale as `i18n-shared.ts`):
- `type LocalizedField = Partial<Record<Language, string | null | undefined>>`
- `resolveLocalized(field, lang): string` — returns `field[lang]` if non-empty (trimmed); else `field['pl']` (DEFAULT_LANGUAGE) if non-empty; else the first non-empty of `SUPPORTED_LANGUAGES`; else `''`.
- `parseEnabledLocales(json: string | null | undefined): Language[]` — parse the JSON array, keep only valid `Language` values, guarantee non-empty (fall back to `['pl']` / all-3 on parse failure), preserve `SUPPORTED_LANGUAGES` order.

### 3. Where resolution happens
- **Client components resolve at render** using `useCurrentLanguage()` + `resolveLocalized(...)`. This preserves today's live-language-switch behavior (current code re-runs `translateProcedureName(..., language)` on every render) and covers admin surfaces too (admin language switch already re-renders client components instantly and also calls `router.refresh()`).
- **Server components** that fetch rows pass the **full variant object** down to their client children (they do NOT pre-resolve), so the client child owns resolution.
- **Notifications** (`src/lib/notifications/index.ts`) have no viewer locale — resolve service name with `resolveLocalized(field, DEFAULT_LANGUAGE)` (i.e. Polish, matching today's behavior). We do not persist a per-client locale on appointments, so this is the only correct deterministic choice for now.

### 4. Non-breaking API evolution for appointment routes
Appointment-serializing routes currently emit a flat `procedureName: service.name`. To avoid a broken intermediate state between groups, we **keep the flat field (now `= service.name_pl`) and ADD sibling variant fields** (`procedureName_en`, `procedureName_uk`). Consumers migrate to `resolveLocalized({ pl: procedureName, en: procedureName_en, uk: procedureName_uk }, language)` group-by-group; any not-yet-migrated consumer still renders the Polish default. `/api/procedures` already keys its payload `name_pl` — it just gains `name_en`/`name_uk`.

### 5. `procedure-translator.ts` disposition — DELETE at end of Group C
Traced call sites (all via `translateProcedureName`; `formatProcedureDisplay`/`addProcedureTranslation` have zero external callers):
- Booking flow: `BookingForm.tsx`, `BookingSuccessPanel.tsx`, `ProcedureSelect.tsx`
- Booking-management: `ResultsPanel.tsx`, `EditSelectionPanel.tsx`, `ConfirmCancelPanel.tsx`, `ConfirmTimeChangePanel.tsx`, `TimeChangeSuccessPanel.tsx`, `DirectTimeChangePanel.tsx`, `ProcedureChangeSuccessPanel.tsx`

All these are migrated in Group C. Once migrated, the module is dead → **delete `src/lib/procedure-translator.ts`** (project directive: remove dead code immediately). It is NOT kept as a fallback path.
- **Tradeoff (surface to user, accepted):** the ~30 hardcoded legacy Olga/Yuliia procedure strings the dictionary used to auto-translate will, if they still exist as `Service` rows, show their Polish `name_pl` to en/uk viewers until an admin fills `name_en`/`name_uk` via the new authoring UI. This is consistent with the chosen structural approach and the ROADMAP note that the dictionary is already broken for all post-redesign content. No data is lost (Polish preserved in `name_pl`); the resolver's fallback yields exactly the old Polish string.

### 6. Stagewise delivery (independent review/verify per group — user preference)
- **A** Foundation: schema + migration + helper + make the whole app compile & behave identically (Polish shown everywhere). Shippable no-op-behavior baseline.
- **B** Admin authoring: per-locale inputs + `enabledLocales` setting + gating + admin-table localized display. After B, variants can be entered and verified in the DB.
- **C** Client booking experience: procedures/masters API variants + booking flow + booking-management + homepage localized; delete `procedure-translator.ts`.
- **D** Remaining read surfaces: staff appointment views + client profile appointments + notifications localized.

Order rationale: B (write) before C/D (read) so there's real per-locale data to display and verify downstream.

---

## Implementation Steps

### Group A — Schema, migration, shared helper, compile-green baseline
- [x] **A1: Edit `prisma/schema.prisma`**
  - Files: `prisma/schema.prisma`
  - Details: In `Service`, replace `name String` with `name_pl String`, `name_en String?`, `name_uk String?`. In `MasterProfile`, replace `bio String?` with `bio_pl String?`, `bio_en String?`, `bio_uk String?`. In `TenantConfig`, add `enabledLocales String @default("[\"pl\",\"en\",\"uk\"]")`.
- [x] **A2: Generate + hand-edit the migration to preserve data**
  - Files: `prisma/migrations/<timestamp>_multilang_content_fields/migration.sql`
  - Details: Run `npx prisma migrate dev --create-only --name multilang_content_fields`. Prisma will emit SQLite table-rebuilds for `Service` and `MasterProfile` (new `CREATE TABLE "new_Service"` / `new_MasterProfile`, `INSERT ... SELECT`, `DROP`, `ALTER ... RENAME`). **Critical hand-edit:** in the `INSERT INTO "new_Service" (...) SELECT ... FROM "Service"` statement, map the old `name` column into `name_pl` (e.g. `INSERT INTO "new_Service" ("id","name_pl","duration","price","masterId","createdAt","updatedAt") SELECT "id","name","duration","price","masterId","createdAt","updatedAt" FROM "Service";`). Same for `MasterProfile`: map old `bio` → `bio_pl`. `name_en`/`name_uk`/`bio_en`/`bio_uk` stay unset (NULL). For `TenantConfig`, keep the simple `ALTER TABLE "TenantConfig" ADD COLUMN "enabledLocales" TEXT NOT NULL DEFAULT '["pl","en","uk"]';`. Do NOT let the generated SQL drop `name`/`bio` before the copy runs.
  - Verify: apply with `npx prisma migrate dev`; open `npx prisma studio` and confirm every existing `Service.name_pl` equals its old name and every populated `MasterProfile.bio_pl` equals its old bio. Then `npx prisma generate`.
- [x] **A3: Create the shared resolver `src/lib/localized-content.ts`**
  - Files: `src/lib/localized-content.ts` (new)
  - Details: Export `LocalizedField`, `resolveLocalized`, `parseEnabledLocales` as specified in Architecture §2. Import `Language`, `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE` from `@/lib/i18n-shared`. No React/i18next imports.
- [x] **A4: Compile-green — server selects & serializers (`.name`→`.name_pl`, `.bio`→`.bio_pl`, `orderBy: { name }`→`{ name_pl }`)**
  - Files: `src/app/api/procedures/route.ts` (source `s.name`→`s.name_pl`; `orderBy` and the `ms.service.name` orderBy), `src/app/api/masters/route.ts` (`bio`→`bio_pl`), `src/app/api/master/services/route.ts` (`orderBy`, `ServiceSchema` field, create `data.name`→`name_pl`), `src/app/api/master/services/[id]/route.ts` (`ServiceSchema`, update `data.name`→`name_pl`), `src/app/api/bookings/all/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/bookings/update-time/route.ts`, `src/app/api/bookings/[id]/check-extension/route.ts`, `src/app/api/master/appointments/route.ts`, `src/app/api/master/appointments/[id]/route.ts`, `src/app/api/client/appointments/[id]/route.ts`, `src/app/api/client/profile/route.ts`, `src/app/api/admin/calendar/appointments/route.ts`, `src/lib/notifications/index.ts` (both `appointment.service.name`/`appt.service.name` sites).
  - Details: Purely mechanical — select `name_pl` (and, where an appointment is joined, keep serializing the single existing field, now sourced from `name_pl`). No variant fields yet; behavior stays Polish-only. Grep `service.*name\b`, `\.bio\b`, `orderBy.*name` to catch every site.
- [x] **A5: Compile-green — admin server pages + client components consuming raw Prisma rows**
  - Files: `src/app/admin/services/page.tsx`, `src/app/admin/services/ServicesClient.tsx` (`Service` type `name`→`name_pl`, `svc.name` display + `DataCard title`), `src/app/admin/services/ServiceForm.tsx` (type + `defaultValue`/input `name`), `src/app/admin/services/actions.ts` (`buildServiceSchema` key + `parsed.data`), `src/app/admin/master/services/page.tsx` (`orderBy`), `src/app/admin/master/services/MasterServicesClient.tsx` (type + `svc.name`), `src/app/admin/master/services/MasterServiceForm.tsx` (type + input), `src/app/admin/masters/page.tsx` (`select bio`→`bio_pl` + `MasterWithProfile` type), `src/app/admin/masters/MastersClient.tsx` (type + `master.masterProfile.bio` display), `src/app/admin/masters/MasterForm.tsx` (type + `defaultValue` + `bio` input), `src/app/admin/masters/actions.ts` (`buildCreate/UpdateMasterSchema` `bio`, and both `create`/`update` `bio:`), plus any admin calendar/dashboard/appointment client components that read a joined service name: `src/app/admin/TodaysAppointmentsTable.tsx`, `src/app/admin/page.tsx`, `src/app/admin/master/AppointmentsList.tsx`, `src/app/admin/master/calendar/{WeekView,DayView,ModernCalendar,AppointmentModal,ViewAppointmentModal}.tsx`, `src/app/profile/page.tsx`, `src/components/profile/EditAppointmentModal.tsx`.
  - Details: Only touch the field-name references needed to compile against the new schema. For admin appointment surfaces whose data comes from the A4 API routes (still flat `procedureName`), no change may be needed — verify by grep. Keep everything Polish-only for now.
  - Verify: `npm run build` and `npm run lint` (zero warnings) and `npm run test` all green. App visually identical to pre-change; existing services/bios still display.

### Group B — Admin authoring UI + `enabledLocales` setting + gating + admin display
- [x] **B1: `enabledLocales` in tenant settings**
  - Files: `src/app/admin/settings/actions.ts` (add `enabledLocales` to schema + `raw` mapping; validate it parses to a non-empty subset of the 3 locales via `parseEnabledLocales`, persist canonical JSON), `src/app/admin/settings/page.tsx` (pass `config.enabledLocales` into the form), `src/app/admin/settings/SettingsForm.tsx` (add `enabledLocales: string` to its `TenantConfig` type and render the new section — see B2), `src/app/admin/settings/LanguagesSection.tsx` (new client component: checkboxes for pl/en/uk writing a hidden `enabledLocales` JSON input; `pl` always checked/disabled since it's the canonical default).
  - Details: Extract the UI into `LanguagesSection.tsx` (new file) to keep `SettingsForm.tsx` under the 500-line limit — see Constraints. Add i18n keys.
- [x] **B2: Reusable per-locale input component**
  - Files: `src/components/admin/LocalizedFieldInput.tsx` (new client component)
  - Details: Props: base field name (e.g. `name` / `bio`), label, existing values `{ pl, en, uk }`, `enabledLocales: Language[]`, variant (`input` | `textarea`). Renders one plain field when `enabledLocales.length === 1`; otherwise a compact tabbed set (one tab per enabled locale) emitting form fields `name_pl`/`name_en`/`name_uk` (or `bio_*`). `pl` is required for services; others optional. Uses `LANGUAGE_NAMES` for tab labels. Keep it small and generic so all three forms reuse it.
- [x] **B3: Wire per-locale inputs into the three forms (gated by `enabledLocales`)**
  - Files: `src/app/admin/services/ServiceForm.tsx` + `src/app/admin/services/actions.ts` + `src/app/admin/services/page.tsx`; `src/app/admin/master/services/MasterServiceForm.tsx` + `src/app/api/master/services/route.ts` + `src/app/api/master/services/[id]/route.ts` + `src/app/admin/master/services/page.tsx`; `src/app/admin/masters/MasterForm.tsx` + `src/app/admin/masters/actions.ts` + `src/app/admin/masters/page.tsx`.
  - Details: Replace the single `name`/`bio` input with `LocalizedFieldInput`. Server actions/route schemas parse `name_pl`(required)/`name_en`/`name_uk` and `bio_pl`/`bio_en`/`bio_uk`; write them to the new columns. `enabledLocales` must be fetched in each server page and threaded to the form (read via `getTenantConfig()` / `parseEnabledLocales`). Editing preserves existing per-locale values as defaults. When only `pl` is enabled, the form persists just `name_pl`/`bio_pl` (others untouched/left as-is on edit).
- [x] **B4: Localize admin table/list display**
  - Files: `src/app/admin/services/ServicesClient.tsx`, `src/app/admin/master/services/MasterServicesClient.tsx`, `src/app/admin/masters/MastersClient.tsx`.
  - Details: These client components add `useCurrentLanguage()` and render `resolveLocalized({ pl: svc.name_pl, en: svc.name_en, uk: svc.name_uk }, language)` for names, and the equivalent for `bio`. Their server pages (`services/page.tsx`, `master/services/page.tsx`, `masters/page.tsx`) must `select` all three variant columns and the client type must carry them.
  - Verify: In admin, set a tenant to all-3 locales, create/edit a service and a master bio with distinct pl/en/uk values; confirm in `prisma studio` the columns persist; switch admin UI language and confirm the tables show the matching variant (empty variant falls back to pl). Set `enabledLocales` to `["pl"]` and confirm the forms collapse to a single input. `npm run build`/`lint`/`test` green.

### Group C — Client booking experience localization + retire translator
- [x] **C1: Serialize variants from client-facing read routes**
  - Files: `src/app/api/procedures/route.ts` (add `name_en: s.name_en`, `name_uk: s.name_uk` to every item mapping), `src/app/api/masters/route.ts` (return `bio_pl`/`bio_en`/`bio_uk`), `src/app/api/bookings/all/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/bookings/update-time/route.ts`, `src/app/api/bookings/[id]/check-extension/route.ts` (add sibling `procedureName_en`/`procedureName_uk`; keep flat `procedureName` = `name_pl`). Select the new columns in each query.
  - Details: Non-breaking additive change (Architecture §4).
- [x] **C2: Update response types**
  - Files: `src/types/api-responses.ts` (rename `ProcedureItem.name_ua`→`name_uk`; ensure `name_en` present; add `procedureName_en?`/`procedureName_uk?` to `BookingResult`; leave the pre-existing dead `description_*` fields untouched — out of scope), `src/components/booking-management/types.ts` (mirror the added fields).
- [x] **C3: Replace `translateProcedureName` with `resolveLocalized` in booking flow**
  - Files: `src/components/ProcedureSelect.tsx`, `src/components/BookingForm.tsx`, `src/components/BookingSuccessPanel.tsx`.
  - Details: Build the `LocalizedField` from the procedure item's `name_pl`/`name_en`/`name_uk` and resolve with the current `language`. Drop the `procedure-translator` import.
- [x] **C4: Replace `translateProcedureName` in booking-management panels**
  - Files: `src/components/booking-management/{ResultsPanel,EditSelectionPanel,ConfirmCancelPanel,ConfirmTimeChangePanel,TimeChangeSuccessPanel,DirectTimeChangePanel,ProcedureChangeSuccessPanel}.tsx` and any handler/hook that pre-computes procedure names (`hooks/useBookingHandlers.ts`, `api/bookingManagementApi.ts` — grep for `name_pl`/`procedureName`).
  - Details: Resolve from the flat `procedureName` + new sibling variants for booked appointments, and from `name_pl`/`name_en`/`name_uk` for procedure-list items. Same live-switch behavior as before, now structural.
- [x] **C5: Localize homepage master bio**
  - Files: `src/components/MasterSelector.tsx`.
  - Details: `DbMaster` type carries `bio_pl`/`bio_en`/`bio_uk`; render `resolveLocalized(..., language)` via `useCurrentLanguage()`.
- [x] **C6: Delete the dead translator**
  - Files: remove `src/lib/procedure-translator.ts`.
  - Details: Only after C3–C4 remove all imports. Confirm zero remaining references (`grep procedure-translator`).
  - Verify: On `/[masterId]`, pick a service with distinct pl/en/uk names, switch language mid-flow, confirm the procedure name updates live in the selector, confirmation panel, and in the "my bookings" management panels; homepage master bio switches with language. `npm run build`/`lint`/`test` green (including `tests/app/api/procedures/route.test.ts` — update expectations for the new fields).

### Group D — Remaining read surfaces + notifications
- [ ] **D1: Staff appointment view routes serialize variants**
  - Files: `src/app/api/master/appointments/route.ts`, `src/app/api/master/appointments/[id]/route.ts`, `src/app/api/admin/calendar/appointments/route.ts`, `src/app/api/client/appointments/[id]/route.ts`, `src/app/api/client/profile/route.ts`.
  - Details: Add sibling `procedureName_en`/`procedureName_uk` (keep flat = `name_pl`); select the new columns.
- [ ] **D2: Localize staff/profile appointment displays**
  - Files: `src/app/admin/TodaysAppointmentsTable.tsx`, `src/app/admin/page.tsx`, `src/app/admin/master/AppointmentsList.tsx`, `src/app/admin/master/calendar/{WeekView,DayView,ModernCalendar,AppointmentModal,ViewAppointmentModal}.tsx`, `src/app/profile/page.tsx`, `src/components/profile/EditAppointmentModal.tsx`.
  - Details: Resolve the service name via `useCurrentLanguage()` + `resolveLocalized`. Where a server component feeds a client child, pass the variant object down and resolve in the child.
- [ ] **D3: Notifications resolve to default locale**
  - Files: `src/lib/notifications/index.ts`.
  - Details: In `notifyBookingConfirmation` and `notifyBookingReminders`, set `service: resolveLocalized({ pl: appt.service.name_pl, en: appt.service.name_en, uk: appt.service.name_uk }, DEFAULT_LANGUAGE)`. Select the new columns in the `include`.
  - Verify: Admin calendar/dashboard, master appointment list, and client profile show the viewer-language service name; a confirmation email/telegram still shows the Polish name. `npm run build`/`lint`/`test` green.

### Group E — App-wide language switcher gating by `enabledLocales`

**Purpose (new user request):** the `enabledLocales` tenant setting (added in Group B for *content authoring*) must ALSO drive the app-wide *UI language switcher* — both the client-facing toggle and the admin top-bar toggle. The switcher must offer only the currently-enabled locales, and **must disappear entirely when only one locale is enabled** (no dead single-option control).

**Ordering vs Groups C/D — independent; run E after D.** E touches only the UI-language switcher and its context (`LanguageContext`, `LanguageToggle`, `providers.tsx`, `layout.tsx`, `tenant.ts`, and one optional line in `SettingsForm.tsx`); Groups C/D touch service-name/bio *content* fields, content API routes, and the translator. There is **no shared file and no hard dependency** either direction. The only interaction is a verification caveat: keep all three locales enabled while verifying C/D's "switch language → content updates live" checks, and only exercise the disable path when verifying E. Running E first would just force testers to re-enable locales to verify C/D anyway, so E-last is cleaner; running it earlier is technically safe if preferred.

**Mechanism decisions (mirroring the content resolver's fallback for consistency):**
- **Source of the enabled set — no new fetch, no new cookie.** `layout.tsx` already calls `getTenantConfig()` (it has `config` in scope). Thread `config.enabledLocales` (JSON string) as a prop down the existing client-provider tree: `layout.tsx` → `Providers` (`src/app/providers.tsx`) → `LanguageProvider` (`src/contexts/LanguageContext.tsx`). The provider parses it once with the existing `parseEnabledLocales()` (Group A helper) and exposes the result as its `supportedLanguages` context value — which today is hardcoded to `SUPPORTED_LANGUAGES` (`LanguageContext.tsx` line 123). No client-side DB access; client components keep reading the enabled set from context exactly as they read `supportedLanguages` today.
- **Switcher offers only enabled locales — one edit covers all sites.** `LanguageToggle` already maps the dropdown over `supportedLanguages` from context (`LanguageToggle.tsx` line 94) and is the *sole* consumer of that value (verified). Narrowing the context value therefore limits the options at every render site with zero per-site edits. The toggle renders in 8 places — `src/app/[masterId]/page.tsx`, `src/components/home/HomeClient.tsx`, `src/app/profile/page.tsx`, `src/app/profile/edit/page.tsx`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/support/page.tsx`, and admin `src/components/admin/AdminTopBar.tsx` — none of which need touching.
- **Hide when one locale remains.** Add `if (supportedLanguages.length <= 1) return null` in `LanguageToggle`. `supportedLanguages` derives from a server-provided prop identical on SSR and hydration, so this branch evaluates the same on both → no hydration mismatch.
- **Stale-cookie / stale-localStorage fallback (the "mid-session in a now-disabled locale" case).** `DEFAULT_LANGUAGE` (`pl`) is invariantly enabled — `saveSettings` already forces `pl` into `enabledLocales` (`src/app/admin/settings/actions.ts` line 134), so falling back to `pl` is always valid. In `LanguageProvider`'s post-mount sync effect (currently `LanguageContext.tsx` lines 65–72), compute `effective = storedLang && enabledLanguages.includes(storedLang) ? storedLang : DEFAULT_LANGUAGE`; apply `effective` (i18next + React state + `lang` cookie); and if `storedLang` existed but differs from `effective`, also overwrite `localStorage` to `effective` and call `router.refresh()` so any server strings rendered from the stale `lang` cookie (via `getServerT()`) re-render in `pl`. This mirrors `resolveLocalized()`'s "active → default → first-non-empty" precedence, now for UI language. **Deliberate scope choice:** the fallback lives in the client provider only; `getServerLanguage()` in `src/lib/i18n-server.ts` is left untouched (adding a DB read to that hot, DB-free cookie reader would be invasive) — because `pl` is always enabled, the worst case is a single transient server paint of a now-disabled non-`pl` UI language that the client immediately reconciles and rewrites the cookie for. Content already falls back independently via `resolveLocalized`, so no content shows a disabled locale.

- [ ] **E1: `getTenantConfig()` fallback carries `enabledLocales`**
  - Files: `src/lib/tenant.ts`
  - Details: Add `enabledLocales: '["pl","en","uk"]',` to the `DEFAULT_CONFIG` object so the union return type of `getTenantConfig()` always has the field and the DB-unavailable fallback branch yields all-locales-enabled. Without this, `config.enabledLocales` in `layout.tsx` is a TypeScript error on the `DEFAULT_CONFIG` branch of the union (and `undefined` at runtime — harmless, since `parseEnabledLocales(undefined)` returns all three, but the type must resolve). Do not change anything else in this file.

- [ ] **E2: Thread the `enabledLocales` prop through the provider tree**
  - Files: `src/app/layout.tsx`, `src/app/providers.tsx`
  - Details: In `layout.tsx` `RootLayout` (which already has `const config = await getTenantConfig()`), pass it: `<Providers enabledLocales={config.enabledLocales}>`. In `providers.tsx`, change the signature to `{ children, enabledLocales }: { children: React.ReactNode; enabledLocales: string }` and forward it: `<LanguageProvider enabledLocales={enabledLocales}>`. `Providers` is a client component; a plain string prop from the server layout is serializable, so this is safe. No other provider needs the value.

- [ ] **E3: Parse + apply the enabled set in `LanguageProvider`**
  - Files: `src/contexts/LanguageContext.tsx`
  - Details:
    - Import `parseEnabledLocales` from `@/lib/localized-content` and `useMemo` from `react`.
    - Add `enabledLocales?: string` to `LanguageProvider`'s props; compute `const enabledLanguages = useMemo(() => parseEnabledLocales(enabledLocales), [enabledLocales])`.
    - Set the context value's `supportedLanguages: enabledLanguages` (replacing the hardcoded `SUPPORTED_LANGUAGES` on line 123). `SUPPORTED_LANGUAGES` may become an unused import here — remove it if so.
    - Rework the post-mount sync effect (lines 65–72) to the fallback mechanism: read `storedLang = getStoredLanguage()`; `const effective = storedLang && enabledLanguages.includes(storedLang) ? storedLang : DEFAULT_LANGUAGE`; if `effective !== DEFAULT_LANGUAGE` run `i18n.changeLanguage(effective)` + `setLanguageState(effective)`; always `setLanguageCookie(effective)`; and if `storedLang && storedLang !== effective` also `setStoredLanguage(effective)` and `router.refresh()`. Add `enabledLanguages` (and `router`) to the effect deps.
    - In `setLanguage` (line 74), add an early `return` if `!enabledLanguages.includes(lang)` (defensive — the switcher never offers a disabled locale, but guard anyway). Add `enabledLanguages` to its `useCallback` deps.
    - In the cross-tab `storage` effect (lines 106–117), also ignore an incoming `newValue` not in `enabledLanguages`.
  - Note: file is 141 lines with ample headroom for the ~15-line change.

- [ ] **E4: Hide / limit the switcher in the shared component**
  - Files: `src/components/LanguageToggle.tsx`
  - Details: `supportedLanguages` from `useLanguage()` already drives the dropdown option list (line 94), so "offer only enabled" needs no mapping change. Add, before the JSX `return` (after the hooks, e.g. after the `handleLanguageSelect` definition), `if (supportedLanguages.length <= 1) return null` so the toggle disappears entirely when a single locale is enabled. This one change covers every render site listed in the mechanism notes. (Hooks stay above the early return to respect the Rules of Hooks — all `useState`/`useEffect`/`useRef` in this component are already declared before the return.)

- [ ] **E5: Immediate reflection after saving Content Languages (recommended)**
  - Files: `src/app/admin/settings/SettingsForm.tsx`
  - Details: On save success the form only resets the dirty flag (effect at line 143–147); the admin top-bar switcher won't reflect a newly disabled locale until the layout re-renders. Import `useRouter` from `next/navigation`, create `const router = useRouter()`, and call `router.refresh()` inside the existing `if (state.success)` effect so the root layout re-fetches config and the switcher updates without a manual reload. `saveSettings` already `revalidatePath("/", "layout")`, so the refresh picks up the new `enabledLocales`. File is 474 lines — add ONLY the import + `useRouter()` + `router.refresh()` (~3 lines) and nothing else, to stay under the 500-line limit.
  - Verify: `npm run build`, `npm run lint` (zero warnings), `npm run test` all green. In admin Settings → Content Languages: with all 3 enabled the top-bar switcher lists PL/UA/EN; disable `uk` and save → the switcher drops UA (and the client-facing toggle too); disable `en` as well, leaving only `pl` → the switcher disappears everywhere. Separately: set the UI language to `uk`, then disable `uk` and reload — the app falls back to Polish and the `lang` cookie/localStorage are rewritten to `pl`.

### Cross-cutting
- [ ] **i18n keys**: add the new UI strings (language-tab labels reuse `LANGUAGE_NAMES`; settings "Content languages" section title/description/hint; any per-locale input helper text) to `src/locales/{pl,en,uk}.json` in all three files, keeping them in sync. (Group E adds no new UI strings — the switcher only shows fewer options / hides — so no new keys for E.)
- [ ] **DOX pass**: update the nearest owning `AGENTS.md` files for changed subtrees (`prisma/AGENTS.md` for the new columns/migration, `src/lib/AGENTS.md` for `localized-content.ts` and the removal of `procedure-translator.ts`, `src/app/admin/AGENTS.md` if authoring workflow rules change, `src/components/AGENTS.md` if `LocalizedFieldInput` warrants a note; for Group E note in `src/components/AGENTS.md` / relevant doc that the language switcher is now gated by `enabledLocales` and hides at a single locale). Refresh any affected Child DOX Index entries.
- [ ] **ROADMAP**: mark the Priority 5 multilang item done with a short note (do this only when the user confirms the feature complete, not mid-stage).

## Acceptance Criteria
- [ ] `npm run build`, `npm run lint` (zero warnings), `npm run test` all pass after every group.
- [ ] Migration preserves data: every existing `Service.name` value is present in `name_pl`; every existing `MasterProfile.bio` value is present in `bio_pl` (verified in `prisma studio`).
- [ ] Admin can enter pl/en/uk values for service names and master bios; input UI collapses to a single field when `TenantConfig.enabledLocales` has one locale, and shows tabs for the enabled subset otherwise.
- [ ] Client booking flow, homepage bios, admin tables, staff appointment views, and client profile all display the service name / bio in the viewer's current UI language, falling back to `pl` (then any non-empty variant) when the current-locale value is empty.
- [ ] Booking confirmation/reminder notifications render the Polish (default-locale) service name.
- [ ] `src/lib/procedure-translator.ts` is deleted and has zero remaining references.
- [ ] The language switcher (client site + admin top bar) offers only the tenant's `enabledLocales`; disabling a locale removes it from the switcher app-wide (not just in service/master forms).
- [ ] When exactly one locale is enabled, the switcher renders nothing (no dead single-option control) at every render site.
- [ ] A session whose `lang` cookie / `localStorage` points at a now-disabled locale silently falls back to `pl` (default, always-enabled) on next load, with the cookie rewritten — no broken/blank UI language.
- [ ] Switcher gating reuses the existing `enabledLocales` / `parseEnabledLocales` — no second config field is introduced.
- [ ] Follows project conventions (i18n keys in all 3 locale files, encrypted-secret rules untouched, DOX pass done).

## Constraints & Risks
- **500-line file limit** — flag & split proactively:
  - `MasterForm.tsx` (currently 372 lines): adding per-locale bio must go through the shared `LocalizedFieldInput` component (net add ~10–15 lines), not inline three fields. Watch the count.
  - `SettingsForm.tsx` (currently 474 lines): put the `enabledLocales` UI in the new `LanguagesSection.tsx` and render it with a few lines — do NOT inline the section or the file exceeds 500. For Group E's E5, the ONLY permitted edit is `useRouter` + one `router.refresh()`; add nothing else here.
  - Group E's other targets have ample headroom: `LanguageContext.tsx` (141), `LanguageToggle.tsx` (123), `providers.tsx` (43), `layout.tsx` (161), `tenant.ts` (77).
- **Migration is destructive if the data-copy edit is wrong.** The SQLite table-rebuild drops the old `name`/`bio` columns; the `INSERT ... SELECT` mapping (`name`→`name_pl`, `bio`→`bio_pl`) is the only thing preserving data. Verify on a DB copy / via `prisma studio` before considering A2 done. Take a backup of `prisma/app.db` first.
- **`name_pl` is NOT NULL.** All create paths (admin `ServiceForm`, master-services API, seeds/scripts if any create services) must always supply `name_pl`. Grep for every `service.create`/`service.update` to ensure none omit it.
- **Non-breaking route evolution** — appointment routes must keep the flat `procedureName` field alongside the new variant fields so cross-group consumers never see an undefined name during the staged rollout.
- **`procedure-translator.ts` deletion tradeoff** (Architecture §5) — legacy hardcoded procedure strings lose auto-translation until an admin fills the new columns; no data loss, resolver falls back to the preserved Polish. Confirm the user accepts before deleting (they chose the structural approach, so this is expected).
- **Switcher gating (Group E) reuses `enabledLocales`** — do NOT add a second config field; parse the existing one with `parseEnabledLocales`. `DEFAULT_LANGUAGE` (`pl`) is guaranteed enabled by `saveSettings` (actions.ts line 134), so it is always a safe UI-language fallback target — do not weaken that invariant.
- **Group E fallback stays client-side** — do NOT add a DB/tenant-config read to `getServerLanguage()` in `src/lib/i18n-server.ts` (it must remain a DB-free cookie reader). The client provider reconciles a stale `lang` cookie to `pl` on mount; the only visible edge is a single transient server paint of a disabled non-`pl` UI string, which self-corrects.
- **Group E is independent of Groups C/D** (no shared files, no hard dependency); recommended order is after D. Keep all three locales enabled while verifying C/D's live-switch checks so no test locale is unavailable.
- **Do not touch:** the `Service.description*` dead fields in `api-responses.ts` (out of scope), encryption/auth flows, unrelated `TenantConfig` fields, `User.name` (master display name is out of scope — only `MasterProfile.bio`).
- **No dev server / no chaining stages** (user preferences): use one-shot `build`/`lint`/`test`/`prisma migrate` commands only, and stop after each group for manual user verification before starting the next.

## Manual checks for the user (per group, hand off after each)
- After A: existing services and master bios still show (in Polish) everywhere; nothing looks changed; DB columns backfilled correctly.
- After B: in Settings, toggle content languages; in Services and Masters forms, enter distinct pl/en/uk values; confirm they save (admin tables reflect the current UI language).
- After C: on the public booking page and homepage, switch language and confirm procedure names and master bios change live.
- After D: check the admin calendar/today's list, master appointment list, and client profile appointments show localized names; send/trigger a test confirmation and confirm the notification shows the Polish name.
- After E: in Settings → Content Languages, toggle locales and confirm the switcher (homepage/client pages AND admin top bar) shows only the enabled set; disable down to a single locale and confirm the switcher disappears everywhere; then set the UI to a locale, disable it, reload, and confirm the app falls back to Polish (and the switcher no longer lists the disabled locale).
