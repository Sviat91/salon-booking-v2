# Review: telegram-bot-security-hang-fix
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none found)

## Minor/Syntax Issues
- [ ] Unhandled retry failure: `src/lib/telegram-bot/handlers/consent.ts` and `confirm.ts` — if the fallback (no-URL-button) `ctx.reply`/`ctx.editMessageText` call itself throws, it's not caught locally; it propagates to `bot.catch()` (safely logged via `describeError`, no leak) but leaves the wizard silently stuck in that rare double-failure case. Consider a second try/catch with a plain-text-only fallback, or explicitly documenting this as an accepted limit.

## Passed Checks
- [x] `describeError` in `lifecycle.ts` matches grammy's real `BotError{error, ctx}` shape (verified against `node_modules/grammy/out/composer.js`); no path can serialize `ctx`/`Api`/token.
- [x] All 5 `console.*` calls in `src/lib/telegram-bot/` route through a safe-summary helper; no other leak surface found in a full directory sweep.
- [x] `route.ts:64`'s untouched catch block is provably safe — `restartClientBot()` never throws (wraps everything internally, returns a result object), and `clientBotToken` has no unique constraint that could echo it back in a Prisma error message.
- [x] Fix L wraps the correct URL-button call sites; retry keyboards are genuinely URL-button-free; booking/state integrity preserved (state/clearState happen before the try, not conditional on send success).
- [x] Circular-import risk for `lifecycle.ts → bot.ts → consent.ts/confirm.ts` is real (confirmed via `bot.ts`'s actual import graph); local duplication of `describeError` is justified and small.
- [x] `confirm.ts`'s `ctx.editMessageText` (vs. plan's assumed `ctx.reply`) matches pre-existing sibling-handler style (`back:time` handler uses the same pattern), not a coder invention.
- [x] i18n additions (pl/en/uk) read naturally, existing text unchanged.
- [x] All touched files well under the 500-line limit.

## Summary
The token-leak fix is sound: `describeError`'s logic was verified directly against grammy's `BotError`/`GrammyError`/`HttpError` source, and no code path can emit `ctx`, `Api`, or the raw token. The route.ts exclusion was independently re-verified as safe rather than taken on faith. The hang fix correctly scopes retry logic to the two URL-button call sites without touching unrelated keyboards, and state handling avoids double-booking or inconsistent Redis state. The only gap is a narrow, low-severity edge case (retry-of-retry failure) that doesn't affect security and is reasonable to leave as-is or fix later. Approved.
