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

---

# Review: Telegram Client Booking Bot — Group 3 (Date & Time Picker)
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] **Availability integration correct**: `renderDateStep()` (`src/lib/telegram-bot/handlers/datetime.ts:35`) calls `getAvailableDays(fromISO, untilISO, durationMin, { masterId })` and the `d:<date>` handler calls `getDaySlots(dateISO, durationMin, 15, masterId)` — both verified against `src/lib/availability.ts` signatures and actual return shapes. `getDaySlots` returns `{ slots: {startISO,endISO}[] }` directly (used without a cast, correctly). `getAvailableDays` returns `Record<string, unknown>` (`{ days, debug? }`); the local cast to `{ days: {date,hasWindow}[] }` is safe because `debug` is only added when `opts.debug` is passed, which it never is here — the cast doesn't mask a shape mismatch.
- [x] **Timezone handling consistent with existing code**: `warsawHorizon()` reuses the exact `toZonedTime(new Date(), SCHEDULE_TZ)` → `isoDate()` pattern already used inside `availability.ts` itself (hide-past-slots logic), so no new timezone risk. `d:<date>` values are plain `'YYYY-MM-DD'` strings from `buildMonthGrid`, round-tripped verbatim through callback_data — no Date reparsing that could shift by a day. Slot labels are derived via `formatInTimeZone(new Date(slot.startISO), SCHEDULE_TZ, 'HH:mm')`, matching how `startISO` was constructed.
- [x] **No callback-data collisions**: `nop`, `cal:prev`, `cal:next`, `sp:prev`, `sp:next` are exact-string matches; `d:` and `t:` use anchored regexes (`/^d:(\d{4}-\d{2}-\d{2})$/`, `/^t:(\d+)$/`). None overlap with `lang:`, `m:`, `p:`, `back:*`, `consent:`, `confirm:`. `back:date`/`back:procedure` are distinct, no collision with `back:master`/`back:lang`.
- [x] **`t:<idx>` index safety**: `idx = Number(ctx.match[1])`, then `state.slots[idx]` is checked with a null-guard before use — an out-of-range/malformed index can't crash the handler or leak attacker-controlled data (the array is server-side Redis state, not client-supplied).
- [x] **Wizard state transitions correct**: `DATE`→`TIME` on `d:<date>` stores `dateISO`/`slots`/`slotPage: 0`; `back:date` recomputes availability fresh (no stale-slot leakage risk, `TIME`-step reads always gated on `state.step === 'TIME'`); `back:procedure` resets cleanly to `PROCEDURE`. No path found where stale `slots`/`dateISO` could book the wrong slot.
- [x] **Slot pagination boundaries safe**: `sp:prev`/`sp:next` clamp correctly at first/last/single-page; pagination row omitted entirely when not needed; no out-of-bounds slice.
- [x] **Localization**: calendar month label/weekday initials use `Intl.DateTimeFormat(localeFor(lang), ...)` via `calendar-utils.ts`, driven by `state.lang` — reuses the project's existing `localeFor()` helper, not hardcoded Polish.
- [x] **500-line limit**: `datetime.ts` 234 lines, `keyboards.ts` 115 lines, `calendar-utils.ts` 59 lines — all well under the limit.
- [x] **i18n parity**: `bot.date.prompt`, `bot.date.noSlots`, `bot.time.prompt`, `bot.contact.comingSoon` present at identical positions across pl/en/uk, translations sound. No leftover functional reference to removed `bot.date.comingSoon`.
- [x] **Plan fidelity / deviations reasonable**: all four coder-flagged deviations (new `calendar-utils.ts` split, `back:procedure`'s small duplication to avoid a real circular import, natural 4-6 row calendar grid instead of fixed 6, pre-authorized `bot.contact.comingSoon` placeholder mirroring Group 2's precedent) are sound engineering judgment within the plan's own stated allowances — none warranted stopping to ask first.

## Summary
Group 3 is a correct, well-scoped implementation of the calendar/time-slot picker. Availability integration is faithful to `availability.ts`'s actual signatures/return shapes, the flagged type cast is genuinely safe, timezone handling reuses the established pattern already in `availability.ts` (no new off-by-one-day risk), and the new callback-data prefixes are all correctly anchored/exact-matched with zero collisions against the reserved namespace. Pagination, wizard-state transitions, and localization all check out. No issues found.

---

# Review: Telegram Client Booking Bot — Group 4 (Consent, Booking Extraction, Confirmation)
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [ ] **4-way circular import chain among wizard handler modules**: `contact.ts` → `consent.ts` → `confirm.ts` → `datetime.ts` → back to `contact.ts` (each importing the next step's `render*Step` function). Functionally safe today (all cross-referenced exports are hoisted `function` declarations, only ever called inside other function bodies, never at module top-level — verified no crash risk), but a real circular-dependency graph across 4 files. Recommend a lightweight follow-up: a small step-dispatcher module instead of each handler importing the next step's render function directly, to keep the module graph acyclic as more steps get added. Not blocking.

## Passed Checks
- [x] **`createBooking()` behavior-preserving fidelity — independently confirmed by the orchestrator via literal `git diff`** (the reviewer's own pass lacked Bash/git access and relied on static reconstruction; the orchestrator closed that gap by running `git show HEAD:src/app/api/book/route.ts` and reading both files in full side-by-side). The extraction is a byte-for-byte faithful move: identical validation order (masterId → guest phone length → phone normalization → pre-transaction conflict check → consent evaluation/gate → find-or-create guest user → consent persistence → service resolution → `$transaction`-wrapped conflict re-check + `Appointment.create`); identical error codes/messages/HTTP statuses (`STATUS_FOR_CODE` map in the new thin `route.ts` reproduces 400/400/400/400/409/401/500 exactly); identical `$transaction` conflict re-check structure; `notifyBookingConfirmation(created.id).catch(console.error)` fire-and-forget call is in the exact same position (after transaction commit, not awaited); `input.authenticatedUserId`/`input.ip` are faithful 1:1 substitutions for `session?.user`/`getRequestIp(req)` — the new `route.ts` computes both identically (`isAuth = session?.user?.role === "CLIENT"`, `getRequestIp(req)`) and passes them straight through. No behavior drift found.
- [x] Test coverage validity confirmed: `tests/lib/booking-service.test.ts`'s 6 tests exercise real behavior via mock-call-argument/count assertions, not tautologies (consent gate short-circuit, success, pre-transaction conflict, transactional race conflict via `mockResolvedValueOnce` sequencing, language persistence, language default).
- [x] `tests/app/api/book/consent-gate.test.ts` unmodified and green against the new thin wrapper — the Step 4.1 hard gate was honored, verified in the correct order (extraction → gate test green → new unit tests green → only then proceed to 4.2+).
- [x] Consent semantics simplification (one in-chat "agree" → `{dataProcessing:true, terms:true, notifications:true}`) was pre-authorized in the plan's own Constraints & Risks section, not a silent coder decision — flagged for the record as a real but accepted v1 simplification, not blocking.
- [x] `instrumentation.ts` block-form guard is logically equivalent to the prior early-return form for the nodejs path (same condition, same fire-and-forget, same error swallowing — only brace placement changed) — **independently re-confirmed by the orchestrator via a fresh `npm run build`**, which succeeds cleanly after this change.
- [x] Contact/consent/confirm handler correctness (phone normalization with re-prompt on failure, name-derivation fallback, `remove_keyboard` + separate `bot.contact.received` message working around Telegram's one-keyboard-type-per-message API constraint, consent skip/decline paths, rate-limit checked before the DB write, full result-code branching, graceful price re-fetch degradation) all verified correct.
- [x] 500-line limit respected across all Group 4 files (largest: `booking-service.ts` 245 lines).
- [x] i18n parity confirmed across pl/en/uk for all new keys including `bot.contact.received`; no leftover `comingSoon` references.
- [x] Plan fidelity: all 4 coder-flagged deviations are reasonable, well-justified engineering judgment, none warranted stopping to ask first.

## Summary
Group 4 — the highest-risk slice of the project — holds up completely. The `createBooking()` extraction is confirmed behavior-preserving by direct line-by-line comparison against the pre-extraction `route.ts` (via `git diff`/`git show`), not just inference: identical validation order, error codes/messages/statuses, transaction structure, and notification timing. The unmodified `consent-gate.test.ts` staying green against the new thin wrapper is the load-bearing safety net and it held. The bot-specific handlers are correct, defensive, properly localized, and the rate limit is correctly ordered before the expensive DB write. The `instrumentation.ts` fix for the edge-bundle build break is legitimate and independently confirmed via a fresh production build. The one finding (circular imports among handler modules) is a maintainability note, not a functional risk. Nothing here blocks moving to Group 5.

---

## Group 4 fix — Typed Phone Number Support
**Verdict:** APPROVED

### Critical/Architectural Issues
(none)

### Minor/Syntax Issues
(none)

### Passed Checks
- [x] `bot.on('message:text', ...)` in `contact.ts` gates on `state.step === 'CONTACT'` (returns early otherwise) — confirmed as an actual runtime check, not just documented.
- [x] Defensive leading-`/` guard present as a backstop.
- [x] Shared `handleContactSubmission()` helper used by both `message:contact` and `message:text` call sites — no duplicated normalize/reply/advance logic; both pass correctly-shaped input.
- [x] Name derivation for the typed-text path (`ctx.from?.first_name`/`last_name`, falling back to `first_name` alone when the joined result is <2 chars) is sensible, mirrors the native-contact path's fallback spirit.
- [x] **Grammy composer-ordering claim independently re-verified by the reviewer against `node_modules/grammy/out/composer.js`** (not just taken on the coder's word): `bot.command()` → `filter()` → `branch(predicate, composer, pass)`; `pass` only calls `next()` when the predicate is false. Since the `/start`/`/cancel` handler never calls `next()`, the chain terminates on a match — confirmed those commands cannot reach the later `message:text` listener.
- [x] Checked every other handler (`select.ts`, `datetime.ts`, `consent.ts`, `confirm.ts`) — all use `bot.callbackQuery()` only, none compete on `message:text` or a broad `message` filter. No additional ordering risk beyond the already-verified `/start`/`/cancel` case.
- [x] Regression check: the native `message:contact` handler's logic is unchanged after the helper extraction.
- [x] File is 80 lines, well under the 500-line limit.
- [x] No i18n changes needed; `bot.contact.invalid` wording is generic and reads correctly for both a share-button failure and a typed-text failure.
- [x] All 4 "Group 4 fix" checklist items match the actual implementation.

### Summary
Clean, behavior-preserving fix. The new text handler is correctly step-gated, the shared helper eliminates duplication, and the grammy composer-ordering claim was independently checked against the library's actual source rather than trusted on assertion. No competing message handlers exist elsewhere in the bot. Approved as-is.

---

# Review: Telegram Client Booking Bot — Group 4 polish round 2
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] **`renderMasterStep` context-awareness is correct and the justification is real**: branches on `ctx.callbackQuery` presence. Grammy's `ctx.editMessageText` shortcut derives `chat_id`/`message_id` from `callback_query.message`; invoked from a plain command update (`/start`, no callback_query) it has nothing to edit and throws — a genuine grammy/Bot API constraint, not fabricated. The `ctx.reply` fallback sends the identical content, no missing text, no double-send. Existing callback call sites (`lang:`, `back:master`, `restart:book`) are unaffected since they always have `ctx.callbackQuery` set.
- [x] **Fix F traced end-to-end**: `beginWizard()` calls `clearState` before reading `enabledLocales` (correct order — no stale sub-state leak). Single-locale path sets `state.lang` in the same `setState` call before `renderMasterStep`. Multi-locale path shows the filtered keyboard. `lang:` callback re-validates against a fresh `enabledLocales` read; on mismatch it re-renders (never crashes, never silently advances with an invalid lang). `languageKeyboard(enabledLocales)` correctly reflects Settings order.
- [x] **`restart:book` correctness**: calls the identical `beginWizard()` used by `/start`/`/cancel`; since it's always invoked from a callback context, the edit-path branch is safe here (editing the success message, a bot message).
- [x] **Fix D formatting/guard**: extracted `formatBookingSummary()` used identically by `renderConfirmStep` and the `confirm:yes` success branch — zero drift between the two messages. The tightened `confirm:yes` guard (requiring `masterName`/`procedureName`) is provably a no-op against real state timing — both fields are already unconditionally set earlier in the wizard and `renderConfirmStep` already required them. `confirmSuccessKeyboard()` correctly omits the site-link row when `NEXT_PUBLIC_SITE_URL` is unset.
- [x] **Fix B message-deletion safety**: both deletions wrapped in try/catch. Order is correct — ack sent → next step's message sent and awaited → only then is the ack deleted, so there's no race/flash of an empty chat.
- [x] **Fix A polling**: `setInterval`/`clearInterval` correctly paired for cleanup; public booking calendar (`DayCalendar.tsx`) confirmed untouched.
- [x] i18n parity confirmed line-for-line across pl/en/uk for all new/renamed keys; no leftover old copy.
- [x] 500-line limit respected across every touched file.
- [x] All `languageKeyboard()` call sites updated consistently to the new signature.
- [x] Plan fidelity: all six fixes match their checklist descriptions; the `renderMasterStep`/`back:lang` deviations were necessary (a real API constraint) and well-justified.

## Summary
Six correct, low-risk UX fixes with no functional regressions. The highest-risk item — `renderMasterStep`'s context-aware branching — is genuinely required by the Telegram Bot API and correctly implemented with no missing-content or double-send failure modes. `beginWizard()`'s ordering and the `lang:` re-validation are sound. Fix D's summary formatter has zero drift; the tightened guard is a no-op. Fix B's deletions are safely ordered. Fix A's polling is cleanly scoped. Approved as-is.

---

# Review: Telegram Client Booking Bot — Group 4 polish round 3
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] **Migration correctness**: pure single-line additive `ALTER TABLE ... ADD COLUMN "clientBotSiteUrl" TEXT` — nullable, no default, no table-redefine, zero data-loss risk.
- [x] **API route fidelity**: `clientBotSiteUrl` in `PatchSchema` correctly allows empty string (no strict `.url()`); GET/PATCH use the exact same `|| null` clearing idiom as `clientBotToken`/`clientBotUsername` — no divergent pattern.
- [x] **Form validation**: `z.union([z.literal(''), z.string()...url()])` correctly allows empty or valid URL, rejects garbage with a clear message.
- [x] **Username link fix**: strips leading `@`, renders only when non-empty/non-whitespace, uses `target="_blank" rel="noopener noreferrer"` (both attributes confirmed present).
- [x] **`resolveSiteUrl()` helper**: fallback order exactly DB → env var → `undefined`, both trimmed/trailing-slash-stripped so appended paths don't double-slash. Uses `getTenantConfig()` the same proven-safe non-request-context way `lifecycle.ts` already does.
- [x] **`legalLinks()`/`consent.ts`**: made async, awaited correctly; final fallback (bare relative paths) preserved exactly when both DB field and env var are unset.
- [x] **`confirmSuccessKeyboard()`/`confirm.ts`**: signature change applied at its single call site (grep-confirmed no orphaned callers); website button correctly omitted (not an empty-string-URL button) when resolved URL is undefined.
- [x] **Out-of-scope boundary respected**: `layout.tsx`/`sitemap.xml`/`robots.txt` confirmed untouched via direct grep.
- [x] i18n parity confirmed across pl/en/uk for all four new keys.
- [x] 500-line limit respected (largest touched file 247 lines).
- [x] Plan fidelity: all 6 steps done as specified; both coder-flagged deviations verified reasonable (optional helper overload skipped per plan's own wording; "no i18n-keyed zod message precedent" claim independently verified true via codebase-wide grep).

## Summary
Clean, faithful, low-risk implementation. Migration is trivial and additive, API/form validation exactly mirrors existing sibling-field patterns, and the new `resolveSiteUrl()` helper correctly centralizes the fallback chain with correct URL-joining behavior verified against both consumers. No orphaned callers, no regressions, out-of-scope boundary respected. Approved as-is.

---

## Group 4 polish round 4
**Date:** 2026-07-20
**Verdict:** APPROVED

### Critical/Architectural Issues
(none)

### Minor/Syntax Issues
- Test coverage gap: `telegramChatId` (Fix I) — `src/lib/booking-service.ts` has no corresponding test in `tests/lib/booking-service.test.ts` covering create-with-chatId, update-refresh-when-different, or no-clobber-when-omitted. Existing tests remain green (untouched), but the new behavior is unverified by the suite. Not required by the plan explicitly, but worth a follow-up test given this touches the shared booking transaction.

### Passed Checks
- [x] Fix G: `consentKeyboard()` only calls `.url()` when `links.termsUrl`/`privacyUrl` are truthy — never passes a relative path. `legalLinks()` returns `undefined` (not a string) when `resolveSiteUrl()` yields nothing.
- [x] `bot.consent.prompt` text (pl/en/uk) reads naturally without the raw URL mention; `termsButton`/`privacyButton` keys present and in sync across all 3 locales.
- [x] Fix H: `tgbotlang:<chatId>` key namespace cannot collide with `tgwiz:<chatId>`; TTL (180d) refreshed on both read and write. `beginWizard()` check order matches plan exactly: single-enabled-locale skip → remembered-language check (falls through correctly if no longer enabled) → multi-locale prompt. `lang:` callback writes the remembered key on every successful pick.
- [x] Fix I: guest-user block sets `telegramChatId` on create, always-refreshes on update only when provided and different, never clobbers with undefined/null. `src/app/api/book/route.ts` confirmed untouched. `confirm.ts` passes `telegramChatId: String(chatId)`.
- [x] Fix J: className exactly matches `Footer.tsx`'s pattern. i18n copy updated in pl/en/uk with concrete `@username` examples and clear distinction from display name.
- [x] Both changed files well under 500 lines. i18n parity spot-checked. Judgement call on Fix G's message wording is reasonable.

### Summary
All four fixes are implemented correctly, match the plan's specified behavior precisely, and stay within file-size and i18n-parity constraints. The one gap is a missing unit test for the new `telegramChatId` persistence logic — minor, non-blocking, flagged for optional follow-up. No architectural concerns.
