# Review: Telegram Client Booking Bot — Group 1 (Foundation)
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [ ] No co-located unit tests for pure Group 1 helpers: `src/lib/telegram-bot/wizard-state.ts:1`, `src/lib/telegram-bot/keyboards.ts:1` — plan's generic "Step N: Tests" guidance calls for tests of `wizard-state` key/TTL and `keyboards` callback_data shapes under `tests/lib/telegram-bot/`. Not blocking Group 1 (no step in the Group 1 checklist explicitly requires it), but should land before/alongside Group 2-3 when more keyboard logic is added.

## Passed Checks
- [x] Lifecycle correctness: `startClientBot`/`stopClientBot`/`restartClientBot` in `src/lib/telegram-bot/lifecycle.ts` correctly guard double-start (checks `runningBot`/`runningToken`/`isRunning()`), verified against grammy internals (`bot.js` `start()`/`stop()` correctly reset `pollingRunning`, so restarting the same cached `Bot` instance after `stop()` is safe). `getClientBot()` in `bot.ts` caches per-token and only calls `registerHandlers` once per new instance, avoiding duplicate `.use()` registration across restarts.
- [x] `instrumentation.ts` correctly gates on `NEXT_RUNTIME === 'nodejs'`, dynamic-imports the lifecycle module, never awaits `bot.start()`, and swallows errors so a bad token can't crash boot. `next.config.mjs` has `experimental.instrumentationHook: true` added correctly.
- [x] `startClientBot()` reads `clientBotEnabled`/`clientBotToken` from `getTenantConfig()` and no-ops cleanly when disabled/missing token; never throws (try/catch wraps the whole function).
- [x] Security: `src/app/api/admin/client-bot-settings/route.ts` GET/PATCH both gate on `session.user.role === 'ADMIN' | 'SUPERADMIN'`, identical to sibling `notification-settings/route.ts`. Token is only returned to an already-authenticated admin session (matches existing plaintext-token pattern for `telegramBotToken`, per plan decision #8) — no leak to unauthenticated/client-facing surfaces.
- [x] All files well under the 500-line limit (largest new file, `lifecycle.ts`, is 93 lines).
- [x] Isolation from the existing notification bot confirmed: separate `clientBotToken`/`clientBotUsername`/`clientBotEnabled` fields (clearly commented in `schema.prisma`), separate `Bot` singleton in `bot.ts`, zero references to `clientBot*` inside `src/lib/notifications/`, and vice versa.
- [x] i18n: `admin.nav.clientBot`, `admin.settings.clientBot.*` (14 keys), and `bot.language.prompt`/`bot.master.comingSoon` all present with identical structure/line numbers across `pl.json`/`en.json`/`uk.json` — no missing/mismatched keys.
- [x] `ClientBotSettingsForm.tsx` follows the exact UX pattern of `NotificationSettingsForm.tsx`: masked (`type="password"`) token input, `settings-form` id + `settings-dirty` CustomEvent wiring, `form.reset(values)` after save, `apiErrorKey` toast mapping, `SettingsSection`/`ToggleRow` reuse, matching `loading.tsx`/`page.tsx` structure (auth redirect to `/admin`, `getServerT()` eyebrow).
- [x] `errors.VALIDATION_ERROR`/`errors.INTERNAL_ERROR` (the only two codes the new route can return) are already in `apiErrorKey.ts`'s `KNOWN_ERROR_CODES` whitelist — no new code was needed, so no whitelist/test gap.
- [x] Plan fidelity: every checked-off item in Group 1 (1.1–1.11) matches the actual implementation, including the intentional "placeholder / coming-soon" edit for the master step to keep Group 1 independently testable, as the plan explicitly allowed.
- [x] Migration (`20260720074826_add_client_bot_config`) correctly adds the three new nullable/defaulted columns via SQLite table-redefine, preserves all existing columns including `telegramBotToken`/`telegramBotUsername`/`notifTelegramEnabled` untouched.
- [x] `src/lib/tenant.ts` `DEFAULT_CONFIG` updated with matching defaults (`clientBotToken: null`, `clientBotUsername: null`, `clientBotEnabled: false`).
- [x] `package.json` adds `grammy: ^1.45.1` under `dependencies` (not `telegraf`), no ESM/CJS conflict with `"type": "module"`.

## Summary
Group 1 is a clean, faithful implementation of the plan's foundation slice. The riskiest piece — the long-polling lifecycle (start/stop/restart across repeated Settings saves and server-boot HMR cycles) — was traced against grammy's actual source (`pollingRunning` reset in `stop()`, no-op guard in `start()`, one-time `.use()` registration before first `start()`) and is correct with no orphaned-instance or double-registration risk. Isolation from the existing salon-notification bot is total (separate schema fields, separate `Bot` singleton, zero cross-references). Security gating, i18n parity, and settings-UI conventions all match sibling patterns exactly. The only gap is the absence of unit tests for the new pure helpers (`wizard-state`, `keyboards`), which is minor and not required by Group 1's own checklist — flagged for the coder to pick up opportunistically in Group 2/3 rather than blocking this pass.

---

# Review: Telegram Client Booking Bot — Group 2 (Master & Procedure Selection)
**Date:** 2026-07-20
**Verdict:** NEEDS CHANGES

## Critical/Architectural Issues
- [ ] **Callback-data prefix collision with the plan's own Group 3 design**: `src/lib/telegram-bot/handlers/select.ts:23` — the master-selection handler registers `bot.callbackQuery(/^m:(.+)$/, ...)`. The plan's Group 3 (Step 3.1, `handoff/telegram-client-bot_plan.md:134`) explicitly specifies calendar month-navigation callback data as `m:prev` / `m:next`. Since grammy callback-query filters are global (a `Bot` has one set of registered `.callbackQuery()` matchers checked against every incoming update, not scoped per wizard step), `m:next`/`m:prev` from the future calendar keyboard will match this Group 2 regex first. Degrades gracefully to a silent no-op (no match found, handler returns) rather than crashing, but Group 3's month navigation will be **completely non-functional** as currently planned. Fix: rename the calendar-nav callback prefix in the plan (e.g. `cal:prev`/`cal:next`) before Group 3 implementation begins.

## Minor/Syntax Issues
- [ ] **Wizard-state TTL not refreshed on the zero-procedures branch**: `src/lib/telegram-bot/handlers/select.ts:53-58` — when a master has no procedures, the handler re-renders the masters keyboard but never calls `setState`, so the Redis TTL isn't refreshed on this interaction, unlike every other step transition. Low impact; add a `setState(chatId, state)` call for consistency.
- [ ] **Silent no-op on stale/missing master or procedure lookups**: `select.ts:44-47` and `:87-90` — if an ID from a callback no longer exists (e.g. deleted mid-flow), the handler just acknowledges the callback and returns with no user-facing message, leaving the chat looking unresponsive. Recommend a one-line localized "no longer available, please choose again" fallback that re-renders the current keyboard.
- [ ] **Still no co-located unit tests for new pure helpers**: `catalog.ts`, `keyboards.ts` — flagged already in Group 1's feedback as a Group 2/3 pickup; still not done. Not blocking, but recommend addressing before Group 4's higher-risk `createBooking` extraction.

## Passed Checks
- [x] `catalog.ts`'s `listBookableMasters()`/`listMasterProcedures()` are faithful mirrors of the real `src/app/api/masters/route.ts`/`src/app/api/procedures/route.ts` prisma queries (same role/visibility filters, same price-override fallback, same global+own-service `OR` fallback). No HTTP self-call.
- [x] Localized content correctly resolved via `resolveLocalized(field, state.lang)` in both `keyboards.ts` and `select.ts` — driven by the wizard's selected language, never hardcoded Polish.
- [x] Wizard state transitions are correct across `m:<id>`/`p:<id>`/`back:master`/`back:lang` — no state corruption, no step mismatch even in the zero-procedures edge case (state remains `MASTER`, consistent with the re-rendered keyboard).
- [x] Callback-data (`m:<cuid>`/`p:<cuid>`) well under Telegram's 64-byte limit; IDs only used as DB lookup keys against already-fetched records, no injection risk.
- [x] i18n parity confirmed across pl/en/uk for all new keys, no leftover references to the removed `bot.master.comingSoon`.
- [x] All files well under the 500-line limit (`select.ts` 135, `catalog.ts` 68, `keyboards.ts` 45).
- [x] Plan fidelity for Steps 2.1–2.4 confirmed; both coder-flagged deviations were reasonable/pre-authorized by the plan's own wording, not scope creep.

## Summary
Group 2's catalog-mirroring, localization, and wizard-state logic are correctly implemented and faithful to both the plan and the real API routes. The one real issue is architectural but forward-looking: the `m:<masterId>` callback prefix will collide with Group 3's planned `m:prev`/`m:next` calendar navigation once built, since grammy callback matching is global. Fix by renaming the Group 3 calendar-nav prefix in the plan before that group starts. The two minor issues (TTL refresh gap, silent no-op on stale IDs) are small polish items a coder can fix directly.

---

## Group 2 — Fix Verification
**Date:** 2026-07-20
**Verdict:** APPROVED

### Critical/Architectural Issues
(none)

### Minor/Syntax Issues
(none)

### Passed Checks
- [x] Zero-procedures branch (`select.ts:57-63`) now calls `await setState(chatId, state)` with the unchanged state object before re-rendering the masters keyboard — refreshes the Redis TTL, consistent with every other transition in the file (`back:master`, `m:` success path, `p:` success path).
- [x] Master-lookup-miss (`select.ts:44-51`) and procedure-lookup-miss (`select.ts:92-98`) branches both `answerCallbackQuery()`, then `editMessageText(t('bot.common.noLongerAvailable'), { reply_markup: ... })` using `state.lang` (not a hardcoded locale) via `botT(state.lang)`. Master-miss re-renders `mastersKeyboard(masters, state.lang)` (already fetched); procedure-miss re-renders `proceduresKeyboard(procedures, state.lang)` (already fetched from `state.masterId`). Correct keyboard per branch, no extra DB calls, no crash risk beyond what already exists elsewhere in the file for `ctx.editMessageText` (pre-existing pattern, not introduced by this fix).
- [x] `bot.common.noLongerAvailable` added identically at pl.json:1200 / en.json:1200 / uk.json:1200, correctly nested under `common` alongside pre-existing `common.back`, no typos, translations are sound (PL/EN/UK). Not a duplicate of any existing key — grepped `noLongerAvailable`/`noServices` across all three locale files, only one occurrence each.
- [x] Plan (`handoff/telegram-client-bot_plan.md`) fully updated: Step 3.1 (line 134) explicitly documents `cal:` replacing `m:` for calendar nav with the collision rationale; Constraints & Risks (line 208) lists the full reserved-prefix namespace (`lang:`, `m:`, `p:`, `back:`, `nop`, `cal:`, `d:`, `t:`, `sp:`, `consent:`, `confirm:`) — `cal:` does not collide with any of them; Group 3 manual-verification step (line 220) also references `cal:prev`/`cal:next`. No remaining references to `m:prev`/`m:next` anywhere in the plan file.
- [x] Surgical scope confirmed: diff against the prior reviewed version of `select.ts` shows only the `setState` addition in the zero-procedures branch and the two `noLongerAvailable` message/keyboard additions — no unrelated formatting, renames, or logic changes.

### Summary
Both minor fixes from the prior Group 2 review are implemented correctly and match existing patterns in the file. The zero-procedures branch now refreshes wizard-state TTL consistently with all other transitions, and stale master/procedure callbacks now give localized user feedback with the correct re-rendered keyboard instead of silently no-op'ing. The new `bot.common.noLongerAvailable` key is correctly and identically placed across all three locale files with no duplication. The plan's `cal:` rename for Group 3 calendar navigation is fully propagated with no leftover `m:prev`/`m:next` references and no new prefix collisions. Changes are surgical. Group 2 is now fully approved.
