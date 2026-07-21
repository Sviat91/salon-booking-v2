# Review: client-telegram-reminders
**Date:** 2026-07-21
**Verdict:** CHANGES_REQUESTED (Critical/Architectural)

## Critical/Architectural Issues

- **Top-level early-return gate blocks client-Telegram-only configurations**: `src/lib/notifications/index.ts:177-179` — `notifyBookingReminders()` still has the pre-existing guard `if (!config.notifEmailEnabled && !config.notifTelegramEnabled) return { sent, skipped }` at the very top of the function, evaluated *before* the loop that contains the new `clientTelegramEligible` branch. This means if an admin enables `clientBotEnabled` + a valid `clientBotToken`, but disables both `notifEmailEnabled` and `notifTelegramEnabled` (e.g. salon wants client-Telegram-only reminders, no email), the function returns immediately and **the new client-Telegram send code never executes at all** — silently, with no error/log. This contradicts the plan's own "Gating" Architecture Decision (plan line 29), which lists only `clientBotEnabled && clientBotToken && telegramChatId && no prior sent row` as the gating conditions. The gap is in the plan (it never told the coder to touch this guard), not a coder mistake. Needs a planner decision: either (a) widen the guard to `if (!config.notifEmailEnabled && !config.notifTelegramEnabled && !config.clientBotEnabled) return`, or (b) explicitly document client-Telegram reminders as email-dependent (i.e. intentionally never standalone) and update the plan's Acceptance Criteria to state that. Given the user's original ask ("настраиваем уведомления через телеграм, как минимум для тех, кто через бота записался") implies client-Telegram should work independently of the admin's email toggle, option (a) is the more faithful fix.

## Minor/Syntax Issues

- **`ReminderLabels` interface deviates from the plan's literal text** (`src/lib/notifications/client-telegram.ts:11-16`): plan specified a plain `interface ReminderLabels { master; service; date; time }`; coder changed to `interface ReminderLabels extends Record<string, string> { ... }` because passing a plain named interface to `botT(lang)('bot.reminder.details', params.labels)` fails `tsc --noEmit` (i18next's interpolation overload needs an index-signature-compatible type; named interfaces don't get one implicitly, unlike inferred object types). Reviewer confirmed no prior precedent for this pattern elsewhere in `src/lib/telegram-bot/` — every other `botT()` call site passes an inline literal or an inferred type, which is why they never hit this. The widening is runtime-neutral (same 4 keys actually sent). No action required; noted for future maintainers.

## Passed Checks
- [x] `src/lib/notifications/telegram.ts` untouched — same signature, same admin call sites, still hardcodes `parse_mode: 'HTML'`.
- [x] Token/URL never leak into any returned `Error` or logged value in `client-telegram.ts` — traced every path (non-ok response, rejected fetch, catch block).
- [x] `channel: 'telegram_client'` used consistently for both dedup read and log write — independent from admin's `'telegram'` channel.
- [x] Early-skip condition inside the loop correctly extended with `clientTelegramDone` so a pending client-Telegram send is never skipped there (independent of the function-level guard issue above).
- [x] Send gated on `clientBotEnabled && clientBotToken && appt.client.telegramChatId`; `sendClientBookingReminder` never throws (all paths return `Error | null`).
- [x] Localization uses `appt.clientLanguage` with `DEFAULT_LANGUAGE` fallback — no `getRememberedLanguage`/Redis, no import of `lifecycle.ts`/`bot.ts`/grammy anywhere in `notifications/`.
- [x] i18n keys present and structurally identical across pl/en/uk with matching placeholders.
- [x] `prisma/schema.prisma` change is comment-only; no new migration created for this feature.
- [x] `src/lib/AGENTS.md` DOX pass accurate.
- [x] All touched/created files well under the 500-line limit.
- [x] Unit test covers success, exact request shape, non-ok error, rejected-fetch token-non-leak assertion, and 2h vs 24h heading selection.
- [x] `notifyBookingConfirmation` and `notifyContactForm` code paths untouched.

## Summary
Implementation faithfully follows the plan; the one deviation (`ReminderLabels` widening) is justified and runtime-neutral. However, the plan itself missed that `notifyBookingReminders()`'s existing top-level guard (`!notifEmailEnabled && !notifTelegramEnabled` → early return) sits upstream of all the new logic, silently preventing client-Telegram-only reminder configurations from ever firing. Route back to planner to decide and specify the guard fix, then a small coder patch + re-review. All token-safety, dedup, language-source, import-boundary, schema, and file-size constraints check out cleanly.

---

# Review: client-telegram-reminders (Step 8 re-review)
**Date:** 2026-07-21
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none — the previously-noted `ReminderLabels extends Record<string, string>` deviation remains logged as a non-blocking minor note and is unchanged)

## Passed Checks
- [x] `src/lib/notifications/index.ts:177-179` now reads exactly `if (!config.notifEmailEnabled && !config.notifTelegramEnabled && !config.clientBotEnabled) { return { sent, skipped } }` — matches the plan's Step 8 fix verbatim, single-condition widening only.
- [x] Logic trace confirmed: `clientBotEnabled=true, notifEmailEnabled=false, notifTelegramEnabled=false` → guard evaluates false → proceeds to loop → client-Telegram send path reachable. Gap is closed.
- [x] Inverse confirmed: `clientBotEnabled=false` + both other toggles false → guard evaluates true → returns immediately, before any DB query.
- [x] Per-appointment `clientTelegramEligible` check unchanged — remains the authoritative send gate; widened top-level guard cannot cause spurious sends.
- [x] `notifyBookingConfirmation` and `notifyContactForm` untouched — still use their own narrower guards, out of scope for Step 8.
- [x] No other lines in `src/lib/notifications/index.ts` changed beyond the Step 8 guard.
- [x] `client-telegram.ts` unchanged from prior review — token safety, plain-text POST, no grammy imports, well under 500 lines.
- [x] `prisma/schema.prisma` comment-only change confirmed, no migration side effects.
- [x] File size: `index.ts` 418 lines, well under the 500-line limit.

## Summary
The Step 8 fix is exactly the one-line/one-condition widening specified in the plan, applied at the correct location, with no incidental changes elsewhere. Control-flow trace confirms it fully closes the previously-identified gap while preserving the fully-disabled short-circuit. All previously-passed checks remain intact. This closes the last open item from the original review — feature approved end-to-end.
