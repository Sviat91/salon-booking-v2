# Review: notification-bots-unify — Stage 2 (Dispatch rewrite)
**Date:** 2026-09-23
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `dispatchToBots` where-clause for `broadcastToMasterBots` is byte-identical to the pre-refactor shape: `{ enabled: true, OR: [{ scope: 'ALL' }, { masters: { some: { masterId } } }] }` (`src/lib/notifications/bots.ts:62`).
- [x] `broadcastToAllScopeBots` uses exactly `{ enabled: true, scope: 'ALL' }` with no `OR`/`masters` clause, so a `SELECTED`-scope bot cannot receive a contact-form message (`src/lib/notifications/bots.ts:74`).
- [x] `dispatchToBots` preserves the pre-existing behavior verbatim: `recipients.length === 0 → continue`, falsy `decrypt()` result → `continue`, `attempted === 0 → return` (no log write), and the error aggregation.
- [x] Both `broadcastToMasterBots` and `broadcastToAllScopeBots` retain their own top-level `try/catch` — the never-throw contract holds at every export boundary.
- [x] `notifyBookingConfirmation`, `notifyBookingCancellation`, `notifyBookingUpdate` in `index.ts`: only the general-bot branch was removed. Gate, message construction, and the existing `broadcastToMasterBots` call are untouched. `notifyBookingUpdate`'s `if (!msg) return` no-op guard preserved exactly.
- [x] `notifyContactForm` now gates Telegram solely on `config.notifTelegramEnabled`, builds the same message text, calls `broadcastToAllScopeBots` with no `appointmentId`. No direct `sendTelegramMessage`/`broadcastTelegram` calls remain in `index.ts`.
- [x] `notifyCalendarConflict`: general-bot branch removed, email half untouched, `logNotification` import correctly retained (still used by the email half).
- [x] `getTelegramRecipients()` fully deleted, zero remaining code references (only a stale AGENTS.md mention, Stage 5 scope). `broadcastTelegram()` correctly kept as `bots.ts`'s transport.
- [x] U-7 log-channel change verified safe by grep — nothing reads `NotificationLog.channel === 'telegram'` for the salon path.
- [x] File sizes: `bots.ts` 67, `index.ts` 244, `calendar-conflict.ts` 43, `internal.ts` 102 — all well under 500.
- [x] `tests/lib/notifications/bots.test.ts` still passes against the refactored `dispatchToBots` (assertions match the current implementation exactly).
- [x] `bots.ts` header docblock updated to reflect this is now the only salon Telegram mechanism.

## Summary
Stage 2 is a clean, faithful refactor. The highest-risk item — the `dispatchToBots` extraction and the two Prisma `where` shapes — is byte-identical to the plan's U-5 specification. All notifiers had only the legacy general-bot branch surgically removed, no drift in gates/message text/existing calls. `notifyContactForm` correctly routes through `broadcastToAllScopeBots`. `getTelegramRecipients()` cleanly deleted. Never-throw contract intact everywhere. No issues found — approved.

---

## Review: notification-bots-unify — Stage 3-4 (Tests, UI rewrite, dead-code removal)
**Date:** 2026-09-23
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `broadcastToAllScopeBots` test asserts `where` equals exactly `{ enabled: true, scope: 'ALL' }` (strict `toEqual`) — no `OR`/`masters` clause can leak in
- [x] Migrated-legacy-row equivalence test genuinely proves U-2's verbatim-copy claim: mixes an encrypted token and a raw plaintext token in the same `findMany` result, asserts both decode correctly through real `decrypt()`
- [x] `broadcastToAllScopeBots` block also covers multi-bot fan-out with one aggregated log, and zero-bots → zero log writes
- [x] `contact-form.test.ts` mock set matches the real import graph exactly; assertions inspect actual message content and prove the old `telegramBotToken`-gated path is dead, not just call-count theater
- [x] All six deleted files confirmed via `git status` as tracked deletions; fresh grep of `src`/`tests` returns zero live references (only expected pre-Step-19 doc mentions)
- [x] `NotificationSettingsForm.tsx`: token/recipients surgically removed from schema/defaults/load/save/onSubmit; `NotificationBotsManager` relocated inside the Telegram section with `telegramEnabled` correctly wired from `watch('notifTelegramEnabled')`; unrelated sections (email/SMS/reminders/dirty-tracking/onInvalid) untouched
- [x] `api/admin/notification-settings/route.ts`: `telegramBotToken` cleanly stripped from schema/GET/PATCH, no collateral changes
- [x] `NotificationBotsManager.tsx`: `effectiveTelegramEnabled = telegramEnabled ?? fetchedTelegramEnabled` correct override logic; notice text de-linked as specified
- [x] i18n: all 5 F-4 keys survive and match what `BotRecipientsField.tsx` renders; all 8 slated-for-deletion keys gone from all three locale files (scoped correctly, unrelated `notificationBots.recipientsLabel`/`recipientsDesc` pair correctly left alone); en/uk are real translations
- [x] No live code calls the deleted recipients API routes
- [x] File sizes all comfortably under 500 lines

## Summary
Clean, faithful execution of F-3/F-4/U-9/U-10 and Steps 10-17. New tests are substantive, not superficial. UI rewrite is surgical. All deletions confirmed safe via git status + fresh grep. i18n parity holds with correct scoping. No issues found — approved.
