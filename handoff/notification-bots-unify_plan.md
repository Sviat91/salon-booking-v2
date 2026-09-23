# Plan: Fully unify the general Telegram bot into NotificationBot

**Date:** 2026-09-23
**Status:** Implementation complete (Stages 1-5) — awaiting user manual verification (see checklist at the end of this file)
**Source requirements:** `handoff/notification-bots-unify_requirements.md`

## Goal

Eliminate the special-cased "general salon bot" (`TenantConfig.telegramBotToken` + `TelegramNotificationRecipient`) as a separate mechanism: migrate its data into one ordinary `NotificationBot` row (`scope: 'ALL'`, `ownerId: null`), route every salon Telegram notification through the `NotificationBot` path only, and leave exactly ONE Telegram area in `/admin/settings/notifications` — the channel toggle plus the single bot list.

---

## Findings that change the requirements' assumptions (read before starting)

**F-1 — `TenantConfig.telegramBotToken` is NOT reliably encrypted. It has two writers with contradictory conventions:**
- `src/app/api/admin/notification-settings/route.ts:49` writes it **plaintext** (`updateData.telegramBotToken = data.telegramBotToken || null`, no `encrypt()`), and its `GET` returns the raw value (line 28).
- `src/app/api/admin/social-settings/route.ts:57` writes it **encrypted** (`handleSecret(...)` → `encrypt()`), for the Telegram **Login Widget** provider (`src/app/api/auth/[...nextauth]/route.ts:48` does `decrypt(config.telegramBotToken)`).
- The notification dispatcher today uses `config.telegramBotToken` **raw, with no `decrypt()`** — so a salon that saved the token on the Social page currently has a broken notification bot. That is a pre-existing latent bug; the migration incidentally fixes it (see U-2).

So the requirements' "already-encrypted ciphertext" assumption is **wrong for the likely real value**. This does not block a verbatim copy — see U-2.

**F-2 — the column is dual-purpose.** `telegramBotToken`/`telegramBotUsername` also back the Telegram OAuth login widget (`auth/login/page.tsx:25`, `auth/register/page.tsx:24`, `api/auth/[...nextauth]/route.ts:47`). **Never null it, never remove it from `social-settings`.** Only the *notification* side stops reading/writing it.

**F-3 — no existing test asserts the old general-bot dispatch path.** There is no `tests/lib/notifications/index*.test.ts`; `tests/lib/notifications-internal.test.ts` does not touch `getTelegramRecipients`. So "update the old tests" is really "add the new ones" (Stage 3).

**F-4 — some legacy i18n keys are still live.** `BotRecipientsField.tsx` (the new bot card's chat-ID rows) reuses `admin.settings.notifications.recipientChatIdPlaceholder`, `recipientLabelPlaceholder`, `removeRecipientAria`, `addRecipientBtn`, `groupChatHelp`. **Those five must NOT be deleted.**

---

## Architecture Decisions

### U-1 — Raw-SQL, hand-written data migration (house convention)
`prisma/AGENTS.md` already prescribes hand-created timestamped `migrations/<ts>_<name>/migration.sql` folders for data-preserving work. `deploy/docker-entrypoint.sh` runs `prisma migrate deploy` on every container start, so a migration folder is automatically applied on local + every VPS with zero manual steps — which is exactly the requirement. A `scripts/` file would not satisfy that. Idempotency is free: Prisma's `_prisma_migrations` ledger runs it exactly once.

### U-2 — The token is copied **verbatim**, not decrypted/re-encrypted
`decrypt()` (`src/lib/encryption.ts:37-41`) splits on `:` and returns the input **unchanged** when it isn't `iv:authTag:data` (3 parts). A Telegram bot token (`<digits>:<[A-Za-z0-9_-]{20,}>`) has exactly **one** colon → 2 parts → passthrough. Therefore `decrypt(bot.token)` in `bots.ts` yields the correct token for **both** stored forms:
- plaintext (notification-settings writer) → returned as-is → identical behaviour to today;
- ciphertext (social-settings writer) → properly decrypted → **fixes** the F-1 bug.

SQL cannot call `encrypt()` (AES-GCM keyed off `AUTH_SECRET`), and no boot-time/backfill machinery will be added for this. The plaintext case does **not** introduce a new secret exposure: the identical plaintext already sits in `TenantConfig.telegramBotToken` in that same DB file, the source column is not removed, `NotificationBot.token` is never selected by `bots-store.ts` or returned by any API, and `notificationBot` is not in `db-browser`'s `ALLOWED_TABLES`. Any later edit through the bot card re-encrypts it properly (`updateBot` → `encrypt()`), and after this task the plaintext writer path is deleted (U-6), so every *future* value is encrypted.

### U-3 — Fixed sentinel id `legacy_general_bot`
The `id` columns are plain `TEXT PRIMARY KEY`; cuid is a client-side nicety, not a constraint. A literal id makes the recipients' FK trivially correct in the second statement and makes the row self-documenting in the DB.

### U-4 — Timestamps are copied from Prisma-written rows, never `CURRENT_TIMESTAMP`
`NotificationBot.updatedAt` is `NOT NULL` with no default. Rather than betting on how the libSQL driver adapter parses SQLite's `CURRENT_TIMESTAMP` text format, copy `TenantConfig."createdAt"`/`"updatedAt"` (and `TelegramNotificationRecipient."createdAt"` for the recipient rows) — those values were written by Prisma itself, so they round-trip by construction.

### U-5 — One shared per-bot loop in `bots.ts`, two thin exports
`broadcastToMasterBots` and the new `broadcastToAllScopeBots` differ only in the Prisma `where`. Extract the loop into one private `dispatchToBots(where, { html, type, appointmentId })`; both exports stay one-liners. Keep the existing `where` object shape byte-identical (`{ enabled: true, OR: [{ scope: 'ALL' }, { masters: { some: { masterId } } }] }`) — `tests/lib/notifications/bots.test.ts` asserts `where.OR[1].masters.some.masterId` and `where.enabled`.

### U-6 — The notification-settings API stops touching `telegramBotToken` entirely
Remove it from `PatchSchema`, from `updateData`, and from the `GET` response. Zod objects are non-strict, so a stale client sending the field is silently stripped, never rejected (this is the "tolerant" option the requirements asked us to choose). `social-settings` keeps owning the column for the login widget (F-2).

### U-7 — `notifyContactForm` routes to enabled `scope: 'ALL'` bots, and its log channel becomes `telegram_bot`
The unified dispatcher writes one `NotificationLog` row per event with `channel: 'telegram_bot'`. Accepted change: `CONTACT_FORM`/`BOOKING_*`/`CALENDAR_CONFLICT` telegram rows will now be `telegram_bot` instead of `telegram`. No code reads `NotificationLog.channel === 'telegram'` for the salon channel (the reminder dedup only reads `email`/`telegram_client`/`sms` — verify with a grep before finishing Stage 2).

### U-8 — `getTelegramRecipients()` is deleted, not kept
After Stage 2 nothing calls it. Deleting it is a compile-level guarantee that the legacy path cannot come back — stronger than any test, which is why Stage 3 does not add a Prisma-mocked test per booking notifier. `broadcastTelegram()` stays (it is `bots.ts`'s transport).

### U-9 — The whole legacy recipients surface is dead code and goes with it
With `recipients` out of the form, `TelegramRecipientsField.tsx`, `recipient-schema.ts`, `recipient-diff.ts`, its test, and both `api/admin/notification-settings/recipients/**` routes have zero remaining references. Repo directive (2026-07-13, "весь мёртвый/старый/ненужный код — удалять сразу") applies. The `TelegramNotificationRecipient` **model and table stay** (no destructive migration, per the requirements) — they just become unreferenced by application code, with their data already copied into `NotificationBotRecipient`.

### U-10 — The "Telegram is disabled" notice follows the live toggle
Once the toggle and the bot list share one card, a notice reading "Telegram notifications are disabled in <link>notification settings</link>" while sitting directly under that very toggle — and linking to the page it is already on — reads as broken. Give `NotificationBotsManager` an optional `telegramEnabled?: boolean` prop: when supplied (admin settings page, from `watch('notifTelegramEnabled')`) it wins over the fetched value; when omitted (master page) the fetched value is used as today. Drop the `<link>` from the notice copy in all three locales (it is also broken on the master surface — a MASTER clicking it gets redirected out of `/admin/settings/*`), which also removes the now-unused `Trans`/`next/link` imports from the manager.

---

## Implementation Steps

### Stage 1 — Data migration (STOP for user verification after this stage)

- [x] Step 1: Update the stale schema comment on `NotificationBot`
  - Files: `prisma/schema.prisma` (lines 424-427)
  - Details: replace the "strictly additive … that general bot is unmigrated and keeps working exactly as today" block comment with the new truth: this is the **only** salon Telegram notification mechanism; `TenantConfig.telegramBotToken`/`telegramBotUsername` + `TelegramNotificationRecipient` are legacy, retained only because `telegramBotToken`/`telegramBotUsername` still back the Telegram **login widget** (`api/auth/[...nextauth]/route.ts`), and their notification data was migrated into this table by `20260923090000_unify_general_telegram_bot`. Comment-only change — it produces no SQL and must not be paired with a `prisma migrate dev` schema diff.

- [x] Step 2: Hand-create the data migration
  - Files: `prisma/migrations/20260923090000_unify_general_telegram_bot/migration.sql` (new folder + file)
  - Details: exactly these two statements plus the header comment (do not add a third statement, do not touch `TenantConfig`):

    ```sql
    -- Data migration: fold the legacy general salon bot into the unified
    -- NotificationBot table as one enabled, ALL-scope, admin-owned bot.
    --
    -- The token is copied VERBATIM on purpose: src/lib/encryption.ts's decrypt()
    -- returns any string that is not `iv:authTag:data` (3 colon-separated parts)
    -- unchanged, and a Telegram token has exactly one colon. So both storage
    -- forms this column has historically held — plaintext (old
    -- api/admin/notification-settings) and encrypted (api/admin/social-settings)
    -- — resolve correctly through decrypt(bot.token) in src/lib/notifications/bots.ts.
    -- SQL cannot call encrypt() (AES-GCM keyed off AUTH_SECRET).
    --
    -- TenantConfig.telegramBotToken/telegramBotUsername are NOT cleared: they still
    -- back the Telegram login widget. TelegramNotificationRecipient rows are copied,
    -- not deleted.
    INSERT INTO "NotificationBot" ("id", "label", "token", "username", "enabled", "scope", "ownerId", "createdAt", "updatedAt")
    SELECT
        'legacy_general_bot',
        COALESCE(NULLIF(TRIM("telegramBotUsername"), ''), 'Telegram'),
        "telegramBotToken",
        NULLIF(TRIM("telegramBotUsername"), ''),
        true,
        'ALL',
        NULL,
        "createdAt",
        "updatedAt"
    FROM "TenantConfig"
    WHERE "telegramBotToken" IS NOT NULL AND TRIM("telegramBotToken") <> ''
    LIMIT 1;

    INSERT INTO "NotificationBotRecipient" ("id", "botId", "chatId", "label", "createdAt")
    SELECT
        'legacy_' || r."id",
        'legacy_general_bot',
        r."chatId",
        r."label",
        r."createdAt"
    FROM "TelegramNotificationRecipient" r
    WHERE EXISTS (SELECT 1 FROM "NotificationBot" b WHERE b."id" = 'legacy_general_bot');
    ```

- [x] Step 3: Apply it locally
  - Details: run `npx prisma migrate deploy` (NOT `migrate dev`). `deploy` is non-interactive and only applies pending migrations; `migrate dev` can prompt for a destructive reset against the real dev database and requires a TTY (see `prisma/AGENTS.md`). No client regeneration is needed — there is no schema change. Remember the live dev DB is `prisma/prisma/app.db`, not the stray `prisma/app.db`.

- [x] Step 4: Verify no data loss (do NOT use `npx prisma studio` — no long-running servers)
  - Details: write a throwaway `npx tsx` script **in your scratchpad directory, never inside the repo**, that prints `prisma.notificationBot.findMany({ select: { id: true, label: true, username: true, enabled: true, scope: true, ownerId: true, recipients: { select: { chatId: true, label: true } } } })` plus `prisma.telegramNotificationRecipient.count()`. **Never select or print `token`.** Expected: the `legacy_general_bot` row exists iff `TenantConfig.telegramBotToken` was set, `scope === 'ALL'`, `ownerId === null`, `enabled === true`, and its `recipients.length` equals the `TelegramNotificationRecipient` count. Record the observed numbers in the report.
  - Result: verified — `legacy_general_bot` exists (label "Telegram", scope ALL, ownerId null, enabled true), `recipients.length` 0 matches `TelegramNotificationRecipient` count 0. No data loss.

> **CHECKPOINT 1 — stop here and hand back for user verification.** Nothing user-visible changed yet; the old dispatch path is still live, so the site keeps working either way.

### Stage 2 — Dispatch rewrite

- [x] Step 5: Add the ALL-scope send path to `bots.ts`
  - Files: `src/lib/notifications/bots.ts`
  - Details: per U-5, extract the existing body into a private `async function dispatchToBots(where: Prisma.NotificationBotWhereInput, params: { html: string; type: string; appointmentId?: string })` (`import type { Prisma } from '@prisma/client'` — the same `import type` pattern as `google-calendar/push.ts:1`). Keep the `recipients.length === 0 → continue`, `decrypt` → falsy `continue`, `attempted === 0 → return` (no log), and the `` `${bot.label}: ${err.message}` `` aggregation **exactly as they are**. Then:
    - `broadcastToMasterBots({ masterId, html, type, appointmentId })` → `dispatchToBots({ enabled: true, OR: [{ scope: 'ALL' }, { masters: { some: { masterId } } }] }, ...)` (shape unchanged, see U-5).
    - new `export async function broadcastToAllScopeBots(params: { html: string; type: string; appointmentId?: string })` → `dispatchToBots({ enabled: true, scope: 'ALL' }, ...)`.
    - Update the file's header docblock: it currently claims "called after the existing general-bot broadcast, never replaces it" — that is now false.
  - File stays well under 500 lines (~56 → ~85).

- [x] Step 6: Remove the general-bot branch from the three booking notifiers
  - Files: `src/lib/notifications/index.ts` (lines 141-153, 203-215, 275-287, and the contact-form block 322-336)
  - Details: delete each `if (config.telegramBotToken) { … getTelegramRecipients() … broadcastTelegram(config.telegramBotToken, …) … logNotification({ channel: 'telegram' }) … }` block. The `if (config.notifTelegramEnabled)` outer gate, the message construction, and the existing `await broadcastToMasterBots({...})` call stay **exactly** as they are. In `notifyContactForm`, replace the whole `if (config.notifTelegramEnabled && config.telegramBotToken) {…}` block with: gate on `config.notifTelegramEnabled` only, build `subjectLine`/`emailLine`/`msg` unchanged, then `await broadcastToAllScopeBots({ html: msg, type: 'CONTACT_FORM' })` (no `appointmentId` — there is no appointment). Drop `getTelegramRecipients` and `broadcastTelegram` from the `./internal` import list; add `broadcastToAllScopeBots` to the `./bots` import.

- [x] Step 7: Same removal in the calendar-conflict notifier
  - Files: `src/lib/notifications/calendar-conflict.ts` (lines 30-41)
  - Details: delete the `if (config.telegramBotToken) {…}` block; keep the `notifTelegramEnabled` gate, the escaped message, the `broadcastToMasterBots({ masterId, html: msg, type: 'CALENDAR_CONFLICT' })` call, and the whole email half untouched. Reduce the `./internal` import to `{ logNotification }` — **and then check whether `logNotification` is still used in this file**; if the telegram branch was its only user, drop that import too (the email half at lines 53/55 does use it, so it most likely stays).

- [x] Step 8: Delete the now-dead `getTelegramRecipients()`
  - Files: `src/lib/notifications/internal.ts` (lines 48-51)
  - Details: per U-8. Keep `broadcastTelegram()` (used by `bots.ts`). Before deleting, `grep -rn "getTelegramRecipients" src tests` must return zero hits outside this file.

- [x] Step 9: Grep-verify the accepted log-channel change (U-7)
  - Details: `grep -rn "'telegram'" src/lib src/app/api` — confirm nothing filters `NotificationLog.channel === 'telegram'` (the reminder dedup in `reminders.ts` uses `email`/`telegram_client`/`sms`). If a reader exists, stop and report instead of silently changing its behaviour.

### Stage 3 — Tests

- [x] Step 10: Extend the bots dispatch test
  - Files: `tests/lib/notifications/bots.test.ts`
  - Details: add a `describe('broadcastToAllScopeBots')` block using the existing hoisted `mockPrisma`/`mockSendTelegramMessage` setup (no new mock patterns):
    - asserts the `where` passed to `findMany` is `{ enabled: true, scope: 'ALL' }` (i.e. no `OR`/`masters` clause — a `SELECTED` bot can never receive a contact-form message);
    - sends to every recipient of every returned bot and writes one `channel: 'telegram_bot'` log;
    - zero bots ⇒ zero `notificationLog.create` calls.
  - Add one test to the existing `broadcastToMasterBots` block proving the **migrated legacy row behaves identically to a hand-created ALL-scope bot**: two bots in the same `findMany` result, one with `token: encrypt(raw)` and one with `token: rawPlaintextToken` (the U-2 verbatim-copy case, `id: 'legacy_general_bot'`, `label: 'Telegram'`), and assert `sendTelegramMessage` is called with the same *decoded* raw token for both.

- [x] Step 11: New `notifyContactForm` test
  - Files: `tests/app/api/…` is wrong here — create `tests/lib/notifications/contact-form.test.ts`
  - Details: `vi.mock('@/lib/prisma')` (needs `notificationLog.create`), `vi.mock('@/lib/tenant', () => ({ getTenantConfig: vi.fn() }))`, `vi.mock('@/lib/notifications/email', () => ({ sendContactFormToAdmin: vi.fn(), sendBookingConfirmationToClient: vi.fn(), sendBookingConfirmationToAdmin: vi.fn() }))`, `vi.mock('@/lib/notifications/bots', () => ({ broadcastToMasterBots: vi.fn(), broadcastToAllScopeBots: vi.fn(), BOT_SCOPES: ['ALL','SELECTED'] }))`, `vi.mock('@/lib/notifications/telegram', () => ({ sendTelegramMessage: vi.fn() }))`, and `vi.mock('@/lib/notifications/reminders', () => ({ notifyBookingReminders: vi.fn() }))` (index.ts re-exports it; this keeps the import graph light). Assert:
    - `notifTelegramEnabled: true` ⇒ `broadcastToAllScopeBots` called exactly once with `{ html: <contains the sender name and message>, type: 'CONTACT_FORM' }`;
    - `sendTelegramMessage` is **never** called directly (the deleted legacy path) and `broadcastToMasterBots` is **never** called (no master to scope to);
    - `notifTelegramEnabled: false` + `notifEmailEnabled: true` ⇒ `broadcastToAllScopeBots` not called, email still sent;
    - a set `config.telegramBotToken` changes nothing (prove the field is no longer consulted).
  - If the import graph fights back (nodemailer/upstash at module eval), report it rather than inventing new global setup — `tests/setup/env.ts` already seeds env vars.

- [x] Step 12: Delete the orphaned recipient-diff test
  - Files: delete `tests/app/admin/settings/notifications/recipient-diff.test.ts` (and the now-empty folder chain if nothing else lives there)
  - Details: only valid once Step 14 removes `recipient-diff.ts`. Keep this checkbox ordered with Stage 4 in mind — do Stage 4 first if you prefer, but do not leave a test importing a deleted module.

### Stage 4 — UI rewrite + dead-code removal

- [x] Step 13: Collapse the Telegram section into one area
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Details:
    - Remove `telegramBotToken` and `recipients` from `formSchema`, from `defaultValues`, from the `form.reset(...)` in the load effect, and from the post-save `form.reset(...)`.
    - Delete the `fetchRecipients()` helper, the `recipients` entry in the `Promise.all` load, the whole `diffRecipients`/`Promise.allSettled` recipients-CRUD block in `onSubmit`, and the `freshRecipients` fetch (the post-save reset then only needs the SMS refetch).
    - Delete the `telegramBotToken` `FormField` (lines 342-362) and the `<TelegramRecipientsField control={form.control} />` line.
    - Delete the standalone "Additional notification bots" `SettingsSection` (lines 367-373) and instead render `<NotificationBotsManager apiBase="/api/admin/notification-bots" canEditScope telegramEnabled={telegramEnabled} />` **inside** the existing Telegram `SettingsSection`, directly below the `notifTelegramEnabled` `ToggleRow` field. `telegramEnabled` is the already-present `watch('notifTelegramEnabled')` value.
    - Remove imports orphaned by the above only: `Input`, `FormControl`, `FormDescription`, `FormLabel`, `TelegramRecipientsField`, `recipientSchema`/`RecipientRow`, `diffRecipients`. **Keep** `Trans` (still used by `smtpNotConfiguredDesc`), `FormField`/`FormItem`/`FormMessage`.
    - Do not touch the `settings-dirty` wiring, the `onInvalid` callback, the `isLoading` skeleton comment, or the SMS/reminders sections.

- [x] Step 14: Delete the legacy recipients surface (U-9)
  - Files (delete): `src/app/admin/settings/notifications/TelegramRecipientsField.tsx`, `src/app/admin/settings/notifications/recipient-schema.ts`, `src/app/admin/settings/notifications/recipient-diff.ts`, `src/app/api/admin/notification-settings/recipients/route.ts`, `src/app/api/admin/notification-settings/recipients/[id]/route.ts` (and the emptied `recipients/` directory)
  - Details: before each deletion, `grep -rn "<basename>" src tests scripts` must show no remaining importer. Do **not** touch the `TelegramNotificationRecipient` Prisma model or its table.

- [x] Step 15: Strip `telegramBotToken` from the notification-settings API (U-6)
  - Files: `src/app/api/admin/notification-settings/route.ts`
  - Details: remove it from `PatchSchema` (line 12), from the `GET` response (line 28), and from `updateData` (line 49). Leave `invalidateTenantConfigCache()` and everything else untouched. Do **not** change `api/admin/social-settings/route.ts` (F-2).

- [x] Step 16: Make the disabled-channel notice live + link-free (U-10)
  - Files: `src/components/admin/notification-bots/NotificationBotsManager.tsx`
  - Details: add an optional `telegramEnabled?: boolean` prop; use `props.telegramEnabled ?? fetchedTelegramEnabled` for the notice condition (keep fetching `telegramEnabled` for the master surface, which passes nothing). Replace the `<Trans …/>` notice with a plain `{t('admin.settings.notificationBots.telegramDisabledNotice')}` and remove the now-unused `Trans` and `next/link` imports. Nothing else in this component changes.

- [x] Step 17: i18n — pl canonical, real en/uk translations
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details (identical key set in all three — `npm run i18n:check` enforces parity):
    - **Reword** `admin.settings.notifications.telegramSectionDesc` → describes the unified list, e.g. pl: `"Boty Telegram wysyłające powiadomienia o rezerwacjach i zgłoszeniach z formularza kontaktowego. Dodaj dowolną liczbę botów — każdy z własnym tokenem, listą odbiorców i zakresem specjalistów."`
    - **Reword** `admin.settings.notificationBots.sectionTitle` → drop "Dodatkowe"/"Additional" (e.g. pl `"Boty Telegram"`); `…sectionDesc` → drop any "obok głównego bota" framing (still rendered on the MASTER page, so it must read correctly there too).
    - **Reword** `admin.settings.notificationBots.masterPageDesc` → remove "obok głównego bota salonu" (there is no main bot any more).
    - **Reword** `admin.settings.notificationBots.telegramDisabledNotice` → no `<link>` markup, e.g. pl: `"Powiadomienia Telegram są wyłączone — włącz je przełącznikiem powyżej. Boty poniżej nie będą wysyłać wiadomości."` (the master surface reads it as guidance to ask the admin; keep the wording surface-neutral).
    - **Delete** the keys that become unreferenced: `admin.settings.notifications.botTokenLabel`, `botTokenDesc`, `recipientsLabel`, `recipientsDesc`, `noRecipientsHint`, `recipientAddFailed`, `recipientDeleteFailed`, `recipientChatIdRequired`, and `admin.settings.notificationBots.pageDesc` (already unused).
    - **Do NOT delete** `admin.settings.notifications.recipientChatIdPlaceholder`, `recipientLabelPlaceholder`, `removeRecipientAria`, `addRecipientBtn`, `groupChatHelp` — `BotRecipientsField.tsx` still renders all five (F-4). Re-grep each key before deleting it.

### Stage 5 — Verification + DOX pass

- [x] Step 18: Run the checks
  - Details: `npm run lint` (zero warnings), `npm run test`, `npm run i18n:check`, `npx tsc --noEmit` if the repo exposes it. **Do not run `npm run dev` or `npm run build`** (user directive: no long-running servers; a one-shot build can corrupt `.next/` under the user's running dev server).

- [x] Step 19: DOX pass (mandatory, per root CLAUDE.md)
  - Files: `src/lib/AGENTS.md`, `src/app/admin/AGENTS.md`, `src/app/api/AGENTS.md`, `prisma/AGENTS.md`, `tests/AGENTS.md`
  - Details:
    - `src/lib/AGENTS.md` (the `notifications/` bullet, L19): remove `getTelegramRecipients()` from the `internal.ts` inventory; state that every salon-facing Telegram send now goes through `bots.ts` only — `broadcastToMasterBots` (master-scoped: `ALL` + matching `SELECTED`) and `broadcastToAllScopeBots` (`notifyContactForm`, `ALL` only), both logging `channel: 'telegram_bot'`, both gated by `TenantConfig.notifTelegramEnabled`; note that `TenantConfig.telegramBotToken` is no longer read by any notifier and survives only for the Telegram login widget; record the U-2 verbatim-copy/`decrypt()`-passthrough rule so nobody "fixes" it later.
    - `src/app/admin/AGENTS.md`: rewrite the "Additional notification bots" bullet (L36) — one Telegram `SettingsSection` holding the toggle + `NotificationBotsManager`, no bot-token field, no recipients field array; note the `telegramEnabled` prop override (U-10). In L37, keep the `register()`-vs-`FormField` lesson but re-point it at the since-deleted `TelegramRecipientsField.tsx` (mark it deleted) so the lesson doesn't reference a live file that no longer exists.
    - `src/app/api/AGENTS.md`: replace the `notification-settings/recipients` bullet (L24) with a line saying those endpoints were deleted 2026-09-23 and chat IDs are now owned by `admin|master/notification-bots/**`; note `admin/notification-settings` no longer reads/writes `telegramBotToken` (and that `social-settings` still does, encrypted, for the login widget).
    - `prisma/AGENTS.md`: add `NotificationBot`/`NotificationBotMaster`/`NotificationBotRecipient` to the Ownership model list (currently missing); rewrite the `TelegramNotificationRecipient` bullet (L19) as legacy/unreferenced-by-app with its data migrated by `20260923090000_unify_general_telegram_bot`; add a bullet for the new models + the verbatim-token-copy decision (U-2) + the fact that `telegramBotToken` is dual-purpose and must never be nulled (F-2).
    - `tests/AGENTS.md`: add a dated (2026-09-23) bullet covering the new `broadcastToAllScopeBots` coverage, `contact-form.test.ts` and its mock set, and the removal of `recipient-diff.test.ts`.
    - Report any doc intentionally left unchanged and why (root `CLAUDE.md` needs no change — no new command, dependency or top-level structure).

---

## Acceptance Criteria

- [x] `npm run test` passes (including the pre-existing suites that mock `@/lib/prisma`). — 54 files / 578 tests, all green.
- [x] `npm run i18n:check` passes. `npm run lint` does **not** pass with zero warnings repo-wide (74 pre-existing errors / 5 warnings), but **none** are in any file touched by this plan — confirmed unrelated pre-existing debt (see report).
- [x] `grep -rn "telegramBotToken" src/lib src/app/api/admin/notification-settings src/app/admin/settings` — one code hit (`src/lib/tenant.ts:77`, the allowed `DEFAULT_CONFIG`), one doc hit (`src/lib/AGENTS.md:19`, the new Step-19 bullet explaining the field is no longer read — expected).
- [x] `grep -rn "getTelegramRecipients\|TelegramRecipientsField\|recipient-diff\|recipient-schema" src tests` — zero hits in any executable/importable code path; five surviving hits are all in doc/comment text (`src/app/admin/AGENTS.md`, `tests/AGENTS.md` ×2 intentional Step-19 additions; `src/components/AGENTS.md:14` and `BotRecipientsField.tsx:21` are stale references outside Step 19's five-file scope, not part of this plan — flagged in report, not fixed).
- [ ] After migration, a salon that had a working general bot receives booking/cancellation/update/contact-form/conflict Telegram messages with **no re-entry of the token or chat IDs**. — requires live testing, deferred to the user's manual checklist below.
- [ ] `/admin/settings/notifications` shows exactly ONE Telegram area: the toggle plus the bot list — no Bot Token input, no standalone chat-ID list, no second "Additional notification bots" card. — verified by code read in Stage 4 review; requires live-browser confirmation, deferred to the user's manual checklist below.
- [ ] `/admin/master/notification-bots` still loads and functions unchanged (copy reworded only). — requires live testing, deferred to the user's manual checklist below.
- [ ] Telegram **login** (login/register pages' Telegram button) is unaffected. — no code in the login path was touched (verified by grep); requires live testing, deferred to the user's manual checklist below.
- [x] Every touched file stays under 500 lines. — `bots.ts` 78, `index.ts` 281, `calendar-conflict.ts` 48, `internal.ts` 117, `NotificationSettingsForm.tsx` 335, `notification-settings/route.ts` 63, `NotificationBotsManager.tsx` 114.

## Constraints & Risks

- **Must not touch:** `TenantConfig.clientBotToken` / `src/lib/telegram-bot/` (interactive client bot); `api/admin/social-settings/route.ts`; `api/auth/[...nextauth]/route.ts`; the `TelegramNotificationRecipient` table/model; the `master/notification-bots` API routes and `bots-store.ts`.
- **High-impact path.** This is the third pass over the live notification dispatcher in one session. The `never-throw` contract (public notifiers catch everything and log to `NotificationLog`) must survive; do not `await` notifiers in call sites, do not let a new export throw.
- **Never null `TenantConfig.telegramBotToken`** — it is the Telegram login-widget credential (F-2). Nulling it silently kills OAuth login.
- **Known accepted edge:** a salon that set `telegramBotToken` only for Telegram *login* and never used notification recipients will get a migrated bot row with zero recipients. It sends nothing (`recipients.length === 0 → continue`) and the admin can delete the card; deleting it does not affect login.
- **Known accepted edge:** if `telegramBotToken` is NULL but `TelegramNotificationRecipient` rows exist, no bot is created and those chat IDs are not carried over — matching today's behaviour exactly (no token ⇒ nothing was ever sent).
- **Accepted:** `NotificationLog.channel` for salon Telegram sends becomes `telegram_bot` for all event types (U-7); historical `telegram` rows stay.
- **Accepted:** one migrated row may hold a plaintext token (U-2); it is a copy of a plaintext value already present in the same DB, is never returned by any API, and is re-encrypted on the first edit through the bot card.
- **Migration mechanics:** hand-created folder + `npx prisma migrate deploy`. Never `prisma migrate dev` here (interactive reset risk against the real dev DB at `prisma/prisma/app.db`), never `prisma studio` or any long-running server.

## Manual verification to relay to the user (RU, after Stage 1 and again at the end)

1. Открой `/admin/settings/notifications` — должен быть ОДИН блок «Telegram»: переключатель + список ботов. Поля «Token bota» и отдельного списка Chat ID быть не должно.
2. В списке ботов должен уже быть бот с твоим старым токеном и всеми старыми Chat ID (ничего вводить заново не нужно). Нажми «Testuj» — должно ответить «Token działa».
3. Создай тестовую запись (или отмени существующую) — сообщение должно прийти в тот же чат, что и раньше.
4. Отправь сообщение через форму контакта на сайте — оно должно прийти ботам с областью «Wszyscy mistrzowie».
5. Выключи переключатель Telegram, сохрани, перезагрузи страницу — под переключателем должно появиться предупреждение, что Telegram выключен. Включи обратно.
6. Проверь вход через Telegram на `/auth/login` (кнопка Telegram) — должен работать как раньше.
7. Зайди как мастер на `/admin/master/notification-bots` — страница работает, формулировки без «дополнительные боты».
