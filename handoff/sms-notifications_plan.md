# Plan: SMS notification channel + admin-editable reminder templates

**Date:** 2026-08-23
**Status:** In Progress

## Goal

Add SMS as a third reminder channel (BYO Twilio **or** SMSAPI.pl credentials, encrypted on `TenantConfig`) with admin-authored 24h/2h reminder bodies per language, and fix the already-diagnosed reminder-window timezone bug in the same effort.

---

## Architecture Decisions

### AD-1 — Timezone bug: reuse the existing `fromZonedTime` + `SCHEDULE_TZ` pattern

Already root-caused, **do not re-diagnose**. `notifyBookingReminders()` builds `` `${dateStr}T${appt.startTime}:00.000Z` ``, treating `Appointment.startTime` as UTC. It is Warsaw **local wall-clock** (written by `src/lib/booking-service.ts` via `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw' })`). In August (UTC+2) the 2h reminder fires at the appointment's actual start time.

Fix = `fromZonedTime(localStr, SCHEDULE_TZ)`, mirroring `src/lib/availability.ts:186`. `date-fns-tz@^3.2.0` is already a dependency — no new package.

The conversion is extracted into a pure exported helper so the fix is covered by a unit test rather than only by inspection. This mirrors the repo's established "extract to make testable" precedent (`buildBookingUpdateMessage` in `internal.ts`, `checkLoginGuards` in `auth-guards.ts`).

### AD-2 — `notifications/index.ts` must be split before SMS is added

`src/lib/notifications/index.ts` is **510 lines today — already over the project's 500-line limit**. `src/lib/AGENTS.md` explicitly says to split further growth out of this file. `notifyBookingReminders()` gains ~45 lines of SMS wiring, so it moves to its own module first, as a behavior-preserving extraction, re-exported from `index.ts` so no caller changes.

### AD-3 — Two providers behind one closure-based sender; `Error | null`, never throws

`getSmsSender(config)` returns `((to, text) => Promise<Error | null>) | null` — built **once per cron run** from the already-loaded `TenantConfig`, so credentials are decrypted once instead of per appointment. `sendSms(to, text)` is a thin convenience wrapper that loads config itself (used by the admin test-send route only).

**Deliberate deviation from the brief's `sendSms(to, text): Promise<void>`:** the return type is `Promise<Error | null>`, matching the nearest sibling `client-telegram.ts` and the `notifications/` module contract ("public functions never throw — errors are caught and written to `NotificationLog`"). The reminder loop needs the error text for `NotificationLog.error`; a thrown error would have to be re-caught anyway. Flag to the user if this is unwanted.

Both providers use native `fetch` (like `client-telegram.ts` / `telegram.ts`) — **no new npm dependency**, which also satisfies the "never import a library without verifying it exists in `package.json`" mandate.

### AD-4 — Encrypt every BYO credential; sender/from fields stay plaintext

`twilioAccountSid`, `twilioAuthToken`, `smsApiToken` all go through `src/lib/encryption.ts`. The Account SID is arguably a username (the SMTP precedent stores `smtpUser` plaintext, `smtpPass` encrypted), but encrypting it costs one `decrypt()` call and removes any judgement call — `prisma/AGENTS.md` forbids new plaintext secret columns. `twilioFromNumber` / `smsApiSender` are plaintext: they are displayed on the recipient's handset, they are not secrets.

Provider credential groups are **separate columns per provider**, not one generic `smsApiKey`. Switching provider back and forth is then lossless and a half-configured provider can't masquerade as configured. This matches how the schema already keeps `telegramBotToken` and `clientBotToken` separate.

### AD-5 — `NotificationTemplate` model with a `channel` column from day one

One row per `(type, language, channel)`. **Absent row = use the built-in default** — the table starts empty, there is no seeding step and no backfill. Saving an empty body deletes the row, which is how "reset to default" works.

`channel` is included now even though only `'sms'` is written this iteration: it is the one axis we know will be needed (the user explicitly asked not to paint the architecture into a corner), it costs one column, and adding it later would require a migration plus a unique-index change on a table that already has admin-authored data.

### AD-6 — One substitution engine, defaults as constants (not locale keys)

Placeholders: `{{clientName}}`, `{{date}}`, `{{time}}`, `{{service}}`, `{{master}}`, `{{brandName}}`.

`{{brandName}}` is added beyond the brief's five because an SMS from a numeric Twilio `From` gives the recipient no sender context at all — the brand has to be in the body.

Default bodies live as **constants in `src/lib/notifications/templates.ts`**, not in `src/locales/*.json`. Rationale: i18next would try to interpolate `{{clientName}}` itself and blank it out when no matching variable is passed, so locale-hosted defaults would need either an i18next escape hatch or a second substitution engine. Defaults here are *seed content for a DB-backed editor*, conceptually the same as `DEFAULT_CONFIG` in `src/lib/tenant.ts` (which also holds literal defaults rather than locale keys). `scripts/i18n-check.mjs` only inspects `t('...')` call sites, so this is not an i18n-parity violation.

`renderTemplate()` is the single engine used for both the stored body and the default body.

### AD-7 — Client consent: **no new checkbox, no schema change** (decided, not open)

`src/components/BookingForm.tsx:197-203` already carries the project's recorded 2026-08-07 decision: booking confirmation/reminder notifications are **transactional** under GDPR Art. 6(1)(b) (contract-necessary, no promotional content), so there is no separate opt-in; `ConsentRecord.consentNotificationsV10` is always recorded `true`.

An SMS reminder carries the same transactional content as the email/Telegram reminders already shipping under that basis, to a phone number the client supplied for that same booking. Same basis → **no new consent checkbox, no change to `CreateBookingConsents`, `consent-service.ts`, `ConsentRecord`, or `BookingConsentModal.tsx`.**

No new personal data is stored (`User.phone` already exists; `NotificationLog` stores no phone number), so the GDPR export/erase flows need no changes either.

**One guardrail this introduces:** the admin now authors the wording, so the template editor must carry a visible hint that this channel is for transactional reminders only and promotional content is not covered by that legal basis (see Step 10).

### AD-8 — Cron entrypoint is untouched

`src/app/api/cron/reminders/route.ts` needs **zero changes**. All wiring happens inside `notifyBookingReminders()`, and its `{ sent, skipped }` return shape is preserved. Do not add SMS-specific handling to the route.

### AD-9 — UI split: provider config on the existing page, template editor on its own page

- SMS provider/credentials/toggle → a new `SettingsSection` on the existing `/admin/settings/notifications` page (that is where the other two channels and the reminder toggles already live), extracted into a co-located `SmsSettingsSection.tsx` so `NotificationSettingsForm.tsx` (355 lines) stays well under 500.
- Template editor → its own page `/admin/settings/reminder-templates` + nav item. 2 types × up to 3 locales = 6 textareas plus placeholder chips and a segment counter; bolting that onto the notifications form would push it past 500 lines and risk the documented-as-fragile `settings-form` / `settings-dirty` contract. This also matches the repo's one-page-per-settings-concern convention (`email/`, `social/`, `notifications/`, `client-bot/`, `legal/`).

### AD-10 — SMS segment counter is in scope

SMS is a **paid, per-message** channel and Polish/Ukrainian diacritics force UCS-2 encoding (70 chars/segment instead of GSM-7's 160), silently doubling cost. A pure `estimateSmsSegments()` helper (~15 lines, unit-tested) plus a live counter in the editor is directly cost-relevant, not polish. Default bodies keep correct diacritics; the UI hint tells the admin that dropping them roughly halves the cost, and lets them choose.

### Explicit non-goals

- Booking confirmation / cancellation / update / contact-form notifications stay hardcoded and email/Telegram-only. Do not template them, do not send SMS for them.
- Email and Telegram reminder copy keeps using the existing `emailNotif.*` / `bot.*` locale keys. The template system applies to SMS only this iteration (that is what `channel` is for).
- The reminder day-bucket query (`date: { gte: todayUTC, lt: tomorrowUTC }`) is left as-is. It could theoretically miss an appointment whose Warsaw-local start crosses a UTC date boundary, but that requires a booking between 22:00–01:00 Warsaw, outside every realistic salon working window (`TenantConfig.workingHourStart/End` default 8–21). Note it, do not expand scope.
- No central/operator-billed SMS. BYO only.

---

## Implementation Steps

- [x] **Step 1: Fix the reminder-window timezone bug (do this first, standalone)**
  - Files: `src/lib/notifications/internal.ts`, `src/lib/notifications/index.ts`
  - In `internal.ts`, add:
    ```ts
    import { fromZonedTime } from 'date-fns-tz'
    import { SCHEDULE_TZ } from '@/lib/schedule-utils'

    /**
     * Reconstructs an appointment's absolute UTC instant from its stored
     * `date` (UTC midnight) + `startTime` ("HH:MM", Warsaw local wall-clock
     * as written by booking-service.ts). DST-aware.
     */
    export function appointmentStartUtc(date: Date, startTime: string): Date {
      const dateStr = date.toISOString().slice(0, 10)
      return fromZonedTime(`${dateStr}T${startTime}:00`, SCHEDULE_TZ)
    }
    ```
  - In `index.ts`'s `notifyBookingReminders()` post-filter (currently lines 244–250), replace the three lines building `fullISO`/`apptDateTime` with `const apptDateTime = appointmentStartUtc(appt.date, appt.startTime)`, add `appointmentStartUtc` to the existing `./internal` import, and **delete the now-wrong comment** `// startTime is treated as UTC; correct for Vercel/cloud (always UTC). Local dev: ensure TZ=UTC or results will shift.`
  - Do not change the window bounds, the day-bucket query, or anything else in this step.

- [x] **Step 2: Unit-test the timezone fix**
  - Files: `tests/lib/notifications-internal.test.ts`
  - Add an `appointmentStartUtc` describe block to the existing file (it already imports from `../../src/lib/notifications/internal` with **no mocks** — keep it that way).
  - Assert both DST sides, which is exactly what the old `Z`-suffix code got wrong:
    - `appointmentStartUtc(new Date('2026-08-15T00:00:00.000Z'), '14:00')` → `2026-08-15T12:00:00.000Z` (CEST, UTC+2)
    - `appointmentStartUtc(new Date('2026-01-15T00:00:00.000Z'), '14:00')` → `2026-01-15T13:00:00.000Z` (CET, UTC+1)

- [x] **Step 3: Prisma schema + migration**
  - Files: `prisma/schema.prisma`, `prisma/migrations/<new>/`, `src/lib/tenant.ts`
  - Add to `model TenantConfig`, grouped under a comment near the existing notification flags:
    ```prisma
    // SMS channel — BYO provider credentials (same pattern as SMTP above).
    // Secrets are encrypted at rest via src/lib/encryption.ts.
    notifSmsEnabled  Boolean @default(false)
    smsProvider      String  @default("twilio") // "twilio" | "smsapi"
    twilioAccountSid String?  // encrypted
    twilioAuthToken  String?  // encrypted
    twilioFromNumber String?  // plaintext, E.164 sender number
    smsApiToken      String?  // encrypted — SMSAPI.pl OAuth2 API token
    smsApiSender     String?  // plaintext, registered SMSAPI sender name
    ```
  - Add the new model:
    ```prisma
    // Admin-editable notification body text. One row per (type, language, channel).
    // An absent row means "use the built-in default" — the table starts empty and
    // is never seeded; saving an empty body deletes the row (reset to default).
    model NotificationTemplate {
      id        String   @id @default(cuid())
      type      String   // BOOKING_REMINDER_24H | BOOKING_REMINDER_2H (mirrors NotificationLog.type)
      language  String   // pl | en | uk (SUPPORTED_LANGUAGES)
      channel   String   // "sms" today; the axis exists for future email/telegram bodies
      body      String   // free text with {{placeholder}} tokens, see src/lib/notifications/templates.ts
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt

      @@unique([type, language, channel])
    }
    ```
  - Update the `NotificationLog.channel` comment to `// email | telegram | telegram_client | sms`.
  - Add all seven new `TenantConfig` fields to `DEFAULT_CONFIG` in `src/lib/tenant.ts` (`notifSmsEnabled: false`, `smsProvider: 'twilio'`, rest `null`) — it is both the DB-unavailable fallback and the auto-seed payload, and it types the cache generic. Easy to miss.
  - Migration: `npx prisma migrate dev --name add_sms_channel_and_reminder_templates`. Every new column is nullable or has a default, so the non-interactive-TTY workaround in `prisma/AGENTS.md` is **not** needed. Never hand-edit `migrations/` or `app.db`.

- [x] **Step 4: Template rendering (pure) + template store (Prisma)**
  - Files: `src/lib/notifications/templates.ts` (new), `src/lib/notifications/template-store.ts` (new)
  - `templates.ts` — **zero Prisma, zero React**, so it is testable with no mocks (same rule as `discounts/eligibility.ts`):
    - `export const REMINDER_TEMPLATE_TYPES = ['BOOKING_REMINDER_24H', 'BOOKING_REMINDER_2H'] as const` + type
    - `export const TEMPLATE_PLACEHOLDERS = ['clientName', 'date', 'time', 'service', 'master', 'brandName'] as const` + `TemplateVars = Record<Placeholder, string>`
    - `renderTemplate(body, vars)` — replace via `/\{\{\s*(\w+)\s*\}\}/g`; a **known** placeholder is substituted, an **unknown** one is left literal (a typo must be visible in the preview/SMS, never silently blanked). No HTML escaping — this is plain text.
    - `validateTemplateBody(body)` → `{ ok: true } | { ok: false; unknown: string[] }` for admin-side validation.
    - `estimateSmsSegments(text)` → `{ chars, encoding: 'gsm7' | 'ucs2', segments }`. GSM-7 alphabet check; segments = 160/153 for gsm7, 70/67 for ucs2.
    - `DEFAULT_REMINDER_BODIES: Record<ReminderType, Record<Language, string>>` — use exactly:
      - pl/24h: `{{brandName}}: przypominamy o wizycie jutro o {{time}} — {{service}}.`
      - pl/2h: `{{brandName}}: Twoja wizyta ({{service}}) zaczyna się o {{time}}.`
      - en/24h: `{{brandName}}: reminder — your {{service}} appointment is tomorrow at {{time}}.`
      - en/2h: `{{brandName}}: your {{service}} appointment starts at {{time}}.`
      - uk/24h: `{{brandName}}: нагадуємо про візит завтра о {{time}} — {{service}}.`
      - uk/2h: `{{brandName}}: ваш візит ({{service}}) розпочнеться о {{time}}.`
  - `template-store.ts` — the Prisma side:
    - `loadReminderTemplates(channel: string): Promise<Map<string, string>>` — one `findMany`, keyed `` `${type}:${language}` ``. Called **once per cron run**, not per appointment.
    - `resolveReminderBody(map, type, lang)` → stored body, else `DEFAULT_REMINDER_BODIES[type][lang]`, else the `pl` default.

- [x] **Step 5: SMS provider modules**
  - Files: `src/lib/notifications/sms/index.ts`, `src/lib/notifications/sms/twilio.ts`, `src/lib/notifications/sms/smsapi.ts` (all new)
  - `sms/index.ts`:
    - `export type SmsSender = (to: string, text: string) => Promise<Error | null>`
    - `SmsConfigSource` = a structural type over the seven new `TenantConfig` fields (so both a Prisma row and `DEFAULT_CONFIG` satisfy it).
    - `getSmsSender(config: SmsConfigSource): SmsSender | null` — returns `null` when `!notifSmsEnabled` or the selected provider's required fields are missing. Decrypts secrets via `decrypt()` from `@/lib/encryption` **once**, then returns a closure that: normalizes `to` with `normalizePhoneToE164()` from `@/lib/utils/phone-normalization` (returns `new Error('INVALID_PHONE')` if it throws) and delegates to the provider.
    - `export function isSmsConfigured(config): boolean` — same predicate, for UI/guard use.
    - `export async function sendSms(to, text): Promise<Error | null>` — loads `getTenantConfig()` itself, builds a sender, returns `new Error('SMS_NOT_CONFIGURED')` when there is none. **Only** the admin test-send route uses this; the cron path uses `getSmsSender`.
  - `sms/twilio.ts` — `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`, `Authorization: Basic ` + base64(`sid:token`), `Content-Type: application/x-www-form-urlencoded`, body `To`/`From`/`Body` via `URLSearchParams`. Non-2xx → `new Error('Twilio ' + status + ': ' + body)`.
  - `sms/smsapi.ts` — `POST https://api.smsapi.pl/sms.do`, `Authorization: Bearer <token>`, form-encoded `to`, `message`, `from`, `format=json`, `encoding=utf-8`.
    - **Footgun the coder must handle:** SMSAPI's `.do` endpoint returns HTTP 200 with an `{ "error": <code>, "message": "..." }` body on failure. Checking `res.ok` alone silently swallows every error. Parse the JSON and treat a present `error` field as a failure.
    - Verify the exact request/response shape against SMSAPI's current docs before finalizing; if it has changed, follow the docs and note the deviation in the feedback file.
  - Both providers: wrap `fetch` in `try/catch`, never throw, and pass `signal: AbortSignal.timeout(10_000)` — the hourly cron processes appointments serially and a hung provider socket would stall every remaining reminder.
  - No secret may ever be logged or included in a returned `Error` message.

- [x] **Step 6: Extract `notifyBookingReminders()` into its own module (behavior-preserving)**
  - Files: `src/lib/notifications/reminders.ts` (new), `src/lib/notifications/index.ts`
  - Move `notifyBookingReminders()` and its local `ReminderWindowConfig` interface verbatim into `reminders.ts` with its own imports. Header comment in the style of `booking-service.ts`: "Behavior-preserving extraction of the logic formerly inline in `index.ts` — see `src/lib/AGENTS.md`'s 500-line rule."
  - In `index.ts`, add `export { notifyBookingReminders } from './reminders'` and drop any imports the move orphaned (`sendClientBookingReminder`, `sendBookingReminderToClient`, `appointmentStartUtc`, etc. — remove only what *this* move orphaned).
  - `src/app/api/cron/reminders/route.ts` keeps importing from `@/lib/notifications` — **do not touch it**.
  - Verify `index.ts` is now comfortably under 500 lines (~320 expected) and no behavior changed.

- [x] **Step 7: Wire SMS as a third reminder channel**
  - Files: `src/lib/notifications/reminders.ts`
  - Before the window loop:
    - Widen the early return: `if (!config.notifEmailEnabled && !config.clientBotEnabled && !config.notifSmsEnabled) return { sent, skipped }`
    - `const smsSender = getSmsSender(config)` and `const smsTemplates = smsSender ? await loadReminderTemplates('sms') : null` — both once per run.
  - Per appointment, alongside the existing email / `telegram_client` dedup:
    - `const alreadySms = await prisma.notificationLog.findFirst({ where: { appointmentId: appt.id, type: window.type, channel: 'sms', status: 'sent' } })`
    - `const smsEligible = !!smsSender && !!appt.client.phone`
    - `const smsDone = alreadySms !== null || !smsEligible`
    - Extend the skip guard to `if (emailDone && clientTelegramDone && smsDone) { skipped++; continue }`
  - Send block (after the Telegram block), following the exact shape of the existing two:
    ```ts
    if (smsEligible && !alreadySms) {
      const lang = (appt.clientLanguage as Language) || DEFAULT_LANGUAGE
      const body = resolveReminderBody(smsTemplates!, window.type, lang)
      const text = renderTemplate(body, {
        clientName: clientData.name,
        date: clientData.date,
        time: clientData.time,
        service: clientData.service,
        master: clientData.master,
        brandName,
      })
      const sendErr = await smsSender!(appt.client.phone!, text)
      await logNotification({
        type: window.type,
        channel: 'sms',
        appointmentId: appt.id,
        recipientId: appt.client.id,
        status: sendErr ? 'failed' : 'sent',
        error: sendErr ? sendErr.message : undefined,
      })
      if (!sendErr) sent++
    }
    ```
  - Use `clientData` (client's booking-time language), never `data` — SMS is client-facing copy.
  - Keep the never-throw contract: no `throw` reaches the caller.

- [x] **Step 8: Admin API — SMS settings + test send**
  - Files: `src/app/api/admin/sms-settings/route.ts` (new), `src/app/api/admin/sms-settings/test/route.ts` (new)
  - `route.ts` mirrors `src/app/api/admin/email-settings/route.ts` exactly:
    - `GET` — ADMIN/SUPERADMIN gate; returns `notifSmsEnabled`, `smsProvider`, `twilioFromNumber`, `smsApiSender` verbatim and each secret as `"••••••••"` when set / `""` when not. **Never return a decrypted secret** (`src/app/admin/AGENTS.md` local contract).
    - `PATCH` — Zod-validated body; a secret equal to `"••••••••"` means "keep the existing value", anything else is `encrypt()`ed; empty string → `null`. Validate `smsProvider` against `['twilio','smsapi']`. Must call `invalidateTenantConfigCache()` after the write (mandatory per `src/lib/AGENTS.md` — 6 existing call sites show the pattern).
  - `test/route.ts` mirrors `email-settings/test/route.ts`: ADMIN/SUPERADMIN gate, accepts `{ to: string }`, calls `sendSms(to, '<brandName>: test')`, returns `{ success: true }` or `{ error }` with the provider's message. Rationale: BYO credentials fail silently inside an hourly cron otherwise.
  - `export const runtime = 'nodejs'` (Prisma + node `crypto`).

- [x] **Step 9: Admin API — reminder templates**
  - Files: `src/app/api/admin/reminder-templates/route.ts` (new)
  - `GET` — ADMIN/SUPERADMIN gate. For every (type × locale enabled via `parseEnabledLocales(config.enabledLocales)`) returns `{ type, language, channel: 'sms', body, isDefault }`, filling `DEFAULT_REMINDER_BODIES` where no row exists.
  - `PUT` — accepts `{ templates: [{ type, language, channel, body }] }`. Per entry: validate `type` against `REMINDER_TEMPLATE_TYPES`, `language` via `isValidLanguage()`, `channel === 'sms'`, `body.length <= 640`, and `validateTemplateBody(body)` (reject unknown placeholders with a `{ code }` the client maps through `apiErrorKey`). Blank/whitespace body → `delete` the row; otherwise `upsert` on the `(type, language, channel)` composite unique key.
  - No cache invalidation needed — templates are read directly from the DB once per cron run, not through `getTenantConfig()`.
  - Use `handleApiError()` / `ErrorResponses` (`src/lib/api/error-handler.ts`) — this is a new route, so it follows the current convention, not `email-settings`' older manual style.

- [x] **Step 10: Admin UI — SMS section on the notifications settings page**
  - Files: `src/app/admin/settings/notifications/SmsSettingsSection.tsx` (new), `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Extend the existing form schema with `notifSmsEnabled`, `smsProvider`, `twilioAccountSid`, `twilioAuthToken`, `twilioFromNumber`, `smsApiToken`, `smsApiSender`; load them in the existing `Promise.all` block via a fourth `fetch('/api/admin/sms-settings')`.
  - `onSubmit` splits the values three ways: the existing `notification-settings` PATCH, a new `sms-settings` PATCH, and the existing recipients diff — the same "one form, several endpoints" pattern `recipients` already uses. After save, **re-fetch sms-settings** and `form.reset` with the fresh masked values so the `"••••••••"` round-trip stays correct (mirrors the existing `fetchRecipients()` re-fetch).
  - `anyChannelEnabled` (which gates the 24h/2h reminder toggles) must now include `notifSmsEnabled`.
  - `SmsSettingsSection.tsx` takes `control` (same shape as the existing `TelegramRecipientsField.tsx`), renders inside a `SettingsSection` from `@/app/admin/settings/FormFields`:
    - `ToggleRow` for `notifSmsEnabled` (reuse the one already in `NotificationSettingsForm.tsx` — export it rather than copying).
    - A `Select` for `smsProvider` (Twilio / SMSAPI.pl).
    - Provider-conditional credential fields, `type="password"` + `autoComplete="off"` for the secrets.
    - A "Send test SMS" button hitting `/api/admin/sms-settings/test`, disabled while the form is dirty (credentials must be saved first), with a `toast.success`/`toast.error` result.
  - **All inputs must be bound via `FormField`/`Controller` with explicit `value`/`onChange`/`onBlur` — never `register()`.** `src/components/ui/input.tsx` is a plain function component under React 18; `register()`'s ref silently never attaches and Save dies with no visible symptom (documented 2026-08-07 bug in this very folder).
  - Keep `NotificationSettingsForm.tsx` under 500 lines.

- [x] **Step 11: Admin UI — reminder template editor page**
  - Files: `src/app/admin/settings/reminder-templates/page.tsx`, `.../ReminderTemplatesForm.tsx`, `.../loading.tsx` (all new), `src/components/admin/adminNavItems.ts`
  - `page.tsx` — async Server Component: `auth()` + ADMIN/SUPERADMIN redirect to `/admin` (pages must not rely on middleware alone), `getTenantConfig()` + `parseEnabledLocales()` for the enabled locales, eyebrow + muted subtitle header (no `<h1>` — the topbar supplies the title), renders the form.
  - `loading.tsx` — `FormSkeleton` from `src/components/admin/skeletons/`, wrapped in the same outer container classes as the page (required for every async Server Component page in this tree).
  - `ReminderTemplatesForm.tsx` (`'use client'`) — one `SettingsSection` per reminder type (24h, 2h), each with a `Textarea` per enabled locale. Per textarea:
    - clickable placeholder chips that insert `{{token}}` at the cursor;
    - a live `estimateSmsSegments()` readout — `"124 chars · UCS-2 · 2 SMS"` — with a hint that removing Polish/Ukrainian diacritics switches to GSM-7 and roughly halves the cost;
    - a "Reset to default" action that clears the field (empty = server deletes the row = default restored), with the default body shown as the `placeholder`.
    - **A visible note that these are transactional reminders only and must not contain promotional content** (see AD-7 — the admin now owns the wording, so this guardrail moves into the UI).
    - Self-contained inline Save button (the `email/`, `social/`, `legal/` pattern) — do **not** wire this page into the shared `settings-form` / `settings-dirty` sidebar contract.
    - `handleSubmit(onSubmit, onInvalid)` with an `onInvalid` toast (mandatory in this folder).
  - Add a nav entry to `adminNavItems` right after `admin.nav.notifications`: `{ labelKey: 'admin.nav.reminderTemplates', href: '/admin/settings/reminder-templates', icon: MessageSquare }` — `MessageSquare` is a confirmed `lucide-react` export; verify any other icon choice against the installed version before using it.

- [x] **Step 12: i18n keys**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Add, with identical key sets in all three files: `admin.nav.reminderTemplates`, `admin.settings.sms.*` (section title/desc, toggle label/desc, provider label + option labels, per-provider field labels/descriptions/placeholders, test-send button/success/error), `admin.settings.reminderTemplates.*` (page desc, section titles, per-locale labels, placeholder-chip labels, segment-counter string with `{{chars}}`/`{{encoding}}`/`{{segments}}`, diacritics hint, transactional-only note, reset action, save success/failure).
  - Any new API `{ code }` value must be added to `KNOWN_ERROR_CODES` in `src/lib/errors/apiErrorKey.ts` **and** to `errors.*` in all three locale files.
  - Run `npm run i18n:check` — it fails on both key-set drift and unresolvable `t()` references.

- [x] **Step 13: Tests**
  - Files: `tests/lib/notifications/templates.test.ts` (new), `tests/lib/notifications-internal.test.ts` (extended in Step 2)
  - `templates.test.ts` — **no mocks by design** (`templates.ts` is Prisma-free/React-free, same rationale as `discounts/eligibility.test.ts`):
    - `renderTemplate` substitutes every known placeholder, handles `{{ spaced }}`, leaves an unknown `{{nope}}` literal, and handles repeated tokens.
    - `validateTemplateBody` accepts a clean body and reports unknown tokens.
    - `estimateSmsSegments` — GSM-7 boundaries (160 → 1, 161 → 2) and UCS-2 (a body with `ą`/`ę` → `ucs2`, 70 → 1, 71 → 2).
    - `DEFAULT_REMINDER_BODIES` has a non-empty entry for both types × all three languages, and every token it uses is in `TEMPLATE_PLACEHOLDERS`.
  - Do **not** add a Prisma-mocked test for `notifyBookingReminders()` itself — the repo has no such harness and the risky logic is now in the two pure helpers that are covered.
  - `npm run test` must stay green (baseline: 18 files / 101 tests, 0 failures).

- [x] **Step 14: DOX pass (required before the task is done)**
  - `prisma/AGENTS.md` — add `NotificationTemplate` to the Ownership model list; add a Local Contract for the absent-row-means-default rule, the `(type, language, channel)` unique key, and the encrypted SMS credential columns.
  - `src/lib/AGENTS.md` — update the `notifications/` bullet: `reminders.ts` extraction and why, the new `sms/` subfolder and its `Error | null` contract, `templates.ts` (pure) vs `template-store.ts` (Prisma) split, `appointmentStartUtc()` and the timezone fix, `channel = 'sms'` in `NotificationLog`. Update the 500-line "largest files" note now that `index.ts` shrank.
  - `src/app/api/AGENTS.md` — add the `admin/sms-settings` (+ `/test`) and `admin/reminder-templates` routes; note the cron route is deliberately unchanged.
  - `src/app/admin/AGENTS.md` — add the new `settings/reminder-templates/` page to the settings-page list and note the SMS section lives on the notifications page but saves through its own endpoint.
  - `tests/AGENTS.md` — add a dated bullet for `tests/lib/notifications/templates.test.ts` (no mocks by design) and the extended internal test.
  - Update `src/lib/notifications/email-i18n.ts`'s header comment only if SMS ends up reusing `emailT` (it should not, per AD-6) — otherwise leave it untouched.

---

## Acceptance Criteria

- [x] `npm run test` passes with no new failures (39 files / 376 tests, 0 failures)
- [ ] `npm run lint` passes with zero warnings — pre-existing baseline failures only (79 problems, all in files this feature never touched: `demo-widget/`, `next.config.mjs`, unrelated admin/auth files); zero lint errors in any file added/edited by this feature
- [x] `npm run i18n:check` passes
- [x] Every touched file is under 500 lines, including `notifications/index.ts` (now ~309 lines after the `reminders.ts` extraction)
- [x] `appointmentStartUtc()` returns `12:00Z` for a 14:00 August Warsaw appointment and `13:00Z` for a 14:00 January one, proven by unit test
- [x] No secret (`twilioAccountSid`, `twilioAuthToken`, `smsApiToken`) is ever stored in plaintext, returned by a GET, or included in a log line or `Error` message
- [x] `TenantConfig`-writing routes call `invalidateTenantConfigCache()`
- [x] `src/app/api/cron/reminders/route.ts` is unchanged
- [x] No changes to `BookingForm.tsx`, `BookingConsentModal.tsx`, `consent-service.ts`, `booking-service.ts`, or the `ConsentRecord` model (AD-7)
- [x] With SMS disabled or unconfigured, `notifyBookingReminders()` behaves exactly as before (email + `telegram_client` only, same `{ sent, skipped }` shape) — verified by the full pre-existing regression suite staying green
- [x] Re-running the cron within the same window does not re-send an SMS (per-channel `NotificationLog` dedup on `channel: 'sms'`) — implemented via `alreadySms`/`smsDone` guard in `reminders.ts`, mirroring the email/telegram_client dedup
- [ ] Admin can pick a provider, save BYO credentials, send a test SMS, and author 24h/2h bodies per enabled locale; clearing a body restores the built-in default — requires manual verification with real Twilio/SMSAPI.pl credentials (see report)
- [x] DOX pass completed (Step 14)

---

## Constraints & Risks

**Must not be touched**
- `src/app/api/cron/reminders/route.ts` — the `Bearer <CRON_SECRET>` guard and the route shape stay as-is (`src/app/api/AGENTS.md`: "don't add session-based auth to it").
- The booking consent flow and `ConsentRecord` — AD-7 is a decision, not an open question.
- `telegramBotToken`'s existing plaintext storage and unmasked GET in `admin/notification-settings/route.ts` — pre-existing, out of scope, do not "fix" it while nearby.
- Email/Telegram reminder copy and the `emailNotif.*` / `bot.*` keys.

**Critical dependencies / ordering**
- Step 6 (extraction) must land before Step 7 (SMS wiring) — `index.ts` is already over the 500-line limit.
- Step 3 (migration) must land before Steps 4–11 compile.
- `date-fns-tz@^3.2.0`, `zod`, `react-hook-form`, `sonner`, `lucide-react` are all already in `package.json`. **No new dependency is permitted** — both SMS providers are plain `fetch`.
- `encryption.ts` throws at import if `AUTH_SECRET` is missing; `tests/setup/env.ts` already seeds it.

**Risks**
- *Silent SMS misconfiguration.* BYO credentials fail inside an hourly cron where nobody sees the error. Mitigated by the test-send route (Step 8) and by `NotificationLog` rows with `status: 'failed'` + the provider's message.
- *SMSAPI returns HTTP 200 on error.* Checking only `res.ok` would report every failure as a success. Called out in Step 5; the reviewer should verify this specifically.
- *Provider API drift.* The exact SMSAPI request/response shape must be verified against current docs at implementation time; deviations go in the feedback file, not silently into the code.
- *Cost.* Polish/Ukrainian diacritics force UCS-2 (70 chars/segment). The segment counter is the mitigation; it is not optional (AD-10).
- *Migration environment.* `DATABASE_URL`'s relative path resolves against `schema.prisma`'s directory — the live dev DB is `prisma/prisma/app.db`, not the stray empty `prisma/app.db` (`prisma/AGENTS.md`). Never hand-edit `migrations/` or the DB file.
- *Build/dev server.* Do not run `npm run dev` or `npm run build` — a one-shot build can corrupt `.next/` under the user's concurrently running dev server. Verify with `npm run test` / `npm run lint` / `npm run i18n:check` only, and tell the user to restart their dev server before manually checking the new routes.
- *Residual (accepted, do not fix).* The reminder day-bucket query can miss an appointment whose Warsaw-local start crosses a UTC date boundary — impossible within realistic 8–21 salon hours. Documented, out of scope.

**Manual verification the user will need to perform** (list this at the end of implementation, in Russian, per the project's reporting preference): restart the dev server; enter real Twilio or SMSAPI credentials in Admin → Notifications; send a test SMS; edit a 24h body and confirm the segment counter reacts to diacritics; clear a body and confirm the default returns; create a booking ~2h out and trigger `GET /api/cron/reminders` with the `CRON_SECRET` bearer token to confirm the SMS arrives at the corrected time and that a second call does not re-send.
