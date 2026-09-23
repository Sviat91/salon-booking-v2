# Requirements: additional Telegram notification bots, scoped per master

## User's request (2026-09-22, refined after one round of clarification)
Backlog item 6 from `project_backlog_2026-09-21` memory, **scope reduced**: notification routing
only. NOT in this pass: interactive bot commands (today's/week's schedule, mark day off/working
day) — those stay deferred, per the user's explicit "расширять функционал бота не будем, пусть
пока будет только уведомление."

The user's own redesign (rejecting the orchestrator's first, more rigid proposal of "one bot per
master + the existing general bot"): make it **generic**. You can add as many additional bots as
you want. Each one independently has:
- its own bot token
- its own list of Telegram chat ID recipients (however many)
- a **scope**: either "all masters" or "a specific selected set of masters" — determines whose
  bookings this bot receives.

Direct quote (translated): "we can already add as many chat IDs as we want [to the existing
general bot's recipient list]. Just make it so you can add another bot — an admin one, or a
[master] one — with however many chat IDs it wants too, and choose which masters' bookings it
sends: all masters, or only specified ones, all going to the chat IDs configured on it. I think
that's simpler."

This one generalized model subsumes: a per-master bot (scope = that one master only), an
all-masters admin bot (scope = all), a shared bot for a subset of masters who work together
(scope = those specific masters), etc. — all the same underlying entity, just different scope
configuration, exactly as the user described.

## Existing system (read before planning)
- `TenantConfig.telegramBotToken`/`telegramBotUsername` — the ONE existing salon-wide bot. Always
  broadcasts every master's booking notifications to every row in `TelegramNotificationRecipient`
  (a flat, tenant-scoped chat-ID list, no master concept at all today). Dispatch helpers:
  `getTelegramRecipients()` and `broadcastTelegram(botToken, recipients, html)` in
  `src/lib/notifications/internal.ts`.
- Call sites that currently do `config.telegramBotToken` + `getTelegramRecipients()` +
  `broadcastTelegram(...)`, every one of which already has the appointment (and therefore
  `appointment.masterId`/`appointment.master`) loaded before building the Telegram HTML string:
  `notifyBookingConfirmation`, `notifyBookingCancellation`, `notifyBookingUpdate` (all in
  `src/lib/notifications/index.ts`), and `notifyCalendarConflict` in
  `src/lib/notifications/calendar-conflict.ts`. These four are master-scoped and in-scope for the
  new routing.
- `notifyContactForm` (`index.ts`) is **not** master-scoped (generic site contact form, no
  `masterId` on `ContactFormData`) — stays on the existing general bot only, out of scope here.
- Existing secret-storage convention: `src/lib/encryption.ts` (AES-256-GCM via `AUTH_SECRET`) —
  every bot token must be stored encrypted, same as `googleServiceAccountKey`,
  `twilioAuthToken`, etc. Never return a stored token in an API response.
- Good precedent to reuse for the admin/master split UI: this session's Google Calendar settings
  work — `src/app/admin/settings/google-calendar/` (admin: lists/edits every master's calendar
  connection) and `src/app/admin/master/google-calendar/` (master: manages her own), plus the
  "test connection" button pattern (`testMasterCalendar` → calls the provider API and reports
  ok/error) — reuse the same shape for a bot-token "test" action via Telegram's `getMe` endpoint.

## Decided
- **Keep the existing general bot (`TenantConfig.telegramBotToken` + `TelegramNotificationRecipient`)
  exactly as-is, unmigrated.** It is the simplest case of the new model (implicitly "all masters"),
  already works, and the user's phrasing ("we can already add chat IDs... just make it so you can
  add ANOTHER bot") indicates they want to keep it and add to it, not replace/migrate it. Do not
  fold it into the new table — that would be an unnecessary migration risk for zero benefit. Note
  this as the recommended default; if the planner finds a clean, low-risk unification, it may
  propose it, but additive-only is the expected shape.
- **New model, roughly:** a bot entity (token — encrypted, username, label, enabled flag, scope:
  `ALL` | `SELECTED`), a join table for the `SELECTED` case (bot ↔ master, many-to-many — a bot can
  cover more than one master, a master can be covered by more than one bot), and a recipients table
  (bot ↔ chat ID, one-to-many, with an optional label, mirroring `TelegramNotificationRecipient`'s
  shape). The planner should design the exact Prisma shape.
- **No interactive commands, no long-polling, no new bot process.** Every send is a one-shot
  Telegram Bot API `sendMessage` call via the existing token, exactly like `broadcastTelegram`
  already does for the general bot — reuse that helper (parameterize by token, already is) rather
  than writing a new send path.
- **Dispatch behavior:** for the four master-scoped notification functions, after the existing
  general-bot broadcast (untouched), additionally loop over every enabled new-model bot whose scope
  includes that appointment's `masterId` (`ALL`, or `SELECTED` containing it) and broadcast the same
  already-built message string to that bot's own recipients via that bot's own token. These are
  independent per-bot sends (never merge chat-ID lists across different tokens — a token can only
  message chats that started a conversation with THAT bot). A failure sending to one bot must not
  block sending to another or to the general bot (mirror the existing never-throw /
  `logNotification` pattern per channel).
- **Management/permissions — recommended default, planner may refine:** mirror the Google Calendar
  admin/master split built this session. A master's own cabinet page lets her create/edit/test/
  delete bot(s) implicitly scoped to herself only (she should not be able to pick other masters into
  a bot's scope — no UI for that on her side). ADMIN/SUPERADMIN gets a page listing every bot
  (master-created and admin-created), can create a new bot with either `ALL` or `SELECTED` scope
  (multi-select any combination of masters), and can edit/enable/disable/delete any bot including
  ones a master created — matching last session's explicit decision ("master can add own bot token
  in her cabinet; ADMIN/SUPERADMIN see all bots and can enable/disable/edit/create for a master").
- Test-token action: call Telegram's `getMe` Bot API endpoint with the stored token, report
  ok/invalid, same UX shape as `testMasterCalendar`.

## Explicitly out of scope (this pass)
- Interactive bot commands (schedule view, mark day off, date-range appointments) — deferred, per
  the user's own words today.
- Personal client-facing reminders via a master's own bot — not requested, don't add it.
- Any change to `notifyContactForm` or the existing general bot's behavior/schema.
- Any change to the unrelated client-facing booking bot (`TenantConfig.clientBotToken` — a
  different, already-interactive bot, do not confuse the two or touch its code).

## Constraints
- Token storage encrypted via `src/lib/encryption.ts`, never returned in API responses (mirror
  `googleServiceAccountKey`/`googleServiceAccountEmail`'s pattern: token opaque, but a non-secret
  derived value like `username` from `getMe` can be shown).
- File-size cap 500 lines — `src/lib/notifications/index.ts` and `calendar-conflict.ts` should grow
  minimally (a shared dispatch helper belongs in `internal.ts` or a new small file under
  `src/lib/notifications/`, not duplicated at each of the 4 call sites).
- No new npm dependency — Telegram calls are plain `fetch` to `api.telegram.org`, same as whatever
  the existing `broadcastTelegram`/`sendContactFormToAdmin` etc. already use; check before assuming.
- Respect `src/app/api/AGENTS.md`, `src/app/admin/AGENTS.md`, `src/lib/AGENTS.md`,
  `prisma/AGENTS.md` — read before planning.
- This is a genuinely new feature with schema changes and two new admin-surface UIs — full
  decomposition needed (this is why it's Mode: FULL).

## Deliverable
`handoff/master-notification-bots_plan.md`, checkbox-based, staged with user checkpoints between
stages if the planner judges the scope large enough to warrant it (schema+dispatch first, then UI,
mirroring how the Google Calendar work was staged this session is a reasonable precedent but not a
requirement — use judgment).
