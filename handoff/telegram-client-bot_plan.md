# Plan: Telegram Client Booking Bot (interactive)

**Date:** 2026-07-17
**Status:** In Progress

## Goal
Add a SEPARATE, opt-in interactive Telegram bot (its own token) that lets clients complete a full appointment booking by chatting with inline-keyboard buttons (language → master → procedure → date/time → phone → consent → confirm), running in-process in this Next.js app via a grammy webhook, reusing the app's existing booking/availability/consent logic and locale files.

## Architecture Decisions

These are **locked** (agreed with the user) — the sections below record the concrete codebase-grounded choices, not open questions.

1. **In-process grammy webhook, not polling / not a Mini App / not a separate service.** One deployable app. Webhook route: `POST /api/telegram/client-bot/webhook`. Library: **grammy** (new `package.json` dependency — confirmed absent today). Use grammy's `webhookCallback(bot, 'std/http', { secretToken })`; the `'std/http'` adapter maps a standard `Request → Response`, which is exactly what a Next.js App Router route handler is. Flag as an implementation risk to verify: grammy has no official Next-App-Router adapter, so `'std/http'` is the intended fit — the Coder must confirm the returned handler works when called as `POST(req)` and returns the `Response` grammy produces.

2. **Separate config from the existing salon-notification bot.** The existing one-way bot uses `TenantConfig.telegramBotToken` / `notifTelegramEnabled` / `notifAdminChatId` and `src/lib/notifications/telegram.ts` — **do not touch or overload these.** The new bot gets its own new `TenantConfig` fields (below), its own Settings section, its own token.

3. **Reuse existing booking logic in-process, no HTTP self-call (decision #10).** The booking-creation transaction currently lives inline in `src/app/api/book/route.ts` (lines ~40–242: consent evaluation, phone normalization, find-or-create guest user, double-booking conflict re-check inside `prisma.$transaction`, `Appointment.create` incl. `clientLanguage`, fire-and-forget `notifyBookingConfirmation`). This must be **extracted** into a framework-free `createBooking()` in `src/lib/booking-service.ts` and called by BOTH the HTTP route and the bot. The bot must NOT call the public `/api/book` endpoint (it sits on the public surface and may later gain Turnstile per ROADMAP Priority 2 item #4, which a webhook bot can't satisfy). Do NOT duplicate the transaction/consent/phone logic.

4. **Wizard state in Redis via existing `src/lib/cache.ts`** (`cacheGet`/`cacheSet`/`cacheDel`), key `tgwiz:<chatId>`, TTL **1800s (30 min)** refreshed on every step. No new DB table, no new state store. Abandoned sessions expire naturally.

5. **Consent stays in-chat** (inline "agree"/"don't agree" buttons), reusing `src/lib/consent-service.ts`'s `evaluateConsentStatus()` (to skip the step for returning phones that already hold valid consent — mirrors the web flow) and `saveConsentRecord()` (invoked inside `createBooking`, exactly as the web route does today — no parallel consent logic). Legal docs are still *linked* (`/terms`, `/privacy`); the accept action is buttons, not a link-out form.

6. **Phone via Telegram native "request contact" button** (`keyboard: [{ text, request_contact: true }]`), normalized with `normalizePhoneToE164()` from `src/lib/utils/phone-normalization.ts` — same normalization the rest of the app requires.

7. **Bot UI text reuses `src/locales/{pl,en,uk}.json` under a new `bot.*` namespace.** First interaction is a language pick reusing `SUPPORTED_LANGUAGES` / `LANGUAGE_NAMES` from `src/lib/i18n-shared.ts`. The chosen language drives the bot conversation AND is persisted into `Appointment.clientLanguage` at booking time (same column the web flow already uses). A dedicated language-parametric translator (dedicated `i18next.createInstance()`, core-only, mirroring `src/lib/i18n-server.ts`) is needed because `i18n-server.ts`'s `getServerT()` is cookie-bound and unusable for a bot picking an arbitrary language.

8. **Token storage mirrors the existing `telegramBotToken` pattern (plaintext).** The current salon-notif `telegramBotToken` is stored/read in plaintext (`src/app/api/admin/notification-settings/route.ts`, `src/lib/notifications/index.ts`) — NOT through `src/lib/encryption.ts` (unlike OAuth/SMTP secrets). For consistency the new `clientBotToken` follows the same plaintext pattern. **Flag:** if the team later wants encryption for Telegram tokens, apply it to BOTH tokens together in a separate pass — do not diverge one bot from the other here.

9. **v1 = booking CREATION only.** Managing/cancelling an existing booking via the bot is an explicit later phase (note as future extension; do not design/build now).

10. **Opt-in per deployment (decision #12).** `clientBotEnabled=false` short-circuits the webhook handler AND drives webhook (de)registration with Telegram: enabling calls `setWebhook`, disabling calls `deleteWebhook`.

## Prerequisites / Constraints to respect
- Files must stay **under 500 lines** — the bot is split into many small modules under `src/lib/telegram-bot/` (see steps). Flag proactively.
- Existing test `tests/app/api/book/consent-gate.test.ts` imports `POST` from the book route and exercises the full flow. The `createBooking` extraction MUST keep it green (it is the behavior-preservation safety net). Add a co-located `createBooking` unit test.
- Middleware (`src/middleware.ts`) matcher already excludes `/api/*` — the webhook route needs no auth-guard changes.
- Webhook (de)registration needs a public base URL: `process.env.NEXT_PUBLIC_SITE_URL` (optional env already used by `sitemap.xml`/`robots.txt`). If unset, `setWebhook` can't run — surface a clear error in Settings rather than failing silently.

---

## Implementation Steps

### Group 1 — Foundation: schema, deps, settings toggle, webhook route, language pick
Independently verifiable: admin can enter a token + enable the bot; sending `/start` to the bot replies with a language keyboard and picking a language advances the wizard (persisted in Redis). No booking yet.

- [ ] **Step 1.1: Add grammy dependency**
  - Files: `package.json`, `package-lock.json`
  - Details: `npm install grammy`. Verify it resolves and is added under `dependencies`. Do not add `telegraf`. Confirm no version conflict with `type: "module"` (grammy ships ESM+CJS — fine).

- [ ] **Step 1.2: Prisma schema — new `TenantConfig` fields**
  - Files: `prisma/schema.prisma`, new migration under `prisma/migrations/`, `src/lib/tenant.ts`
  - Details: Add to `model TenantConfig` (place near the existing `telegramBotToken`/notif block, clearly commented as the SEPARATE client-booking bot):
    - `clientBotToken String?`
    - `clientBotUsername String?`  // for setup instructions / t.me deep link
    - `clientBotEnabled Boolean @default(false)`
    Run `npx prisma migrate dev --name add_client_bot_config`. Add matching defaults (`clientBotToken: null`, `clientBotUsername: null`, `clientBotEnabled: false`) to `DEFAULT_CONFIG` in `src/lib/tenant.ts`. Do NOT rename/reuse `telegramBotToken`/`telegramBotUsername`/`notifTelegramEnabled`.

- [ ] **Step 1.3: Bot i18n translator (language-parametric)**
  - Files: `src/lib/telegram-bot/i18n.ts` (new)
  - Details: Mirror `src/lib/i18n-server.ts`'s dedicated-instance pattern (`i18next.createInstance()`, resources = the 3 locale JSONs, `interpolation.escapeValue: false`), but expose `botT(lang: Language)` returning `instance.getFixedT(lang)` with NO cookie dependency (do not import `next/headers`). Lazy `ensureInitialized()`. This is what all bot handlers use to render `bot.*` strings.

- [ ] **Step 1.4: Wizard state (Redis)**
  - Files: `src/lib/telegram-bot/wizard-state.ts` (new)
  - Details: Define `WizardStep` (`'LANGUAGE' | 'MASTER' | 'PROCEDURE' | 'DATE' | 'TIME' | 'CONTACT' | 'CONSENT' | 'CONFIRM'`) and `WizardState` type:
    ```
    { step, lang, masterId?, masterName?, procedureId?, procedureName?, durationMin?,
      calMonth?, dateISO?, slots?, startISO?, endISO?, slotLabel?, slotPage?,
      phone?, name?, consentGiven? }
    ```
    Export `getState(chatId)`, `setState(chatId, state)` (TTL 1800), `clearState(chatId)` built on `cacheGet`/`cacheSet`/`cacheDel` with key `tgwiz:<chatId>`. Keep types small; `slots` holds the current date's `{startISO,endISO}[]` for index-based callbacks.

- [ ] **Step 1.5: Keyboards module (language only for this group)**
  - Files: `src/lib/telegram-bot/keyboards.ts` (new)
  - Details: Start with `languageKeyboard()` — one inline button per `SUPPORTED_LANGUAGES` labeled from `LANGUAGE_NAMES`, callback_data `lang:<code>`. (Masters/procedures/calendar/slots/consent/confirm keyboards added in later groups.) Keep all `callback_data` short (<64 bytes).

- [ ] **Step 1.6: Bot instance + `/start` + language handler**
  - Files: `src/lib/telegram-bot/bot.ts` (new), `src/lib/telegram-bot/handlers/start.ts` (new)
  - Details: `bot.ts` builds and lazily caches a grammy `Bot` keyed by token (`getClientBot(token)`), registering all handler modules via a `register(bot)` convention. `handlers/start.ts`: on `/start` (and on `/cancel`) → `clearState`, set `{ step: 'LANGUAGE' }`, send `bot.language.prompt` with `languageKeyboard()`. On `callback_query:data` matching `lang:<code>` → validate with `isValidLanguage`, store `lang`, advance `step` to `'MASTER'`, `answerCallbackQuery`, then hand off to the master step (Group 2 wires the master list; for Group 1 it may just edit to a placeholder "coming next" localized string so the group is testable in isolation).

- [ ] **Step 1.7: Webhook route (short-circuit + secret verify)**
  - Files: `src/app/api/telegram/client-bot/webhook/route.ts` (new)
  - Details: `export const runtime = "nodejs"`. `POST(req)`:
    1. Load `getTenantConfig()`. If `!clientBotEnabled || !clientBotToken` → return `new Response('ok', { status: 200 })` (short-circuit, do no work).
    2. Compute the webhook secret deterministically: `sha256(AUTH_SECRET + ':clientbot')` hex (via `node:crypto`) — no new DB field, stable, secret. Pass it as `secretToken` to grammy's `webhookCallback` (grammy compares the `X-Telegram-Bot-Api-Secret-Token` header itself and 401s on mismatch).
    3. `const bot = getClientBot(clientBotToken)`; `const handle = webhookCallback(bot, 'std/http', { secretToken })`; `return handle(req)`.
    Keep the file thin — all logic lives in `src/lib/telegram-bot/`.

- [ ] **Step 1.8: Webhook (de)registration helper**
  - Files: `src/lib/telegram-bot/webhook-admin.ts` (new)
  - Details: `registerWebhook(token)` → POST `https://api.telegram.org/bot<token>/setWebhook` with `{ url: `${NEXT_PUBLIC_SITE_URL}/api/telegram/client-bot/webhook`, secret_token, allowed_updates: ['message','callback_query'] }` (secret derived as in 1.7). `deleteWebhook(token)` → POST `.../deleteWebhook`. `getMe(token)` (used by the later test-connection action). Return `{ ok, error? }`; never throw (mirror `notifications/telegram.ts` contract). If `NEXT_PUBLIC_SITE_URL` is missing, return a clear `{ ok:false, error:'NO_PUBLIC_URL' }`.

- [ ] **Step 1.9: Settings API route**
  - Files: `src/app/api/admin/client-bot-settings/route.ts` (new)
  - Details: Mirror `src/app/api/admin/notification-settings/route.ts`. `GET` (ADMIN/SUPERADMIN) returns `{ clientBotEnabled, clientBotToken, clientBotUsername }`. `PATCH` (Zod: `clientBotEnabled: boolean.optional()`, `clientBotToken: string.trim().max(256).nullable().optional()`, `clientBotUsername: string.trim().max(64).nullable().optional()`) writes to the single `TenantConfig` row (create-if-missing pattern, same as sibling). After a successful write: if the effective state is enabled+token → call `registerWebhook`; if disabled → call `deleteWebhook`. Surface `registerWebhook`'s `error` (esp. `NO_PUBLIC_URL`) back to the client as a `{ code }` so the form can toast it via `apiErrorKey`.

- [ ] **Step 1.10: Settings UI section + nav**
  - Files: `src/app/admin/settings/client-bot/page.tsx` (new), `src/app/admin/settings/client-bot/ClientBotSettingsForm.tsx` (new), `src/app/admin/settings/client-bot/loading.tsx` (new), `src/components/admin/adminNavItems.ts`
  - Details: `page.tsx` = Server Component mirroring `settings/notifications/page.tsx` (auth gate → redirect, eyebrow + muted subtitle, render the form). `ClientBotSettingsForm.tsx` = client component mirroring `NotificationSettingsForm.tsx`: `SettingsSection` from `@/app/admin/settings/FormFields`, a `ToggleRow` for enable, a password `Input` for the token, a plain input for the bot username, and static setup instructions (how to create a bot via @BotFather, paste token, save; note the deployment must have a public URL). Drive the shared sidebar Save button via `<form id="settings-form">` + the `settings-dirty` CustomEvent + `form.reset(values)` after save (per admin AGENTS.md). `loading.tsx` composes `FormSkeleton`. Add a nav item to `adminNavItems.ts` (`labelKey: "admin.nav.clientBot"`, `href: "/admin/settings/client-bot"`, icon `Bot` from `lucide-react`).

- [ ] **Step 1.11: i18n keys — group 1**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: Add `admin.nav.clientBot`, an `admin.settings.clientBot.*` block (page desc, section titles/descriptions, enable label, token label/placeholder/desc, username label/desc, setup instructions, save success/fail, `NO_PUBLIC_URL` error), the corresponding `errors.*` code if used via `apiErrorKey` (also register it in `src/lib/errors/apiErrorKey.ts`'s whitelist + `tests/lib/errors/apiErrorKey.test.ts`), and a `bot.*` block scaffold with at least `bot.language.prompt`. Run `npm run i18n:check` for parity.

### Group 2 — Master & procedure selection
Independently verifiable: after language pick, bot shows master buttons; picking one shows that master's procedures (localized name + duration + price); picking one advances state.

- [ ] **Step 2.1: Catalog data helpers for the bot**
  - Files: `src/lib/telegram-bot/catalog.ts` (new)
  - Details: `listBookableMasters()` — prisma query mirroring `src/app/api/masters/route.ts` (`role: 'MASTER'`, `masterProfile.showOnHomepage: true`, ordered `createdAt asc`), returning `{ id, name }[]`. `listMasterProcedures(masterId)` — mirror `src/app/api/procedures/route.ts` logic (MasterService assignments with price override, fallback to global + own services), returning `{ id, nameField: {pl,en,uk}, duration, price }[]` (keep the raw `{pl,en,uk}` object so the handler resolves per the picked language via `resolveLocalized`). Reuse the SAME underlying prisma shape as the routes; do NOT HTTP self-call. (Optional, do not force: the API routes MAY later be refactored to call these helpers — out of scope here.)

- [ ] **Step 2.2: Master & procedure keyboards**
  - Files: `src/lib/telegram-bot/keyboards.ts`
  - Details: `mastersKeyboard(masters)` — one inline button per master, callback `m:<masterId>` (one per row for readable long names), plus a `‹ Back` button (`back:lang`). `proceduresKeyboard(procedures, lang)` — one button per procedure labeled `resolveLocalized(nameField, lang) · {duration}min · {price} zł` (use `common.currency`), callback `p:<procedureId>`, plus `back:master`.

- [ ] **Step 2.3: Selection handlers**
  - Files: `src/lib/telegram-bot/handlers/select.ts` (new), register in `bot.ts`
  - Details: On `m:<masterId>` (step must be `MASTER`) → store `masterId`+`masterName`, load `listMasterProcedures`, if empty show a localized "no services" message, else store nothing yet and render procedures, set step `PROCEDURE`. On `p:<procedureId>` (step `PROCEDURE`) → look up the procedure, store `procedureId`, `procedureName` (resolved to `state.lang`), `durationMin`, advance to `DATE` (Group 3 renders the calendar; Group 2 may edit to a localized placeholder to stay testable). Wire the `back:*` callbacks to re-render the previous step. Handlers read/write via `getState`/`setState`; guard on `state.step` and `answerCallbackQuery` on every callback.

- [ ] **Step 2.4: i18n keys — group 2**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: `bot.master.prompt`, `bot.procedure.prompt`, `bot.procedure.noServices`, `bot.common.back`. Reuse `common.currency`. `npm run i18n:check`.

### Group 3 — Date & time picker (inline calendar + slot list)
Independently verifiable: after procedure pick, bot shows a month calendar with only bookable days tappable; month arrows page within the horizon; picking a day shows time-slot buttons (paginated); picking a slot advances state. This is the trickiest UI piece — designed concretely below, not hand-waved.

- [ ] **Step 3.1: Calendar + slots keyboards**
  - Files: `src/lib/telegram-bot/keyboards.ts`
  - Details:
    - `calendarKeyboard(month, availableDays, horizon)` where `month = 'YYYY-MM'` and `availableDays` is the set of `'YYYY-MM-DD'` with `hasWindow` from `getAvailableDays`:
      - Row 1 (nav): `‹` = `m:prev` (rendered as noop `nop` when prev month is fully before today), a centered noop label button showing the localized `Month YYYY` (via `Intl.DateTimeFormat(localeFor(lang), {month:'long', year:'numeric'})`), `›` = `m:next` (noop when next month exceeds the horizon).
      - Row 2 (weekday headers): 7 noop buttons with localized short weekday initials (Intl), Monday-first.
      - 6 week rows × 7 buttons: leading/trailing blanks and past/unavailable days → noop `nop` button (label `·`); bookable days → callback `d:<YYYY-MM-DD>`, label = day number.
      - Final row: `‹ Back` (`back:procedure`).
      - `callback_data` budget is fine (`d:2026-07-15` = 12 chars, `m:next` short).
    - `slotsKeyboard(slots, page, lang)`: buttons `HH:mm` (derive from `startISO` via `Intl.DateTimeFormat(localeFor(lang), {hour, minute}, timeZone:'Europe/Warsaw')` or slice the already-Warsaw-formatted ISO), callback `t:<idx>` (index into `state.slots`), 3 per row. Paginate at e.g. 24 slots/page with `‹`/`›` (`sp:prev`/`sp:next`) when needed. Final row: `‹ Back` (`back:date`).

- [ ] **Step 3.2: Date/time handlers**
  - Files: `src/lib/telegram-bot/handlers/datetime.ts` (new), register in `bot.ts`
  - Details: Define `BOOKING_HORIZON_DAYS = 60` (flag: align with the web booking horizon if one is later found; availability.ts itself takes an explicit range from the caller). On entering `DATE`: default `calMonth` = current Warsaw month; compute the visible-month range clamped to `[today, today+horizon]`, call `getAvailableDays(fromISO, untilISO, state.durationMin, { masterId: state.masterId })`, render `calendarKeyboard`. On `m:prev`/`m:next` → shift `calMonth` within horizon bounds, recompute, edit message. On `d:<date>` (step `DATE`) → store `dateISO`, call `getDaySlots(dateISO, state.durationMin, 15, state.masterId)`; if empty (raced to full) show a localized "no free slots, pick another day" and re-render the calendar; else store `slots`, `slotPage: 0`, set step `TIME`, render `slotsKeyboard`. On `sp:prev`/`sp:next` → adjust `slotPage`, re-render. On `t:<idx>` (step `TIME`) → read `state.slots[idx]`, store `startISO`/`endISO`/`slotLabel`, advance to `CONTACT` (Group 4). Wire `back:date`/`back:procedure`. Use `editMessageText`/`editMessageReplyMarkup` to keep the flow in one message where possible; `answerCallbackQuery` always.

- [ ] **Step 3.3: i18n keys — group 3**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: `bot.date.prompt`, `bot.date.noSlots`, `bot.time.prompt`. Month/weekday NAMES come from `Intl` (do not hardcode). `npm run i18n:check`.

### Group 4 — Consent, booking creation (shared extraction), confirmation
Independently verifiable: full end-to-end booking from Telegram creates a real `Appointment` (visible in admin), fires the existing confirmation notification, handles the double-booking race and other failures with localized messages, and re-asks consent only when needed.

- [ ] **Step 4.1: Extract `createBooking()` (shared, behavior-preserving) — GATE before wiring the bot**
  - Files: `src/lib/booking-service.ts` (new), `src/app/api/book/route.ts` (edit), `tests/lib/booking-service.test.ts` (new)
  - Details: Move the booking business logic (current `route.ts` lines ~40–242) into `createBooking(input)`:
    - Input: `{ startISO, endISO, procedureId?, masterId?, name, phone?, email?, language?, consents?, ip?, authenticatedUserId? }`.
    - Replace `getRequestIp(req)` with `input.ip` (null → `maskIpForConsent` yields `0.0.0.xxx`, already handled) and `session?.user` with `input.authenticatedUserId` (when present: authenticated path, skip consent, load that user; when null: guest path).
    - Return a discriminated union `{ ok: true, appointmentId }` | `{ ok: false, code, message }` where `code` ∈ `'MISSING_MASTER' | 'VALIDATION_ERROR' | 'INVALID_PHONE' | 'CONSENT_REQUIRED' | 'CONFLICT' | 'UNAUTHORIZED' | 'INTERNAL_ERROR'` and `message` is the EXACT original error string per branch (so the HTTP route reproduces identical `{ error, code }` bodies + statuses). Keep the fire-and-forget `notifyBookingConfirmation(created.id)` inside `createBooking`.
    - Rewrite `POST /api/book` as a thin wrapper: Zod parse (unchanged, incl. the two pre-existing 400s for ZodError / invalid payload), resolve `isAuth`/`authenticatedUserId` via `auth()`, compute `ip = getRequestIp(req)`, call `createBooking(...)`, then map the result → `NextResponse` using a `statusForCode` map that preserves today's statuses (VALIDATION_ERROR/MISSING_MASTER/INVALID_PHONE/CONSENT_REQUIRED → 400, CONFLICT → 409, UNAUTHORIZED → 401, INTERNAL_ERROR → 500, success → `{ eventId: appointmentId }` 200).
    - **Hard verification gate:** `npx vitest run tests/app/api/book/consent-gate.test.ts` stays green unchanged, plus a manual web-booking smoke test, BEFORE any bot wiring in 4.2+. Add `tests/lib/booking-service.test.ts` covering the guest consent gate + conflict + clientLanguage defaulting at the function level (mirror the existing mock-prisma setup).

- [ ] **Step 4.2: Contact (phone) step**
  - Files: `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/contact.ts` (new), register in `bot.ts`
  - Details: On entering `CONTACT`, send `bot.contact.prompt` with a `ReplyKeyboardMarkup` containing a single `request_contact: true` button (`one_time_keyboard: true`, `resize_keyboard: true`). Handle `message:contact`: take `msg.contact.phone_number`, normalize via `normalizePhoneToE164` (on throw → localized `bot.contact.invalid`, re-prompt), store `phone`; derive `name` from `msg.from` (`first_name` + optional `last_name`; if it's <2 chars after trim, fall back to `contact.first_name`); store `name`; remove the reply keyboard (`remove_keyboard`). Then run consent evaluation (4.3).

- [ ] **Step 4.3: Consent step (reuse `evaluateConsentStatus` / gather in-chat)**
  - Files: `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/consent.ts` (new), register in `bot.ts`
  - Details: After phone+name known, call `evaluateConsentStatus({ phone: state.phone, name: state.name })`. If `hasValidConsent` → skip to `CONFIRM` (4.4). Else set step `CONSENT` and send `bot.consent.prompt` (text includes `/terms` + `/privacy` links built from `NEXT_PUBLIC_SITE_URL`) with an inline `consentKeyboard()`: `✅ agree` (`consent:yes`) / `❌ decline` (`consent:no`). On `consent:yes` → set `consentGiven: true` (this maps to `consents: { dataProcessing: true, terms: true, notifications: true }` when calling `createBooking`; **flag:** the two web-required checkboxes are collapsed into one "agree", and `notifications` is set true since the user opted into a Telegram bot — record this simplification), advance to `CONFIRM`. On `consent:no` → send `bot.consent.declined` explaining consent is required, `clearState` (or drop back to start). Consent PERSISTENCE happens inside `createBooking` (via `saveConsentRecord`) exactly as the web route does — the bot only collects and passes `consents`.

- [ ] **Step 4.4: Confirm + create booking + result handling**
  - Files: `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/confirm.ts` (new), register in `bot.ts`
  - Details: On entering `CONFIRM`, render a localized summary (master, procedure, date, time, price) via `bot.confirm.summary` with `confirmKeyboard()`: `✅ book` (`confirm:yes`) / `‹ back` (`back:time`). On `confirm:yes`:
    - Light per-chat-id rate limit (see 4.5) BEFORE calling createBooking.
    - Call `createBooking({ startISO, endISO, procedureId: state.procedureId, masterId: state.masterId, name: state.name, phone: state.phone, language: state.lang, consents: state.consentGiven ? {dataProcessing:true,terms:true,notifications:true} : undefined, ip: null, authenticatedUserId: null })`.
    - Map result: `ok` → `bot.confirm.success` (summary + note that a confirmation was sent), `clearState`. `CONFLICT` → `bot.error.slotTaken`, jump back to `DATE` and re-render the calendar (the slot was raced). `CONSENT_REQUIRED` → back to consent step (shouldn't happen). `INVALID_PHONE` → back to `CONTACT`. `MISSING_MASTER`/`VALIDATION_ERROR`/`INTERNAL_ERROR` → `bot.error.generic`, suggest `/start`. Each user-facing failure mirrors the web route's failure semantics.

- [ ] **Step 4.5: Light abuse guard (v1 minimal)**
  - Files: `src/lib/telegram-bot/handlers/confirm.ts` (or a small `src/lib/telegram-bot/rate-limit.ts`)
  - Details: Use the existing `rateLimit()` from `src/lib/cache.ts` with a per-chat-id key (e.g. `tgbook:<chatId>`, limit ~5 bookings/hour) on the final `confirm:yes` action; on limit → localized `bot.error.rateLimited`. **Flag (do not over-build in v1):** this bot is a NEW inbound booking-creation surface with the same spam exposure as the web `/api/book` (ROADMAP Priority 2 item #4, still open). Fuller hardening (per-update throttle, allow/deny) is an explicit follow-up tied to that ROADMAP item — this step only adds the cheap per-chat-id cap.

- [ ] **Step 4.6: i18n keys — group 4**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: `bot.contact.prompt`, `bot.contact.button`, `bot.contact.invalid`, `bot.consent.prompt`, `bot.consent.agree`, `bot.consent.decline`, `bot.consent.declined`, `bot.confirm.summary`, `bot.confirm.book`, `bot.confirm.success`, `bot.error.slotTaken`, `bot.error.generic`, `bot.error.rateLimited`. `npm run i18n:check`.

### Group 5 — Nice-to-have polish (only if scope allows)
- [ ] **Step 5.1: "Test connection" action in Settings**
  - Files: `src/app/api/admin/client-bot-settings/route.ts` (or a sibling `.../test/route.ts`), `ClientBotSettingsForm.tsx`, locale files
  - Details: A button that calls `getMe(token)` (from `webhook-admin.ts`) and reports the resolved bot username or the API error. Read-only, no state change.
- [ ] **Step 5.2: DOX pass** — update `handoff/` is not needed, but update the nearest owning AGENTS.md files whose contracts changed: `src/lib/AGENTS.md` (new `booking-service.ts` extraction + new `telegram-bot/` module family + its Local Contracts), `src/app/api/AGENTS.md` (new webhook route + `client-bot-settings` route), `src/app/admin/AGENTS.md` (new `settings/client-bot/` page), and root `CLAUDE.md` Child DOX Index / a new `src/lib/telegram-bot/AGENTS.md` if that folder becomes a durable boundary (it does — create one). Update `prisma/AGENTS.md` for the new `TenantConfig` fields.

- [ ] **Step N: Tests** — see per-group test steps (4.1 `booking-service.test.ts`, keep `consent-gate.test.ts` green, `apiErrorKey` whitelist test if a new error code is added). Pure/unit-testable bot helpers (`wizard-state` key/TTL, `keyboards` callback_data shapes, `catalog` resolution) get co-located tests under `tests/lib/telegram-bot/`. grammy handler flows are integration-heavy — cover the extractable pure pieces, verify the conversational flow manually (see Manual Verification).

## Acceptance Criteria
- [ ] `npm run test` green (incl. unchanged `tests/app/api/book/consent-gate.test.ts` and new `tests/lib/booking-service.test.ts`).
- [ ] `npm run lint` passes with zero warnings.
- [ ] `npm run build` succeeds (no Server-Component/`createContext` build-phase breakage from the bot i18n instance; bot i18n uses a core-only `i18next.createInstance()`, never `@/lib/i18n`).
- [ ] `npm run i18n:check` passes (pl/en/uk parity for all new `bot.*` and `admin.settings.clientBot.*` / `admin.nav.clientBot` keys).
- [ ] Existing web booking flow (`/[masterId]` → `/api/book`) behaves identically after the `createBooking` extraction (same `{ error, code }` bodies + statuses, same confirmation notification).
- [ ] Existing salon-notification bot (`telegramBotToken`/`notifTelegramEnabled`) is completely untouched and still works.
- [ ] Bot is fully gated by `clientBotEnabled`: disabled → webhook short-circuits AND `deleteWebhook` was called; enabled → `setWebhook` registered with the secret token.
- [ ] End-to-end: a client can book from Telegram (language → master → procedure → date/time → contact → consent-if-needed → confirm), the `Appointment` appears in admin with the picked `clientLanguage`, and the double-booking race returns a localized "slot taken" without creating a row.
- [ ] Every file stays under 500 lines.
- [ ] Follows project conventions (admin settings-form pattern, `SettingsSection`, nav via `adminNavItems.ts`, `apiErrorKey` for API error codes, `resolveLocalized` for content, `runtime = "nodejs"` on the webhook route).

## Constraints & Risks
- **Do NOT touch** the existing salon-notification bot fields/code: `TenantConfig.telegramBotToken` / `telegramBotUsername` / `notifTelegramEnabled` / `notifAdminChatId`, `src/lib/notifications/telegram.ts`, `src/app/api/admin/notification-settings/route.ts`, `NotificationSettingsForm.tsx`. This plan is a SEPARATE bot.
- **`createBooking` extraction is the highest-risk change** (it rewrites the core booking transaction shared by the live web flow). It must be behavior-preserving and gated on `consent-gate.test.ts` staying green + a manual web-booking smoke test BEFORE the bot is wired to it. Do not change the double-booking `$transaction` re-check, phone normalization, find-or-create-guest identity `(phone+name)`, or consent gating semantics.
- **grammy `'std/http'` adapter fit** is the main unknown — verify the returned `webhookCallback` handler consumes a Next `Request` and returns a valid `Response` when called from the route's `POST`. If the adapter mismatches, fall back to grammy's framework-agnostic `Bot.handleUpdate(update)` with manual `await req.json()` + `new Response('ok')` and manual secret-header check.
- **Public URL dependency:** webhook registration needs `NEXT_PUBLIC_SITE_URL`. Without it, `setWebhook` fails — the Settings UI must show a clear error, not fail silently.
- **Webhook secret** derived from `AUTH_SECRET` (`src/lib/encryption.ts` already hard-requires `AUTH_SECRET` at import) — no new secret env needed; rotating `AUTH_SECRET` invalidates the webhook (would need re-registration — acceptable, note it).
- **Consent simplification** in-chat: one "agree" collapses the web's two required checkboxes and sets `notifications: true`. Recorded as an intentional v1 choice; revisit if legal wants the three toggles separated in-chat.
- **Token plaintext** mirrors the existing telegram-token pattern (not encrypted). Do not encrypt only this one — if encryption is wanted, do both telegram tokens together later.
- **v1 excludes** booking management/cancellation via the bot (explicit future phase) and heavier abuse hardening beyond the light per-chat-id cap (tied to ROADMAP Priority 2 item #4).
- **Stagewise delivery** (per user's standing preference): stop after each Group for manual user verification/commit — do not chain groups. Group order: 1 (foundation+language) → 2 (master/procedure) → 3 (date/time) → 4 (consent+booking) → 5 (polish).

## Manual Verification (hand to user after each group)
- **Group 1:** Create a bot via @BotFather, paste token in Admin → Settings → Client Bot, enable, save. Confirm `setWebhook` succeeded (no error toast). Send `/start` → language keyboard appears; tap a language → advances.
- **Group 2:** Continue: master buttons appear → tap → procedures with duration/price appear → tap → advances.
- **Group 3:** Calendar shows only bookable days; month arrows respect the horizon; tap a day → time slots; tap a slot → advances.
- **Group 4:** Share contact → (consent prompt only if that phone+name has no valid consent) → confirm → booking appears in Admin calendar with correct master/service/time and the picked language; the existing confirmation notification fires. Re-run with a taken slot (book same slot twice quickly) → "slot taken", no duplicate row. Re-book with the same contact → consent step is skipped.
- **Toggle:** Disable the bot in Settings → `/start` gets no response (webhook short-circuited / deregistered). Re-enable → works again.
