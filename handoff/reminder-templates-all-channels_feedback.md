# Review: Reminder templates on all channels (SMS/Email/Telegram) + SMS help panel
**Date:** 2026-08-23
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks

- [x] AD-9 (highest priority): `ReminderTemplatesForm.tsx:66-71` (`loadTemplates()`) only sets `values[fieldName(...)]` when `!row.isDefault`; `onSubmit` (`:102-111`) builds the payload via `values[fieldName(c, type, language)] ?? ''` across all 3 channels × 2 types × N locales. The AD-9 invariant fixed in the prior review round for SMS now correctly holds for email and Telegram too.
- [x] AD-1: `prisma/schema.prisma:399-412` — only the line-406 comment changed; model shape and `@@unique([type, language, channel])` byte-identical to before. No new migration directory.
- [x] AD-3: **Independently verified by the orchestrator** (reviewer flagged this as a gap due to no Bash access) — the six `DEFAULT_REMINDER_BODIES.telegram.*` strings in `templates.ts` are byte-identical to `bot.reminder.heading24h|heading2h + '\n\n' + bot.reminder.details` for all three locales, cross-checked against the actual locale file content captured during plan review (before Step 10 deleted those keys). A salon that never customizes Telegram sees zero change.
- [x] SMS defaults unchanged: six `sms.*` strings in `templates.ts` match the prior iteration character-for-character.
- [x] AD-5: `email.ts` — `escapeHtml(body)` called exactly once, after `renderTemplate()`. Subject line, `<html lang>`, header row, and footer row byte-for-byte unchanged; only the middle content cell differs. `BookingData` param correctly dropped from this function's signature.
- [x] AD-6: `client-telegram.ts` — `sendClientBookingReminder` takes `{ botToken, chatId, text }`, no `botT`/`Language`/`ReminderLabels` imports, forwards `text` verbatim. `client-telegram.test.ts` fully rewritten (5 tests, all passing).
- [x] Untouched-file constraints: `src/app/api/cron/reminders/route.ts`, `telegram.ts`, `notifications/index.ts` (re-export only), `sms/*` all confirmed unmodified in scope-relevant ways.
- [x] AD-10: `MAX_BODY_LENGTH = { sms: 640, email: 2000, telegram: 2000 }`; PUT route's validation loop explicitly checks per-channel length independent of the widened Zod `.max(4000)`.
- [x] Form-binding footgun avoided: `ReminderTemplateField.tsx` binds via `FormField`/`Controller` with explicit `value`/`onChange`/`onBlur`, never `register()`.
- [x] `estimateSmsSegments` stays SMS-only: gated `channel === 'sms'` in `ReminderTemplateField.tsx`.
- [x] Step 10 orphan cleanup: the five orphaned keys are gone from all three locale files (grep-confirmed zero references); `emailNotif.confirmation.*` labels and `emailNotif.reminder.subject/.whenTomorrow/.whenSoon/.footer` all correctly preserved (still used by the confirmation email / reminder subject+footer).
- [x] i18n key parity: `admin.settings.reminderTemplates.channel*` and `admin.settings.sms.help.*` blocks present identically across pl/en/uk.
- [x] File-size limit: all touched/created files well under 500 lines (largest: `reminders.ts` at 241, `SmsSettingsSection.tsx` at 203).
- [x] AD-11: `SmsInstructions.tsx` mirrors `SmtpInstructions.tsx`'s `<details>`/`<summary>`/`ChevronDown` pattern exactly, no outer `<Card>`, no `<button>` inside any panel body.
- [x] AD-2/AD-4/AD-7/AD-8: `DEFAULT_REMINDER_BODIES` channel-outermost; `renderTemplate`/`validateTemplateBody` untouched/channel-agnostic; `GET` returns all 18 rows with no `?channel=` param; channel switcher buttons use `type="button"`, no `shouldUnregister: true`.
- [x] DOX pass (Step 13): all five listed `AGENTS.md` files carry accurate, specific updates matching what actually shipped.

## Independently Verified (orchestrator — the reviewer role had no Bash access)

- `npm run test` → **39 files / 382 tests passed, 0 failures.**
- `npm run lint` → 79 pre-existing problems (74 errors, 5 warnings), identical to baseline, **none in any file this feature touched.**
- `npm run i18n:check` → **PASS** — 1406 keys in sync across pl/en/uk, all 1145 referenced `t()` keys resolve.
- `npx tsc --noEmit` → clean, zero errors.
- AD-3 Telegram byte-identity → independently confirmed against locale content captured pre-deletion (see above) — closes the one substantive gap the reviewer flagged.

## Summary

The multi-channel rewrite is faithful to the plan on every checked point, most importantly AD-9: the "empty field = default, only touched fields persist" invariant fixed in the prior SMS-only review round correctly extends to email and Telegram, with no regression. Email escaping, Telegram's transport-only refactor (with a properly rewritten test file), the per-channel length cap enforced server-side, the SMS-only segment counter, the orphaned-key cleanup with confirmed-safe key preservation, and the full DOX pass all check out. Both verification gaps the reviewer role couldn't close on its own (no Bash access — the automated test/lint/i18n/tsc suite, and byte-identity proof for the Telegram defaults) are now closed independently by the orchestrator. No issues found. Feature approved as-is.
