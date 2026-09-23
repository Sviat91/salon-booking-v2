# Plan: additional Telegram notification bots, scoped per master

**Date:** 2026-09-22
**Status:** In Progress
**Requirements:** `handoff/master-notification-bots_requirements.md` (read it first — it is the source of truth for scope)

## Goal

Let the salon add any number of *additional* Telegram notification bots — each with its own token, its own chat-ID recipient list, and a master scope (`ALL` or a selected set of masters) — so that the four master-scoped booking notifications are additionally delivered through every bot whose scope covers that appointment's master, while the existing general salon bot keeps working exactly as today.

## Architecture Decisions

### AD-1 — Additive only; the general bot is untouched
`TenantConfig.telegramBotToken` + `TelegramNotificationRecipient` stay exactly as they are — no migration, no folding into the new tables, no behavior change. The new bots are a strictly additional delivery path layered after the existing broadcast. This is the requirements file's explicit recommendation and there is no clean-unification win that would justify the migration risk.

### AD-2 — Three new Prisma models, `DiscountService` shape for the join
- `NotificationBot` — the bot entity (`label`, encrypted `token`, `username`, `enabled`, `scope`, `ownerId`).
- `NotificationBotMaster` — bot ↔ master join for `scope = "SELECTED"`; many-to-many both ways, mirroring `DiscountService`'s exact shape (`id @default(cuid())` + `@@unique([botId, masterId])` + `@@index([masterId])`) rather than a composite `@@id`, to match house style.
- `NotificationBotRecipient` — bot ↔ chat ID (one-to-many), mirroring `TelegramNotificationRecipient`'s field shape but FK'd to the bot.

`scope` is a plain `String` (`"ALL" | "SELECTED"`) validated in the app layer — SQLite/Prisma enums are banned by `prisma/AGENTS.md`.

### AD-3 — Ownership via `NotificationBot.ownerId`, not derived from scope
`ownerId String?` mirrors `Service.masterId` / `Discount.masterId` semantics exactly: `null` = admin/salon-owned, filled = that master's own bot. This is what authorizes the MASTER surface.

Rejected alternative: deriving "the master may manage this bot iff its scope is exactly `[her]`". That leaks permissions in both directions — an admin-created bot scoped to one master would become editable/deletable by that master, and an admin widening a master's bot scope would silently revoke her access. The repo already has this exact authorization pair pattern twice (`canManagePage`/`authorizePageOwner`, `canManageDiscount`/`authorizeDiscountScope`); follow it.

### AD-4 — A master's bot is `ownerId = her` + `scope = "SELECTED"` + one join row for herself
The MASTER API surface **never** accepts `scope`, `masterIds`, or `ownerId` from the client — it forces them server-side. Her UI shows the scope as a read-only line (never a picker). If an admin later widens that bot's scope, she still owns it and sees the widened scope read-only (master *names* are public data — they are already listed by `GET /api/masters` — so showing them is not a leak).

### AD-5 — One shared dispatch helper, called from all four notifiers
New `src/lib/notifications/bots.ts` exports one never-throw `broadcastToMasterBots({ masterId, html, type, appointmentId? })`. The four call sites each gain exactly one line after their existing general-bot broadcast. The message string is built once and reused verbatim — no per-bot re-rendering.

Each bot is sent independently with its own token to its own recipients (**never merge chat-ID lists across tokens** — a token can only message chats that have started a conversation with *that* bot). `sendTelegramMessage`/`broadcastTelegram` already never throw, so a failing bot cannot abort the loop.

### AD-6 — `notifTelegramEnabled` gates the new bots; `telegramBotToken` does not
Today three of the four notifiers early-return on `!config.notifTelegramEnabled || !config.telegramBotToken`. That would make a salon that uses *only* per-master bots (no general bot configured) receive nothing. Restructure each guard to: gate everything on `notifTelegramEnabled` (the salon-wide Telegram master switch), then gate **only the general-bot broadcast** on `config.telegramBotToken`, then call `broadcastToMasterBots` regardless. Per-bot `enabled` is the finer-grained switch.

### AD-7 — Logging: one aggregated `NotificationLog` row per event, channel `telegram_bot`
Matches the documented "one summary row per event" contract in `src/lib/AGENTS.md` and bounds log growth (N bots × 4 notifiers). `status: 'sent'` if at least one bot delivered to at least one recipient, `'failed'` otherwise; `error` is the last error prefixed with that bot's label (`"Anna's bot: Telegram API error 401: ..."`) so a failure is still diagnosable. No row at all when no bot matched / no bot had recipients — mirrors the existing `recipients.length > 0` gating.

### AD-8 — Full-replace writes, no diff machinery
`PATCH` sends the bot's whole representation; the server replaces the `NotificationBotMaster` and `NotificationBotRecipient` rows wholesale inside one `prisma.$transaction` (`deleteMany` + `createMany`). Nothing references those row ids, so recreating them is harmless. This removes the need for anything like `recipient-diff.ts` and lets the UI use plain local state instead of a react-hook-form field array.

### AD-9 — Token handling
Encrypted at rest via `src/lib/encryption.ts`. **Never** returned by any API response in any form (no mask round-trip either — `GET` returns `hasToken: boolean` only). `PATCH` semantics: `token` omitted → keep existing; non-empty string → validate + re-encrypt; empty string → `400 VALIDATION_ERROR` (a token-less bot is useless; disable it instead). `POST` requires a non-empty token. `username` (from Telegram `getMe`) is **not** a secret and is displayed — same split as `googleServiceAccountKey` (secret) vs `googleServiceAccountEmail` (shown).

### AD-10 — "Test" via Telegram `getMe`, mirroring `testMasterCalendar`
New `getTelegramBotInfo(token)` in the existing `src/lib/notifications/telegram.ts` (plain `fetch`, no new dependency, `AbortSignal.timeout(10_000)` like `sms/`). Optionally takes a not-yet-saved token in the request body (exactly like `testMasterCalendar(masterId, rawCalendarId?)`), so an admin can test before saving. `POST`/token-changing `PATCH` also run it best-effort to refresh `username` — the write never fails on a `getMe` failure; the response carries `tokenCheck: "ok" | "failed"` so the UI can warn.

### AD-11 — Two UI surfaces sharing one component set (Google Calendar precedent)
`/admin/settings/notification-bots` (ADMIN/SUPERADMIN, every bot, full scope editing) and `/admin/master/notification-bots` (MASTER, own bots only) both render the same `src/components/admin/notification-bots/` components parameterised by `apiBase` + `canEditScope`, exactly as both Google Calendar pages share `MasterCalendarField`.

### AD-12 — Zod schemas colocated in `src/lib/notifications/bots-store.ts`
`src/lib/validation/api-schemas.ts` holds only public booking/consent/auth schemas today; every admin route colocates its own (`google-calendar-settings`, `notification-settings/recipients`, `client-bot-settings`). Colocating in the shared store module keeps **one** definition imported by both the admin and master surfaces, which is what the `api/AGENTS.md` "don't inline ad-hoc validation" rule is actually protecting against.

### AD-13 — Explicitly NOT in this feature
No interactive bot commands, no long-polling, no new bot process, no client-facing reminders through a master's bot, no change to `notifyContactForm`, no change to `TenantConfig.clientBotToken` (the separate interactive client booking bot — do not touch `src/lib/telegram-bot/`), no change to `sendTelegramMessage`'s existing signature/behavior.

---

## Implementation Steps

> Stages are checkpointed: **stop after each stage** and let the user verify before starting the next one (per the repo's stagewise-checkpoint preference), unless the user explicitly asks to chain them.

### Stage 1 — Data model

- [x] Step 1: Add the three models to `prisma/schema.prisma`
  - Files: `prisma/schema.prisma`
  - Details: append after `model TelegramNotificationRecipient` (keep that model untouched). Shapes:
    - `NotificationBot`: `id String @id @default(cuid())`, `label String`, `token String` (comment: *encrypted via src/lib/encryption.ts — never returned by an API*), `username String?` (comment: *plaintext, from Telegram getMe; not a secret*), `enabled Boolean @default(true)`, `scope String @default("SELECTED")` (comment: *"ALL" | "SELECTED"*), `ownerId String?` (comment: *null = admin/salon-owned; filled = that master's own bot — mirrors Service.masterId / Discount.masterId*), `owner User? @relation("MasterOwnedNotificationBots", fields: [ownerId], references: [id], onDelete: Cascade)`, `createdAt`/`updatedAt`, relations `masters NotificationBotMaster[]` + `recipients NotificationBotRecipient[]`, `@@index([ownerId])`.
    - `NotificationBotMaster`: `id String @id @default(cuid())`, `botId String`, `masterId String`, `bot NotificationBot @relation(..., onDelete: Cascade)`, `master User @relation("MasterNotificationBotScopes", ..., onDelete: Cascade)`, `@@unique([botId, masterId])`, `@@index([masterId])` — i.e. verbatim the `DiscountService` shape.
    - `NotificationBotRecipient`: `id String @id @default(cuid())`, `botId String`, `chatId String`, `label String?`, `createdAt DateTime @default(now())`, `bot NotificationBot @relation(..., onDelete: Cascade)`, `@@index([botId])`.
    - On `model User`, add the two back-relations: `ownedNotificationBots NotificationBot[] @relation("MasterOwnedNotificationBots")` and `notificationBotScopes NotificationBotMaster[] @relation("MasterNotificationBotScopes")`.
  - Add a block comment above `NotificationBot` explaining it is *additional to*, never a replacement for, `TenantConfig.telegramBotToken`.
- [x] Step 2: Create and apply the migration
  - Command: `npx prisma migrate dev --name notification_bots`
  - Details: three brand-new tables with no required columns on existing tables, so plain `migrate dev` works non-interactively (the `migrate diff` workaround in `prisma/AGENTS.md` is not needed here). Never hand-edit `migrations/` or `app.db`.
  - Verify: `npx prisma studio` shows the three empty tables; the app still builds (`npm run lint`).

**Checkpoint 1** — user verification: existing notifications must be byte-identical (nothing reads the new tables yet).

### Stage 2 — Dispatch

- [x] Step 3: Add `getTelegramBotInfo(botToken)` to `src/lib/notifications/telegram.ts`
  - Files: `src/lib/notifications/telegram.ts`
  - Details: plain `fetch` `GET https://api.telegram.org/bot<token>/getMe` with `signal: AbortSignal.timeout(10_000)` (same hygiene as `sms/twilio.ts`). Returns `{ ok: true; username: string | null } | { ok: false; status: number }` (`status: 0` for a network/timeout failure). Never throws, never logs the token. **Do not modify the existing `sendTelegramMessage`** — it is shared with the general bot.
- [x] Step 4: Create `src/lib/notifications/bots.ts` (dispatch only, keep it small — target < 100 lines)
  - Files: `src/lib/notifications/bots.ts` (new)
  - Details:
    - `export const BOT_SCOPES = ['ALL', 'SELECTED'] as const` + `export type BotScope = (typeof BOT_SCOPES)[number]`.
    - `export async function broadcastToMasterBots(params: { masterId: string; html: string; type: string; appointmentId?: string }): Promise<void>` — the whole body wrapped in one `try { ... } catch (err) { console.error('[notifications] broadcastToMasterBots error:', err) }` (never-throw contract).
    - Query: `prisma.notificationBot.findMany({ where: { enabled: true, OR: [{ scope: 'ALL' }, { masters: { some: { masterId } } }] }, select: { id: true, label: true, token: true, recipients: { select: { chatId: true } } } })`.
    - Loop: skip a bot with zero recipients; `const token = decrypt(bot.token)`, skip if falsy; `await broadcastTelegram(token, chatIds, html)` (reuse the existing helper from `./internal`, do **not** write a new send path); accumulate `attempted`, `anySuccess`, and `lastError = \`${bot.label}: ${res.lastError.message}\``.
    - `if (attempted === 0) return` — no log row when nothing was attempted.
    - Otherwise one `logNotification({ type, channel: 'telegram_bot', appointmentId, status: anySuccess ? 'sent' : 'failed', error: lastError ?? undefined })` (AD-7).
- [x] Step 5: Wire `notifyBookingConfirmation`
  - Files: `src/lib/notifications/index.ts`
  - Details: restructure the Telegram block per AD-6 — outer `if (config.notifTelegramEnabled) { ... }`; build `priceLine` + `msg` unconditionally inside it; keep the existing general-bot send (`if (config.telegramBotToken) { recipients = await getTelegramRecipients(); if (recipients.length > 0) { ...unchanged... } }`); then `await broadcastToMasterBots({ masterId: appointment.masterId, html: msg, type: 'BOOKING_CONFIRMATION', appointmentId })`. The existing general-bot message text and its `NotificationLog` row must stay byte-identical.
- [x] Step 6: Wire `notifyBookingCancellation`
  - Files: `src/lib/notifications/index.ts`
  - Details: add `masterId: string` to the local `CancellationAppointment` type. **No call-site changes are needed** — all six callers (`client/appointments/[id]`, `master/appointments/[id]` ×2, `admin/calendar/appointments/[id]`, `bookings/cancel`, `google-calendar/pull.ts`) already pass a full Prisma `Appointment` row loaded with `include`, so `masterId` is present; `tsc` will prove it. Change the early return from `if (!config.notifTelegramEnabled || !config.telegramBotToken) return` to `if (!config.notifTelegramEnabled) return`, move the `getTelegramRecipients()`/`recipients.length` general-bot path under `if (config.telegramBotToken)`, build `msg` before it, and add the `broadcastToMasterBots({ masterId: appointment.masterId, ..., type: 'BOOKING_CANCELLATION', appointmentId: appointment.id })` call after.
- [x] Step 7: Wire `notifyBookingUpdate`
  - Files: `src/lib/notifications/index.ts`
  - Details: same guard restructure. Keep the `if (!msg) return` no-op (nothing changed ⇒ send nothing, log nothing) **before** any send, so the new bots also stay silent on a no-op update. Then general bot (token-gated), then `broadcastToMasterBots({ masterId: appointment.masterId, html: msg, type: 'BOOKING_UPDATE', appointmentId })`.
  - Guard: `src/lib/notifications/index.ts` must stay under 500 lines (it is ~309 now; this adds roughly 20). If it would exceed, extract the confirmation-message builder into `internal.ts` rather than trimming the feature.
- [x] Step 8: Wire `notifyCalendarConflict`
  - Files: `src/lib/notifications/calendar-conflict.ts`, `src/lib/google-calendar/conflicts.ts`
  - Details: add `masterId: string` to `CalendarConflictInput`; pass it from the single call site in `detectAndNotifyConflicts` (it already has `masterId` as its first parameter). In `notifyCalendarConflict`, keep the existing `if (config.notifTelegramEnabled && config.telegramBotToken) { ... }` general-bot block but restructure to AD-6 (build `msg` under `notifTelegramEnabled`, token-gate only the general send) and add `broadcastToMasterBots({ masterId: input.masterId, html: msg, type: 'CALENDAR_CONFLICT' })` (no `appointmentId`). The email half is unchanged. The message already HTML-escapes external input via `escapeHtml` — keep that; the same escaped string goes to the bots.
- [x] Step 9: Unit test the dispatch helper
  - Files: `tests/lib/notifications/bots.test.ts` (new)
  - Details: `vi.mock('@/lib/prisma')` + `vi.mock('@/lib/notifications/telegram')` (stub `sendTelegramMessage`). `AUTH_SECRET` is already seeded by `tests/setup/env.ts`, so `encrypt`/`decrypt` work for real. Cases: (a) an `ALL`-scope bot receives a message for any master; (b) a `SELECTED` bot only for a master in its join set; (c) `enabled: false` bots are excluded (assert via the `where` argument passed to `findMany`); (d) each bot's send uses **its own** token and **only its own** chat IDs — never a merged recipient list; (e) one bot's failure does not prevent the next bot's send, and the aggregated log row is `status: 'sent'` when another bot succeeded; (f) zero matching bots ⇒ zero `notificationLog.create` calls.
- [x] Step 10: Keep existing Prisma-mocked suites green
  - Files: `tests/app/api/**`, `tests/lib/**` as needed
  - Details: run `npm run test`. Route suites that fire a notifier fire-and-forget should stay green (the new call is inside a never-throw `try`), but if any goes red, add `notificationBot: { findMany: vi.fn().mockResolvedValue([]) }` to that file's `@/lib/prisma` mock — per `prisma/AGENTS.md`'s "a schema change needs the mocks updated" rule. Do not loosen an assertion to make a test pass.

**Checkpoint 2** — user verification: insert a `NotificationBot` row + a `NotificationBotRecipient` row by hand in `npx prisma studio`, make a booking, confirm both the general bot **and** the new bot receive it, and that scoping to a different master suppresses it.

### Stage 3 — API surface

- [x] Step 11: Create `src/lib/notifications/bots-store.ts` (shared schemas + CRUD + authorization)
  - Files: `src/lib/notifications/bots-store.ts` (new, target < 250 lines)
  - Details:
    - Zod schemas (AD-12), shared by both surfaces: `label` trimmed 1–64; `token` trimmed, max 256, matching `/^\d+:[A-Za-z0-9_-]{20,}$/` (Telegram's `<bot_id>:<secret>` shape) → otherwise `BOT_TOKEN_INVALID`; `enabled` boolean; `scope` one of `BOT_SCOPES`; `masterIds` `string[]` max 50; `recipients` array max 50 of `{ chatId: 1–64, label?: ≤64 }`.
    - `canManageBot(user: { id: string; role?: string }, bot: { ownerId: string | null }): boolean` — sync, row-based: `ADMIN`/`SUPERADMIN` → true; `MASTER` → `bot.ownerId === user.id`; anything else → false. Mirrors `canManageDiscount`.
    - `listBots({ ownerId }: { ownerId?: string })` — returns the serialised shape below; `ownerId` filters to one master's own bots. **Never selects/returns `token`.**
    - `createBot(input, { ownerId })` and `updateBot(id, input)` — write path. `$transaction`: upsert the bot row, then `deleteMany` + `createMany` the `NotificationBotMaster` and `NotificationBotRecipient` rows when those arrays were supplied (AD-8). Drop recipient rows whose `chatId` trims to empty. Encrypt the token with `encrypt()` whenever one is supplied.
    - Validation rules enforced here (not per-route): `scope === 'SELECTED'` with an empty `masterIds` → `BOT_SCOPE_REQUIRED`; any `masterId` that is not an existing `User` with `role: 'MASTER'` → `VALIDATION_ERROR`; empty-string `token` on update → `VALIDATION_ERROR`.
    - `testBotToken(botId, rawToken?)` — uses the supplied token, else decrypts the stored one; calls `getTelegramBotInfo`; persists `username` **only** when the stored token was the one tested. Returns `{ ok: true; username } | { ok: false; status: number; code: 'BOT_TOKEN_INVALID' | 'TELEGRAM_API_ERROR' }` (`401`/`404` from Telegram → `BOT_TOKEN_INVALID` at HTTP 400; anything else → `TELEGRAM_API_ERROR` at HTTP 502). Same result shape as `testMasterCalendar`.
    - After a successful `createBot`/token-changing `updateBot`, run `getTelegramBotInfo` best-effort to refresh `username`; the write never fails on it; surface the outcome as `tokenCheck: 'ok' | 'failed'` in the return value (AD-10).
    - Serialised bot shape returned to clients (**no token field, ever**): `{ id, label, username, enabled, scope, masterIds, scopeMasterNames, ownerId, ownerName, hasToken, recipients: [{ chatId, label }] }`.
- [x] Step 12: Admin routes
  - Files: `src/app/api/admin/notification-bots/route.ts`, `src/app/api/admin/notification-bots/[id]/route.ts`, `src/app/api/admin/notification-bots/[id]/test/route.ts` (all new)
  - Details: `export const runtime = 'nodejs'`. Every handler does its own `auth()` check for `ADMIN`/`SUPERADMIN` (401 otherwise) — no middleware reliance. Error style: `{ error, code }` + `handleApiError`-free manual `NextResponse.json`, matching the adjacent `google-calendar-settings`/`notification-settings` routes.
    - `GET` → `{ telegramEnabled: config.notifTelegramEnabled, masters: [{ id, name }] (role MASTER, ordered by name), bots: listBots({}) }`.
    - `POST` → create with full admin input (`label`, `token`, `enabled?`, `scope`, `masterIds`, `recipients`), `ownerId: null`.
    - `PATCH [id]` → partial update of any bot including a master-owned one; may change `scope`/`masterIds`; must **not** change `ownerId`.
    - `DELETE [id]` → delete any bot (cascades to joins + recipients).
    - `POST [id]/test` → optional `{ token? }` body → `testBotToken`.
  - No `invalidateTenantConfigCache()` call anywhere here — these rows are read directly from their own tables, not through `getTenantConfig()` (same reasoning as `admin/reminder-templates`).
- [x] Step 13: Master routes
  - Files: `src/app/api/master/notification-bots/route.ts`, `src/app/api/master/notification-bots/[id]/route.ts`, `src/app/api/master/notification-bots/[id]/test/route.ts` (all new)
  - Details: `auth()` check for `role === 'MASTER'` with `session.user.id` — never a `masterId` param (same rule as `master/google-calendar`).
    - `GET` → `{ telegramEnabled, masters: [], bots: listBots({ ownerId: session.user.id }) }`.
    - `POST` → accepts **only** `{ label, token, enabled?, recipients }`; the server forces `ownerId = session.user.id`, `scope = 'SELECTED'`, `masterIds = [session.user.id]`. A `scope`/`masterIds`/`ownerId` field in the body is ignored, never honoured (AD-4).
    - `PATCH [id]` / `DELETE [id]` / `POST [id]/test` → load the bot, run `canManageBot(session.user, bot)`; `404 NOT_FOUND` when it does not exist, `403 FORBIDDEN` when it exists but is not hers (do not leak existence beyond that). `PATCH` accepts only `{ label?, token?, enabled?, recipients? }` — scope/owner fields are ignored.
- [x] Step 14: Register the new error codes
  - Files: `src/lib/errors/apiErrorKey.ts`, `src/locales/{pl,en,uk}.json`
  - Details: add `BOT_TOKEN_INVALID`, `BOT_SCOPE_REQUIRED`, `TELEGRAM_API_ERROR` to `KNOWN_ERROR_CODES`, plus an `errors.*` entry for each in all three locale files (Polish is the canonical wording; `uk`/`en` are real translations, not copies of `pl`).
- [x] Step 15: Route tests
  - Files: `tests/app/api/admin/notification-bots.test.ts`, `tests/app/api/master/notification-bots.test.ts` (new)
  - Details: `vi.mock('@/auth', ...)` + `vi.mock('@/lib/prisma', ...)` per `tests/AGENTS.md`. Assert: 401 for an unauthenticated/wrong-role caller on every handler; `POST` stores an **encrypted** token (the value handed to Prisma is not the plaintext, and `decrypt()` round-trips it); no response body in any handler contains the token; the master `POST` forces `scope: 'SELECTED'` + `masterIds: [session id]` even when the body tries to send `scope: 'ALL'`; the master `PATCH`/`DELETE` on another master's bot is rejected; `scope: 'SELECTED'` with empty `masterIds` returns `BOT_SCOPE_REQUIRED`.

**Checkpoint 3** — user verification: the endpoints are callable but have no UI yet; verification is `npm run test` + `npm run lint` green.

### Stage 4 — UI

- [x] Step 16: Shared components
  - Files: `src/components/admin/notification-bots/NotificationBotsManager.tsx`, `NotificationBotCard.tsx`, `BotRecipientsField.tsx` (all new, `"use client"`)
  - Details:
    - `NotificationBotsManager({ apiBase, canEditScope })` — loads `GET {apiBase}` once, renders a muted notice when `telegramEnabled` is false (pointing at `/admin/settings/notifications`), renders one `NotificationBotCard` per bot plus an "Add bot" button that appends an unsaved draft card. Reloads from the server after every successful save/delete.
    - `NotificationBotCard({ bot, masters, canEditScope, apiBase, onSaved, onCancel })` — plain `React.useState` local form (no react-hook-form; AD-8 makes a diff/field-array unnecessary, and `MasterCalendarField` is the precedent for a locally-stateful settings control). Fields: `label`, a token input (placeholder "leave blank to keep the current token" once `hasToken`; required on a new bot), an `enabled` `Switch`, scope — a `Select` (`ALL`/`SELECTED`) plus a `Checkbox` list of masters when `SELECTED`, rendered **only** when `canEditScope`; otherwise a read-only scope summary line built from `scope`/`scopeMasterNames`. Buttons: Save (`POST` or `PATCH {apiBase}/{id}`), Test (`POST {apiBase}/{id}/test`, sending the typed token when one was typed), Delete (behind `await useConfirm()(t(...))` — native `confirm` is ESLint-banned).
    - `BotRecipientsField({ value, onChange })` — chat-ID + label rows with add/remove, visually matching `TelegramRecipientsField.tsx` but driven by props instead of `useFieldArray`.
    - Error handling: every non-ok response is surfaced as `toast.error(t(apiErrorKey(err.code)))`; successes as `toast.success(...)` — never a raw `error` string.
    - Each file must stay under 500 lines; split further if a card grows past it.
- [x] Step 17: Admin page
  - Files: `src/app/admin/settings/notification-bots/page.tsx`, `src/app/admin/settings/notification-bots/loading.tsx` (new)
  - Details: `async` Server Component, `auth()` + `redirect('/admin')` when the role is not `ADMIN`/`SUPERADMIN` (copy `settings/google-calendar/page.tsx` verbatim as the shape, including the `admin.settings.configurationEyebrow` eyebrow + muted subtitle, no `<h1>`). Body: a `SettingsSection` (from `@/app/admin/settings/FormFields`) wrapping `<NotificationBotsManager apiBase="/api/admin/notification-bots" canEditScope />`. `loading.tsx` composes `FormSkeleton` inside the same outer container classes.
- [x] Step 18: Master page
  - Files: `src/app/admin/master/notification-bots/page.tsx`, `src/app/admin/master/notification-bots/loading.tsx` (new)
  - Details: same shape as `admin/master/google-calendar/page.tsx` — `auth()` + `redirect('/auth/login')` when `role !== 'MASTER'`; renders `<NotificationBotsManager apiBase="/api/master/notification-bots" canEditScope={false} />`.
- [x] Step 19: Navigation
  - Files: `src/components/admin/adminNavItems.ts`
  - Details: add `{ labelKey: 'admin.nav.notificationBots', href: '/admin/settings/notification-bots', icon: BotMessageSquare }` to `adminNavItems` (right after the `admin.nav.clientBot` entry) and `{ labelKey: 'admin.nav.notificationBots', href: '/admin/master/notification-bots', icon: BotMessageSquare }` to `masterNavItems`. `BotMessageSquare` is exported by the installed `lucide-react` (verified) and is visually distinct from the `Bot` icon already used by the client-bot entry — the collapsed 72px sidebar is icon-only, so do not reuse `Bot`. Never hardcode a page title in the page itself; `AdminTopBar` derives it from this file.
- [x] Step 20: i18n
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: add `admin.nav.notificationBots` and a new `admin.settings.notificationBots.*` group (page description, master page description, section title/description, add-bot button, label/token/enabled/scope/recipients field labels + placeholders + hints, scope options `ALL`/`SELECTED`, read-only scope summary, save/test/delete buttons, confirm text, success/failure toasts, the "Telegram notifications are off" notice, and an "invalid token" warning for `tokenCheck: 'failed'`). Reuse `common.*`/`admin.common.*` where the concept already exists instead of duplicating. All three files must stay key-identical.
  - Verify: `node scripts/i18n-check.mjs` passes (key parity + every referenced key resolves).

**Checkpoint 4** — user verification: full manual pass through both UIs (see the checklist in Step 22).

### Stage 5 — Verification & DOX

- [ ] Step 21: Run the full verification suite
  - Commands: `npm run lint` (zero warnings), `npm run test`, `node scripts/i18n-check.mjs`. Do **not** run `npm run dev` or `npm run build` — the user runs their own dev server and a build can corrupt `.next/`.
- [ ] Step 22: Produce the manual-verification checklist for the user
  - Details: the repo's root `CLAUDE.md` requires a clear, step-by-step "what to check manually" list at the end of the task. Cover at minimum: creating a bot as ADMIN with scope `ALL`; creating one with scope `SELECTED` for one master; creating one from the MASTER cabinet (confirm no scope picker appears); Test button on a valid and on a garbage token; disabling a bot and confirming it stops receiving; deleting a bot; confirming the general salon bot still receives everything unchanged; confirming an ADMIN can edit and delete a master-created bot; confirming a MASTER cannot see another master's bot; and confirming the contact form still goes only to the general bot. Write it in Russian, short, using "ты".
- [ ] Step 23: DOX pass
  - Files: `src/lib/AGENTS.md`, `src/app/api/AGENTS.md`, `src/app/admin/AGENTS.md`, `prisma/AGENTS.md`, `tests/AGENTS.md`
  - Details: per the root `CLAUDE.md` Closeout. Add a bullet to each nearest owning doc: `src/lib/AGENTS.md` (the `bots.ts`/`bots-store.ts` contract, the `telegram_bot` log channel, the AD-6 gating change to the four notifiers, `CancellationAppointment.masterId`/`CalendarConflictInput.masterId`); `src/app/api/AGENTS.md` (the six new routes, the token-never-returned rule, the master surface's forced scope); `src/app/admin/AGENTS.md` (the two new surfaces sharing one component set, the `canEditScope` split); `prisma/AGENTS.md` (the three new models, `ownerId` semantics, the "additive, general bot unmigrated" decision); `tests/AGENTS.md` (the new test files + any mock additions). No new child `AGENTS.md` is needed — `src/components/admin/notification-bots/` mirrors `src/components/admin/google-calendar/`, which has none. Report any doc intentionally left unchanged and why.

---

## Acceptance Criteria

- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` passes (no newly-skipped or loosened tests)
- [ ] `node scripts/i18n-check.mjs` passes
- [ ] The existing general bot's behaviour, message text, recipients table, and `NotificationLog` rows are unchanged when no new bot exists
- [ ] `notifyContactForm` and `TenantConfig.clientBotToken` / `src/lib/telegram-bot/` are untouched
- [ ] An admin can create a bot with scope `ALL` or `SELECTED`, with any number of recipient chat IDs, and can edit/enable/disable/delete **any** bot including master-created ones
- [ ] A master can create/edit/test/delete her **own** bots from `/admin/master/notification-bots` and has no UI to add another master to a scope
- [ ] A master cannot read, modify, or delete another master's bot through the API
- [ ] A bot token is never present in any API response, any log line, or any rendered page; it is stored encrypted via `src/lib/encryption.ts`
- [ ] Each bot is sent its own message with its own token to its own chat IDs — chat-ID lists are never merged across tokens
- [ ] One failing bot blocks neither the other bots nor the general bot, and never throws out of a notifier
- [ ] Every touched file stays under 500 lines
- [ ] The DOX chain is updated (Step 23) and the manual-verification checklist is delivered (Step 22)

## Constraints & Risks

**Must not be touched**
- `TenantConfig.telegramBotToken` / `telegramBotUsername` / `TelegramNotificationRecipient` — schema and behaviour both frozen.
- `notifyContactForm` — not master-scoped, stays general-bot-only.
- `TenantConfig.clientBotToken` and all of `src/lib/telegram-bot/` — that is the separate interactive *client booking* bot. Registration order inside `bot.ts` there is load-bearing and invisible to `tsc`; do not go near it.
- `sendTelegramMessage`'s existing signature/behaviour (shared with the general bot) — only *add* `getTelegramBotInfo` alongside it.
- `src/lib/google-calendar/pull.ts` must never enqueue a push; Step 6 only changes a type it already satisfies, nothing else in that file.

**Critical dependencies**
- `src/lib/encryption.ts` throws at import when `AUTH_SECRET` is missing — already required, already seeded in tests.
- No new npm dependency: Telegram is plain `fetch` to `api.telegram.org`, exactly as `telegram.ts` already does.
- `src/components/ui/input.tsx` is not `forwardRef`-wrapped under React 18 — if any part of the UI ends up inside a react-hook-form, it must be `FormField`/`Controller`-bound, never `register()`-bound. AD-8's plain-`useState` approach sidesteps this entirely; do not "improve" it into an RHF form.

**Risks**
- *Guard restructure (AD-6)* is the highest-risk edit: it touches the live notification path for all four notifiers. Keep the general-bot branch textually identical (same message string, same `logNotification` call, same `recipients.length > 0` gate); only the surrounding `if` nesting changes. Checkpoint 2 exists specifically to catch a regression here.
- *Sequential sends.* N bots × M recipients are sent one at a time inside a fire-and-forget notifier. This never blocks an HTTP response (all callers use `.catch(console.error)` without awaiting) but does lengthen the background task. Accepted; do not add concurrency.
- *Orphaned scope.* An admin-owned bot whose only scoped master is later deleted ends up with zero join rows and `scope: 'SELECTED'` — it matches nobody and sends nothing. Harmless, accepted, no cleanup job.
- *No dedup across bots.* If two bots both cover a master and share a chat ID, that chat receives two messages (from two different bots). This is inherent to per-token delivery and is the user's configuration choice — do not add cross-bot dedup.
- *`username` staleness.* `username` is refreshed only on create/token-change/test. It is display-only and never used for routing, so staleness is cosmetic.
