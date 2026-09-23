# Requirements: fully unify the general Telegram bot into the NotificationBot table

## User's request (2026-09-23, frustrated, direct)
After the previous consolidation (moving the UI into one page), the user looked at the result and
rejected it: having a dedicated "Telegram" section (`TenantConfig.telegramBotToken` +
`TelegramNotificationRecipient`, its own Bot Token field + recipients list) sitting ABOVE a
separate "Additional notification bots" list is still two different mechanisms for the same
concept, just visually adjacent now instead of on two pages. Direct quote (translated): "why is
this bot separate, you're duplicating this... one bot [mechanism] where you enable them and add
chat IDs — why are you dividing this? Make everything one, one window. We go into Notifications
and there's one window, all 'NotificationBots'."

**The ask: eliminate the special-cased "general bot" entirely.** It becomes just an ordinary row in
the `NotificationBot` table (the table built in the previous FULL-mode task), typically with
`scope: 'ALL'`. There is no longer a conceptual difference between "the general bot" and "an
additional bot" — there is only "bots," and the salon can have as many as they want, each scoped
however they want, managed in exactly one list.

## Orchestrator's stated design decisions (communicated to the user, proceeding unless corrected)
- **Migrate existing data automatically.** Any salon that already has `TenantConfig.telegramBotToken`
  set gets it (and its `TelegramNotificationRecipient` rows) copied into one new `NotificationBot`
  row (`scope: 'ALL'`, `ownerId: null`, `enabled: true`) as part of the migration, so nobody's
  existing configuration is silently lost or needs re-entry. This must work automatically on every
  environment (local + each VPS) via the normal `prisma migrate` flow — no manual step for the user.
- **`notifyContactForm` (not master-scoped) now sends to every enabled bot with `scope: 'ALL'`**
  (not to `SELECTED`-scope bots, since those are explicitly about one/a few masters and a generic
  site contact form isn't about any specific master). This replicates prior behavior for the typical
  case (most salons will have one `ALL`-scope bot) while sensibly excluding master-specific bots.
- **`TenantConfig.notifTelegramEnabled` stays** as the one salon-wide "is the Telegram channel on at
  all" master switch — this concept is not being removed, only the *duplicate bot-token mechanism*
  is. It continues to gate every bot send (as it already does per the existing AD-6 restructure).
- **`TenantConfig.telegramBotToken`/`telegramBotUsername`/`TelegramNotificationRecipient` columns
  are NOT dropped from the schema** (avoid a destructive migration for zero benefit) — they simply
  stop being read or written by the application anywhere, fully superseded by `NotificationBot`.
  Flag if the planner finds a cleaner path, but destructive removal is not required.

## What "one window" means concretely (UI)
In `NotificationSettingsForm.tsx`'s "Telegram" `SettingsSection`: **remove** the `Bot Token` input
field and the `TelegramRecipientsField` (chat-ID list) entirely. **Keep** the
`notifTelegramEnabled` toggle ("Send Telegram notifications"). Immediately below that toggle,
render the existing `NotificationBotsManager` (already built) as the ONE list — drop the "Additional
notification bots" section heading/framing since it's no longer "additional" to anything; it's just
the bot list. One `SettingsSection` (or the toggle + the manager sharing the existing Telegram
section), not two.

## Scope

### Data migration
- One new Prisma migration that, for the singleton `TenantConfig` row, if `telegramBotToken` is
  non-null: insert one `NotificationBot` row (`label` — a sensible default, e.g. the existing
  `telegramBotUsername` if set, else a translated-at-runtime-safe generic string is not available in
  raw SQL, so use a plain literal like `'Telegram'` — check `prisma/AGENTS.md` for the house
  convention on data migrations with literal values), `token` = the **already-encrypted** ciphertext
  copied byte-for-byte (same `src/lib/encryption.ts` scheme, so no decrypt/re-encrypt needed —
  verify this assumption against `encryption.ts` before relying on it), `username` =
  `telegramBotUsername`, `enabled = true`, `scope = 'ALL'`, `ownerId = NULL`; and copy every
  `TelegramNotificationRecipient` row into `NotificationBotRecipient` rows FK'd to that new bot
  (`chatId`, `label`). Idempotent / safe to run once (there is only ever one `TenantConfig` row and
  migrations run exactly once).
- Read `prisma/AGENTS.md` for this repo's established pattern for a data-bearing migration (raw SQL
  in the migration file vs. a script) before writing it.

### Dispatch rewrite
- `src/lib/notifications/index.ts` (`notifyBookingConfirmation`, `notifyBookingCancellation`,
  `notifyBookingUpdate`), `src/lib/notifications/calendar-conflict.ts` (`notifyCalendarConflict`):
  remove the special-cased "general bot" branch (the `if (config.telegramBotToken) { ... }` block
  using `getTelegramRecipients()`/`broadcastTelegram(config.telegramBotToken, ...)` directly) —
  every master-scoped send now goes through `broadcastToMasterBots` alone (already correctly scopes
  by `ALL`/`SELECTED`). `notifTelegramEnabled` remains the outer gate.
- `notifyContactForm`: replace its `config.telegramBotToken`-based send with a new send path to
  every enabled `scope: 'ALL'` bot (no master to filter by) — likely a small new function in
  `src/lib/notifications/bots.ts` (e.g. `broadcastToAllScopeBots`) sharing logic with
  `broadcastToMasterBots` rather than duplicating the per-bot loop; use judgment on the cleanest
  shared shape without over-engineering.
- `getTelegramRecipients()`/`broadcastTelegram()` in `internal.ts`: check every remaining caller
  after this change — if nothing calls `getTelegramRecipients()` anymore, decide whether to delete
  it (dead code) or leave it (it may still be a reasonable general-purpose helper `broadcastTelegram`
  continues to need internally via `bots.ts`). Don't leave truly dead exports if nothing uses them.

### UI rewrite
- `NotificationSettingsForm.tsx`: remove the `telegramBotToken` field, its `FormDescription`, and
  `<TelegramRecipientsField control={form.control} />` from the Telegram section. Keep
  `notifTelegramEnabled`. Render `<NotificationBotsManager apiBase="/api/admin/notification-bots"
  canEditScope />` directly below it, inside the same `SettingsSection` (or immediately after it —
  coder's call on whichever reads better, but there must be visually ONE Telegram area, not two
  stacked sections).
- Check whether `telegramBotToken`/`recipients` remain in this form's Zod schema/`defaultValues`/
  `onSubmit` payload — remove them from the client form's submitted shape too (the field is gone,
  don't keep silently POSTing a value nobody can edit anymore). Check `src/app/api/admin/
  notification-settings/route.ts` (or wherever this form POSTs) for whether the API route also needs
  the now-unused field stripped from its accepted body — decide whether to leave the API route
  tolerant of an absent field (safer, simpler) rather than rejecting it.
- `TelegramRecipientsField.tsx` — if nothing renders it anymore, it's dead code; per repo convention
  ("Directive 2026-07-13: весь мёртвый/старый/ненужный код — удалять сразу") delete it, unless
  something else still uses it (check first).
- Reword `NotificationBotsManager`'s section copy (`sectionTitle`/`sectionDesc` and the page-level
  Telegram section description) so it no longer implies "additional to something else" — these are
  now simply "your Telegram bots." Update i18n accordingly (pl canonical, real en/uk translations).

### Tests
- Update/replace any test asserting the OLD general-bot dispatch path in `index.ts`/
  `calendar-conflict.ts` (from the Stage 2 work) to assert the new unified path instead.
- Add a migration-data test or a `bots-store`/dispatch test proving a migrated legacy bot (scope
  ALL, ownerId null) behaves identically to a manually-created ALL-scope bot.
- Update the admin `NotificationSettingsForm`-adjacent tests (if any exist) for the removed field.
- `notifyContactForm`'s new ALL-scope routing needs its own test coverage.

## Explicitly out of scope
- `TenantConfig.clientBotToken` / `src/lib/telegram-bot/` (the separate interactive client bot) —
  untouched, as always.
- The master's own `/admin/master/notification-bots` page — unaffected by this (it was never
  involved with the general-bot fields to begin with).
- Dropping/renaming the legacy `TenantConfig` columns in the schema.

## Constraints
- Files under 500 lines; check `NotificationSettingsForm.tsx`'s size after removing fields (should
  shrink, not a risk) and `bots.ts`'s size after adding the ALL-scope helper.
- No new npm dependency.
- Respect `src/lib/AGENTS.md`, `src/app/admin/AGENTS.md`, `src/app/api/AGENTS.md`,
  `prisma/AGENTS.md`, `tests/AGENTS.md` — read before planning, update after.
- This re-touches the same live notification dispatch path already reviewed twice this session
  (Stage 2's AD-6 restructure) — treat with the same care; a regression here is high-impact.

## Deliverable
`handoff/notification-bots-unify_plan.md`, checkbox-based, staged with user checkpoints if the
planner judges it large enough (data migration first is a natural first checkpoint — verify no data
loss before touching dispatch/UI).
