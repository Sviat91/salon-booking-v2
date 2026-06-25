# Plan: Notification System

## Context

N8N was removed in a prior session, leaving two contact-form routes returning stubs (`console.log + 200`) and no post-booking notifications at all. This plan adds a full notification system with:
- **Email** (nodemailer already installed, SMTP in TenantConfig)
- **Telegram** (admin/master only — reuse existing `telegramBotToken` via native fetch, no new library)
- **SMS** — deferred (user confirmed: not now; leave a thin provider abstraction)
- **Reminders** (24h + 2h before appointment, via cron endpoint)
- **Admin settings page** to configure all of the above
- GDPR consent model: transactional notifications always send; reminders treated the same (Art. 6(1)(b))

---

## Architecture Overview

```
POST /api/book           → NotificationService.bookingConfirmation()
Cron /api/cron/reminders → NotificationService.sendReminders()
POST /api/support/contact     → NotificationService.contactFormAdmin()
POST /api/master/contact      → NotificationService.contactFormAdmin()

NotificationService
  ├── email.ts      (templates via existing sendEmail())
  ├── telegram.ts   (fetch to Telegram Bot API, no library)
  └── consent.ts    (type guard: TRANSACTIONAL always, REMINDER always per user decision)

NotificationLog (Prisma) — deduplication + audit trail
```

---

## Step 1 — Database: `prisma/schema.prisma`

### Add to `model User`
```prisma
telegramChatId  String?   // foundation for future client/master TG notifications
```

### Add to `model TenantConfig`
```prisma
notifEmailEnabled       Boolean  @default(false)
notifTelegramEnabled    Boolean  @default(false)
notifAdminChatId        String?  // Telegram chat_id for admin notifications
notifReminder24hEnabled Boolean  @default(false)
notifReminder2hEnabled  Boolean  @default(false)
```

### New model `NotificationLog`
```prisma
model NotificationLog {
  id            String   @id @default(cuid())
  type          String   // BOOKING_CONFIRMATION | BOOKING_REMINDER_24H | BOOKING_REMINDER_2H | BOOKING_CANCELLATION | CONTACT_FORM
  channel       String   // email | telegram
  appointmentId String?
  recipientId   String?
  status        String   // sent | failed | skipped
  error         String?
  sentAt        DateTime @default(now())

  @@index([appointmentId, type])
}
```

Run: `npx prisma migrate dev --name add_notification_system`

---

## Step 2 — Service Layer: `src/lib/notifications/`

### `src/lib/notifications/telegram.ts`
- `sendTelegramMessage(botToken: string, chatId: string, html: string): Promise<void>`
- Uses native `fetch` to `https://api.telegram.org/bot{token}/sendMessage`
- Does not throw on failure — logs error and returns

### `src/lib/notifications/email.ts`
New template functions (call existing `sendEmail()` from `src/lib/email.ts`):
- `sendBookingConfirmationToClient(to, data: { name, date, time, service, master })`
- `sendBookingConfirmationToAdmin(to, data)`
- `sendBookingReminderToClient(to, data, hoursAhead: 24 | 2)`
- `sendContactFormToAdmin(to, data: { senderName, senderEmail, message, subject? })`

### `src/lib/notifications/index.ts`
Main dispatcher — reads TenantConfig once per call, then fans out:

```ts
export async function notifyBookingConfirmation(appointmentId: string): Promise<void>
export async function notifyBookingReminders(): Promise<void>   // called by cron
export async function notifyContactForm(data): Promise<void>
```

Each function:
1. Loads config via `getTenantConfig()`
2. Loads appointment + client + master + service from DB
3. Sends to enabled channels (email if `notifEmailEnabled`, telegram if `notifTelegramEnabled` and `notifAdminChatId`)
4. Writes `NotificationLog` row per send attempt
5. Never throws — errors are caught, logged, and written to `NotificationLog.error`

`notifyBookingReminders()`:
- 24h window: find CONFIRMED appointments where `date` is within `[now+23h, now+25h]`
- 2h window: find CONFIRMED appointments where `date` is within `[now+1h45m, now+2h15m]`
- Skip if `NotificationLog` already has a `sent` row for that `appointmentId + type`
- Respects `notifReminder24hEnabled` / `notifReminder2hEnabled` flags

---

## Step 3 — Cron Endpoint: `src/app/api/cron/reminders/route.ts`

```ts
GET /api/cron/reminders
Authorization: Bearer ${CRON_SECRET}
```
- Validates bearer token against `process.env.CRON_SECRET`
- Calls `notifyBookingReminders()`
- Returns `{ sent: N, skipped: M }`

Add `CRON_SECRET` to `.env.example`. Configure Vercel Cron (or external cron) to hit this endpoint every hour.

---

## Step 4 — Admin Settings: Notification Page

### `src/app/api/admin/notification-settings/route.ts`
Pattern identical to `/api/admin/email-settings`:
- `GET` — returns `{ notifEmailEnabled, notifTelegramEnabled, notifAdminChatId, notifReminder24hEnabled, notifReminder2hEnabled }`
- `PATCH` — validates with Zod, updates TenantConfig, returns updated values

### `src/app/admin/settings/notifications/page.tsx`
Server component, auth-guarded (ADMIN/SUPERADMIN), renders `<NotificationSettingsForm>`.

### `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
Client component (~180 lines). Sections:

**Channels**
- Email notifications toggle (requires SMTP to be configured — show warning if SMTP host is empty)
- Telegram notifications toggle + Admin Chat ID input + instructions ("Send `/start` to your bot, then `/id` or use @userinfobot to get your chat ID")

**Reminders** (disabled if all channel toggles are off)
- Reminder 24h before toggle
- Reminder 2h before toggle

Save via `PATCH /api/admin/notification-settings`.

### Add navigation link
In `src/components/admin/AdminSidebar.tsx` (or wherever email/social settings links live): add "Notifications" link pointing to `/admin/settings/notifications`.

---

## Step 5 — Wire Up Existing Routes

### `src/app/api/book/route.ts`
After `prisma.appointment.create(...)` succeeds, add (fire-and-forget):
```ts
notifyBookingConfirmation(appointment.id).catch(console.error);
```
Do NOT await — booking response must not be delayed by notification.

### `src/app/api/support/contact/route.ts`
Replace the `console.log` stub:
```ts
await notifyContactForm({ senderName: body.name, senderEmail: body.email, subject: body.subject, message: body.message });
```

### `src/app/api/master/contact/route.ts`
Same replacement.

---

## Step 6 — `src/lib/tenant.ts`

Add defaults for new fields:
```ts
notifEmailEnabled: false,
notifTelegramEnabled: false,
notifAdminChatId: null,
notifReminder24hEnabled: false,
notifReminder2hEnabled: false,
```

---

## Files Changed / Created

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add User.telegramChatId, TenantConfig notif fields, NotificationLog model |
| `src/lib/tenant.ts` | Add defaults |
| `src/lib/notifications/index.ts` | NEW — main dispatcher |
| `src/lib/notifications/email.ts` | NEW — email templates |
| `src/lib/notifications/telegram.ts` | NEW — Telegram sender |
| `src/app/api/cron/reminders/route.ts` | NEW — cron endpoint |
| `src/app/api/admin/notification-settings/route.ts` | NEW — settings CRUD |
| `src/app/admin/settings/notifications/page.tsx` | NEW |
| `src/app/admin/settings/notifications/NotificationSettingsForm.tsx` | NEW |
| `src/app/api/book/route.ts` | Wire up confirmation |
| `src/app/api/support/contact/route.ts` | Replace stub |
| `src/app/api/master/contact/route.ts` | Replace stub |
| `src/components/admin/AdminSidebar.tsx` | Add nav link |
| `.env.example` | Add CRON_SECRET |

No new npm packages required.

---

## Verification

1. **Migration**: `npx prisma migrate dev --name add_notification_system` — should apply cleanly, no data loss.
2. **Email confirmation**: Book an appointment via the UI → check that `NotificationLog` has a row with `type=BOOKING_CONFIRMATION, status=sent` (via `npx prisma studio`).
3. **Telegram**: Set `notifTelegramEnabled=true` and `notifAdminChatId` in admin settings → book appointment → message arrives in Telegram.
4. **Reminders**: Hit `GET /api/cron/reminders` with correct bearer token manually → check `NotificationLog` rows. Second hit should produce `skipped` rows, not `sent`.
5. **Contact form**: Submit the support contact form → admin receives email/Telegram.
6. **Settings page**: Visit `/admin/settings/notifications` — all toggles save and reload correctly.
7. **Booking not blocked**: If SMTP is misconfigured, booking still completes; `NotificationLog` shows `status=failed` with error message.
