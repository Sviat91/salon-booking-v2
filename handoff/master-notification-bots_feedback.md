## Review: master-notification-bots (Stage 1 — Data model)
**Date:** 2026-09-22
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `NotificationBot`, `NotificationBotMaster`, `NotificationBotRecipient` match the plan's field names, types, relation names, `onDelete` behavior, and indexes exactly (`prisma/schema.prisma:428-470`)
- [x] `NotificationBotMaster` mirrors `DiscountService`'s exact shape — `id @default(cuid())` surrogate key (not composite `@@id`), `@@unique([botId, masterId])`, `@@index([masterId])`, cascade FKs on both sides (`prisma/schema.prisma:146-156` vs `448-458`)
- [x] `TenantConfig.telegramBotToken`/`telegramBotUsername`, `clientBotToken`/`clientBotUsername`/`clientBotSiteUrl`/`clientBotEnabled`, and `TelegramNotificationRecipient` are byte-identical to before, untouched by the new models (`prisma/schema.prisma:375-422`)
- [x] Migration SQL (`prisma/migrations/20260922085907_notification_bots/migration.sql`) contains only `CREATE TABLE`/`CREATE INDEX` statements for the three new tables — no `ALTER TABLE` on any pre-existing table
- [x] `ownerId String?` on `NotificationBot` is nullable with no default, correctly wired as `owner User? @relation(..., onDelete: Cascade)` — null = admin-owned, matching the established `Service.masterId`/`Discount.masterId` pattern exactly (`prisma/schema.prisma:85-86`, `120-121`, `436-437`)
- [x] `User` model gained exactly the two documented back-relations (`ownedNotificationBots`, `notificationBotScopes`) with matching relation names, no other changes to `User` (`prisma/schema.prisma:45-46`)
- [x] `scope` is a plain `String @default("SELECTED")` with an inline comment documenting the `"ALL" | "SELECTED"` values — no Prisma `enum` used, consistent with `prisma/AGENTS.md`'s ban and the file's own top-of-file note ("Enums replaced with String constants due to SQLite limitations")
- [x] A block comment above `NotificationBot` documents it as strictly additive to `TenantConfig.telegramBotToken` (`prisma/schema.prisma:424-427`), satisfying the plan's Step 1 instruction
- [x] `TelegramNotificationRecipient` model itself is untouched, and the new models are appended after it as instructed

## Summary
Stage 1 of the plan is implemented exactly as specified. All three new models' field names, types, relation names, cascade behavior, and indexes match Step 1's shapes verbatim, `NotificationBotMaster` is a faithful mirror of `DiscountService`, `ownerId` nullability and cascade semantics correctly follow the established `Service.masterId`/`Discount.masterId` precedent, and the generated migration is purely additive (three `CREATE TABLE` blocks plus their indexes, zero `ALTER TABLE` on existing tables). The general salon bot's config (`TenantConfig.telegramBotToken`/`telegramBotUsername`, `clientBotToken`, `TelegramNotificationRecipient`) is completely untouched, satisfying AD-1. No enum usage anywhere. No issues found — Stage 1 is approved and Stage 2 (dispatch) can proceed.

---

## Review: master-notification-bots (Stage 2 — Dispatch)
**Date:** 2026-09-22
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [x] `NotificationLog.channel` comment not updated: `prisma/schema.prisma:475` — the inline comment documenting valid `channel` values (`email | telegram | telegram_client | sms`) was not extended to include the new `telegram_bot` value introduced by `broadcastToMasterBots`'s `logNotification({ channel: 'telegram_bot', ... })` call (`src/lib/notifications/bots.ts:48`). Purely a documentation comment, zero behavioral impact. **Fixed directly by orchestrator** — comment now reads `email | telegram | telegram_client | telegram_bot | sms`.

## Passed Checks
- [x] `getTelegramBotInfo` added to `src/lib/notifications/telegram.ts` exactly as specified (plain `fetch`, `AbortSignal.timeout(10_000)`, never throws, never logs the token, correct `{ok:true,username}|{ok:false,status}` shape); `sendTelegramMessage` untouched
- [x] `src/lib/notifications/bots.ts` (56 lines, target <100) matches Step 4 exactly: `BOT_SCOPES`/`BotScope` exported, `broadcastToMasterBots` wrapped in one top-level `try/catch` (never-throw), the exact Prisma `findMany` shape from the plan, per-bot `decrypt`+skip-if-falsy, `broadcastTelegram` reused from `./internal` (no new send path), `attempted===0` early-return with no log row, one aggregated `logNotification` call with `channel:'telegram_bot'`
- [x] All four notifiers restructured per AD-6: outer gate is `notifTelegramEnabled` only, message text built unconditionally inside that gate, the general-bot send nested one level deeper under `if (config.telegramBotToken)` with message text and log payload unchanged from the pre-existing pattern, and `broadcastToMasterBots(...)` called once, unconditionally, after the general-bot branch
- [x] `notifyBookingUpdate`'s `if (!msg) return` still fires before both the general-bot send and `broadcastToMasterBots`
- [x] `broadcastToMasterBots` never merges recipient lists across bots/tokens (confirmed by test); one bot's failure never blocks another's send or the general bot's send
- [x] AD-7 logging: exactly one `NotificationLog` row per event on `channel:'telegram_bot'`, `status:'sent'` iff any bot succeeded, no row when `attempted===0`
- [x] `CancellationAppointment.masterId`/`CalendarConflictInput.masterId` additions required no call-site changes, as predicted (spot-checked)
- [x] `notifyContactForm`, `TenantConfig.clientBotToken`, `src/lib/telegram-bot/` completely untouched
- [x] Test suite (6 tests) is meaningful, not over-mocked: real `encrypt`/`decrypt`, only `prisma`/`sendTelegramMessage` mocked, assertions check actual call arguments
- [x] File sizes all well under 500 lines

## Summary
Stage 2 is implemented with high fidelity to the plan. The highest-risk item — the AD-6 guard restructure across all four live notifiers — was executed correctly and consistently: only the `if` nesting changed, general-bot behavior is byte-identical, `broadcastToMasterBots` is strictly additive. The dispatch helper never merges recipients across bots/tokens, never throws, correctly skips bots with zero recipients. `NotificationLog` aggregation matches AD-7 exactly. `notifyContactForm`/`clientBotToken`/`telegram-bot/` untouched. Test file is genuinely meaningful. The one trivial documentation nit was fixed directly. Stage 2 approved; Stage 3 (API surface) can proceed.

---

## Review: master-notification-bots (Stage 3 — API surface)
**Date:** 2026-09-22
**Verdict:** NEEDS CHANGES

## Critical/Architectural Issues
- [ ] `updateBot`'s `BOT_SCOPE_REQUIRED` check validates request-relative fields, not the resulting effective state: `src/lib/notifications/bots-store.ts:246-248`. The check is:
  ```
  if (input.scope === 'SELECTED' && (input.masterIds ?? []).length === 0) {
    return { ok: false, code: 'BOT_SCOPE_REQUIRED', status: 400 }
  }
  ```
  Two failure modes, both from conflating "field omitted" with "field explicitly empty":
  - **False positive:** a PATCH of `{ scope: 'SELECTED', label: 'x' }` that intentionally omits `masterIds` (relying on the documented omit-to-keep semantics used everywhere else in this function) is wrongly rejected, even though the bot already has valid master joins that would be left untouched.
  - **False negative:** a PATCH of `{ masterIds: [] }` on a bot whose scope is already `'SELECTED'` in the DB (not resent in this request) sails through unchecked — `input.scope` is `undefined` so the guard never fires — and wipes all `NotificationBotMaster` rows, leaving `scope: 'SELECTED'` with zero masters.
  Fix requires computing the *effective* scope/masterIds (merging the request against the existing row) before applying the invariant, not checking the two fields independently per-request.

## Minor/Syntax Issues
- [ ] `bots-store.ts` is 341 lines against the plan's stated target of "< 250 lines" — well under the hard 500-line cap, flag for a possible split if the file grows further in Stage 4.
- [ ] Admin `DELETE` swallows every error (not-found, FK constraint, unexpected DB error) into a generic `404 NOT_FOUND` response (`src/app/api/admin/notification-bots/[id]/route.ts`, master equivalent too) — low risk, matches adjacent route style, worth distinguishing P2025 from other errors if revisited.

## Passed Checks
- [x] No route response ever includes the plaintext or encrypted token, in any success or error path, admin or master
- [x] Master `POST`'s Zod schema has no `scope`/`masterIds`/`ownerId` fields at all — structurally impossible to smuggle through
- [x] `canManageBot` consistently applied before every master mutation, correct 403-vs-404 separation
- [x] Admin routes bypass ownership checks but cannot change `ownerId` via `PATCH` (schema has no such field)
- [x] Token regex + omit-to-keep / empty-string-rejects semantics match AD-9 exactly
- [x] `createBot`'s `BOT_SCOPE_REQUIRED` check is correct (no prior state to merge against at creation time); `masterIds` validated against real MASTER-role users
- [x] Full-replace write wrapped in one `prisma.$transaction`, atomic
- [x] i18n key parity across pl/en/uk confirmed, en/uk genuinely translated
- [x] 21 new tests meaningfully exercise authorization boundaries and token secrecy, not just happy-path CRUD
- [x] File sizes all under the hard 500-line cap

## Summary
Authorization boundaries are solid (ownership, token secrecy, admin-vs-master separation all correctly enforced and tested). One real bug in `updateBot`'s scope/masterIds invariant check: it validates the request payload in isolation instead of the resulting effective state, which can both wrongly reject legitimate partial updates and silently allow a `SELECTED`-scope bot to end up with zero masters. Needs a fix before Stage 3 is approved. Two minor, non-blocking items noted.

**Fix verified by orchestrator (2026-09-22):** `updateBot` now computes `effectiveScope`/`effectiveMasterIds` by merging the request against the existing row (`existing.scope`, `existing.masters`) before applying the invariant — exactly the fix recommended above. Two regression tests added covering both failure modes (omit-masterIds-keeps-joins, and empty-masterIds-on-existing-SELECTED-is-rejected). `npm run test` green (579/579), `npm run lint` clean on touched files. **Stage 3 verdict updated: APPROVED.**

---

## Review: master-notification-bots (Stage 4 — UI)
**Date:** 2026-09-22
**Verdict:** APPROVED (after one direct fix)

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [x] Master page was missing the `SettingsSection` title/description chrome that the admin page has, and that the Google Calendar precedent provides symmetrically on both surfaces (just via different layers — admin's page.tsx wraps, master's own client component wraps internally on that older feature). Here neither layer provided it on the master side, a real visible regression (no section title/description, raw cards). **Fixed directly by orchestrator** — wrapped `NotificationBotsManager` in `SettingsSection` in `src/app/admin/master/notification-bots/page.tsx`, mirroring the admin page exactly, reusing the same `sectionTitle`/`sectionDesc` i18n keys (generic enough for both audiences). Verified clean with `npx eslint`.

## Passed Checks
- [x] `canEditScope` correctly gates the scope editor — master never sees the ALL/SELECTED picker or master checkboxes, only a read-only scope summary
- [x] `apiBase` wiring correct on both pages (`/api/admin/notification-bots` vs `/api/master/notification-bots`)
- [x] Auth guards match the Google Calendar precedent exactly (role checks + redirect targets)
- [x] Delete uses `useConfirm()`, no native `confirm()` anywhere
- [x] Error handling consistently uses `toast.error(t(apiErrorKey(...)))`, never a raw string
- [x] Token UX matches AD-9/AD-10: blank keeps existing token, required on a new bot, typed-but-unsaved token can be tested
- [x] File sizes all well under 500 lines
- [x] i18n key parity confirmed across pl/en/uk (28 keys), en/uk genuinely translated, error codes registered and translated
- [x] Nav icon (`BotMessageSquare`) distinct from the existing client-bot `Bot` icon, placed correctly in both nav lists
- [x] Bot list reloads after every save/delete; Telegram-disabled notice shown with a link to settings when the channel is off

## Summary
Stage 4 is functionally solid — scope gating, API wiring, auth guards, confirm-dialog delete, error-toast discipline, token semantics, file sizes, i18n parity, and nav icon choice all match the plan. The one real finding (master page missing section chrome, a visible UX regression versus the admin page and the cited precedent) was fixed directly (one-line wrap, verified lint-clean) rather than routed back through another coder/reviewer round, since it required no architectural decision. Stage 4 approved.
