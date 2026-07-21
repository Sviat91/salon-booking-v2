# Plan: Client Telegram appointment reminders

**Date:** 2026-07-21
**Status:** Implemented — pending manual verification (see below)

## Goal
Send the existing 24h/2h appointment reminders ALSO as a Telegram message (via the client booking bot) to any client whose `User.telegramChatId` is set — additive to, and never replacing, the current email reminders and the separate admin-salon Telegram notification.

## Context
The interactive client booking bot (`src/lib/telegram-bot/`) persists `User.telegramChatId` at booking time (via `src/lib/booking-service.ts` and `src/lib/telegram-bot/handlers/confirm.ts`), but nothing ever reads it — clients who booked through Telegram get email reminders only. This adds a client-facing Telegram reminder into the existing cron-driven reminder loop. New work, not a bug fix.

## Verified facts (from reading the current code)
- `src/lib/notifications/index.ts` → `notifyBookingReminders()` (lines 165–347): builds 24h/2h windows, queries `CONFIRMED` appointments (`include: { client, master, service }`), and for each appointment does independent per-channel dedup via `prisma.notificationLog.findFirst({ appointmentId, type, channel, status: 'sent' })`. It already sends a **client email** (`channel: 'email'`) and a **separate admin-salon Telegram** message (`channel: 'telegram'`, to `config.notifAdminChatId` using `config.telegramBotToken`). The function never throws (top-level try/catch, line 342).
- The early skip at lines 277–282 uses `emailDone && telegramDone` to `continue` before building message data — this must be extended so a pending client-Telegram send is not skipped.
- `clientData` (lines 299–302) already holds the client-facing, `Appointment.clientLanguage`-localized values (`name`, `date` via `formatDate` = pl-PL `DD.MM.YYYY`, `time`, `service`, `master`). Reuse it directly.
- `src/lib/notifications/telegram.ts` → `sendTelegramMessage(botToken, chatId, html)` is token-parametric but **hardcodes `parse_mode: 'HTML'`**. Do NOT modify it or its admin call sites (scope boundary). A salon-admin service name containing `&`/`<`/`>` would break HTML mode; the client reminder will use a plain-text sender instead (matching the bot's existing plain-text `ctx.reply` style).
- `prisma/schema.prisma` `NotificationLog` (lines 281–292): free `channel` String (currently `email | telegram`). The admin reminder ALREADY uses `channel: 'telegram'`, so the client reminder MUST use a new channel value (`telegram_client`) to keep dedup independent. No migration needed (String column, comment-only change).
- `TenantConfig.clientBotToken` / `clientBotEnabled` exist (schema lines 264–267) and are surfaced by `getTenantConfig()` (`src/lib/tenant.ts`). `Appointment.clientLanguage` defaults to `"pl"` (never null).
- `src/lib/telegram-bot/i18n.ts` → `botT(lang)` reads `bot.*` keys from `src/locales/{pl,en,uk}.json`. It imports only core `i18next` + `i18n-shared` + the 3 JSON files — NO grammy, NO `lifecycle.ts`/`bot.ts` — so importing it into the notifications module is safe (no circular import, no grammy pulled into the cron path, no react-i18next RSC-build hazard).
- `src/app/api/cron/reminders/route.ts` (`GET`, `Bearer $CRON_SECRET`) is the trigger; it just calls `notifyBookingReminders()` — no change needed there.
- i18n gate: `npm run i18n:check` (`scripts/i18n-check.mjs`) asserts identical key sets across pl/en/uk AND that every literal `t('...')` key resolves in all 3 files.

## Architecture Decisions
- **New plain-text sender file, not reuse of `sendTelegramMessage`.** Create `src/lib/notifications/client-telegram.ts`. Reason: the existing sender forces HTML parse mode (breaks on `&` in admin-entered service names) and modifying it risks the "admin flow must stay behaviorally identical" mandate. The new file owns both the raw fetch POST (plain text, no `parse_mode`) and the localized message composition (calls `botT`), keeping `notifications/index.ts` lean and honoring the src/lib AGENTS.md guidance to split growth into new files rather than extend `index.ts` (already ~387 lines).
- **Language source = `Appointment.clientLanguage`, NOT `getRememberedLanguage(chatId)`.** Reason: (1) it is already loaded on `appt` and guaranteed non-null; (2) every appointment that qualifies for a Telegram reminder was booked via the bot, where `clientLanguage` was set from the bot's chosen language (`state.lang`), so it is authoritative here; (3) it keeps the Telegram reminder in the SAME language as the client's email reminder for that appointment; (4) it avoids adding a Redis round-trip and an extra failure surface into the send path. `getRememberedLanguage` was considered per the exploration note and rejected for these reasons — no import of `wizard-state.ts` into notifications.
- **New dedup channel `telegram_client`** (distinct from admin `telegram`), reusing the existing `NotificationLog.findFirst({ appointmentId, type, channel, status: 'sent' })` mechanism — a retry can never double-send.
- **Best-effort / resilient:** the client-Telegram send returns `Error | null` and never throws; a failure is written to `NotificationLog` (`status: 'failed'`) and the email/admin loop is unaffected — matching every other send path in the file.
- **Token safety (hard rule):** the sender constructs the request URL locally and NEVER includes it in the returned `Error` (only `Telegram API error <status>: <body>` for non-ok, or a sanitized fetch-error `name: message`); `index.ts` logs only `sendErr.message`, never a raw error/context object. This is a plain `sendMessage` with no inline URL button, so no retry-without-button logic is needed.
- **Gating:** send only when `clientBotEnabled === true` AND `clientBotToken` is set AND `appt.client.telegramChatId` is truthy AND no prior `telegram_client` `sent` row exists. No consent gate (the existing email reminder has none — stay consistent and additive).
- **Client-Telegram reminders are independent of the email/admin toggles.** The function-level early-return guard that short-circuits when notifications are entirely off must also account for `clientBotEnabled`, so a salon can run client-Telegram-only reminders (email + admin-Telegram both off). See Step 8. The per-appointment `clientTelegramEligible` check remains the authoritative send gate; the widened guard only prevents the function from bailing before the loop.

## Implementation Steps

- [x] Step 1: Add the `bot.reminder.*` i18n keys to all three locale files.
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: Inside the existing `"bot"` object (each file, `"bot"` starts at line 1188), add a new sibling key `"reminder"` after the `"common"` block (add a comma after `common`'s closing `}`). Keys and values, keeping `{{master}} {{service}} {{date}} {{time}}` placeholders identical across all three files:
    - `bot.reminder.heading24h`
      - pl: `"⏰ Przypomnienie: Twoja wizyta jest jutro"`
      - en: `"⏰ Reminder: your appointment is tomorrow"`
      - uk: `"⏰ Нагадування: ваш візит завтра"`
    - `bot.reminder.heading2h`
      - pl: `"⏰ Przypomnienie: Twoja wizyta jest za 2 godziny"`
      - en: `"⏰ Reminder: your appointment is in 2 hours"`
      - uk: `"⏰ Нагадування: ваш візит за 2 години"`
    - `bot.reminder.details`
      - pl: `"👤 Specjalista: {{master}}\n💇 Usługa: {{service}}\n📅 Data: {{date}}\n🕐 Godzina: {{time}}"`
      - en: `"👤 Specialist: {{master}}\n💇 Service: {{service}}\n📅 Date: {{date}}\n🕐 Time: {{time}}"`
      - uk: `"👤 Спеціаліст: {{master}}\n💇 Послуга: {{service}}\n📅 Дата: {{date}}\n🕐 Час: {{time}}"`
  - Verify: JSON stays valid (run `npm run i18n:check` in Step 6).

- [x] Step 2: Create the client-bot Telegram sender + reminder composer.
  - Files: `src/lib/notifications/client-telegram.ts` (new)
  - Details: Zero new dependencies (native `fetch`). Never throws.
    - Import `botT` from `@/lib/telegram-bot/i18n` and `type Language` from `@/lib/i18n-shared`.
    - Define `interface ReminderLabels { master: string; service: string; date: string; time: string }`.
    - Private `async function postPlainText(botToken: string, chatId: string, text: string): Promise<Error | null>`: mirror `src/lib/notifications/telegram.ts`'s fetch pattern but with body `{ chat_id: chatId, text }` and **no `parse_mode`**. On `!res.ok` return `new Error(\`Telegram API error ${res.status}: ${await res.text()}\`)` (Telegram error bodies never echo the token). In `catch`, return `err instanceof Error ? new Error(\`${err.name}: ${err.message}\`) : new Error(String(err))` — never include the request URL, so the token can never leak into logs.
    - Export `async function sendClientBookingReminder(params: { botToken: string; chatId: string; lang: Language; hours: 24 | 2; labels: ReminderLabels }): Promise<Error | null>`: `const t = botT(params.lang)`; pick heading via `params.hours === 24 ? t('bot.reminder.heading24h') : t('bot.reminder.heading2h')`; `const details = t('bot.reminder.details', params.labels)`; return `postPlainText(params.botToken, params.chatId, \`${heading}\n\n${details}\`)`.

- [x] Step 3: Wire the client-Telegram reminder into `notifyBookingReminders()`.
  - Files: `src/lib/notifications/index.ts`
  - Details (all inside the existing `for (const appt of filtered)` loop, lines 257–340):
    - Add import near line 10: `import { sendClientBookingReminder } from './client-telegram'`. (`DEFAULT_LANGUAGE`, `type Language` are already imported on line 9.)
    - After the `alreadyTelegram` lookup (ends line 275), add a third dedup query and an eligibility flag:
      ```
      const alreadyClientTelegram = await prisma.notificationLog.findFirst({
        where: { appointmentId: appt.id, type: window.type, channel: 'telegram_client', status: 'sent' },
      })
      const clientTelegramEligible =
        config.clientBotEnabled && !!config.clientBotToken && !!appt.client.telegramChatId
      ```
    - Extend the early-skip (lines 277–282) to include the new channel:
      ```
      const clientTelegramDone = alreadyClientTelegram !== null || !clientTelegramEligible
      if (emailDone && telegramDone && clientTelegramDone) { skipped++; continue }
      ```
    - After the admin-Telegram block (ends line 339), still inside the loop, add the client-Telegram send + log:
      ```
      if (clientTelegramEligible && !alreadyClientTelegram) {
        const sendErr = await sendClientBookingReminder({
          botToken: config.clientBotToken!,
          chatId: appt.client.telegramChatId!,
          lang: (appt.clientLanguage as Language) || DEFAULT_LANGUAGE,
          hours: window.hours,
          labels: {
            master: clientData.master,
            service: clientData.service,
            date: clientData.date,
            time: clientData.time,
          },
        })
        await logNotification({
          type: window.type,
          channel: 'telegram_client',
          appointmentId: appt.id,
          recipientId: appt.client.id,
          status: sendErr ? 'failed' : 'sent',
          error: sendErr ? sendErr.message : undefined,
        })
        if (!sendErr) sent++
      }
      ```
    - Do NOT touch the existing email, admin-Telegram, `notifyBookingConfirmation`, or `notifyContactForm` code paths.
  - Verify: file stays under 500 lines (expected ~410).

- [x] Step 4: Update the `NotificationLog.channel` schema comment.
  - Files: `prisma/schema.prisma` (line 286)
  - Details: Change the inline comment on `channel` from `// email | telegram` to `// email | telegram | telegram_client`. Comment only — do NOT create a migration (no column/type change).

- [x] Step 5: Add a unit test for the new sender.
  - Files: `tests/lib/notifications/client-telegram.test.ts` (new; mirror path)
  - Details: `vi.stubGlobal('fetch', vi.fn())` (or assign `global.fetch`). Call `sendClientBookingReminder({ botToken: 'SECRET_TOKEN', chatId: '123', lang: 'en', hours: 24, labels: { master: 'Anna', service: 'Facial', date: '10.04.2026', time: '10:00' } })`. Assert:
    - Returns `null` when fetch resolves `{ ok: true }`.
    - fetch called once with URL `https://api.telegram.org/botSECRET_TOKEN/sendMessage`; parsed request body has `chat_id: '123'`, `text` containing both the English heading and the interpolated `Anna`/`Facial`, and NO `parse_mode` field.
    - Returns an `Error` (does not throw) when fetch resolves `{ ok: false, status: 401, text: async () => '{"ok":false}' }`.
    - Returns an `Error` (does not throw) when fetch rejects, and the returned `Error.message` does NOT contain `SECRET_TOKEN` (token-safety assertion).
    - Use `hours: 2` in one case to confirm the 2h heading is selected.

- [x] Step 6: Run the verification suite (see below) and fix any failures.

- [x] Step 7: DOX pass — update owning docs.
  - Files: `src/lib/AGENTS.md`
  - Details: (a) In the `notifications/` bullet (line 16), add `client-telegram.ts` to the module list and note it sends the client-facing Telegram reminder via `clientBotToken` on channel `telegram_client`, gated by `clientBotEnabled` + `User.telegramChatId`. (b) In the client-vs-admin language bullet (line 23), note the client Telegram reminder also localizes via `Appointment.clientLanguage` (consistent with the client email), while the admin-salon Telegram message stays `DEFAULT_LANGUAGE`. Keep edits minimal; remove nothing else.

- [x] Step 8: Fix the top-level reminder gate to include client-Telegram. (Reviewer Critical/Architectural — plan gap, not a coder mistake. Addendum only; do NOT revisit Steps 1–7.)
  - Files: `src/lib/notifications/index.ts` (lines **177–179**, inside `notifyBookingReminders()`)
  - Problem: The pre-existing function-level early-return guard sits UPSTREAM of the per-appointment loop and all the Step 3 client-Telegram logic. It currently reads (verified at lines 177–179 of the current file):
    ```
    if (!config.notifEmailEnabled && !config.notifTelegramEnabled) {
      return { sent, skipped }
    }
    ```
    So if a salon wants client-Telegram-only reminders (`clientBotEnabled = true` with a valid `clientBotToken`, but `notifEmailEnabled = false` AND `notifTelegramEnabled = false`), the function returns immediately and the new client-Telegram send never runs — silently, with no log. This contradicts the feature intent (client-Telegram reminders must not be hard-dependent on the email/admin toggles).
  - Fix (one-condition widening, nothing else): change ONLY the guard's condition on line 177 to also short-circuit past when the client bot is on:
    ```
    if (!config.notifEmailEnabled && !config.notifTelegramEnabled && !config.clientBotEnabled) {
      return { sent, skipped }
    }
    ```
  - Do NOT change anything else about the function's control flow:
    - The `notifReminder24hEnabled`/`notifReminder2hEnabled` guard above it (lines 173–175) stays exactly as-is.
    - The per-appointment `clientTelegramEligible` check from Step 3 (still requires `clientBotToken` + `appt.client.telegramChatId`) remains the authoritative gate for actually sending — this widened guard only stops the function from bailing before the loop.
    - The email, admin-Telegram, `notifyBookingConfirmation`, and `notifyContactForm` branches are untouched.
  - Verify: `npx tsc --noEmit`, `npm run lint` (zero new warnings), `npx vitest run` (existing suite green), and `npm run build` all still pass. No new test required (no new behavior in `client-telegram.ts`; this is a gate condition only).

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes (zero warnings) — pre-existing repo-wide lint errors (48 problems, unrelated files) verified present before this change too (via `git stash`/`pop` diff); zero lint errors in any file touched by this plan
- [x] `npm run i18n:check` passes (pl/en/uk key parity + all referenced keys resolve)
- [x] `npx vitest run` passes (existing suite green + new `client-telegram.test.ts`)
- [x] `npm run build` succeeds
- [x] Follows project conventions (files < 500 lines; native `fetch`; no new deps)
- [ ] A client with `telegramChatId` set receives their 24h and 2h reminder via the client bot, in their `clientLanguage`, IN ADDITION to the existing email — manual verification (user)
- [x] Existing email reminders and the admin-salon Telegram notification are behaviorally unchanged (code paths untouched, only new branches added)
- [x] Re-running the cron never double-sends the same client Telegram reminder (dedup on `telegram_client`)
- [x] No client Telegram send when `clientBotEnabled` is false or the client has no `telegramChatId`
- [x] Client-Telegram reminders STILL send when both `notifEmailEnabled` and `notifTelegramEnabled` are false but `clientBotEnabled` is true (top-level guard at lines 177–179 no longer blocks a client-Telegram-only config — Step 8); and they still do NOT send when `clientBotEnabled` is false even if email/admin-Telegram are enabled (guaranteed by the inner `clientTelegramEligible` check, so a widened guard does not cause spurious sends)

## Constraints & Risks
- **Do NOT touch** the admin-notification Telegram flow: `notifTelegramEnabled`, `notifAdminChatId`, `telegramBotToken`, `src/lib/notifications/telegram.ts`, and its existing call sites must stay behaviorally identical.
- **Do NOT** remove or alter any email reminder behavior — additive only.
- **Do NOT** reuse `channel: 'telegram'` for the client reminder — it collides with the admin dedup. Must be `telegram_client`.
- **Do NOT** import the live grammy `Bot` singleton (`src/lib/telegram-bot/lifecycle.ts` / `bot.ts`) into the notifications/cron path — only `botT` from `src/lib/telegram-bot/i18n.ts` (safe, no grammy) is allowed.
- **Do NOT** log raw error/context objects; log only `sendErr.message` (sanitized, never contains the token/URL).
- **Step 8 is a one-condition widening only.** Do NOT restructure the guard, do NOT touch the `notifReminder*Enabled` guard, and do NOT alter the per-appointment eligibility logic — the inner `clientTelegramEligible` check must remain the true send gate.
- **Out of scope:** bot booking cancellation/management; the separate content-pages/CMS feature. Do not start either.
- Critical dependency: `TenantConfig.clientBotToken` + `clientBotEnabled` must be configured for live sending; `Appointment.clientLanguage` is the localization source (guaranteed non-null, default `pl`).
- Pre-existing runtime-timezone caveat in the reminder window math (lines 250–254) is unrelated to this change — do not "fix" it.

## Manual verification (user)
You run your own dev server; do the following after the coder finishes:
1. In the DB / Admin settings, ensure `TenantConfig` has: `clientBotEnabled = true`, a valid `clientBotToken`, `notifReminder24hEnabled` (and/or `notifReminder2hEnabled`) `= true`, and `notifEmailEnabled = true`. If you also want to confirm the admin path is untouched, keep `notifTelegramEnabled = true` with a valid `telegramBotToken` + `notifAdminChatId`.
2. Create a qualifying appointment: either book via the client Telegram bot for a time ~24h (or ~2h) out, OR in `npx prisma studio` set an existing `CONFIRMED` appointment's `date`/`startTime` into the reminder window and set its client `User.telegramChatId` to your own Telegram chat id (and `clientLanguage` to `en`/`uk` to check localization).
3. Trigger the cron once:
   `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`
4. Confirm: your Telegram bot chat receives the reminder in the client's language; the client email still arrives; and (if enabled) the admin-salon chat still gets its separate reminder.
5. Run the same `curl` again → confirm you do NOT receive a duplicate Telegram reminder (dedup working).
6. In `npx prisma studio` → `NotificationLog`, confirm a row with `channel = "telegram_client"`, `status = "sent"`, matching `appointmentId` and `type` (`BOOKING_REMINDER_24H` / `BOOKING_REMINDER_2H`).
7. Set `clientBotEnabled = false`, move the appointment into a fresh window (or clear its prior `telegram_client` log rows), trigger the cron → confirm NO client Telegram send while the email still goes out.
8. (Step 8 check) Set `notifEmailEnabled = false` AND `notifTelegramEnabled = false`, keep `clientBotEnabled = true` + valid `clientBotToken`, move the appointment into a fresh window (or clear its prior `telegram_client` log rows), trigger the cron → confirm the client STILL receives their Telegram reminder (proving the widened top-level guard no longer blocks a client-Telegram-only config).
