# Plan: Telegram Client Booking Bot (interactive)

**Date:** 2026-07-17
**Status:** In Progress

## Goal
Add a SEPARATE, opt-in interactive Telegram bot (its own token) that lets clients complete a full appointment booking by chatting with inline-keyboard buttons (language → master → procedure → date/time → phone → consent → confirm), running in-process in this Next.js app via grammy **long polling** started from Next.js `instrumentation.ts` on server boot, reusing the app's existing booking/availability/consent logic and locale files.

## Architecture Decisions

These are **locked** (agreed with the user) — the sections below record the concrete codebase-grounded choices, not open questions.

1. **In-process grammy LONG POLLING, not webhook / not a Mini App / not a separate service.** One deployable app. Library: **grammy** (new `package.json` dependency — confirmed absent today). The bot runs with grammy's `bot.start()` (long polling via `getUpdates`), started **once when the Next.js server boots** from a root `instrumentation.ts` `register()` hook (runs in both `next dev` and `next start`/production). No public URL, no DNS, no tunnel, no secret-token header — Telegram is polled outbound, so it works identically on `localhost` and on the VPS with zero per-environment setup. A lifecycle module owns the running `Bot` instance so the bot can be started/stopped/restarted at runtime (from boot AND from the Settings save action) without restarting the server. **Rationale:** the user tests locally and deploys to a plain VPS (persistent Node process, not serverless — ROADMAP: "Хостинг на обычном VPS (не Vercel/serverless)"), so a webhook's public-HTTPS requirement was pure friction. `bot.start()` returns a promise that resolves only when the bot stops — it must be **fire-and-forget** (do NOT `await` it in `register()`).

2. **Separate config from the existing salon-notification bot.** The existing one-way bot uses `TenantConfig.telegramBotToken` / `notifTelegramEnabled` / `notifAdminChatId` and `src/lib/notifications/telegram.ts` — **do not touch or overload these.** The new bot gets its own new `TenantConfig` fields (below), its own Settings section, its own token.

3. **Reuse existing booking logic in-process, no HTTP self-call (decision #10).** The booking-creation transaction currently lives inline in `src/app/api/book/route.ts` (lines ~40–242: consent evaluation, phone normalization, find-or-create guest user, double-booking conflict re-check inside `prisma.$transaction`, `Appointment.create` incl. `clientLanguage`, fire-and-forget `notifyBookingConfirmation`). This must be **extracted** into a framework-free `createBooking()` in `src/lib/booking-service.ts` and called by BOTH the HTTP route and the bot. The bot must NOT call the public `/api/book` endpoint (it sits on the public surface and may later gain Turnstile per ROADMAP Priority 2 item #4, which a bot can't satisfy). Do NOT duplicate the transaction/consent/phone logic.

4. **Wizard state in Redis via existing `src/lib/cache.ts`** (`cacheGet`/`cacheSet`/`cacheDel`), key `tgwiz:<chatId>`, TTL **1800s (30 min)** refreshed on every step. No new DB table, no new state store. Abandoned sessions expire naturally.

5. **Consent stays in-chat** (inline "agree"/"don't agree" buttons), reusing `src/lib/consent-service.ts`'s `evaluateConsentStatus()` (to skip the step for returning phones that already hold valid consent — mirrors the web flow) and `saveConsentRecord()` (invoked inside `createBooking`, exactly as the web route does today — no parallel consent logic). Legal docs are still *linked* (`/terms`, `/privacy`); the accept action is buttons, not a link-out form.

6. **Phone via Telegram native "request contact" button** (`keyboard: [{ text, request_contact: true }]`), normalized with `normalizePhoneToE164()` from `src/lib/utils/phone-normalization.ts` — same normalization the rest of the app requires.

7. **Bot UI text reuses `src/locales/{pl,en,uk}.json` under a new `bot.*` namespace.** First interaction is a language pick reusing `SUPPORTED_LANGUAGES` / `LANGUAGE_NAMES` from `src/lib/i18n-shared.ts`. The chosen language drives the bot conversation AND is persisted into `Appointment.clientLanguage` at booking time (same column the web flow already uses). A dedicated language-parametric translator (dedicated `i18next.createInstance()`, core-only, mirroring `src/lib/i18n-server.ts`) is needed because `i18n-server.ts`'s `getServerT()` is cookie-bound and unusable for a bot picking an arbitrary language.

8. **Token storage mirrors the existing `telegramBotToken` pattern (plaintext).** The current salon-notif `telegramBotToken` is stored/read in plaintext (`src/app/api/admin/notification-settings/route.ts`, `src/lib/notifications/index.ts`) — NOT through `src/lib/encryption.ts` (unlike OAuth/SMTP secrets). For consistency the new `clientBotToken` follows the same plaintext pattern. **Flag:** if the team later wants encryption for Telegram tokens, apply it to BOTH tokens together in a separate pass — do not diverge one bot from the other here.

9. **v1 = booking CREATION only.** Managing/cancelling an existing booking via the bot is an explicit later phase (note as future extension; do not design/build now).

10. **Opt-in per deployment (decision #12).** `clientBotEnabled=false` means the long-polling loop is **not started** (or is stopped). Enabling/disabling from the Settings save action calls the lifecycle module **directly, in-process** (`restartClientBot()` — same Node instance, no HTTP, no webhook registration). On server boot, `instrumentation.ts` reads `clientBotEnabled` from `TenantConfig` and starts the loop only if it's `true`.

## Prerequisites / Constraints to respect
- Files must stay **under 500 lines** — the bot is split into many small modules under `src/lib/telegram-bot/` (see steps). Flag proactively.
- Existing test `tests/app/api/book/consent-gate.test.ts` imports `POST` from the book route and exercises the full flow. The `createBooking` extraction MUST keep it green (it is the behavior-preservation safety net). Add a co-located `createBooking` unit test.
- **Enable instrumentation:** Next.js 14.2 gates `instrumentation.ts` behind `experimental.instrumentationHook: true`. The current `next.config.mjs` does NOT set it — it must be added (see Step 1.8), or `register()` will never run.
- **Long polling needs NO public URL** — it works on `localhost` (`npm run dev`) and on the VPS identically. `process.env.NEXT_PUBLIC_SITE_URL` (optional env already used by `sitemap.xml`/`robots.txt`) is still used ONLY to build the `/terms` & `/privacy` links inside the consent message (Group 4); if unset, fall back to plain relative paths in the text — it is NOT a bot prerequisite and never blocks the bot from running.
- **Single-process assumption:** exactly one Node process may run `bot.start()` per token — Telegram returns HTTP 409 (`Conflict: terminated by other getUpdates`) if two processes poll the same token. This is fine for a single-VPS `next start`; flag it if the deployment later runs a PM2/cluster with multiple Node workers.

---

## Implementation Steps

### Group 1 — Foundation: schema, deps, settings toggle, long-polling lifecycle, language pick
Independently verifiable: admin can enter a token + enable the bot; sending `/start` to the bot replies with a language keyboard and picking a language advances the wizard (persisted in Redis). No booking yet. **No public URL / tunnel needed — works on localhost.**

- [x] **Step 1.1: Add grammy dependency**
  - Files: `package.json`, `package-lock.json`
  - Details: `npm install grammy`. Verify it resolves and is added under `dependencies`. Do not add `telegraf`. Confirm no version conflict with `type: "module"` (grammy ships ESM+CJS — fine).

- [x] **Step 1.2: Prisma schema — new `TenantConfig` fields**
  - Files: `prisma/schema.prisma`, new migration under `prisma/migrations/`, `src/lib/tenant.ts`
  - Details: Add to `model TenantConfig` (place near the existing `telegramBotToken`/notif block, clearly commented as the SEPARATE client-booking bot):
    - `clientBotToken String?`
    - `clientBotUsername String?`  // for setup instructions / t.me deep link
    - `clientBotEnabled Boolean @default(false)`
    Run `npx prisma migrate dev --name add_client_bot_config`. Add matching defaults (`clientBotToken: null`, `clientBotUsername: null`, `clientBotEnabled: false`) to `DEFAULT_CONFIG` in `src/lib/tenant.ts`. Do NOT rename/reuse `telegramBotToken`/`telegramBotUsername`/`notifTelegramEnabled`.

- [x] **Step 1.3: Bot i18n translator (language-parametric)**
  - Files: `src/lib/telegram-bot/i18n.ts` (new)
  - Details: Mirror `src/lib/i18n-server.ts`'s dedicated-instance pattern (`i18next.createInstance()`, resources = the 3 locale JSONs, `interpolation.escapeValue: false`), but expose `botT(lang: Language)` returning `instance.getFixedT(lang)` with NO cookie dependency (do not import `next/headers`). Lazy `ensureInitialized()`. This is what all bot handlers use to render `bot.*` strings.

- [x] **Step 1.4: Wizard state (Redis)**
  - Files: `src/lib/telegram-bot/wizard-state.ts` (new)
  - Details: Define `WizardStep` (`'LANGUAGE' | 'MASTER' | 'PROCEDURE' | 'DATE' | 'TIME' | 'CONTACT' | 'CONSENT' | 'CONFIRM'`) and `WizardState` type:
    ```
    { step, lang, masterId?, masterName?, procedureId?, procedureName?, durationMin?,
      calMonth?, dateISO?, slots?, startISO?, endISO?, slotLabel?, slotPage?,
      phone?, name?, consentGiven? }
    ```
    Export `getState(chatId)`, `setState(chatId, state)` (TTL 1800), `clearState(chatId)` built on `cacheGet`/`cacheSet`/`cacheDel` with key `tgwiz:<chatId>`. Keep types small; `slots` holds the current date's `{startISO,endISO}[]` for index-based callbacks.

- [x] **Step 1.5: Keyboards module (language only for this group)**
  - Files: `src/lib/telegram-bot/keyboards.ts` (new)
  - Details: Start with `languageKeyboard()` — one inline button per `SUPPORTED_LANGUAGES` labeled from `LANGUAGE_NAMES`, callback_data `lang:<code>`. (Masters/procedures/calendar/slots/consent/confirm keyboards added in later groups.) Keep all `callback_data` short (<64 bytes).

- [x] **Step 1.6: Bot instance + `/start` + language handler**
  - Files: `src/lib/telegram-bot/bot.ts` (new), `src/lib/telegram-bot/handlers/start.ts` (new)
  - Details: `bot.ts` builds and lazily caches a grammy `Bot` keyed by token (`getClientBot(token)`), registering all handler modules via a `register(bot)` convention (the lifecycle module in 1.7 calls `getClientBot` then `bot.start()`). `handlers/start.ts`: on `/start` (and on `/cancel`) → `clearState`, set `{ step: 'LANGUAGE' }`, send `bot.language.prompt` with `languageKeyboard()`. On `callback_query:data` matching `lang:<code>` → validate with `isValidLanguage`, store `lang`, advance `step` to `'MASTER'`, `answerCallbackQuery`, then hand off to the master step (Group 2 wires the master list; for Group 1 it may just edit to a placeholder "coming next" localized string so the group is testable in isolation).

- [x] **Step 1.7: Bot lifecycle module (start / stop / restart + token validation)**
  - Files: `src/lib/telegram-bot/lifecycle.ts` (new)
  - Details: This replaces the old webhook route + webhook-admin helper. Hold a module-level singleton reference to the running `Bot` instance and a running flag (survives across calls within the one Node process).
    - `startClientBot()`: load `getTenantConfig()`; if `!clientBotEnabled || !clientBotToken` → no-op return `{ ok: true, running: false }`. Else `const bot = getClientBot(clientBotToken)`; guard against double-start (if already running with the same token, return); call `bot.start({ onStart })` **without awaiting** (fire-and-forget — it resolves only on stop). Store the instance + token. Wrap in try/catch and return `{ ok, error? }`; never throw (mirror `notifications/telegram.ts` contract).
    - `stopClientBot()`: if a bot is running, `await bot.stop()`, clear the singleton. Idempotent.
    - `restartClientBot()`: `await stopClientBot()` then `await startClientBot()` — re-reads config, so it uniformly handles enable, disable, AND token change. This is what the Settings save action calls.
    - `validateToken(token)`: build a throwaway `new Bot(token)` (or reuse grammy's `bot.api.getMe()`), call `getMe()`, return `{ ok, username?, error? }`. Used by the Settings "test connection" action (1.9/5.1). Does NOT touch the running singleton.
    Keep the file thin and under 500 lines; all handler logic stays in `handlers/`.

- [x] **Step 1.8: Server-boot hook (`instrumentation.ts`) + enable instrumentationHook**
  - Files: `instrumentation.ts` (new, project root), `next.config.mjs` (edit)
  - Details:
    - Create root `instrumentation.ts` exporting `async function register()`. Guard on `process.env.NEXT_RUNTIME === 'nodejs'` (so it never runs in the edge runtime), then dynamically `import()` the lifecycle module and call `startClientBot()` — dynamic import keeps grammy/prisma out of the edge bundle. Do NOT `await bot.start()` transitively block boot (lifecycle already fire-and-forgets). Swallow/log errors so a bad token can never crash server boot.
    - Edit `next.config.mjs`: add `experimental.instrumentationHook: true` (merge into the existing `experimental` object that already holds `serverComponentsExternalPackages`). Without this, `register()` is never called on Next 14.2.

- [x] **Step 1.9: Settings API route**
  - Files: `src/app/api/admin/client-bot-settings/route.ts` (new)
  - Details: Mirror `src/app/api/admin/notification-settings/route.ts`. `GET` (ADMIN/SUPERADMIN) returns `{ clientBotEnabled, clientBotToken, clientBotUsername }`. `PATCH` (Zod: `clientBotEnabled: boolean.optional()`, `clientBotToken: string.trim().max(256).nullable().optional()`, `clientBotUsername: string.trim().max(64).nullable().optional()`) writes to the single `TenantConfig` row (create-if-missing pattern, same as sibling). After a successful write, call `restartClientBot()` (from the lifecycle module) so the enable/disable/token change takes effect immediately in-process — no server restart, no webhook registration. If `restartClientBot` returns an error, surface it as a `{ code }` so the form can toast it via `apiErrorKey`.

- [x] **Step 1.10: Settings UI section + nav**
  - Files: `src/app/admin/settings/client-bot/page.tsx` (new), `src/app/admin/settings/client-bot/ClientBotSettingsForm.tsx` (new), `src/app/admin/settings/client-bot/loading.tsx` (new), `src/components/admin/adminNavItems.ts`
  - Details: `page.tsx` = Server Component mirroring `settings/notifications/page.tsx` (auth gate → redirect, eyebrow + muted subtitle, render the form). `ClientBotSettingsForm.tsx` = client component mirroring `NotificationSettingsForm.tsx`: `SettingsSection` from `@/app/admin/settings/FormFields`, a `ToggleRow` for enable, a password `Input` for the token, a plain input for the bot username, and static setup instructions (how to create a bot via @BotFather, paste token, enable, save — note that NO public URL/domain is needed; it works immediately). Drive the shared sidebar Save button via `<form id="settings-form">` + the `settings-dirty` CustomEvent + `form.reset(values)` after save (per admin AGENTS.md). `loading.tsx` composes `FormSkeleton`. Add a nav item to `adminNavItems.ts` (`labelKey: "admin.nav.clientBot"`, `href: "/admin/settings/client-bot"`, icon `Bot` from `lucide-react`).

- [x] **Step 1.11: i18n keys — group 1**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: Add `admin.nav.clientBot`, an `admin.settings.clientBot.*` block (page desc, section titles/descriptions, enable label, token label/placeholder/desc, username label/desc, setup instructions, save success/fail), any `errors.*` code used via `apiErrorKey` (also register it in `src/lib/errors/apiErrorKey.ts`'s whitelist + `tests/lib/errors/apiErrorKey.test.ts`), and a `bot.*` block scaffold with at least `bot.language.prompt`. Run `npm run i18n:check` for parity.

### Group 2 — Master & procedure selection
Independently verifiable: after language pick, bot shows master buttons; picking one shows that master's procedures (localized name + duration + price); picking one advances state.

- [x] **Step 2.1: Catalog data helpers for the bot**
  - Files: `src/lib/telegram-bot/catalog.ts` (new)
  - Details: `listBookableMasters()` — prisma query mirroring `src/app/api/masters/route.ts` (`role: 'MASTER'`, `masterProfile.showOnHomepage: true`, ordered `createdAt asc`), returning `{ id, name }[]`. `listMasterProcedures(masterId)` — mirror `src/app/api/procedures/route.ts` logic (MasterService assignments with price override, fallback to global + own services), returning `{ id, nameField: {pl,en,uk}, duration, price }[]` (keep the raw `{pl,en,uk}` object so the handler resolves per the picked language via `resolveLocalized`). Reuse the SAME underlying prisma shape as the routes; do NOT HTTP self-call. (Optional, do not force: the API routes MAY later be refactored to call these helpers — out of scope here.)

- [x] **Step 2.2: Master & procedure keyboards**
  - Files: `src/lib/telegram-bot/keyboards.ts`
  - Details: `mastersKeyboard(masters)` — one inline button per master, callback `m:<masterId>` (one per row for readable long names), plus a `‹ Back` button (`back:lang`). `proceduresKeyboard(procedures, lang)` — one button per procedure labeled `resolveLocalized(nameField, lang) · {duration}min · {price} zł` (use `common.currency`), callback `p:<procedureId>`, plus `back:master`.

- [x] **Step 2.3: Selection handlers**
  - Files: `src/lib/telegram-bot/handlers/select.ts` (new), register in `bot.ts`
  - Details: On `m:<masterId>` (step must be `MASTER`) → store `masterId`+`masterName`, load `listMasterProcedures`, if empty show a localized "no services" message, else store nothing yet and render procedures, set step `PROCEDURE`. On `p:<procedureId>` (step `PROCEDURE`) → look up the procedure, store `procedureId`, `procedureName` (resolved to `state.lang`), `durationMin`, advance to `DATE` (Group 3 renders the calendar; Group 2 may edit to a localized placeholder to stay testable). Wire the `back:*` callbacks to re-render the previous step. Handlers read/write via `getState`/`setState`; guard on `state.step` and `answerCallbackQuery` on every callback.

- [x] **Step 2.4: i18n keys — group 2**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: `bot.master.prompt`, `bot.procedure.prompt`, `bot.procedure.noServices`, `bot.common.back`. Reuse `common.currency`. `npm run i18n:check`.

### Group 3 — Date & time picker (inline calendar + slot list)
Independently verifiable: after procedure pick, bot shows a month calendar with only bookable days tappable; month arrows page within the horizon; picking a day shows time-slot buttons (paginated); picking a slot advances state. This is the trickiest UI piece — designed concretely below, not hand-waved.

- [x] **Step 3.1: Calendar + slots keyboards**
  - Files: `src/lib/telegram-bot/keyboards.ts`
  - Details:
    - `calendarKeyboard(month, availableDays, horizon)` where `month = 'YYYY-MM'` and `availableDays` is the set of `'YYYY-MM-DD'` with `hasWindow` from `getAvailableDays`:
      - Row 1 (nav): `‹` = `cal:prev` (rendered as noop `nop` when prev month is fully before today), a centered noop label button showing the localized `Month YYYY` (via `Intl.DateTimeFormat(localeFor(lang), {month:'long', year:'numeric'})`), `›` = `cal:next` (noop when next month exceeds the horizon). **Note:** the calendar month-nav prefix is `cal:` (NOT `m:`) so it never collides with Group 2's master-select callback `m:<masterId>` (grammy `callbackQuery` matchers are global on the `Bot` instance, not scoped per wizard step).
      - Row 2 (weekday headers): 7 noop buttons with localized short weekday initials (Intl), Monday-first.
      - 6 week rows × 7 buttons: leading/trailing blanks and past/unavailable days → noop `nop` button (label `·`); bookable days → callback `d:<YYYY-MM-DD>`, label = day number.
      - Final row: `‹ Back` (`back:procedure`).
      - `callback_data` budget is fine (`d:2026-07-15` = 12 chars, `cal:next` short).
    - `slotsKeyboard(slots, page, lang)`: buttons `HH:mm` (derive from `startISO` via `Intl.DateTimeFormat(localeFor(lang), {hour, minute}, timeZone:'Europe/Warsaw')` or slice the already-Warsaw-formatted ISO), callback `t:<idx>` (index into `state.slots`), 3 per row. Paginate at e.g. 24 slots/page with `‹`/`›` (`sp:prev`/`sp:next`) when needed. Final row: `‹ Back` (`back:date`).

- [x] **Step 3.2: Date/time handlers**
  - Files: `src/lib/telegram-bot/handlers/datetime.ts` (new), register in `bot.ts`
  - Details: Define `BOOKING_HORIZON_DAYS = 60` (flag: align with the web booking horizon if one is later found; availability.ts itself takes an explicit range from the caller). On entering `DATE`: default `calMonth` = current Warsaw month; compute the visible-month range clamped to `[today, today+horizon]`, call `getAvailableDays(fromISO, untilISO, state.durationMin, { masterId: state.masterId })`, render `calendarKeyboard`. On `cal:prev`/`cal:next` → shift `calMonth` within horizon bounds, recompute, edit message. On `d:<date>` (step `DATE`) → store `dateISO`, call `getDaySlots(dateISO, state.durationMin, 15, state.masterId)`; if empty (raced to full) show a localized "no free slots, pick another day" and re-render the calendar; else store `slots`, `slotPage: 0`, set step `TIME`, render `slotsKeyboard`. On `sp:prev`/`sp:next` → adjust `slotPage`, re-render. On `t:<idx>` (step `TIME`) → read `state.slots[idx]`, store `startISO`/`endISO`/`slotLabel`, advance to `CONTACT` (Group 4). Wire `back:date`/`back:procedure`. Use `editMessageText`/`editMessageReplyMarkup` to keep the flow in one message where possible; `answerCallbackQuery` always.

- [x] **Step 3.3: i18n keys — group 3**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: `bot.date.prompt`, `bot.date.noSlots`, `bot.time.prompt`. Month/weekday NAMES come from `Intl` (do not hardcode). `npm run i18n:check`.

### Group 4 — Consent, booking creation (shared extraction), confirmation
Independently verifiable: full end-to-end booking from Telegram creates a real `Appointment` (visible in admin), fires the existing confirmation notification, handles the double-booking race and other failures with localized messages, and re-asks consent only when needed.

- [x] **Step 4.1: Extract `createBooking()` (shared, behavior-preserving) — GATE before wiring the bot**
  - Files: `src/lib/booking-service.ts` (new), `src/app/api/book/route.ts` (edit), `tests/lib/booking-service.test.ts` (new)
  - Details: Move the booking business logic (current `route.ts` lines ~40–242) into `createBooking(input)`:
    - Input: `{ startISO, endISO, procedureId?, masterId?, name, phone?, email?, language?, consents?, ip?, authenticatedUserId? }`.
    - Replace `getRequestIp(req)` with `input.ip` (null → `maskIpForConsent` yields `0.0.0.xxx`, already handled) and `session?.user` with `input.authenticatedUserId` (when present: authenticated path, skip consent, load that user; when null: guest path).
    - Return a discriminated union `{ ok: true, appointmentId }` | `{ ok: false, code, message }` where `code` ∈ `'MISSING_MASTER' | 'VALIDATION_ERROR' | 'INVALID_PHONE' | 'CONSENT_REQUIRED' | 'CONFLICT' | 'UNAUTHORIZED' | 'INTERNAL_ERROR'` and `message` is the EXACT original error string per branch (so the HTTP route reproduces identical `{ error, code }` bodies + statuses). Keep the fire-and-forget `notifyBookingConfirmation(created.id)` inside `createBooking`.
    - Rewrite `POST /api/book` as a thin wrapper: Zod parse (unchanged, incl. the two pre-existing 400s for ZodError / invalid payload), resolve `isAuth`/`authenticatedUserId` via `auth()`, compute `ip = getRequestIp(req)`, call `createBooking(...)`, then map the result → `NextResponse` using a `statusForCode` map that preserves today's statuses (VALIDATION_ERROR/MISSING_MASTER/INVALID_PHONE/CONSENT_REQUIRED → 400, CONFLICT → 409, UNAUTHORIZED → 401, INTERNAL_ERROR → 500, success → `{ eventId: appointmentId }` 200).
    - **Hard verification gate:** `npx vitest run tests/app/api/book/consent-gate.test.ts` stays green unchanged, plus a manual web-booking smoke test, BEFORE any bot wiring in 4.2+. Add `tests/lib/booking-service.test.ts` covering the guest consent gate + conflict + clientLanguage defaulting at the function level (mirror the existing mock-prisma setup).

- [x] **Step 4.2: Contact (phone) step**
  - Files: `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/contact.ts` (new), register in `bot.ts`
  - Details: On entering `CONTACT`, send `bot.contact.prompt` with a `ReplyKeyboardMarkup` containing a single `request_contact: true` button (`one_time_keyboard: true`, `resize_keyboard: true`). Handle `message:contact`: take `msg.contact.phone_number`, normalize via `normalizePhoneToE164` (on throw → localized `bot.contact.invalid`, re-prompt), store `phone`; derive `name` from `msg.from` (`first_name` + optional `last_name`; if it's <2 chars after trim, fall back to `contact.first_name`); store `name`; remove the reply keyboard (`remove_keyboard`). Then run consent evaluation (4.3).

- [x] **Step 4.3: Consent step (reuse `evaluateConsentStatus` / gather in-chat)**
  - Files: `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/consent.ts` (new), register in `bot.ts`
  - Details: After phone+name known, call `evaluateConsentStatus({ phone: state.phone, name: state.name })`. If `hasValidConsent` → skip to `CONFIRM` (4.4). Else set step `CONSENT` and send `bot.consent.prompt` (text includes `/terms` + `/privacy` links — build from `NEXT_PUBLIC_SITE_URL` when set, else use plain relative paths) with an inline `consentKeyboard()`: `✅ agree` (`consent:yes`) / `❌ decline` (`consent:no`). On `consent:yes` → set `consentGiven: true` (this maps to `consents: { dataProcessing: true, terms: true, notifications: true }` when calling `createBooking`; **flag:** the two web-required checkboxes are collapsed into one "agree", and `notifications` is set true since the user opted into a Telegram bot — record this simplification), advance to `CONFIRM`. On `consent:no` → send `bot.consent.declined` explaining consent is required, `clearState` (or drop back to start). Consent PERSISTENCE happens inside `createBooking` (via `saveConsentRecord`) exactly as the web route does — the bot only collects and passes `consents`.

- [x] **Step 4.4: Confirm + create booking + result handling**
  - Files: `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/confirm.ts` (new), register in `bot.ts`
  - Details: On entering `CONFIRM`, render a localized summary (master, procedure, date, time, price) via `bot.confirm.summary` with `confirmKeyboard()`: `✅ book` (`confirm:yes`) / `‹ back` (`back:time`). On `confirm:yes`:
    - Light per-chat-id rate limit (see 4.5) BEFORE calling createBooking.
    - Call `createBooking({ startISO, endISO, procedureId: state.procedureId, masterId: state.masterId, name: state.name, phone: state.phone, language: state.lang, consents: state.consentGiven ? {dataProcessing:true,terms:true,notifications:true} : undefined, ip: null, authenticatedUserId: null })`.
    - Map result: `ok` → `bot.confirm.success` (summary + note that a confirmation was sent), `clearState`. `CONFLICT` → `bot.error.slotTaken`, jump back to `DATE` and re-render the calendar (the slot was raced). `CONSENT_REQUIRED` → back to consent step (shouldn't happen). `INVALID_PHONE` → back to `CONTACT`. `MISSING_MASTER`/`VALIDATION_ERROR`/`INTERNAL_ERROR` → `bot.error.generic`, suggest `/start`. Each user-facing failure mirrors the web route's failure semantics.

- [x] **Step 4.5: Light abuse guard (v1 minimal)**
  - Files: `src/lib/telegram-bot/handlers/confirm.ts` (or a small `src/lib/telegram-bot/rate-limit.ts`)
  - Details: Use the existing `rateLimit()` from `src/lib/cache.ts` with a per-chat-id key (e.g. `tgbook:<chatId>`, limit ~5 bookings/hour) on the final `confirm:yes` action; on limit → localized `bot.error.rateLimited`. **Flag (do not over-build in v1):** this bot is a NEW inbound booking-creation surface with the same spam exposure as the web `/api/book` (ROADMAP Priority 2 item #4, still open). Fuller hardening (per-update throttle, allow/deny) is an explicit follow-up tied to that ROADMAP item — this step only adds the cheap per-chat-id cap.

- [x] **Step 4.6: i18n keys — group 4**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: `bot.contact.prompt`, `bot.contact.button`, `bot.contact.invalid`, `bot.consent.prompt`, `bot.consent.agree`, `bot.consent.decline`, `bot.consent.declined`, `bot.confirm.summary`, `bot.confirm.book`, `bot.confirm.success`, `bot.error.slotTaken`, `bot.error.generic`, `bot.error.rateLimited`. `npm run i18n:check`.

### Group 4 fix — Contact step doesn't accept a manually-typed phone number

**Found via live testing:** the user typed a phone number as a plain text message on the `CONTACT` step instead of tapping the native "share contact" button, and the bot did nothing — `handlers/contact.ts` only registers `bot.on('message:contact', ...)`, there is no handler at all for typed text on this step. This is a real gap, not just a UX nudge to use the button: the phone number tied to someone's Telegram account may not be the number they want the salon to have (same reasoning the web flow already respects — it lets you type any phone number freely, not tied to any account). The bot should accept both.

- [x] In `src/lib/telegram-bot/handlers/contact.ts`, add a `bot.on('message:text', ...)` handler alongside the existing `message:contact` one, registered in the same `registerContactHandlers(bot)` function. Gate it on `state.step === 'CONTACT'` (return early otherwise, same pattern as the existing handler) so it never intercepts text meant for other steps. Grammy's command matcher (`bot.command(['start','cancel'])`, registered first in `bot.ts`) already consumes `/start`/`/cancel` before a generic text listener sees them — verify this is still true after the edit, don't special-case it defensively if grammy's composer already guarantees it. **Verified by reading `node_modules/grammy/out/composer.js`:** `bot.command()` = `this.filter(predicate, ...middleware)`; `filter()` = `this.branch(predicate, composer, pass)`; when the predicate is false, `pass(_ctx, next)` calls `next()` and the chain continues to later handlers, but when true, the matched composer runs and — since `registerStartHandler`'s handler never calls `next()` — the middleware chain stops there, so `/start`/`/cancel` never reach the later `message:text` handler. Added a defensive leading-`/` guard anyway per the plan's fallback instruction, in case of any other future command.
- [x] Run the typed text through the same `normalizePhoneToE164` + name-derivation (`ctx.from?.first_name`/`last_name`, no `contact.first_name` fallback available for typed text — use `ctx.from` fields directly) + `bot.contact.received` + `renderConsentStep` path as the existing contact handler, to avoid duplicating logic — extract a shared internal helper if that keeps both handlers under ~40-60 lines combined, or call through directly if simple enough to just reuse inline. On normalization failure, reply with `bot.contact.invalid` and re-prompt with `contactKeyboard`, same as the existing handler. Extracted `handleContactSubmission()` shared helper (normalize + reply + advance), reused by both handlers.
- [x] Do not change the `bot.contact.prompt` copy — it already says "provide your phone number" generically (not "tap the button"), so no i18n changes needed for this fix.
- [x] Run `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check`, `npx vitest run`, `npm run build`.

**Manual verification (user):** on the CONTACT step, type a phone number as plain text (do not tap the share-contact button) — the bot should accept it the same way tapping the button would (normalize, proceed to consent/skip to confirm). Also re-verify tapping the actual share-contact button still works (regression check). Restart the dev server fully before this test to rule out a stale/duplicate long-polling bot instance from earlier hot-reloads confusing the results.

### Group 4 polish round 2 — UX feedback from live testing

Six items found/requested by the user after a full end-to-end run through the bot. None require schema/architecture changes.

- [x] **Fix A: Admin calendar doesn't reflect bookings made via the bot without a manual reload.**
  - File: `src/app/admin/master/calendar/ModernCalendar.tsx`
  - Root cause: this component fetches appointments via a plain `fetch()` inside a `useEffect` (no React Query here, unlike the public booking calendar), so a booking created out-of-band (e.g. via the Telegram bot, or another admin's tab) never triggers a refetch while this page stays mounted and in focus.
  - Fix: add a second `useEffect` alongside the existing fetch-triggering one (same deps: `[dateRange, isMounted, selectedMasterId]`) that sets up `setInterval(fetchData, 15000)` (15s) and clears it on cleanup/dep change. Simple polling, no new dependency, matches the project's established "DB is local, prefer fresh over cached" direction from the earlier staleTime/router-cache fixes this session.
  - Do not touch the public booking calendar (`DayCalendar.tsx`) — it already has its own fresh-data fixes from earlier this session (staleTime 0 + router-cache disabled); this fix is specifically for the admin calendar's separate, non-React-Query fetch path.

- [x] **Fix B: Contact step UX — don't say "phone saved", and make the step feel like it dissolves into the next one.**
  - Files: `src/lib/telegram-bot/handlers/contact.ts`, `src/locales/{pl,en,uk}.json`
  - Rename `bot.contact.received` away from "Phone number saved" phrasing (implies permanent storage before consent is even given, which reads as presumptuous/alarming) to a short neutral acknowledgment, e.g. "Dziękujemy! 👍" / "Дякуємо! 👍" / "Thanks! 👍" — keep it brief, it's transient.
  - In `handleContactSubmission()`: after a successful phone submission (both the `message:contact` and `message:text` paths), best-effort delete the user's own inbound message (`ctx.deleteMessage()` — wrap in try/catch, Telegram may reject deleting old/already-gone messages, this must never break the flow on failure) for privacy/tidiness. Then send the (now-brief) acknowledgment message (still carries `remove_keyboard: true`, unchanged purpose), capture its `message_id`, call the next step (`renderConsentStep`, unchanged), then best-effort delete the acknowledgment message right after (same try/catch discipline). Net effect: user's phone number and the bot's brief "thanks" both disappear from the chat once the next step renders, instead of accumulating.
  - Do not attempt to delete the earlier CONTACT-step *prompt* message (the one with the reply keyboard) — that would require threading `message_id`s through wizard state for every step, a much bigger change not requested here. Scope this fix to the phone-submission exchange only.

- [x] **Fix C: `/terms` and `/privacy` links must actually open the real page, not misfire as bot commands.**
  - No code change — `src/lib/telegram-bot/handlers/consent.ts`'s `legalLinks()` already builds `${NEXT_PUBLIC_SITE_URL}/terms` / `/privacy` correctly when that env var is set; it only falls back to a bare relative path (which Telegram auto-renders as a tappable "slash command" instead of a link, explaining the reported "nothing happens when I tap it") when `NEXT_PUBLIC_SITE_URL` is unset.
  - User's explicit direction: tapping should open the real site page in a normal browser tab (no in-chat confirmation UI, no re-showing consent buttons below it) — the original consent message with its agree/decline buttons stays right where it is in the chat; the user reads the page, closes the tab, and taps the still-visible buttons to continue. This is simpler than duplicating consent UI and avoids any bot/website sync question.
  - Action item for the user (not code): set `NEXT_PUBLIC_SITE_URL` in `.env` (e.g. the deployed domain, or `http://localhost:3000` for local testing) — this is the only thing needed to make the links work as real clickable URLs.

- [x] **Fix D: Final confirmation message should show the actual booking details and offer next actions.**
  - Files: `src/lib/telegram-bot/handlers/confirm.ts`, `src/lib/telegram-bot/keyboards.ts`, `src/locales/{pl,en,uk}.json`
  - `bot.confirm.success` currently says only "Booking confirmed! We sent you a confirmation." with no details and no buttons — confusing since this message IS the confirmation. Rewrite it to include the same fields already computed in `renderConfirmStep` (master, procedure, date, time, price) — thread them through into the success branch of the `confirm:yes` handler (the values are already in scope there via `state`/`resolvePrice`, no new lookups needed beyond what `renderConfirmStep` already does; recompute or pass through, coder's judgement on the cleanest way without duplicating the date/time/price formatting logic — consider extracting a small shared formatter if it avoids copy-paste between `renderConfirmStep` and the success handler).
  - Add a new `confirmSuccessKeyboard(lang)` in `keyboards.ts`: one button "🆕 {book again}" with callback_data `restart:book`, and — only when `NEXT_PUBLIC_SITE_URL` is configured — a second row with a URL button "🌐 {open website}" linking to the site's homepage (`process.env.NEXT_PUBLIC_SITE_URL`). Omit the site button entirely when the env var is unset (don't render a dead/placeholder link).
  - Register a `restart:book` callback (in `start.ts`, alongside the existing `/start`/`/cancel` command handler, since it needs the exact same reset logic — see Fix F below for the shared function both should call).
  - No in-bot "my bookings"/manage-booking feature — explicitly out of v1 scope per the plan's own Architecture Decision #9 (booking creation only). The site link is the de facto way to manage an existing booking.

- [x] **Fix E: Remove the hardcoded-Polish "Wybierz język" prompt text — just show the language buttons.**
  - Files: `src/lib/telegram-bot/handlers/start.ts`, `src/locales/{pl,en,uk}.json`
  - Today `/start` always sends `botT(DEFAULT_LANGUAGE)('bot.language.prompt')` — a full Polish sentence ("Wybierz język 👇") shown to every user regardless of their actual language, before their language is even known. Telegram requires non-empty `text` on `sendMessage`, so it can't be truly blank — replace the verbose sentence with a minimal, language-neutral greeting: fetch `TenantConfig.brandName` (via `getTenantConfig()`, already used elsewhere in the bot's lifecycle code from a non-request context, confirmed safe to call here too) and send something like `👋 {brandName}` with the language keyboard — no explanatory sentence, the three language-name buttons are self-explanatory. Keep the i18n key (`bot.language.prompt` or repurpose it) but drastically shorten it / make it brand-only, not a translated sentence, since at this point we don't know the user's language yet.

- [x] **Fix F: Sync the bot's language list with Settings → Content Languages (`TenantConfig.enabledLocales`); skip the language step entirely when only one locale is enabled.**
  - Files: `src/lib/telegram-bot/handlers/start.ts`, `src/lib/telegram-bot/keyboards.ts`
  - `languageKeyboard()` currently always renders all 3 app locales (`SUPPORTED_LANGUAGES`), ignoring `TenantConfig.enabledLocales` — the same setting the web UI's language switcher already respects (`parseEnabledLocales`, from this session's earlier multilang work). Give `languageKeyboard(enabledLocales: Language[])` a parameter and iterate over that instead of the hardcoded constant.
  - Extract a shared `beginWizard(ctx, chatId)` function in `start.ts` (used by the `/start`/`/cancel` command handler AND the new `restart:book` callback from Fix D, so both share identical reset behavior): `clearState(chatId)` → read `enabledLocales` via `getTenantConfig()` + `parseEnabledLocales()` (`@/lib/localized-content`) → if exactly one locale is enabled, skip straight to it: `setState(chatId, { step: 'MASTER', lang: enabledLocales[0] })` then `renderMasterStep(ctx, enabledLocales[0])`, no language prompt at all → otherwise `setState(chatId, { step: 'LANGUAGE' })` and send the (now-minimal, per Fix E) prompt with `languageKeyboard(enabledLocales)`.
  - In the `lang:` callback handler, re-validate the picked language against a fresh `enabledLocales` read (defense against a stale keyboard from before an admin disabled a locale mid-session) before advancing — mirror the "no longer available" pattern already established in `select.ts` (Group 2) rather than inventing a new one; on mismatch, re-render the (updated) language keyboard.

- [x] Run `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check`, `npx vitest run`, `npm run build` after all six fixes.

**Manual verification (user):** restart the dev server fully. (1) Add a schedule/booking via the bot, confirm it appears in `/admin/calendar` within ~15s without reloading. (2) Submit a phone number and watch the chat — your message and the bot's brief "thanks" should both vanish once the next step appears. (3) Tap `/terms` or `/privacy` during consent — should open the real site page in a new tab (requires `NEXT_PUBLIC_SITE_URL` set); the agree/decline buttons should still be tappable in the bot after returning. (4) Complete a booking — final message should show date/master/procedure/time/price plus "Book again" (and "Open website" if configured) buttons; tapping "Book again" should restart the wizard correctly. (5) `/start` should no longer show a Polish sentence before language selection — just a brief greeting + buttons (skip entirely, straight to master selection, if only one locale is enabled in Settings → Content Languages). (6) Disable two of the three locales in Settings, restart the bot flow — only the remaining one should be offered, or the step should be skipped entirely if only one remains.

### Group 4 polish round 3 — Bot site URL setting + username Telegram link

Two user-reported settings-UX gaps, no architectural changes.

**(1) Site URL is env-var-only.** The bot's `/terms`/`/privacy` consent links (`src/lib/telegram-bot/handlers/consent.ts` `legalLinks()`, line 16-22) and the post-booking "Open website" button (`src/lib/telegram-bot/keyboards.ts` `confirmSuccessKeyboard()`, line 159-167, called from `handlers/confirm.ts:160`) both read `process.env.NEXT_PUBLIC_SITE_URL` directly. The non-technical salon-owner persona manages everything through the admin UI and does not edit `.env` on the server — they want a dedicated field in Bot Settings to type the site URL. Add a new `TenantConfig.clientBotSiteUrl` field, surface it in the settings form, and make the bot prefer it over the env var.

**(2) The `clientBotUsername` field is a dead field.** Its i18n description (`admin.settings.clientBot.usernameDesc`: "Optional — used in setup instructions and the t.me link.") promises a t.me link that was never actually implemented — the value is saved to the DB but never rendered as a link anywhere (grepping the `setupStep1`-`setupStep4` keys confirms the gap). The user was confused about what this field is for. Wire it up as promised: render a clickable "Open bot in Telegram →" link below the field when it has a value.

Hard requirement for the bot's URL resolution: **fallback order is DB field (`clientBotSiteUrl`) → env var (`NEXT_PUBLIC_SITE_URL`) → today's final fallback** (relative `/terms`/`/privacy` paths for consent links; omit the "Open website" button for the success keyboard). This preserves current behavior when neither is set.

- [x] **Step R3.1: New `TenantConfig.clientBotSiteUrl` field (schema + migration + default)**
  - Files: `prisma/schema.prisma`, new migration under `prisma/migrations/`, `src/lib/tenant.ts`, `prisma/AGENTS.md`
  - Details: Add `clientBotSiteUrl String?` to `model TenantConfig` immediately alongside the existing `clientBotToken`/`clientBotUsername`/`clientBotEnabled` block (lines 264-266, inside the "Separate interactive Telegram CLIENT BOOKING bot" comment section) — same nullable-string pattern as `clientBotUsername`. Run `npx prisma migrate dev --name add_client_bot_site_url` (purely additive, data-preserving — SQLite table-redefine must keep every existing column). Add `clientBotSiteUrl: null` to `DEFAULT_CONFIG` in `src/lib/tenant.ts` (next to the existing `clientBotToken: null` / `clientBotUsername: null` / `clientBotEnabled: false` at lines 56-58). DOX: note the new field in `prisma/AGENTS.md` if it enumerates `TenantConfig` fields.

- [x] **Step R3.2: Settings API route — read/write the new field**
  - Files: `src/app/api/admin/client-bot-settings/route.ts`
  - Details: Read the current file first (it already has the ADMIN/SUPERADMIN gate and a `PatchSchema`). Extend exactly matching the `clientBotUsername` pattern already there:
    - `PatchSchema` (line 7-11): add `clientBotSiteUrl: z.string().trim().max(512).nullable().optional()`. Light validation only — if the coder wants a URL-shape check, use a schema that ALSO accepts empty string (e.g. `.nullable().optional()` plus a `.refine`/union that permits `''`), because empty must be allowed to clear the field. Do NOT force a strict `.url()` that rejects `''`. A ZodError already maps to `code: 'VALIDATION_ERROR'` (line 58-59), which is whitelisted in `apiErrorKey.ts` — no new error code needed.
    - `GET` (line 21-25): add `clientBotSiteUrl: config?.clientBotSiteUrl ?? ''` to the returned object.
    - `PATCH` (line 40-49): add `if (data.clientBotSiteUrl !== undefined) updateData.clientBotSiteUrl = data.clientBotSiteUrl || null` — this is the exact same `|| null` "empty-string-clears-to-null" pattern the token/username fields already use (lines 42-43). Verify and match it, do not invent a new clearing mechanism.

- [x] **Step R3.3: Settings UI form — new Website URL field + username link fix**
  - Files: `src/app/admin/settings/client-bot/ClientBotSettingsForm.tsx`
  - Details: Read the current file first.
    - **New field:** extend `formSchema` (line 24-28) with `clientBotSiteUrl` — an optional string that allows empty OR a valid URL (mirror the API's approach; if using `.url()`, wrap so `''` passes, e.g. a union with `z.literal('')`, and attach a sensible `message` for the invalid-URL case). Add `clientBotSiteUrl: ''` to `defaultValues` (line 69-73) and to the `form.reset({...})` in the load effect (line 89-93, `clientBotSiteUrl: data.clientBotSiteUrl ?? ''`). Add a new `FormField` for `clientBotSiteUrl` inside the first `SettingsSection` (the token/username one, line 132-188) — place it sensibly near the token/username fields. Plain `Input` (not password), with `label`/`placeholder`/`description` from new i18n keys (Step R3.4); the description must explain it's shown as a link in the bot's terms/privacy consent messages and as the "Open website" button after a successful booking.
    - **Username link fix:** in the existing `clientBotUsername` `FormField` (line 174-187), below the `FormDescription`, conditionally render a small clickable link when `field.value` is a non-empty trimmed string: an `<a href={`https://t.me/${username}`} target="_blank" rel="noopener noreferrer">` whose text is the new `admin.settings.clientBot.openBotLink` key (e.g. "Open bot in Telegram →"). Strip a leading `@` from the username when building the `t.me` URL (users may type `@my_salon_bot`). Simple conditional render, no new dependency. Style it to match the muted-link look of the surrounding form (e.g. small text, accent color).

- [x] **Step R3.4: i18n keys — round 3**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: Under the existing `admin.settings.clientBot.*` block (en.json line 667-688), add, mirroring the `usernameLabel`/`usernamePlaceholder`/`usernameDesc` naming:
    - `siteUrlLabel` — e.g. "Website URL"
    - `siteUrlPlaceholder` — e.g. "https://my-salon.com"
    - `siteUrlDesc` — explains it's shown as the `/terms` & `/privacy` links in the bot's consent message and as the "Open website" button after a successful booking; optional — leave empty to fall back to the server's `NEXT_PUBLIC_SITE_URL`.
    - `openBotLink` — the username link text, e.g. "Open bot in Telegram →"
    Add all four to pl/en/uk with sound translations, identical key structure/position across the three files. Run `npm run i18n:check` for parity.

- [x] **Step R3.5: Bot code — resolve site URL from DB field first (shared helper)**
  - Files: `src/lib/telegram-bot/handlers/consent.ts`, `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/confirm.ts`, plus one small shared helper (placement per coder judgement — see below)
  - Details:
    - **Shared helper (recommended, don't duplicate the 3-line fallback in two files):** add one tiny function that returns the effective base site URL — `clientBotSiteUrl` (trimmed of trailing slash) → `process.env.NEXT_PUBLIC_SITE_URL` (trimmed) → `undefined`. Since `getTenantConfig()` is async, the helper is async (`Promise<string | undefined>`); consider an overload/variant that accepts an already-fetched config to avoid a redundant DB read when the caller already has one. Placement is the coder's call given what's in `src/lib/telegram-bot/` today (e.g. a new `src/lib/telegram-bot/site-url.ts`, or an existing shared module) — pick the cleanest. The helper returns the BASE url; each caller appends its own path (`/terms`, `/privacy`, or uses the root for the website button).
    - **`consent.ts`:** `legalLinks()` (line 16-22) currently reads `process.env.NEXT_PUBLIC_SITE_URL` synchronously. Make it use the resolved base URL with the required fallback order (DB field → env var → relative paths). Two acceptable shapes — pick whichever fits the file more cleanly once in it: (a) make `legalLinks()` async and `await` the helper inside it, or (b) have the caller `renderConsentStep` (already async, line 29) resolve the base URL once and pass it into `legalLinks(baseUrl)`. Preserve today's final fallback exactly: when neither DB field nor env var is set, `termsUrl`/`privacyUrl` stay the bare `'/terms'`/`'/privacy'` relative paths (Fix C behavior). Hard requirement: the DB-field-then-env-var order is not optional.
    - **`keyboards.ts`:** change `confirmSuccessKeyboard(lang: Language)` (line 159-167) to `confirmSuccessKeyboard(lang: Language, siteUrl: string | undefined)` — it must NOT read `process.env` itself anymore. Render the "Open website" URL button only when `siteUrl` is truthy (same omit-when-unset behavior as today, just from the parameter). Update the JSDoc above it (line 155-158) from "only when `NEXT_PUBLIC_SITE_URL` is set" to reflect the new source (DB `clientBotSiteUrl`, falling back to the env var).
    - **`confirm.ts`:** the `confirm:yes` success branch (line 149-162, already inside an async handler) must resolve the base site URL via the same shared helper BEFORE calling `confirmSuccessKeyboard(state.lang, siteUrl)` (line 160). Do not read `process.env` here directly — go through the helper for the DB-field-then-env-var order.
    - **Out-of-scope boundary (do NOT touch):** the other pre-existing `NEXT_PUBLIC_SITE_URL` usages — `src/app/layout.tsx`, `src/app/sitemap.xml/route.ts`, `src/app/robots.txt/route.ts` — are unrelated deploy-time concerns outside this fix. Leave them exactly as they are.

- [x] **Step R3.6: Verification**
  - Details: Run `npx prisma migrate dev --name add_client_bot_site_url` (confirm it applies cleanly), then `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check`, `npx vitest run`, `npm run build`. All must pass.

**Manual verification (user):** restart the dev server fully after the migration.
1. Open Admin → Settings → Booking bot. Fill in the new **Website URL** field (e.g. your domain or `http://localhost:3000`), save. Trigger the bot's consent step (start a booking with a phone that has no valid consent) — `/terms`/`/privacy` should now be real clickable links using this value, with NO `.env` change needed. Complete a booking — the success message's "Open website" button should point at the same URL. Clear the Website URL field and save — the bot should fall back to `NEXT_PUBLIC_SITE_URL` if set, or to relative paths / no website button if not.
2. Fill in the **Bot username** field (e.g. `my_salon_bot`), save — an "Open bot in Telegram →" link should appear below the field and, when clicked, open `https://t.me/my_salon_bot` in a new tab and land on your bot. Clear the field and save — the link should disappear.

### Group 4 polish round 4 — Clickable legal links, remembered language, chatId persistence, link readability

Four items from live testing, no architectural changes. `User.telegramChatId` already exists in `prisma/schema.prisma` and is currently unused anywhere in `src/` (confirmed via grep) — no schema change needed this round.

- [x] **Fix G: `/terms`/`/privacy` mentioned as plain-text URLs aren't reliably clickable — convert to URL buttons.**
  - Files: `src/lib/telegram-bot/handlers/consent.ts`, `src/lib/telegram-bot/keyboards.ts`, `src/locales/{pl,en,uk}.json`
  - Root cause: Telegram's client-side auto-linkification of plain-text URLs doesn't reliably recognize `http://localhost:3000/...` (no real TLD) as a link, and depending on client/version isn't 100% guaranteed even for real domains. `InlineKeyboard.url()` buttons are unconditionally clickable regardless of domain — the robust fix.
  - `consentKeyboard(lang)` → `consentKeyboard(lang, links: { termsUrl?: string; privacyUrl?: string })`: when `resolveSiteUrl()` (already exists, `src/lib/telegram-bot/site-url.ts`) yields a real absolute URL, add two more rows to the keyboard — "📄 {terms}" (`url: termsUrl`) and "🔒 {privacy}" (`url: privacyUrl`) — above the existing agree/decline rows. Telegram rejects non-absolute URLs for `url`-type buttons, so when `resolveSiteUrl()` returns `undefined` (no DB field and no `NEXT_PUBLIC_SITE_URL` set), omit these two rows entirely — do NOT pass a relative path to `InlineKeyboard.url()`.
  - `renderConsentStep` (`consent.ts`) already resolves `termsUrl`/`privacyUrl` via `legalLinks()` (line 17-23) for the message text — pass those same resolved values into `consentKeyboard()` instead of/in addition to leaving them in the text. When `resolveSiteUrl()` was unavailable and `legalLinks()` fell back to relative paths, don't pass those relative paths as button URLs (per above) — simplest: have `legalLinks()` return `{ termsUrl: string | undefined; privacyUrl: string | undefined }` (undefined when no real site URL resolved) instead of always falling back to a relative-path string, and update `bot.consent.prompt`'s i18n text/interpolation so it reads sensibly whether or not the links are present (e.g. keep the current text mentioning the docs when a real URL exists; when it doesn't, either omit that part of the message or keep a generic non-linked mention — coder's judgement, but must not print a raw non-clickable relative path in the message text either, since that reproduces today's confusing look).
  - Add i18n keys for the two new button labels (`bot.consent.termsButton`, `bot.consent.privacyButton` or similar) to pl/en/uk.

- [x] **Fix H: Remember the picked language per Telegram user beyond the 30-min wizard-session TTL.**
  - Files: `src/lib/telegram-bot/wizard-state.ts` (or a new small sibling module — coder's call), `src/lib/telegram-bot/handlers/start.ts`
  - Today `WizardState.lang` only lives in the same `tgwiz:<chatId>` Redis key as the rest of the in-progress wizard (1800s TTL, cleared on every `/start`/`/cancel`/completed booking). A returning user has to re-pick their language every single time they start a new booking. Add a SEPARATE, longer-lived Redis key (e.g. `tgbotlang:<chatId>`, no relation to the wizard-session key/TTL — suggest a long TTL such as 180 days rather than no-expiry, refreshed every time it's read or written, so truly-abandoned chat histories eventually clean up) storing just the last-picked `Language` for that chat.
  - In `beginWizard(ctx, chatId)` (`start.ts`): after `clearState`, check this persistent key BEFORE deciding whether to show the language prompt. If a remembered language exists AND is still in the current `enabledLocales` set (an admin may have disabled it since), skip the language prompt entirely — same skip path already used for the single-enabled-locale case — and go straight to `renderMasterStep` with the remembered language. Only fall through to showing the language keyboard when there's no remembered language (or it's no longer enabled) AND more than one locale is enabled.
  - In the `lang:` callback handler: whenever a language is actively picked (including re-picks), write/refresh the persistent key.
  - Do not add any new command to let a user change their remembered language mid-flow — out of scope for this fix (not requested); if the user later wants a way to switch, that's a separate, deliberate follow-up.

- [x] **Fix I: Persist the booking Telegram user's `chatId` onto their `User` record for future reminder delivery (storage only — no delivery yet, explicitly deferred by the user).**
  - Files: `src/lib/booking-service.ts`, `src/lib/telegram-bot/handlers/confirm.ts`
  - `CreateBookingInput` (`booking-service.ts`) gains an optional `telegramChatId?: string | null`, defaulting to not-set for the existing web caller (`src/app/api/book/route.ts` — do NOT modify that route, it simply won't pass this field, so behavior there is unchanged).
  - In the guest-user find-or-create block (the `else` branch under `if (isAuth) {...} else {...}`, where `clientUser` is looked up by phone+name or created): when `input.telegramChatId` is provided, thread it into `prisma.user.create()`'s `data` for the new-user path, and for the existing-user path, update `telegramChatId` via `prisma.user.update()` when it's present and differs from what's already stored — mirror the existing "update email if provided and user has no email yet" pattern already in that block, but always refresh (not just fill-if-missing) since chatId should track whichever Telegram account most recently booked with this phone+name identity.
  - `confirm.ts`'s `confirm:yes` handler: pass `telegramChatId: String(chatId)` into the `createBooking(...)` call.
  - No reminder-sending changes in this round — `src/lib/notifications/index.ts`'s reminder loop is untouched. This is groundwork only; actually delivering reminders via the client bot to `user.telegramChatId` is an explicit future round, not now.

- [x] **Fix J: "Open bot in Telegram" link is unreadable in both themes, and the username field's purpose is unclear.**
  - Files: `src/app/admin/settings/client-bot/ClientBotSettingsForm.tsx`, `src/locales/{pl,en,uk}.json`
  - The link currently uses `className="text-xs text-accent hover:underline"` (added in round 3) — the tenant's soft/pastel `accent` color has poor contrast as a *resting* text color in both light and dark themes (it's designed for backgrounds/decorative use, not small foreground text) — the user reports it's essentially invisible, and the surrounding default browser focus outline makes it look like a broken input box rather than a link.
  - Fix: restyle to match the already-working, theme-tested link pattern used by `src/components/Footer.tsx`'s legal links (`text-neutral-500 dark:text-dark-muted hover:text-primary dark:hover:text-accent transition-colors`) plus an `underline` class so it unambiguously reads as a link regardless of color — do not introduce a new, untested color combination.
  - Update `admin.settings.clientBot.usernameLabel`/`usernamePlaceholder`/`usernameDesc` (pl/en/uk) to clearly state this must be the bot's exact technical `@username` as registered with @BotFather (always ends in "bot", e.g. `moj_salon_bot`), NOT the bot's display name (a separate, different thing in BotFather) — the user typed the display name here and the resulting `t.me/` link went nowhere useful. Example text: label "Nazwa użytkownika bota (@username)", description something like "Techniczna nazwa użytkownika bota z @BotFather — zawsze kończy się na „bot" (np. moj_salon_bot), NIE nazwa wyświetlana bota." (adapt naturally per locale, keep the concrete example).

- [x] Run `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check`, `npx vitest run`, `npm run build` after all four fixes. No migration needed this round (`telegramChatId` already exists in the schema).

**Manual verification (user):** restart the dev server fully. (1) Trigger the consent step with a real `clientBotSiteUrl` configured — terms/privacy should now be tappable buttons, not plain text. Clear the site URL — those two buttons should disappear cleanly (message still makes sense without them). (2) Pick a language, complete or abandon the flow, send `/start` again — language should NOT be asked again, straight to master selection. Disable that language in Settings → Content Languages, `/start` again — should now ask again (remembered value no longer valid). (3) Complete a booking via the bot, then check the `User` row for that guest (e.g. via the DB browser) — `telegramChatId` should be populated. (4) Look at the Bot Settings page in both light and dark theme — the "Open bot in Telegram" link (when username is filled) should be clearly readable, and the username field's description should make it obvious what to type.

### Group 5 — Nice-to-have polish (only if scope allows)
- [ ] **Step 5.1: "Test connection" action in Settings**
  - Files: `src/app/api/admin/client-bot-settings/route.ts` (or a sibling `.../test/route.ts`), `ClientBotSettingsForm.tsx`, locale files
  - Details: A button that calls `validateToken(token)` (from `lifecycle.ts` — runs `getMe()`) and reports the resolved bot username or the API error. Read-only, does NOT start/stop the running instance.
- [ ] **Step 5.2: DOX pass** — update the nearest owning AGENTS.md files whose contracts changed: `src/lib/AGENTS.md` (new `booking-service.ts` extraction + new `telegram-bot/` module family incl. the `lifecycle.ts` start/stop/restart contract + its Local Contracts), `src/app/api/AGENTS.md` (new `client-bot-settings` route — note there is NO webhook route), `src/app/admin/AGENTS.md` (new `settings/client-bot/` page), root `CLAUDE.md` Child DOX Index + a new `src/lib/telegram-bot/AGENTS.md` (this folder is a durable boundary — create one, and document the `instrumentation.ts` boot hook + long-polling lifecycle). Update `prisma/AGENTS.md` for the new `TenantConfig` fields. Note the new root `instrumentation.ts` in the root DOX index.

- [ ] **Step N: Tests** — see per-group test steps (4.1 `booking-service.test.ts`, keep `consent-gate.test.ts` green, `apiErrorKey` whitelist test if a new error code is added). Pure/unit-testable bot helpers (`wizard-state` key/TTL, `keyboards` callback_data shapes, `catalog` resolution) get co-located tests under `tests/lib/telegram-bot/`. grammy handler flows and the polling lifecycle are integration-heavy — cover the extractable pure pieces, verify the conversational flow manually (see Manual Verification).

## Acceptance Criteria
- [ ] `npm run test` green (incl. unchanged `tests/app/api/book/consent-gate.test.ts` and new `tests/lib/booking-service.test.ts`).
- [ ] `npm run lint` passes with zero warnings.
- [ ] `npm run build` succeeds (no Server-Component/`createContext` build-phase breakage from the bot i18n instance; bot i18n uses a core-only `i18next.createInstance()`, never `@/lib/i18n`; `instrumentation.ts` guards on `NEXT_RUNTIME === 'nodejs'` and dynamic-imports the lifecycle so grammy/prisma never enter the edge bundle).
- [ ] `npm run i18n:check` passes (pl/en/uk parity for all new `bot.*` and `admin.settings.clientBot.*` / `admin.nav.clientBot` keys).
- [ ] Existing web booking flow (`/[masterId]` → `/api/book`) behaves identically after the `createBooking` extraction (same `{ error, code }` bodies + statuses, same confirmation notification).
- [ ] Existing salon-notification bot (`telegramBotToken`/`notifTelegramEnabled`) is completely untouched and still works.
- [ ] Bot is fully gated by `clientBotEnabled`: on server boot `instrumentation.ts` starts the long-polling loop only if enabled+token; disabling in Settings stops the loop (`bot.stop()`), enabling starts it (`bot.start()`) — all in-process, no server restart, no public URL.
- [ ] End-to-end: a client can book from Telegram (language → master → procedure → date/time → contact → consent-if-needed → confirm), the `Appointment` appears in admin with the picked `clientLanguage`, and the double-booking race returns a localized "slot taken" without creating a row.
- [ ] Every file stays under 500 lines.
- [ ] Follows project conventions (admin settings-form pattern, `SettingsSection`, nav via `adminNavItems.ts`, `apiErrorKey` for API error codes, `resolveLocalized` for content).

## Constraints & Risks
- **Do NOT touch** the existing salon-notification bot fields/code: `TenantConfig.telegramBotToken` / `telegramBotUsername` / `notifTelegramEnabled` / `notifAdminChatId`, `src/lib/notifications/telegram.ts`, `src/app/api/admin/notification-settings/route.ts`, `NotificationSettingsForm.tsx`. This plan is a SEPARATE bot.
- **`createBooking` extraction is the highest-risk change** (it rewrites the core booking transaction shared by the live web flow). It must be behavior-preserving and gated on `consent-gate.test.ts` staying green + a manual web-booking smoke test BEFORE the bot is wired to it. Do not change the double-booking `$transaction` re-check, phone normalization, find-or-create-guest identity `(phone+name)`, or consent gating semantics.
- **`bot.start()` is fire-and-forget** — it returns a promise that resolves only when the bot stops, so `instrumentation.ts`/`startClientBot()` must NOT `await` it or server boot will hang. The lifecycle module must guard against double-start (calling `bot.start()` twice on one instance throws).
- **Callback-data prefix namespace (global on the `Bot`):** grammy's `bot.callbackQuery()` matchers are registered on the `Bot` instance and tested against every update regardless of the user's current wizard step. Every prefix must therefore be globally unique. Reserved prefixes: `lang:` (language), `m:` (master select), `p:` (procedure select), `back:` (back nav), `nop` (noop cells), `cal:` (calendar month nav — `cal:prev`/`cal:next`), `d:` (day select), `t:` (slot select), `sp:` (slot pagination), `consent:` (consent), `confirm:` (final confirm). Do NOT reuse `m:` for calendar navigation — that is why month-nav is `cal:`, not `m:prev`/`m:next`.
- **Single-process / 409 Conflict:** only ONE Node process may long-poll a given token. A single-VPS `next start` is fine. If the deployment later runs a multi-worker cluster (PM2 `instances > 1`), Telegram returns 409 and updates get split — flag this and, if it arises, gate `startClientBot()` to a single worker.
- **`instrumentationHook`:** `instrumentation.ts` only runs when `experimental.instrumentationHook: true` is set in `next.config.mjs` (Next 14.2). Missing this = the bot silently never starts on boot. In `next dev`, `register()` may fire on each restart/HMR of the server process — the double-start guard covers this.
- **Consent simplification** in-chat: one "agree" collapses the web's two required checkboxes and sets `notifications: true`. Recorded as an intentional v1 choice; revisit if legal wants the three toggles separated in-chat.
- **Token plaintext** mirrors the existing telegram-token pattern (not encrypted). Do not encrypt only this one — if encryption is wanted, do both telegram tokens together later.
- **`NEXT_PUBLIC_SITE_URL`** is used only for the consent legal links (`/terms`, `/privacy`); if unset, fall back to relative paths. It is NOT required for the bot to run — long polling never needs a public URL.
- **v1 excludes** booking management/cancellation via the bot (explicit future phase) and heavier abuse hardening beyond the light per-chat-id cap (tied to ROADMAP Priority 2 item #4).
- **Stagewise delivery** (per user's standing preference): stop after each Group for manual user verification/commit — do not chain groups. Group order: 1 (foundation+language) → 2 (master/procedure) → 3 (date/time) → 4 (consent+booking) → 5 (polish).

## Manual Verification (hand to user after each group)
- **Group 1:** Create a bot via @BotFather, paste its token in Admin → Settings → Client Bot, enable, save. (No domain, tunnel, or public URL needed.) Then, whether you're running `npm run dev` locally or the app is running on the VPS, send `/start` to the bot from any device → the language keyboard appears immediately; tap a language → the wizard advances (state persisted in Redis).
- **Group 2:** Continue: master buttons appear → tap → procedures with duration/price appear → tap → advances.
- **Group 3:** Calendar shows only bookable days; month arrows (`cal:prev`/`cal:next`) respect the horizon and do NOT get swallowed by the master-select handler; tap a day → time slots; tap a slot → advances.
- **Group 4:** Share contact → (consent prompt only if that phone+name has no valid consent) → confirm → booking appears in Admin calendar with correct master/service/time and the picked language; the existing confirmation notification fires. Re-run with a taken slot (book same slot twice quickly) → "slot taken", no duplicate row. Re-book with the same contact → consent step is skipped.
- **Toggle:** Disable the bot in Settings and save → `/start` gets no response (polling loop stopped in-process, no server restart). Re-enable and save → `/start` works again.
</content>
