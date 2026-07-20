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
