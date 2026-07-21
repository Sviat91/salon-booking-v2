# Plan: Admin Telegram Notification Recipients (multi-recipient list + creation/cancellation/reschedule notifications)

**Date:** 2026-07-21
**Status:** In Progress — Parts A-G complete, Part I (cancellation/reschedule) and Part H (DOX) pending

## Goal
Replace the single admin Telegram chat-ID field with an add/remove list of recipients, broadcast every admin/salon notification to all of them, fire the immediate "new booking" notification for admin- and master-created manual bookings, and additionally notify the salon on appointment **cancellation** and **reschedule** (date/time change) from every route that can perform them.

---

## Root Cause / Context (verified against current code this session)

### Part 1 — multi-recipient list + manual-creation notifications (original scope)
- **Immediate booking notification:** `notifyBookingConfirmation(appointmentId)` in `src/lib/notifications/index.ts` (lines 56-160). Telegram branch is gated by `config.notifTelegramEnabled && config.telegramBotToken && config.notifAdminChatId` (line 146) and sends ONE message via `sendTelegramMessage()` (`src/lib/notifications/telegram.ts`). Message text is hardcoded Polish "Nowa rezerwacja" (line 147) — **DO NOT touch the text/language.**
- **Only current caller** of `notifyBookingConfirmation()` is `src/lib/booking-service.ts` line 250: `notifyBookingConfirmation(created.id).catch(console.error)` (fire-and-forget, not awaited). `createBooking()` is reached only from `POST /api/book` and the client Telegram bot — i.e. only CLIENT-initiated bookings notify today.
- **Manual creation routes DO NOT notify:** `POST /api/admin/calendar/appointments/route.ts` (loop pushes to `createdAppointments` as `appt`) and `POST /api/master/appointments/route.ts` (same `appt` variable). Both create a SERIES of appointments and never call `notifyBookingConfirmation`. Confirmed root cause of the user's live test (manual admin booking → no Telegram alert).
- **Schema today:** `TenantConfig.notifAdminChatId String?` (`prisma/schema.prisma` line 271) — exactly one recipient.
- **Other `notifAdminChatId` references (all must be handled):**
  - `src/lib/notifications/index.ts` — used in THREE places: `notifyBookingConfirmation` (146), `notifyBookingReminders` (335), and **`notifyContactForm` (403)**. Dropping the column will break `tsc` unless all three are handled (see D6 + Correction 1).
  - `src/lib/tenant.ts` — `DEFAULT_CONFIG` object (line 51: `notifAdminChatId: null`), passed to `prisma.tenantConfig.create({ data: DEFAULT_CONFIG })` (line 72). Must drop the key or `create` fails to typecheck.
  - `src/app/api/admin/notification-settings/route.ts` — GET returns it (line 26), PATCH schema+apply (lines 9, 48).
  - `src/app/admin/settings/notifications/NotificationSettingsForm.tsx` — zod schema (28), defaults (79), `load()` reset (110), submitted in `onSubmit` values.
- **UI precedents:** `AppointmentModal.tsx` inline "+ Add date (series)" rows (`addEntry`/`removeEntry`/`entries.map`) — inline add-row + trash-per-row, chosen pattern. `AdminsClient.tsx` — immediate add/delete via API + `router.refresh()` — chosen data-flow pattern.
- **i18n:** all copy in `src/locales/{pl,en,uk}.json` under `admin.settings.notifications`. `npm run i18n:check` requires the three files to have identical key sets and every referenced key to exist.
- **`NotificationLog` schema (`prisma/schema.prisma` 281-292):** `appointmentId String?` is a **plain optional string, NO relation/FK** — safe to log a dangling id even after an appointment is hard-deleted. The `type` comment (line 283) already anticipates `BOOKING_CANCELLATION` as a value; existing values are noun-form (`BOOKING_CONFIRMATION`, `BOOKING_REMINDER_24H`, `BOOKING_REMINDER_2H`, `CONTACT_FORM`).

### Correction 1 — admin/salon reminders REMOVED (not migrated)
- The 24h/2h reminders are **client-only**. The salon's internal notification is only the immediate at-booking one. Therefore the admin-Telegram send inside `notifyBookingReminders()` must be **DELETED**, not migrated to the recipient list.
- `notifyBookingReminders()` current per-appointment dedup (lines 258-347) checks **three** channels independently:
  - `alreadyEmail` (260) → `emailDone` (284) — client email reminder. **KEEP.**
  - `alreadyTelegram` (269, `channel:'telegram'`, admin) → `telegramDone` (285) → used in the early-skip `if (emailDone && telegramDone && clientTelegramDone)` (287) and the send block (335-347). **REMOVE all of this** (the admin-Telegram query, the `telegramDone` var, the send block).
  - `alreadyClientTelegram` (278, `channel:'telegram_client'`) → `clientTelegramDone` (286) — the client-Telegram reminder from `src/lib/notifications/client-telegram.ts`. **KEEP untouched.**
  - Whole-function early guard line 177: `if (!config.notifEmailEnabled && !config.notifTelegramEnabled && !config.clientBotEnabled) return`. After removing admin Telegram, `notifTelegramEnabled` no longer participates in reminders → drop `!config.notifTelegramEnabled` from this guard so the function correctly no-ops when only admin-Telegram is enabled.
- `sendTelegramMessage` import stays (still used by confirmation, contact form, and the new cancellation/reschedule notifiers via `broadcastTelegram`). The client-facing reminder paths (client email + `client-telegram.ts`) are **completely unaffected**.

### Correction 2 — cancellation & reschedule notifications (new requirement)
The salon must ALSO be notified when an appointment is cancelled or rescheduled (date/time changed), broadcast to the SAME `TelegramNotificationRecipient` list, using the SAME `getTelegramRecipients()`/`broadcastTelegram()` helpers (D4). Full route inventory, each verified against current code this session:

**CANCELLATION routes**
| Route | Handler | Mechanism | Row after? | Before-state available |
|---|---|---|---|---|
| `src/app/api/admin/calendar/appointments/[id]/route.ts` | `DELETE` | **hard delete** (`prisma.appointment.delete`) | GONE | `findUnique` at line 24 (no include) |
| `src/app/api/master/appointments/[id]/route.ts` | `PATCH` | status → `CANCELLED_BY_MASTER` | exists | `update` returns `updated` (include service+client) |
| `src/app/api/master/appointments/[id]/route.ts` | `DELETE` | **hard delete** | GONE | `findUnique` at line 89 (no include) |
| `src/app/api/client/appointments/[id]/route.ts` | `DELETE` | status → `CANCELLED` (logged-in profile) | exists | `findUnique` at 204 (select only) then `update` |
| `src/app/api/bookings/cancel/route.ts` | `POST` | status → `CANCELLED` (phone-verified self-service) | exists | `findUnique` at 58 (include client) then `update` |

**RESCHEDULE routes (date OR startTime actually changed)**
| Route | Handler | Reschedule trigger | Old state source |
|---|---|---|---|
| `src/app/api/admin/calendar/appointments/[id]/route.ts` | `PUT` | old vs new `date`/`startTime` differ (`entries[0]`) | `appointment` findUnique line 63 |
| `src/app/api/master/appointments/[id]/route.ts` | `PUT` | old vs new `date`/`startTime` differ (`entries[0]`) | `appointment` findUnique line 132 |
| `src/app/api/client/appointments/[id]/route.ts` | `PATCH` | `body.newStartISO && body.newEndISO` present (time branch, 127-162) | `appointment` findUnique line 99 |
| `src/app/api/bookings/[id]/route.ts` | `PATCH` | time branch (`conflictWindow` set) AND `!hasConflict` | `appointment` findUnique line 86 |
| `src/app/api/bookings/update-time/route.ts` | `POST` | always a time change, on `!hasConflict` | `appointment` findUnique line 99 |

- **Two client self-service flows exist** (both must be covered): the logged-in **profile** page (`src/components/profile/EditAppointmentModal.tsx` → `/api/client/appointments/[id]` PATCH/DELETE), and the phone-verified **booking-management** module (`src/components/booking-management/api/bookingManagementApi.ts` → `cancelBooking`→`/api/bookings/cancel`, `updateBookingTime`→`/api/bookings/update-time`, `updateBooking`→`/api/bookings/[id]` PATCH, `updateBookingProcedure`→`/api/bookings/update-procedure`).

**Explicit scope EXCLUSIONS (reviewed, deliberately NOT notifying):**
- `src/app/api/bookings/update-procedure/route.ts` — changes `serviceId` + recomputed `endTime` only; `date`/`startTime` unchanged → not a reschedule. Procedure-only branches of the admin/master `PUT`, client `PATCH`, and `bookings/[id]` `PATCH` are likewise excluded when no `date`/`startTime` change occurs.
- `src/app/api/client/link-bookings/route.ts` and `src/app/api/auth/register/route.ts` — both do `appointment.updateMany({ data: { clientId } })` (guest-account merge / ownership reassignment); no status/date/time change → not a cancel/reschedule.
- GDPR consent erase/withdraw endpoints (`/api/consents/*`) — grep confirms they never mutate `Appointment` rows (erasure anonymises the client `User`, leaving appointments intact) → no notification applies.

---

## Architecture Decisions

**D1 — New Prisma model (no relation).** One `TenantConfig` singleton exists, so the table is implicitly tenant-scoped. No FK:
```prisma
model TelegramNotificationRecipient {
  id        String   @id @default(cuid())
  chatId    String
  label     String?
  createdAt DateTime @default(now())
}
```

**D2 — Drop `TenantConfig.notifAdminChatId` entirely, NO backfill.** Local dev DB, no production data. The single existing chat-ID value is intentionally NOT migrated — the user re-adds it once via the new UI (see Manual Verification).

**D3 — Recipient CRUD API (separate from the settings PATCH).** Own immediate add/remove endpoints, matching `AdminsClient`'s per-row immediacy:
- `src/app/api/admin/notification-settings/recipients/route.ts` — `GET` (list), `POST` (create one, returns created row).
- `src/app/api/admin/notification-settings/recipients/[id]/route.ts` — `DELETE`.
- Auth gate identical to the sibling settings route: `SUPERADMIN` or `ADMIN` only.
- Validation: `chatId` = `z.string().trim().min(1).max(64)`; `label` = `z.string().trim().max(64).optional()` (empty → null).

**D4 — Recipient resolution helpers in the sender.** Add two private helpers in `src/lib/notifications/index.ts`:
- `getTelegramRecipients()` → `prisma.telegramNotificationRecipient.findMany({ select: { chatId: true } })`.
- `broadcastTelegram(botToken, recipients, html)` → loops `sendTelegramMessage` per recipient, returns `{ anySuccess: boolean; lastError: Error | null }`.
Every Telegram send site (confirmation, contact form, **cancellation, reschedule**) fetches recipients ONCE per invocation and gates on `notifTelegramEnabled && telegramBotToken && recipients.length > 0`.

**D5 — `NotificationLog` for a multi-recipient send: one summary row per event.** One log row per event, `status:'sent'` if ≥1 recipient succeeded, else `'failed'` with `lastError.message`. `recipientId` stays null (salon-side chat IDs, not `User` rows). No per-recipient logging.

**D6 — `notifyContactForm` is migrated too (forced by D2).** Dropping the column makes `config.notifAdminChatId` a compile error at line 403. Same audience → same `getTelegramRecipients()` + `broadcastTelegram()` path. Mechanical consequence of D2, not new scope. Message text untouched.

**D7 — Frontend: extracted sub-component, inline add-row, own fetch/save flow.** Add `src/app/admin/settings/notifications/TelegramRecipientsField.tsx` (client component) inside the existing Telegram `SettingsSection`, replacing the removed `notifAdminChatId` `FormField`. Manages its own state (fetch on mount, add via POST, remove via DELETE, optimistic list update), independent of the parent react-hook-form. Row layout mirrors `AppointmentModal`'s inline entry rows (two small inputs + trash `Button`); inline add-row below the list; empty-state message when none.

**D8 — Fire manual-booking notifications fire-and-forget per created row.** In both manual-creation POST loops, after each `prisma.appointment.create(...)` call `notifyBookingConfirmation(appt.id).catch(console.error)` — NOT awaited, mirroring `booking-service.ts` line 250. Import from `@/lib/notifications`.

**D9 — REMOVE the admin/salon Telegram send from `notifyBookingReminders()` (Correction 1).** The reminder cron sends ONLY client email + client-Telegram. Delete the admin-`channel:'telegram'` send block AND its now-orphaned dedup (`alreadyTelegram` query, `telegramDone` var, and its term in the early-skip condition), and drop `!config.notifTelegramEnabled` from the whole-function guard (line 177). Do NOT touch email/client-Telegram reminder logic, windows, timing, or the cron. This supersedes the original "migrate reminders to broadcast" idea — reminders are removed, not migrated.

**D10 — Two new sender functions in `src/lib/notifications/index.ts` (Correction 2), mirroring `notifyBookingConfirmation`.** Both broadcast to the D4 recipient list, gated `notifTelegramEnabled && telegramBotToken && recipients.length > 0`, log one D5 summary row, and NEVER throw (wrap in try/catch like the rest of the file). Hardcoded-Polish, multi-line, mirroring the existing `Nowa rezerwacja` format — do NOT introduce i18n:
- `notifyBookingCancellation(appointment)` — `type:'BOOKING_CANCELLATION'`, `channel:'telegram'`. Suggested text (exact emoji/wording not load-bearing, keep Polish + the confirmation's multi-line shape):
  `<b>❌ Rezerwacja odwołana</b>\n👤 ${name}\n💆 ${service}\n👩‍🎨 ${master}\n📅 ${date} ${time}`
- `notifyBookingReschedule(appointmentId, oldDate, oldStartTime)` — `type:'BOOKING_RESCHEDULE'`, `channel:'telegram'`. Suggested text:
  `<b>📅 Rezerwacja przeniesiona</b>\n👤 ${name}\n💆 ${service}\n👩‍🎨 ${master}\n🔀 było: ${formatDate(oldDate)} ${oldStartTime}\n✅ jest: ${newDate} ${newTime}`
  Service name resolved at `DEFAULT_LANGUAGE` (like the admin copy in `notifyBookingConfirmation`).

**D11 — Cancellation notifier takes a PRE-LOADED appointment snapshot; reschedule notifier self-fetches by id.** Rationale: two cancellation routes **hard-delete** the row, so a self-fetch-by-id after the delete would return null, and firing before the delete would race the delete's own DB write. So `notifyBookingCancellation(appointment)` accepts an already-loaded object (captured before the delete) — no race, still fire-and-forget, never blocks the response. Reschedules never delete the row, so `notifyBookingReschedule(appointmentId, ...)` self-fetches the NEW committed state exactly like `notifyBookingConfirmation` (called after the awaited update/transaction).
- Cancellation param structural type (accepts both `include:{client:true,master:true,service:true}` full rows and narrower `select` shapes): `{ id: string; date: Date; startTime: string; client: { name: string | null }; master: { name: string | null }; service: { name_pl: string; name_en: string | null; name_uk: string | null } }`. Use `appointment.id` for the `NotificationLog.appointmentId` (safe as a dangling string per the no-FK schema, D-context).

**D12 — Reschedule = date OR startTime actually changed.** For the admin/master `PUT` routes (which may edit only service/client/notes), compare the pre-update `appointment.date.getTime()` / `appointment.startTime` against the new values and fire ONLY when one differs — a plain non-date edit must NOT spuriously fire a reschedule notification. For the client `PATCH` and `bookings/[id]` `PATCH`, the time branch is only entered when `newStartISO`/`newEndISO` are supplied, so its execution is the trigger; `bookings/update-time` always changes the time. In all cases pass the pre-update `appointment.date` + `appointment.startTime` as `oldDate`/`oldStartTime`.

**D13 — Both new notifiers are fire-and-forget from every call site.** `notifyBookingCancellation(appt).catch(console.error)` / `notifyBookingReschedule(id, oldDate, oldStartTime).catch(console.error)` — never awaited, never block the response (mirrors D8). For the two hard-delete routes, call cancellation **before** `prisma.appointment.delete(...)` using the snapshot already in hand.

**D14 — File-size guard for `src/lib/notifications/index.ts`.** Current 419 lines. Correction 1 removes ~22 lines; D4 helpers + confirmation/contact-form edits + the two new notifiers add ~120 → the file will likely exceed the 500-line limit. If it does after editing, extract the shared internals `logNotification`, `formatDate`, `getTelegramRecipients`, `broadcastTelegram` into `src/lib/notifications/internal.ts` and import them back into `index.ts` (keeps all public `notify*` functions and their call-site import path `@/lib/notifications` unchanged). Verify the final line count.

---

## Implementation Steps

### Part A — Schema & migration
- [x] Step A1: Add the `TelegramNotificationRecipient` model (D1) to `prisma/schema.prisma`. In the same edit, **remove** the `notifAdminChatId String?` line (271) from `TenantConfig`. Also extend the `NotificationLog.type` comment (line 283) to list the new `BOOKING_RESCHEDULE` value (`BOOKING_CANCELLATION` is already listed).
- [x] Step A2: Run `npx prisma migrate dev --name add_telegram_notification_recipients`. Confirm it creates the new table, drops the `notifAdminChatId` column, and regenerates the client. (Non-interactive shell rejected `migrate dev`; used `prisma migrate diff` + `migrate deploy` to produce the equivalent migration — see report.)
- [x] Step A3: In `src/lib/tenant.ts`, remove `notifAdminChatId: null,` (line 51) from `DEFAULT_CONFIG`.

### Part B — Recipient CRUD API
- [x] Step B1: Create `src/app/api/admin/notification-settings/recipients/route.ts`.
  - `GET`: auth-gate (SUPERADMIN/ADMIN, copy from sibling `notification-settings/route.ts`); return `prisma.telegramNotificationRecipient.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, chatId: true, label: true } })` as `{ recipients: [...] }`.
  - `POST`: auth-gate; parse `{ chatId, label? }` (D3 zod); create with `label: label || null`; return created `{ id, chatId, label }`. `ZodError` → 400.
- [x] Step B2: Create `src/app/api/admin/notification-settings/recipients/[id]/route.ts`.
  - `DELETE`: auth-gate; `prisma.telegramNotificationRecipient.delete({ where: { id } })` in try/catch (404 if not found); return `{ success: true }`.
  - Matched the synchronous `{ params }: { params: { id: string } }` style used by `src/app/api/admin/calendar/appointments/[id]/route.ts` (same admin tree).

### Part C — Sender: broadcast helpers + Correction 1 removal
- [x] Step C1: In `src/lib/notifications/index.ts` add the two private helpers from D4 (`getTelegramRecipients`, `broadcastTelegram`) near `logNotification`/`formatDate`.
- [x] Step C2: `notifyBookingConfirmation` Telegram branch (145-156): fetch recipients once, gate on `config.notifTelegramEnabled && config.telegramBotToken && recipients.length > 0`, send via `broadcastTelegram`, log one D5 summary row. Keep the hardcoded `msg` text exactly as-is.
- [x] Step C3 (Correction 1, supersedes the old "migrate reminders" step): In `notifyBookingReminders`, DELETE the admin-Telegram integration per D9:
  - Delete the `alreadyTelegram` query (269-276) and the `telegramDone` variable (285).
  - Change the early-skip condition (287) from `if (emailDone && telegramDone && clientTelegramDone)` to `if (emailDone && clientTelegramDone)`.
  - Delete the entire admin-Telegram send block (335-347, the `config.notifAdminChatId && !alreadyTelegram` branch).
  - Drop `!config.notifTelegramEnabled` from the whole-function guard (177).
  - Do NOT touch the `alreadyEmail`/`emailDone`/email send, the `alreadyClientTelegram`/`clientTelegramDone`/client-Telegram send, windows, timing, or `formatDate`. Re-read lines 236-372 in full before editing to keep the surrounding loop intact.
- [x] Step C4: `notifyContactForm` (403-414): migrate the same way as C2 (D6) — fetch recipients, gate on `recipients.length > 0`, broadcast, D5 summary log. Message text unchanged.
- [ ] Step C5: (deferred to Step I5) confirm final line count / extract per D14. (Not applicable this round — file is 424 lines after Parts A-G, well under 500; deferred to Part I round.)

### Part D — Settings API cleanup
- [x] Step D1: In `src/app/api/admin/notification-settings/route.ts` remove all `notifAdminChatId` handling: `PatchSchema` field (9), GET response field (26), PATCH apply line (48). Leave the rest untouched.

### Part E — Frontend
- [x] Step E1: Create `src/app/admin/settings/notifications/TelegramRecipientsField.tsx` (D7): `'use client'` component that fetches `/api/admin/notification-settings/recipients` on mount, renders each recipient row (chatId + label + trash `Button` → DELETE then remove from state), inline add-row (chatId `Input` + optional label `Input` + Add `Button` → POST then append), empty-state message, and group-chat help text. Add disabled while chatId blank or a request is in flight. `toast` for failures. Reuse `Input`/`Button` and `lucide-react` `Plus`/`Trash2`. (Deviation: used plain `<p>` label/description markup instead of `FormLabel`/`FormDescription` — those require an active `useFormField()`/RHF `FormField`+`FormItem` context which this standalone component intentionally does not have, per D7 "independent of the parent react-hook-form".)
- [x] Step E2: In `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`: remove `notifAdminChatId` from the zod `formSchema` (28), `defaultValues` (79), the `load()` `form.reset` (110); delete the `notifAdminChatId` `FormField` block (227-242); render `<TelegramRecipientsField />` in its place inside the Telegram `SettingsSection`. Remove only imports this edit orphans.
- [x] Step E3: Group-chat help copy (real Telegram steps): add the bot to the group; send any message; open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`; copy the negative `chat.id` (e.g. `-1001234567890`). Render via `<Trans>` with a `<code>` component (matching the existing `botTokenDesc`/`adminChatIdDesc` pattern), 2-3 sentences.

### Part F — i18n
- [x] Step F1: In all three `src/locales/{pl,en,uk}.json`, under `admin.settings.notifications`, ADD (identical key sets, translated): `recipientsLabel`, `recipientsDesc`, `recipientChatIdPlaceholder`, `recipientLabelPlaceholder`, `addRecipientBtn`, `removeRecipientAria`, `noRecipientsHint`, `groupChatHelp` (contains `<code>` markup), `recipientAddFailed`, `recipientDeleteFailed`, `recipientChatIdRequired`.
- [x] Step F2: In all three locale files REMOVE the now-orphaned keys `adminChatIdLabel`, `adminChatIdPlaceholder`, `adminChatIdDesc`. Keep the three files' key sets identical.

### Part G — Wire manual-creation routes (Part 1 of the brief)
- [x] Step G1: `src/app/api/admin/calendar/appointments/route.ts` — import `notifyBookingConfirmation` from `@/lib/notifications`; inside the `for (const entry of parsed.entries)` loop, right after `createdAppointments.push(appt)`, add `notifyBookingConfirmation(appt.id).catch(console.error)` (D8). Re-read the current loop first to confirm the `appt` variable name and bounds.
- [x] Step G2: `src/app/api/master/appointments/route.ts` — same treatment after its `createdAppointments.push(appt)`. Do NOT touch the `[id]` routes here (that is Part I).

### Part I — Cancellation & reschedule notifications (Correction 2)
- [ ] Step I1: Add the two notifiers to `src/lib/notifications/index.ts` (D10/D11), both `export async`, both wrapped in try/catch that logs and returns (never throw):
  - `notifyBookingCancellation(appointment)` — accepts the structural snapshot type from D11; early-return if `!config.notifTelegramEnabled || !config.telegramBotToken`; fetch recipients; `if (recipients.length === 0) return`; build the `❌ Rezerwacja odwołana` message (service at `DEFAULT_LANGUAGE`, client name fallback `'Klient'`, master fallback `'Mistrz'`, `formatDate(appointment.date)` + `appointment.startTime`); `broadcastTelegram`; log one D5 row `{ type:'BOOKING_CANCELLATION', channel:'telegram', appointmentId: appointment.id }`.
  - `notifyBookingReschedule(appointmentId, oldDate, oldStartTime)` — self-fetch `prisma.appointment.findUnique({ where:{id:appointmentId}, include:{ client:true, master:true, service:true } })` (return if null); same gating/recipients; build the `📅 Rezerwacja przeniesiona` message using `formatDate(oldDate)`+`oldStartTime` → `formatDate(appointment.date)`+`appointment.startTime`; `broadcastTelegram`; log `{ type:'BOOKING_RESCHEDULE', channel:'telegram', appointmentId }`.
- [ ] Step I2: Wire **cancellation** call sites (all fire-and-forget, `.catch(console.error)`, import from `@/lib/notifications`):
  - `src/app/api/admin/calendar/appointments/[id]/route.ts` `DELETE`: change the pre-delete `findUnique` (24) to `include:{ client:true, master:true, service:true }`; after the 404 guard, call `notifyBookingCancellation(appointment)` **before** `prisma.appointment.delete(...)` (snapshot in hand → no race, D11).
  - `src/app/api/master/appointments/[id]/route.ts` `DELETE`: same change to the pre-delete `findUnique` (89), fire before delete.
  - `src/app/api/master/appointments/[id]/route.ts` `PATCH`: add `master:{ select:{ name:true } }` to the existing `update` include (53-60, additive to the response); after the update call `notifyBookingCancellation(updated)`.
  - `src/app/api/client/appointments/[id]/route.ts` `DELETE`: change the status `update` (235-238) to capture `const updated = await prisma.appointment.update({ where:{id:appointment.id}, data:{status:'CANCELLED'}, include:{ client:true, master:true, service:true } })` (response stays `{success:true}`); call `notifyBookingCancellation(updated)` after.
  - `src/app/api/bookings/cancel/route.ts` `POST`: change the status `update` (104-107) to capture `const updated = await prisma.appointment.update({ where:{id:eventId}, data:{status:'CANCELLED'}, include:{ client:true, master:true, service:true } })`; call `notifyBookingCancellation(updated)` after.
- [ ] Step I3: Wire **reschedule** call sites (all fire-and-forget; capture `oldDate = appointment.date`, `oldStartTime = appointment.startTime` from the pre-update findUnique; D12):
  - `src/app/api/admin/calendar/appointments/[id]/route.ts` `PUT`: after `const updated = await prisma.appointment.update(...)` (106), compute `const dateChanged = appointment.date.getTime() !== updated.date.getTime()` and `const timeChanged = appointment.startTime !== updated.startTime`; `if (dateChanged || timeChanged) notifyBookingReschedule(updated.id, appointment.date, appointment.startTime).catch(console.error)`.
  - `src/app/api/master/appointments/[id]/route.ts` `PUT`: same comparison against `appointment` (132) and `updated` (174).
  - `src/app/api/client/appointments/[id]/route.ts` `PATCH`: set `const timeChanged = Boolean(body.newStartISO && body.newEndISO)`; after the `prisma.appointment.update` (180) succeeds, `if (timeChanged) notifyBookingReschedule(appointment.id, appointment.date, appointment.startTime).catch(console.error)`. Procedure-only PATCH → no notification.
  - `src/app/api/bookings/[id]/route.ts` `PATCH`: after the `$transaction` resolves, `if (conflictWindow && !hasConflict) notifyBookingReschedule(appointmentId, appointment.date, appointment.startTime).catch(console.error)` (i.e. only when the time branch ran and no conflict).
  - `src/app/api/bookings/update-time/route.ts` `POST`: after the `$transaction`, `if (!hasConflict) notifyBookingReschedule(eventId, appointment.date, appointment.startTime).catch(console.error)`.
- [ ] Step I4: Do NOT add any notification to `src/app/api/bookings/update-procedure/route.ts` or to the procedure-only branches (D13 exclusion). Leave `link-bookings`, `register`, and the GDPR endpoints untouched.
- [ ] Step I5: Confirm `src/lib/notifications/index.ts` line count. If > 500, extract `logNotification`, `formatDate`, `getTelegramRecipients`, `broadcastTelegram` into `src/lib/notifications/internal.ts` per D14 and import them; keep every public `notify*` export in `index.ts`.

### Part H — DOX
- [ ] Step H1: Update the nearest owning `AGENTS.md` files for changed contracts: `src/lib/notifications` (new `notifyBookingCancellation`/`notifyBookingReschedule` exports + reminders no longer send admin Telegram + multi-recipient broadcast), the `notification-settings` route index (new `recipients` endpoints), the appointment route trees that now emit notifications (`admin/calendar/appointments`, `master/appointments`, `client/appointments`, `bookings`), and `prisma` model list (new model, dropped field). Refresh affected Child DOX Index entries; note any docs deliberately left unchanged.

---

## Verification
Run after implementation (one-shot commands only — do NOT start a dev server):
- [x] `npx tsc --noEmit` — no type errors (catches every dropped-field reference and the notifier param types). PASS (clean, no output).
- [x] `npm run lint` — zero warnings. 40 pre-existing errors/5 warnings remain in unrelated files (auth routes, DayCalendar, EmailSettingsForm, tailwind.config.ts, test-*.cjs, etc.) — none in any file touched by Parts A-G; confirmed via grep for our filenames in the lint output (zero hits).
- [x] `npm run i18n:check` — identical key sets across pl/en/uk, no missing referenced keys. PASS (1139 keys in each locale, all 941 referenced keys resolve).
- [x] `npx vitest run` — existing suite green (`tests/lib/booking-service.test.ts` included). PASS — 22 files, 126 tests.
- [x] `npm run build` — production build succeeds. PASS (exit 0), new `/api/admin/notification-settings/recipients` + `/recipients/[id]` routes present in output.
- [x] `grep -rn "notifAdminChatId" src prisma` — zero matches in `src/` and `prisma/schema.prisma`. Matches remain only inside three PRE-EXISTING, already-applied historical migration `.sql` files (immutable point-in-time snapshots from before this session) — expected and correct, migrations are never retroactively edited.

## Acceptance Criteria
- [x] All verification commands pass. (For the Parts A-G scope of this round.)
- [x] Follows project conventions (surgical edits, files < 500 lines, no untouched-text drift).
- [x] `notifAdminChatId` no longer exists anywhere (schema, tenant default, settings API, form, sender).
- [x] The immediate booking confirmation and the contact-form notification broadcast to every `TelegramNotificationRecipient`; zero recipients = no Telegram send (email path unchanged).
- [x] `notifyBookingReminders` sends ONLY client email + client-Telegram reminders — no admin/salon Telegram ping — and its email + client-Telegram dedup/skip logic still works.
- [x] Manual bookings from the admin calendar and from a master's own calendar fire the immediate notification for EACH created appointment in a series, fire-and-forget.
- [ ] EVERY cancellation route (admin DELETE, master PATCH, master DELETE, client profile DELETE, phone-verified `bookings/cancel`) broadcasts a cancellation notification to all recipients; the two hard-delete routes send from a pre-delete snapshot with no race. — DEFERRED to Part I (not in scope this round).
- [ ] EVERY reschedule route (admin PUT, master PUT, client PATCH, `bookings/[id]` PATCH, `bookings/update-time`) broadcasts a reschedule notification with OLD → NEW date/time ONLY when `date`/`startTime` actually changed; plain non-date edits and procedure-only changes do NOT fire it. — DEFERRED to Part I (not in scope this round).
- [x] Recipients are added/removed on the Notifications settings page as distinct rows via the new CRUD API; group-chat help text present in all three languages.

## Constraints & Risks
- **DO NOT** change the hardcoded Polish message text/language in any sender (explicitly deferred) — new cancellation/reschedule messages must mirror the existing hardcoded-Polish, multi-line convention; no i18n system for notification bodies.
- **DO NOT** touch the CLIENT reminder logic in `notifyBookingReminders` (client email + `src/lib/notifications/client-telegram.ts`), its windows, timing, or cron — Correction 1 removes ONLY the admin/salon Telegram send + its dedup.
- **DO NOT** touch the client-facing Telegram booking bot (`src/lib/telegram-bot/**`) or `src/lib/notifications/client-telegram.ts`.
- **DO NOT** notify on procedure-only changes (`bookings/update-procedure`, procedure-only PUT/PATCH branches), on `link-bookings`/`register` ownership merges, or on GDPR erasure (they do not cancel/reschedule).
- **DO NOT** build a per-master dedicated bot (deferred).
- **DO NOT** automatic-backfill the old `notifAdminChatId` value (D2).
- Cancellation on the two HARD-DELETE routes MUST fire from the pre-delete snapshot (D11) — firing after the delete (or self-fetching by id) races the delete and loses the row.
- Reschedule detection MUST compare pre/post `date`+`startTime` on the admin/master `PUT` routes so plain edits don't spuriously notify (D12).
- Critical dependency: dropping the column forces the `notifyContactForm` and `tenant.ts DEFAULT_CONFIG` edits — skipping either breaks `tsc`. Grep for `notifAdminChatId` before finishing.
- `POST /api/admin/calendar/appointments` and `POST /api/master/appointments` were edited earlier this session — re-read their current loops before wiring Part G.
- Watch the 500-line limit on `src/lib/notifications/index.ts` (D14) — extract internals if exceeded.

---

## Manual verification (user — live in the browser)
Because the old single chat ID is intentionally dropped (D2), re-add it once.
1. **Admin → Settings → Notifications:** the old single "Admin Chat ID" field is gone; there is now a **recipients list**. Re-add your working chat ID. Ensure "Send Telegram notifications" is ON and the bot token is set. Add a **second** recipient so the list has two entries.
2. **Public site booking:** make a normal booking from the website. Confirm BOTH recipients receive "Nowa rezerwacja".
3. **Admin calendar manual booking:** create a new appointment (try a multi-date series). Confirm BOTH recipients receive a message for each created appointment.
4. **Master calendar manual booking:** log in as a MASTER, create an appointment. Confirm BOTH recipients receive the message.
5. **Cancellation — admin:** delete an appointment from the admin calendar. Confirm BOTH recipients receive the "❌ Rezerwacja odwołana" message.
6. **Cancellation — master:** as a MASTER, cancel your own appointment (and try the permanent-delete action if the UI exposes it). Confirm BOTH recipients receive the cancellation message in each case.
7. **Cancellation — client self-service:** cancel a booking as a client via the public booking-management flow (search by name+phone → cancel) and, if you use the logged-in profile page, cancel there too. Confirm BOTH recipients receive the cancellation message.
8. **Reschedule — admin:** edit an appointment and change its DATE/TIME. Confirm BOTH recipients receive "📅 Rezerwacja przeniesiona" showing old → new. Then edit an appointment changing ONLY the notes/service (not the date/time) and confirm NO reschedule message is sent.
9. **Reschedule — master:** as a MASTER, change an appointment's date/time and confirm the reschedule message; change only non-date fields and confirm none.
10. **Reschedule — client self-service:** move a booking to a new time via the booking-management flow and via the profile edit modal; confirm the reschedule message with old → new. Changing only the procedure must NOT send a reschedule message.
11. **Reminders unchanged for salon:** confirm the salon/admin recipients receive NO 24h/2h reminder pings (only the client does, via email / client bot) — this is the Correction 1 behaviour.
12. **Remove a recipient:** delete the second recipient, then create/cancel/reschedule once more; confirm the removed recipient no longer receives anything and the remaining one still does.
13. **Group chat (optional):** add the bot to a Telegram group, send any message, open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`, copy the negative `chat.id` into a new recipient row, then trigger a booking/cancel/reschedule and confirm the group receives the alert.
