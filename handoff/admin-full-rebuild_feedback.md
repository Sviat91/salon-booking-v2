# Admin panel rebuild — reviewer feedback

## Stage 1 — Shared infra (Sheet/Dialog/Switch/SubNav)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/admin/shared/{Sheet,Dialog,Switch,SubNav}.tsx`.

- Props match plan exactly. Switch dimensions/tokens match production `src/components/ui/switch.tsx` byte-for-byte. SubNav layout classes near-identical to `DatabaseSubNav.tsx`, correctly swapping Next.js routing/i18n for local props.
- Sheet/Dialog are reasonable simplified equivalents of the real `@base-ui/react`-based primitives (missing enter/exit transitions — acceptable, plan calls these "minimal inert").
- No `fetch`/`localStorage`. Not wired into any page yet (grep-confirmed).
- All 4 files well under 500 lines (34/33/43/31).
- Plan checkboxes scoped correctly to only the 4 "Shared infra needed" items.
- Build verified clean by orchestrator directly (`npm run build` in `demo-widget/`) since reviewer had no Bash access this pass.

No issues found.

---

## Stage 2 — Calendar (Month/Week/Day views, 3 modals, master filter)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/admin/pages/CalendarPage/{index,CalendarToolbar,MasterSelectDropdown,MonthView,WeekView,DayView,AppointmentModal,ViewAppointmentModal,BulkSettingsModal,calendarUtils}.tsx|ts`, plus `mockAdminData.ts` (extended, backward-compatible) and deletion of the old flat `CalendarPage.tsx`.

### Passed
- All 8 plan checklist items genuinely satisfied (not just claimed): functional Month/Week/Day toggle, real month grid with day→Day-view jump, Day view reusing `PIXELS_PER_MINUTE = 1.5`, `ViewAppointmentModal`/`AppointmentModal`/`BulkSettingsModal` all real-shaped and verified inert (Save/Delete/Apply terminate in `onClose` only, no mutation of `mockAdminData`), `MasterSelectDropdown` genuinely filters appointments across all 3 views, "Edit Schedule" stays inert.
- No `fetch`/`localStorage` anywhere in the new files.
- `mockAdminData.ts` type extension confirmed backward-compatible by direct read of `DashboardPage.tsx`/`MastersPage.tsx` (not just trusting the coder's claim).
- All files well under 500 lines (largest 132).
- Plan checkboxes scoped correctly to only the Calendar section.
- `bg-red-600`/`text-red-600` explicit-color workaround for Delete buttons justified: verified no `--destructive` CSS var exists anywhere in the repo; broken `text-destructive` usages pre-exist elsewhere (`PagesPage.tsx`, `ServicesPage.tsx`, `DiscountsPage.tsx`, `AdminSidebar.tsx`, `badge.tsx`) and are correctly left untouched as out of scope for this task.
- Build verified clean by orchestrator directly (`tsc -b && vite build`, clean, only pre-existing chunk-size warning).

### Minor (fixed post-review by orchestrator, trivial)
- `AppointmentModal.tsx` used the bare `React.ReactNode` global instead of `import type { ReactNode } from 'react'` (inconsistent with the rest of `demo-widget/src/admin`, including the Stage 1 primitives). Fixed directly — added the import, changed the one usage. Re-verified build clean after the fix.

### Noted, not fixed (non-blocking, future cleanup candidate)
- `ViewAppointmentModal.tsx` hand-rolls its own "Delete booking?" confirm overlay instead of reusing the shared `Dialog` primitive from Stage 1, despite matching its prop shape. Cosmetic/DRY nit only — left as-is per surgical-scope rule (not part of this task's brief, no functional impact).

No Critical/Architectural issues at either stage.

---

## Stage 2b — Calendar bug-fix pass (dark-theme lines, header/grid alignment, step selector)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/index.css`, `demo-widget/tailwind.config.ts`, `demo-widget/src/admin/pages/CalendarPage/{WeekView,DayView,CalendarToolbar,index}.tsx`.

User reported (with screenshot of the real production calendar as reference): dark-theme grid lines rendered bright white instead of subtle, the day-header column dividers drifted out of alignment with the grid body's dividers, and the toolbar's minute-step selector did nothing.

### Root causes (diagnosed by orchestrator before dispatch, verified against compiled CSS)
1. `tailwind.config.ts` defined semantic colors as bare `var(--x)` strings — Tailwind 3.4 cannot generate opacity-modifier classes (`border-border/60`, `bg-muted/40`, etc.) from a bare `var()` color. Confirmed via grepping the built `dist/assets/*.css`: these classes generated no CSS at all, so affected elements fell back to inherited `currentColor` (near-white in dark mode).
2. Day-header row and hour-grid body were separate containers, header guessing scrollbar width via `pr-2` (8px) while the body's real browser scrollbar consumed a different amount — column boundaries drifted, worse to the right.
3. The step/interval selector button had no `onClick` at all — purely decorative, unlike production's functional 5/10/15/30/60-minute control.

### Fix
1. Converted `index.css` CSS custom properties from hex to space-separated RGB triplets, wrapped `tailwind.config.ts`'s color map in `rgb(var(--x) / <alpha-value>)` (standard shadcn/Tailwind pattern) — root-cause fix, also correctly resolves the same silent-no-op bug on every other already-built page (Services/Discounts/Masters/Pages/Settings/shared primitives), not just Calendar. Audited and rewrapped all 13 raw `var(--x)` usages elsewhere in `index.css`; confirmed zero raw usages remain in either `.css` or `.tsx` (independently grepped by both orchestrator-dispatched coder and reviewer).
2. Restructured `WeekView.tsx`/`DayView.tsx` so the header row lives inside the same scrolling container as the grid body, pinned via `position: sticky` — guarantees identical column-width math instead of guessing scrollbar width.
3. Lifted `step` state to `CalendarPage/index.tsx` (`useState(15)`, no localStorage per this demo's no-persistence policy), wired a real native `<select>` (5/10/15/30/60) into `CalendarToolbar.tsx`, and made `WeekView.tsx`/`DayView.tsx` gridlines follow production's formula (`24 * Math.floor(60/step) + 1` lines, hour lines solid, sub-hour lines dashed).

### Verification
- Reviewer (static-only, no Bash access this pass) confirmed all RGB triplets valid, Tailwind wrapping correct, zero raw `var()` leaks, sticky-header restructure preserves click-to-open/appointment-click/now-line/hour-labels, step wiring correct end-to-end, Month-view disabling preserved.
- Orchestrator independently ran `git status`/`git diff --stat` (exactly the 6 claimed files, no extraneous changes) and `npm run build` (clean) to close the gap left by the reviewer's missing Bash access.

No Critical/Architectural or Minor issues found.

---

## Stage 2c — Calendar hour range restricted to 08:00–21:00
**Date:** 2026-08-17
**Verdict:** APPROVED

Files: `demo-widget/src/admin/pages/CalendarPage/{calendarUtils,WeekView,DayView}.tsx`.

User requested the Week/Day grid show 08:00–21:00 instead of the full 00:00–23:00. Added shared `START_HOUR = 8` / `END_HOUR = 21` constants in `calendarUtils.ts`; `HOURS` now produces `[8..20]` (13 labels), `CONTAINER_HEIGHT = 13 * 60 * PIXELS_PER_MINUTE`. Hour labels, the step-based gridlines, the "now" red line, and appointment-block positioning were all re-derived relative to `START_HOUR` so all four share one coordinate system.

Reviewer traced the arithmetic by hand (concrete examples: 14:30 now-line lands at the same pixel as a 14:30 appointment block; 07:00/22:00 correctly fall outside the visible bounds and hide the now-line) — no drift between the four position calculations. Confirmed `MonthView.tsx`, `CalendarToolbar.tsx`, all three modals, `MasterSelectDropdown.tsx`, `index.tsx`, and `mockAdminData.ts` untouched; `PIXELS_PER_MINUTE` unchanged. Orchestrator independently confirmed via `git diff --stat` that only the 3 claimed files changed, and ran `npm run build` clean.

No issues found.

---

## Stage 3 — Edit Sheets for Services/Discounts/Masters/Pages (plan sections 3-6)
**Date:** 2026-08-17
**Verdict:** APPROVED

Files modified: `ServicesPage.tsx`, `DiscountsPage.tsx`, `MastersPage.tsx`, `PagesPage.tsx`. Files created: `ServiceEditSheet.tsx` (82 lines), `DiscountEditSheet.tsx` (147 lines), `MasterEditSheet.tsx` (131 lines), `PageEditSheet.tsx` (63 lines) — all in `demo-widget/src/admin/pages/`.

- All four Sheets correctly reuse the shared `Sheet` primitive. No fetch/localStorage anywhere; every Save closes only.
- Two explicitly-scoped interactive pieces verified safe: Discounts status-badge toggle and the "require promo code" conditional reveal are both local component state only, non-persisting.
- Spot-checked against real production forms (`ServiceForm.tsx`, `DiscountForm.tsx`+`DiscountScopeFields.tsx`+`DiscountWindowFields.tsx`, `MasterForm.tsx`+`MasterFooterBlockField.tsx`, `PageFormSheet.tsx`) — all plan-required fields present, including the two specifically flagged for verification (per-master price-override input in Services, "Manage pages"+"Access Recovery" block in Masters).
- Two trivial, non-blocking field-completeness gaps noted for optional future polish (not plan violations): `DiscountEditSheet.tsx` omits a standalone "Active" checkbox present in the real form (redundant with the table's own status toggle); `PageEditSheet.tsx` shows the visibility checklist unconditionally rather than only for globally-scoped pages (harmless for the demo's single mock page).
- All files well under the 500-line limit (largest 147).
- Plan checkboxes scoped correctly to sections 3-6 only.
- Orchestrator independently confirmed via `git diff --stat` (exactly 4 modified + 4 new files) and `npm run build` (clean).

No Critical/Architectural issues.

---

## Stage 4.5 — Email, Social Auth, Notifications, Booking Bot, Legal Documents (plan sections 8-12)
**Date:** 2026-08-17
**Verdict:** APPROVED

New: `demo-widget/src/admin/shared/SettingsSection.tsx` (shared card wrapper, mirrors the existing pattern already in `SettingsPage/index.tsx` without modifying it), `pages/EmailPage/{index,SmtpInstructions}.tsx`, `pages/SocialAuthPage.tsx`, `pages/NotificationsPage/{index,TelegramRecipientsField}.tsx`, `pages/ClientBotPage.tsx`, `pages/LegalDocumentsPage.tsx`.

- Field sets verified against real production source for all 5 pages — complete, structurally faithful, all inert (zero real fetch/localStorage, grep-confirmed independently by reviewer).
- Legal copy specifically checked given this project's past paraphrasing incident: `LegalDocumentsPage.tsx` imports `termsContent`/`privacyContent` directly from `demo-widget/src/lib/legalContent.ts`, the same source already used by the demo's own public `/terms`/`/privacy` pages — verbatim reuse, not paraphrased.
- Booking bot page correctly documents in-file that this is a real client-facing Telegram chat bot (grammy/long-polling), not n8n — addresses a documented past confusion in this project's planning.
- `AdminApp.tsx` correctly left untouched (routing wire-up is a separate later step).
- All files well under 500 lines. Plan checkboxes scoped to sections 8-12 only.
- Orchestrator independently confirmed via `git diff --stat` (6 new files/folders, only plan file otherwise touched) and `npm run build` (clean).

No Critical/Architectural or Minor issues.

---

## Stage 5 — Database (Clients + GDPR) and Admins (plan sections 13-14)
**Date:** 2026-08-17
**Verdict:** APPROVED

New: `DatabasePage/{index,ClientsTab,GdprTab}.tsx` (30/131/147), `AdminsPage.tsx` (110), `AdminEditSheet.tsx` (76).

- Table columns/badges verified against real `ClientsTable.tsx`/`GdprTable.tsx` — GDPR phone masking confirmed genuinely last-4-only (`'****' + phoneDigits.slice(-4)`), search scope matches real GDPR table (name-only).
- Admins card shows exactly the 6 required permission badges; "Super Admin" all-granted, second admin genuinely mixed.
- Every inert action traced by hand to a bare `close`/no mutation of the mock arrays — confirmed the only 3 live pieces (SubNav tab switch, Clients search, GDPR search) are the only ones with real effect.
- `Sheet`/`Dialog` correctly reused per plan's assignment (Sheet for Admins-edit, Dialog for Clients-edit/GDPR-confirm).
- Admins edit-Sheet showing Name/Email/Password fields (which real production omits in edit mode) is a deliberate, plan-mandated "fuller field set" deviation, not an oversight.
- No fresh instance of the known repo-wide `bg-destructive`/`border-input`/`bg-popover` styling gap; `hover:text-destructive` on row actions is consistent reuse of an already-accepted pre-existing pattern.
- All files under 500 lines. Plan checkboxes scoped to sections 13-14 only; section 15 and Routing change untouched. `AdminApp.tsx` confirmed untouched.
- Orchestrator independently confirmed via `git diff --stat` (3 new files/folders, only plan file otherwise touched) and `npm run build` (clean).

No Critical/Architectural or Minor issues.

---

## Stage 6 — DB Browser (plan section 15, final new page)
**Date:** 2026-08-17
**Verdict:** APPROVED

New: `DbBrowserPage/index.tsx` (182 lines), `DbBrowserPage/mockDbData.ts` (162 lines).

- **Highest-priority check passed**: all 11 tables' mock row objects verified field-by-field against `prisma/schema.prisma` directly — exact scalar-field match for every model, including the newer `appointment.discountId`/`originalPrice`/`finalPrice` triad, and correctly *not* over-including fields the model genuinely lacks (`passwordResetToken` has no `updatedAt`, `account` has no `createdAt`/`updatedAt`). No relation objects leaked, no invented fields.
- Masking verified exact against the real API route's `MASKED_FIELDS`: `user.password`/`passwordEncrypted` → `"[REDACTED]"` (null correctly preserved for the guest user, matching production's null-skip logic), `tenantConfig.smtpPass`/`googleClientSecret`/`applePrivateKey`/`telegramBotToken` → `"[REDACTED]"`, no other field redacted.
- Pagination genuinely functional (local `useState`, `PAGE_SIZE=5`), correctly hidden/shown per table's row count, demonstrated working on `appointment` (8 rows) and `account` (6 rows).
- Delete flow uses the shared `Dialog`, confirmed no mutation of the mock array.
- Confirmed the mobile-card-exception (stays horizontal-scroll table at all breakpoints) and header (name + row count + SUPERADMIN-only warning badge) both correct.
- Two purely cosmetic, non-blocking notes (not worth a follow-up pass): a few day-off `intervals` fields use `null` instead of schema's actual `"[]"` default; a few relation IDs (`u7`-`u12`) referenced in other mock tables aren't defined in the mock `user` table — no visible bug since the page has no joins.
- Both files well under 500 lines. Plan checkboxes scoped to section 15 only; "Routing change" section untouched.
- Orchestrator independently confirmed via `git diff --stat` (1 new folder, only plan file otherwise touched) and `npm run build` (clean).

No Critical/Architectural issues.

---

## Stage 4 — Settings: Security, Brand expansion, Background fields (plan section 7)
**Date:** 2026-08-17
**Verdict:** APPROVED

`SettingsPage.tsx` converted to a folder: `SettingsPage/{index,BrandSection,SecuritySection,BackgroundField}.tsx` (184/158/55/41 lines).

- Reviewer traced the only three live writes anywhere in the touched files (Salon Name, light/dark accent color) directly to the untouched `useBrand()`/`BrandContext` wiring — confirmed these are the sole live state, everything else grepped clean for fetch/localStorage and is disabled/inert-by-construction.
- `SecuritySection.tsx` copy verified against real `en.json` (`securityTitle`/`securityDesc`/`changeEmailTitle`), field sets correct.
- `BrandSection.tsx` structurally covers LogoEditor (light/dark upload, size, layer, show-on-pages, static position preview) + Favicon + ThemeToggleIconsSection. One documented simplification: "Stretch to Full Screen" toggle renders unconditionally rather than gated on `layer === 'below'` (no such state exists in the inert port) — reasonable, flagged as a trivial comment-documentation nit only, no functional impact, not worth a follow-up fix.
- `BackgroundField.tsx` confirmed present in both Light Theme and Dark Theme Colors sections.
- All files well under 500 lines. Plan checkboxes scoped to section 7 only.
- Orchestrator independently confirmed via `git diff --stat` (old flat file deleted, new folder added, only plan file otherwise touched) and `npm run build` (clean).

No Critical/Architectural issues.
