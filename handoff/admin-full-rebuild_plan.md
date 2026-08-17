# Admin panel — full 1:1 rebuild plan (not started)

## Goal
Every one of the 15 real SUPERADMIN admin sections gets rebuilt in
`demo-widget/src/admin/` as a structural 1:1 copy of the real component —
real fields, real labels, real layout, real mock data shaped like production
data. **Only two fields stay interactive: the light-theme and dark-theme
"Primary Button" accent colors in Settings.** Every other field, button,
toggle, tab, modal, and row action is visually and behaviorally present
(hover states, click opens the same panel/modal the real one would) but
writes nothing anywhere — no submit ever persists or calls anything.

This plan only maps what gets copied from where. **No code changes happen
until this plan is reviewed and approved.**

## Assumption to confirm
Salon Name (Settings → Brand) stays editable alongside the two accent
colors, same as the already-approved current build — your instruction this
pass named "colors/palette for light/dark theme" specifically, without
mentioning Name. Defaulting to **keep Name editable too** since that was
already built and never flagged as wrong. Say the word if Name should
become read-only as well.

## Source of truth
Real app root: `/Users/sviat/Salon_Booking_2.0/src/` (repo root, NOT
`demo-widget/`). Nav order confirmed against
`src/components/admin/adminNavItems.ts` — matches what's already in
`demo-widget/src/admin/adminNavItems.ts` exactly, no changes needed there.

Shared chrome already correctly ported and unchanged: `AdminSidebar.tsx`,
`AdminTopBar.tsx`, `AdminApp.tsx` shell, `AdminCard.tsx`, `StatCard.tsx`
(MD3 tone classes), `AdminThemeToggle.tsx`.

---

## 1. Dashboard — already built, needs one addition
**Real source:** `src/app/admin/page.tsx`, `TodaysAppointmentsTable.tsx`,
`src/components/admin/StatCard.tsx`.
**Target:** `demo-widget/src/admin/pages/DashboardPage.tsx` (edit existing).

- [ ] Confirm 4 `StatCard`s match real copy exactly: Today (sub "{{count}}
      masters active"), This week (sub "{{delta}} vs last week"), Revenue
      (value "{amount} zł", sub "This month"), Masters (sub = master names
      joined by " · ").
- [ ] Confirm `TodaysAppointmentsTable`: desktop table (Time/Client/Service/
      Master badge/Price/Status badge) + mobile card list.
- [ ] **Add missing "Quick Actions" card** (3 outline buttons: Services,
      Masters, Settings) — not yet present in the current build.

Editable: nothing. All real state (mock), no interaction changes anything.

---

## 2. Calendar — biggest scope decision in this plan
**Real source:** `src/app/admin/calendar/page.tsx` →
`src/app/admin/master/calendar/ModernCalendar.tsx` → `CalendarToolbar.tsx`,
`MonthView.tsx`, `WeekView.tsx`, `DayView.tsx`, `BulkSettingsModal.tsx`,
`AppointmentModal.tsx`, `ViewAppointmentModal.tsx`, `MasterSelectDropdown.tsx`.
**Target:** `demo-widget/src/admin/pages/CalendarPage.tsx` (currently
Week-only) + new `CalendarPage/` subcomponents.

Currently built: Week view only, toolbar present but every button inert.
Real app has 3 real views (Month/Week/Day) and 3 real modals.

- [x] **Month view** — build a real month grid (`MonthView.tsx` structure),
      mock appointments dotted per day, click a day → jump to Day view.
- [x] **Day view** — same absolute-positioned hour grid as Week, single
      column, `PIXELS_PER_MINUTE = 1.5` (already have this constant).
- [x] View toggle pill (Month/Week/Day) becomes **actually functional** —
      switches which of the 3 views renders. Nothing here writes data, so
      this is safe to make real.
- [x] **ViewAppointmentModal** — clicking an existing appointment block
      opens a real-looking view/edit modal (client/service/master/time/
      price + discount label if any). Edit/Duplicate/Delete buttons present,
      inert.
- [x] **AppointmentModal** — clicking empty grid space or an "Add" affordance
      opens the real create/edit form shell (client, service select, master,
      date/time, notes). Save button present, inert (closes modal only).
- [x] **BulkSettingsModal** — "Bulk Schedule Edit" button opens the real
      multi-day/multi-master schedule editor shell, inert Save.
- [x] `MasterSelectDropdown` — "All Masters" / "All Masters (Combined)" /
      per-master — **make this actually filter** which mock appointments
      show, since it's pure client-side filtering of already-local mock data.
- [x] "Edit Schedule" toggle — can stay inert (real one enables drag-editing
      of the weekly template, no meaningful mock version).

Editable/functional (safe, non-persisting): view toggle, master filter,
modal open/close. Everything that would *save* stays inert.

---

## 3. Services — already built, matches confirmed structure
**Real source:** `src/app/admin/services/page.tsx`, `ServicesClient.tsx`,
`ServiceForm.tsx`.
**Target:** `demo-widget/src/admin/pages/ServicesPage.tsx` (existing).

- [x] Confirmed correct: flat merged catalog, Name/Duration/Price/Special
      Prices badges/Actions. No changes needed to the table itself.
- [x] **Add the edit Sheet** — clicking Pencil (or "+ Add Service") opens
      the real `ServiceForm` shell: localized Name, Duration, Default Price,
      "Assign to Masters" checklist with per-master price-override inputs.
      Save button inert (closes only).

---

## 4. Discounts — already built, matches confirmed structure
**Real source:** `src/app/admin/discounts/page.tsx`,
`DiscountListClient.tsx`, `DiscountForm.tsx`, `DiscountScopeFields.tsx`,
`DiscountWindowFields.tsx`.
**Target:** `demo-widget/src/admin/pages/DiscountsPage.tsx` (existing).

- [x] Confirmed correct: table columns and all 3 rows.
- [x] Status badge (Active/Inactive) — **make actually clickable/toggling**
      local state only, since that's the real interaction and it's harmless
      (nothing persists past a refresh).
- [x] **Add the edit Sheet**: label, discount %, "require promo code"
      checkbox → conditional code field, "one use per client" checkbox,
      scope fields (All/Selected services), window fields (day toggles +
      time range), active from/until dates. Save inert.

---

## 5. Masters — already built, one addition
**Real source:** `src/app/admin/masters/page.tsx`, `MastersClient.tsx`,
`MasterForm.tsx`, `MasterFooterBlockField.tsx`.
**Target:** `demo-widget/src/admin/pages/MastersPage.tsx` (existing).

- [x] Confirmed correct: flex-card list (not table), ring-colored avatar,
      visibility badge.
- [x] **Add the edit Sheet**: avatar upload, Full Name, Email, localized
      Bio/Title, Appointment Color picker, "Show on homepage" checkbox,
      footer-block field. Inside the same Sheet, below the form: "Manage
      pages" button (inert — no nested page-list to fake) and "Access
      Recovery" block (Show password / New password fields, inert).

---

## 6. Pages — already built, matches confirmed structure
**Real source:** `src/app/admin/pages/page.tsx`, `PageListClient.tsx`,
`PageFormSheet.tsx`.
**Target:** `demo-widget/src/admin/pages/PagesPage.tsx` (existing).

- [x] Confirmed correct: drag handle/Title/Slug/Blocks/Visibility/Status/
      Actions.
- [x] **Add the edit Sheet**: title/enabled/visibility fields + "Manage
      blocks →" (inert — no block editor built, single real page doesn't
      need it demonstrated).

---

## 7. Settings — restructure + one addition
**Real source:** `src/app/admin/settings/page.tsx`, `SettingsForm.tsx`,
`SuperAdminCredentials.tsx`, `FormFields.tsx`, `LogoEditor.tsx`,
`ThemeToggleIconsSection.tsx`, `BackgroundSection.tsx`, `LanguagesSection.tsx`.
**Target:** `demo-widget/src/admin/pages/SettingsPage.tsx` (existing).

Confirmed section order already matches: Brand → Salon Contact Info →
Calendar Settings → Business Hours → Content Languages → Homepage widget →
Light Theme → Dark Theme Colors. One section is missing:

- [x] **Add "Security" section** (`SuperAdminCredentials.tsx`) at the very
      bottom, after an `<hr>`: two disabled cards, "Change Password"
      (current/new/confirm) and "Change email" (current password/new
      email). This was previously deliberately left out — including it now
      per "show everything, just make it inactive."
- [x] **Expand Brand section** — currently 3 dashed placeholder boxes. Real
      one has: `LogoEditor` (light/dark logo upload + position/size/pages/
      layer/fullscreen toggle controls, all disabled), Favicon upload,
      `ThemeToggleIconsSection` (custom light/dark icon upload, disabled).
- [x] **Add Background field** to Light Theme and Dark Theme sections
      (`BackgroundSection` — background image upload, disabled) — currently
      missing, only the color swatches are there.
- [x] Keep exactly two live fields: Salon Name, "Primary Button" (light),
      "Dark Primary Button" (dark) — unchanged from current build.

---

## 8. Email — new build
**Real source:** `src/app/admin/settings/email/page.tsx`,
`EmailSettingsForm.tsx`, `SmtpInstructions.tsx`.
**Target:** new `demo-widget/src/admin/pages/EmailPage.tsx`.

- [ ] One `SettingsSection` "SMTP Server" card: Host, Port (587), Username,
      Password (masked), Sender Display Name, Secure Connection (SSL)
      switch. "Save Config" / "Save & Send Test Email" buttons — the latter
      opens a small dialog with an email input, inert send.
- [ ] Sidebar instructions card (`SmtpInstructions`): collapsible `<details>`
      per provider (Gmail, Outlook, ...) with plausible host/port text.
- [ ] All fields disabled, plausible placeholder values (blank, matching a
      salon that hasn't configured SMTP yet — real default state).

---

## 9. Social Auth — new build
**Real source:** `src/app/admin/settings/social/page.tsx`,
`SocialSettingsForm.tsx`.
**Target:** new `demo-widget/src/admin/pages/SocialAuthPage.tsx`.

- [ ] 3 `SettingsSection` cards: Google Auth (Client ID, Client Secret),
      Telegram Auth (Bot Username, Bot Token), Apple Auth (Services ID,
      Team ID, Key ID, Private Key textarea). Single "Save Config" button,
      real page copy underneath. All disabled, all blank (unconfigured
      state, matches Loom & Blade using only credentials/password login in
      the public demo).

---

## 10. Notifications — new build
**Real source:** `src/app/admin/settings/notifications/page.tsx`,
`NotificationSettingsForm.tsx`, `TelegramRecipientsField.tsx`.
**Target:** new `demo-widget/src/admin/pages/NotificationsPage.tsx`.

- [ ] 3 `SettingsSection` cards: Email (toggle, disabled — "configure SMTP
      first" link to Email page), Telegram (toggle + Bot Token + dynamic
      recipient chat-ID rows, disabled), Reminders (24h/2h toggles,
      disabled).

---

## 11. Booking bot — new build
**Real source:** `src/app/admin/settings/client-bot/page.tsx`,
`ClientBotSettingsForm.tsx`.
**Target:** new `demo-widget/src/admin/pages/ClientBotPage.tsx`.

- [ ] "Booking bot" card: Enable toggle, Bot token, Bot username (with
      "Open bot in Telegram →" link), Website URL — all disabled.
- [ ] "How to set up" card: static 4-step `<ol>` (create bot via @BotFather
      → paste token → enable+save → done).
- [ ] Note in-file: this is a client-facing Telegram chat-booking bot, not
      an n8n webhook — confirmed via source, no n8n reference exists in the
      real app at all.

---

## 12. Legal Documents — new build
**Real source:** `src/app/admin/settings/legal/page.tsx`,
`LegalSettingsForm.tsx`.
**Target:** new `demo-widget/src/admin/pages/LegalDocumentsPage.tsx`.

- [ ] 2 `SettingsSection` cards: Terms of Use, Privacy Policy — each a large
      disabled textarea (20 rows) pre-filled with the real Privacy/Terms
      copy already written for the demo's public `/privacy` and `/terms`
      pages (reuse that text, don't rewrite). Markdown-lite formatting hint
      shown below each ("## Heading", "- list item", "**bold**").

---

## 13. Database — new build (Clients + GDPR, not backup/restore)
**Real source:** `src/app/admin/database/layout.tsx`,
`DatabaseSubNav.tsx`, `clients/page.tsx` → `ClientsTable.tsx`,
`gdpr/page.tsx` → `GdprTable.tsx`.
**Target:** new `demo-widget/src/admin/pages/DatabasePage.tsx` (internal
tab state, no real routing needed for a single-page demo).

- [ ] 2-tab underline sub-nav: Clients / GDPR.
- [ ] **Clients tab**: search box (client-side filter over mock rows is
      fine, harmless), table (Name/Phone/Email/Registered/Type badge
      Guest|Registered/Actions). Mock ~5 plausible client rows (can reuse
      names already invented for `mockAdminData.ts` appointments — Kasia
      Wiśniewska, Tomasz Nowicki, etc. — plus a couple more).
  - [ ] Edit action opens a small dialog (name/phone/email), inert save.
- [ ] **GDPR tab**: search box, table (Name/Phone masked `****last4`/
      Consent Date/Status badge Active|Withdrawn|Erased/Actions). Mock ~4
      rows matching the same mock clients where sensible.
  - [ ] Withdraw/Erase buttons open the real confirm-dialog pattern, inert.

---

## 14. Admins — new build
**Real source:** `src/app/admin/admins/page.tsx`, `AdminsClient.tsx`,
`AdminForm.tsx`.
**Target:** new `demo-widget/src/admin/pages/AdminsPage.tsx`.

- [ ] Flex-card list (same family as Masters): name/email, edit/delete icon
      buttons, bottom row of 6 permission badges (Clients: View/Edit/Delete,
      GDPR: View/Withdraw/Erase — green=granted/muted=not). One card for
      the current "S" superadmin (all granted), one invented second admin
      with partial permissions for visual variety.
- [ ] Edit Sheet: Full Name/Email/Password (create-only fields shown),
      permission checklists (Clients group, GDPR group). Inert save.

---

## 15. DB Browser — new build
**Real source:** `src/app/admin/db-browser/page.tsx`, `DbBrowserClient.tsx`.
**Target:** new `demo-widget/src/admin/pages/DbBrowserPage.tsx`.

- [ ] Left sidebar, the real 11 hardcoded table names: `user`,
      `masterProfile`, `service`, `masterService`, `consentRecord`,
      `schedule`, `appointment`, `dateOverride`, `tenantConfig`,
      `passwordResetToken`, `account`. Clicking one shows its row table.
- [ ] Header: table name + "{{count}} rows total" + "SUPERADMIN only"
      warning badge.
- [ ] Table columns derived from real Prisma field names, not invented —
      **before writing this page, read `prisma/schema.prisma` in full for
      the exact field list of all 11 models** (only `tenantConfig`, `user`,
      `consentRecord` were pulled during this planning pass; the other 8
      need a direct read at implementation time, not a guess).
  - [ ] Trailing Actions column, per-row Trash delete (inert, confirm dialog).
- [ ] Pagination footer (Prev/Page x of y/Next) — can be real if mock data
      is paginated client-side (harmless), otherwise static "Page 1 of 1".
- [ ] Exception to the table→card mobile pattern: stays a horizontal-scroll
      `<table>` at all breakpoints, confirmed in real `AGENTS.md`.

---

## Shared infra needed (new, used across several sections above)
- [x] Minimal inert **Sheet** component (right-side slide-over) — used by
      Services/Discounts/Masters/Pages/Admins edit panels. Open/close only.
      Landed at `demo-widget/src/admin/shared/Sheet.tsx`.
- [x] Minimal inert **Dialog** component (centered modal) — used by Email
      test-send, Database client edit, confirm-delete flows.
      Landed at `demo-widget/src/admin/shared/Dialog.tsx`.
- [x] Minimal **Switch** component — used by several Settings-family pages
      (Email secure toggle, Notifications toggles, Client Bot enable toggle).
      Landed at `demo-widget/src/admin/shared/Switch.tsx`.
- [x] Simple 2-tab underline **SubNav** — used only by Database.
      Landed at `demo-widget/src/admin/shared/SubNav.tsx`.

These are small, real-shaped, no data layer — just open/close local state,
matching the pattern already used for the Sheet-less pages today.

---

## Routing change
`AdminApp.tsx`: replace all 8 `PLACEHOLDER_SECTIONS` entries in the
`renderSection` switch with the 8 new real pages above. Delete
`PlaceholderPage.tsx` once nothing references it.

## Explicitly staying inert everywhere
Every Save/Submit/Add/Delete/Withdraw/Erase button, everywhere in all 15
sections: closes its modal/Sheet (if any) or no-ops. Nothing writes to
`localStorage`, nothing persists across reload — the only two exceptions in
the entire admin panel remain the light/dark accent colors (and Salon Name,
per the assumption above), which already persist via `BrandContext` exactly
as approved.

## Effort flags for the today/tomorrow decision
- Calendar (Month+Day views, 3 modals, working filters) is the single
  largest item — realistically its own session.
- 8 new pages (7-14) are each small-to-medium, similar shape to what's
  already built (Settings-family cards or table/card lists) — mechanical
  once source is read, but there are 8 of them.
- DB Browser needs a full `prisma/schema.prisma` read for 8 more models
  before writing mock rows — flagged above, not optional.
- Everything above assumes the shared Sheet/Dialog/Switch primitives get
  built once, early, then reused — do those first regardless of which
  section order you pick.

## Status
2026-08-14 — plan written per user request, no implementation started.
Awaiting go-ahead on scope (all of the above vs. a trimmed subset) and
timing (today vs. tomorrow, per usage limits).
