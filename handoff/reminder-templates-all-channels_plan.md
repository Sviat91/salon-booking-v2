# Plan: Admin-editable reminder templates on all three channels (+ SMS setup help panel)

**Date:** 2026-08-23
**Status:** Complete

## Goal

Widen the already-shipped `NotificationTemplate` reminder-body editor from SMS-only to all three client-facing reminder channels (SMS, email, Telegram), reusing the existing `{{placeholder}}` engine and table without a schema change — and add a small collapsible "how to set this up" help panel to the SMS provider settings section.

---

## Architecture Decisions

### AD-1 — No migration. The `channel` column already does the job (verified, not assumed)

Verified against the live `prisma/schema.prisma:402-412`:

```prisma
model NotificationTemplate {
  id        String   @id @default(cuid())
  type      String
  language  String
  channel   String   // free-text String, no enum, no @db.* constraint
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([type, language, channel])
}
```

`channel` is a plain `String` with no enum, no check constraint, and no default — SQLite/libSQL stores `'email'` / `'telegram'` rows today with zero DDL. The `@@unique([type, language, channel])` composite is already the exact key the upsert needs. **This feature adds no Prisma migration, touches no `.prisma` file except one stale comment (Step 1), and must not run `prisma migrate`.** This is AD-5 of `handoff/sms-notifications_plan.md` paying off exactly as designed.

### AD-2 — `DEFAULT_REMINDER_BODIES` gains channel as the OUTERMOST key

`Record<ReminderChannel, Record<ReminderType, Record<Language, string>>>`, not three separate exported constants.

Rationale: every consumer already indexes it by a *runtime* value (`route.ts` loops types × locales; the form indexes by the selected channel). Three separate constants would force a `switch` or a lookup object at all four call sites; one nested record keeps every call site a plain index expression and keeps the existing test's "loop everything and assert non-empty" invariant a single nested loop. Channel goes outermost because that is the axis that is selected first in the UI and the axis `loadReminderTemplates()` already partitions on.

The constant keeps its name (`DEFAULT_REMINDER_BODIES`) — renaming would churn `src/lib/AGENTS.md`, `prisma/AGENTS.md`, and the test file for no gain. Only its shape changes. `tsc` catches all four call sites (`template-store.ts`, `api/admin/reminder-templates/route.ts`, `ReminderTemplatesForm.tsx`, `tests/lib/notifications/templates.test.ts`).

### AD-3 — Telegram defaults are byte-identical to today's `bot.*`-rendered output

The six Telegram default bodies (Step 2) reproduce the current `bot.reminder.heading24h|heading2h` + `"\n\n"` + `bot.reminder.details` output *verbatim*, with the same emoji, the same field order, and the same per-locale labels. So a salon that never opens the editor sees **no change at all** in its Telegram reminders — the change is provably behavior-preserving by default, and the existing `tests/lib/notifications/client-telegram.test.ts` content assertions still hold once the test passes the default body through.

The email defaults deliberately do **not** try to reproduce the current HTML table byte-for-byte (impossible — it's a table, the new body is plain text). They are warmer/longer than the SMS defaults (no per-segment cost) and reuse the same per-locale vocabulary as `emailNotif.confirmation.serviceLabel` / `.masterLabel` / `.dateLabel` / `.timeLabel` ("Mistrz" / "Specialist" / "Майстер" etc.) so the wording stays consistent with the confirmation email that is *not* being templated.

### AD-4 — `renderTemplate()` / `validateTemplateBody()` are unchanged and channel-agnostic

Confirmed by reading `src/lib/notifications/templates.ts:23-41`: both operate on `(body: string, vars: Record<Placeholder, string>)` with no channel awareness, no HTML, no SMS assumptions. **Do not add a channel parameter to either.** The placeholder set (`clientName`, `date`, `time`, `service`, `master`, `brandName`) is identical for all three channels — no channel-specific token is being introduced.

`estimateSmsSegments()` stays SMS-only and stays in `templates.ts` (it is a pure sibling helper, not worth relocating); only its *UI* usage becomes conditional.

### AD-5 — Email: escape once, after rendering, and drop the now-unused `data` param

The rendered body is admin-authored plain text interpolated with client/service/master names. It is not attacker-controlled in the XSS sense (the admin already has full settings access), but it **is** correctness-critical: a service named `Hair & Nails` or a client named `O'Brien <test>` would currently emit invalid/broken markup. So the rendered string is HTML-escaped **once, after `renderTemplate()`**, immediately before interpolation into the `<p>`.

Escaping after rendering (not before) is the correct order: it covers both the admin's template text and every substituted value in one pass, and there is no double-escaping because `renderTemplate()` produces the final plain text.

A side effect the escape gives for free: it enforces the locked decision that the admin edits *content, not layout* — any `<b>` the admin types renders as literal `<b>`, it cannot break the wrapper.

`escapeHtml()` lives in `templates.ts` (pure, zero-dependency, already the module the no-mocks test file covers), not in `email.ts` — so it gets unit-tested without dragging `nodemailer`/`sendEmail` into the test graph.

Once the heading + greeting + 4-row detail table are replaced by the rendered body, `sendBookingReminderToClient`'s `data: BookingData` parameter is **completely unused** — every one of its five fields now arrives through the template vars instead. It is dropped rather than left dangling (root `CLAUDE.md` §3: "Remove imports/variables/functions that YOUR changes made unused"). There is exactly one call site (`reminders.ts:161`), so the signature change is a two-line diff. `BookingData` itself stays — the other three exported email functions still use it.

### AD-6 — Telegram: `client-telegram.ts` becomes a pure transport

`sendClientBookingReminder` currently owns both message *composition* (`botT` + `bot.reminder.*`) and *transport*. Composition moves to `reminders.ts` (where SMS composition already lives), so the function takes a ready `text: string` and its `lang` / `hours` / `labels` params disappear along with the `botT` import. This is the same shape as the SMS sender (`(to, text) => Promise<Error | null>`) and matches the file's own header comment, which already describes it as a plain-text sender.

**This breaks `tests/lib/notifications/client-telegram.test.ts` (5 tests) — it is updated in the same step, not deferred.** The transport assertions (URL, `parse_mode` undefined, never leaks the token, `Error` on non-ok, `Error` on reject) are unchanged; only `baseParams` and the two content assertions change.

### AD-7 — Admin API `GET` returns **all three channels** in one response; no `?channel=` param

The editor holds all 18 (3 channels × 2 types × up to 3 locales) fields in a single react-hook-form state so it can save them in one `PUT` and so switching channel tabs never refetches or loses an unsaved edit. A `?channel=` param would mean three fetches, three form resets, and a real risk of dropping in-progress edits on tab switch. `PUT` already accepts a per-entry `channel` — it only needs its validation widened.

### AD-8 — UI: one channel switcher at the top, existing section layout untouched underneath

There is **no Tabs, Accordion, or Collapsible component in this repo** — `src/components/ui/` has 19 primitives and none of them is a tab; `package.json` only carries `@radix-ui/react-label` and `@radix-ui/react-slot`. Adding a Radix package for this is out of the question (root `CLAUDE.md` mandate: no new dependency without need).

So: a hand-rolled 3-button segmented switcher above the two existing `SettingsSection`s, driving a `useState<ReminderChannel>`. The existing render tree (one `SettingsSection` per reminder type, one field per enabled locale) is reused **verbatim** — only the field name gains a channel prefix and the SMS-segment readout becomes conditional. This is the lowest-structural-risk option of the three considered (per-type inner tabs, three stacked sections, one top-level switcher) and shows 6 fields at a time instead of 18.

React-hook-form v7 defaults to `shouldUnregister: false`, so a field that unmounts when the admin switches channels **keeps its value in form state** and is still included in `handleSubmit`'s values. This is load-bearing for the design — do not set `shouldUnregister: true`.

### AD-9 — The "empty = default, only touched fields persist" invariant is preserved per-channel

This is the exact defect the previous review round fixed (`handoff/sms-notifications_feedback.md`, Critical issue #1) and it must survive the rewrite:

- `loadTemplates()` populates `values[key]` **only when `!row.isDefault`**. A row with no DB record leaves its key absent → the field renders blank with the default as `placeholder`.
- `onSubmit` builds the payload for every channel × type × locale from `values[key] ?? ''`. An untouched field submits `''` → the `PUT` route's blank branch runs `deleteMany` → no-op when no row exists → the table stays empty for anything never customized, so a future change to `DEFAULT_REMINDER_BODIES` still propagates automatically.
- "Reset to default" stays `field.onChange('')`.

The reviewer should specifically re-verify this for **email and Telegram**, not just SMS.

### AD-10 — Per-channel body length cap

The current `640` cap (Zod `.max(640)` in `route.ts:25` and `maxLength={640}` on the Textarea) is SMS-tuned and would silently reject a normal email body. Add `MAX_BODY_LENGTH: Record<ReminderChannel, number> = { sms: 640, email: 2000, telegram: 2000 }` to `templates.ts`; the Zod schema widens to a blanket `.max(4000)` and the real per-channel check moves into the existing per-entry validation loop (which already returns a proper `ApiError`). Telegram's own hard limit is 4096 chars, so 2000 is comfortably safe.

### AD-11 — The SMS help panel copies the existing `SmtpInstructions.tsx` pattern exactly

`src/components/admin/SmtpInstructions.tsx` is the established precedent in this codebase for exactly this problem (provider credentials that are confusing to obtain): a stack of native `<details class="group/details">` / `<summary>` blocks with a `ChevronDown` that rotates via `group-open/details:rotate-180`, all copy from `t()` keys. Reuse that markup verbatim.

Two deliberate deviations: (a) **no outer `<Card>`** — the SMS panel renders *inside* an existing `SettingsSection`, and a Card-in-Card reads badly; (b) **co-located at `src/app/admin/settings/notifications/SmsInstructions.tsx`**, not `src/components/admin/`, because unlike `SmtpInstructions` (rendered by the page, sibling to a form that lives elsewhere) this one is rendered by `SmsSettingsSection.tsx` and is meaningless outside it — same co-location logic as `TelegramRecipientsField.tsx` and `SmsSettingsSection.tsx` in that folder.

`<summary>` is not a `<button>`, so it cannot submit the enclosing `<form id="settings-form">`. Do not put any `<button>` inside the panel; if one is ever added it needs `type="button"`.

### Explicit non-goals (state these, do not drift)

- **Booking confirmation / cancellation / update / contact-form notifications stay hardcoded on every channel.** Only `BOOKING_REMINDER_24H` and `BOOKING_REMINDER_2H` are templated. Do not add a third `REMINDER_TEMPLATE_TYPES` entry, do not touch `sendBookingConfirmationToClient`, `sendBookingConfirmationToAdmin`, `sendContactFormToAdmin`, or anything in `notifications/index.ts`.
- **Admin/salon-facing Telegram is untouched.** `src/lib/notifications/telegram.ts`, `internal.ts`'s `broadcastTelegram`/`getTelegramRecipients`, and `NotificationLog.channel = 'telegram'` are out of scope. Only the client-facing `'telegram_client'` reminder changes.
- **`estimateSmsSegments()` and its counter/diacritics hint stay SMS-only** — they must not render on the email or Telegram tab.
- **The email HTML wrapper, subject line, `<html lang>`, header brand block, and footer are unchanged.** Only the middle content cell is replaced.
- **No schema change, no migration, no `TenantConfig` column.**
- **No new npm dependency.** No Radix tabs/accordion/collapsible.
- The SMS provider modules (`notifications/sms/*`), credential encryption, and `admin/sms-settings` routes are untouched — the help panel is static copy only.

---

## Implementation Steps

- [x] **Step 1: Confirm the no-migration assumption and refresh the stale schema comment**
  - Files: `prisma/schema.prisma`
  - Re-read `model NotificationTemplate` (currently lines 399-412) and confirm in the feedback file that `channel` is a plain `String` with no enum/check/default. If — contrary to AD-1 — anything constrains it, **stop and report instead of writing a migration**; that would be an architectural change requiring re-planning.
  - The only edit: line 406's comment `// "sms" today; the axis exists for future email/telegram bodies` → `// sms | email | telegram (REMINDER_CHANNELS in src/lib/notifications/templates.ts)`.
  - **Do not run `npx prisma migrate`, do not touch `prisma/migrations/`, do not touch `app.db`.** Changing a comment does not require a migration; verify `npx prisma validate` still passes if you want a check, nothing more.

- [x] **Step 2: Channel axis + per-channel defaults + `escapeHtml` in `templates.ts`**
  - Files: `src/lib/notifications/templates.ts`
  - Update the file header comment: `SMS reminder template rendering` → `Reminder template rendering (SMS / email / Telegram)`.
  - Add next to `REMINDER_TEMPLATE_TYPES`:
    ```ts
    export const REMINDER_CHANNELS = ['sms', 'email', 'telegram'] as const
    export type ReminderChannel = (typeof REMINDER_CHANNELS)[number]

    /** Per-channel body cap. SMS is cost-capped; Telegram's own hard limit is 4096. */
    export const MAX_BODY_LENGTH: Record<ReminderChannel, number> = {
      sms: 640,
      email: 2000,
      telegram: 2000,
    }
    ```
  - Add the escaper (pure, 6 lines, exported so the no-mocks test can cover it):
    ```ts
    /**
     * Escapes a rendered plain-text body for safe interpolation into an HTML
     * email. Applied AFTER renderTemplate(), so it covers both the admin's
     * template text and every substituted value in one pass — and it is what
     * guarantees an admin cannot break the email's layout (locked decision:
     * the admin edits content, never markup).
     */
    export function escapeHtml(text: string): string {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }
    ```
    `&` must be replaced first.
  - Restructure `DEFAULT_REMINDER_BODIES` to `Record<ReminderChannel, Record<ReminderType, Record<Language, string>>>`. The six existing SMS strings move under `sms` **unchanged, character for character** (they are asserted verbatim in `handoff/sms-notifications_feedback.md`). Use exactly:
    ```ts
    export const DEFAULT_REMINDER_BODIES: Record<
      ReminderChannel,
      Record<ReminderType, Record<Language, string>>
    > = {
      sms: {
        BOOKING_REMINDER_24H: {
          pl: '{{brandName}}: przypominamy o wizycie jutro o {{time}} — {{service}}.',
          en: '{{brandName}}: reminder — your {{service}} appointment is tomorrow at {{time}}.',
          uk: '{{brandName}}: нагадуємо про візит завтра о {{time}} — {{service}}.',
        },
        BOOKING_REMINDER_2H: {
          pl: '{{brandName}}: Twoja wizyta ({{service}}) zaczyna się o {{time}}.',
          en: '{{brandName}}: your {{service}} appointment starts at {{time}}.',
          uk: '{{brandName}}: ваш візит ({{service}}) розпочнеться о {{time}}.',
        },
      },
      email: {
        BOOKING_REMINDER_24H: {
          pl: 'Cześć {{clientName}}!\n\nPrzypominamy o Twojej wizycie jutro o {{time}}.\n\nUsługa: {{service}}\nMistrz: {{master}}\nData: {{date}}\nGodzina: {{time}}\n\nDo zobaczenia!\n{{brandName}}',
          en: 'Hi {{clientName}},\n\nThis is a reminder about your appointment tomorrow at {{time}}.\n\nService: {{service}}\nSpecialist: {{master}}\nDate: {{date}}\nTime: {{time}}\n\nSee you soon!\n{{brandName}}',
          uk: 'Привіт, {{clientName}}!\n\nНагадуємо про ваш візит завтра о {{time}}.\n\nПослуга: {{service}}\nМайстер: {{master}}\nДата: {{date}}\nЧас: {{time}}\n\nДо зустрічі!\n{{brandName}}',
        },
        BOOKING_REMINDER_2H: {
          pl: 'Cześć {{clientName}}!\n\nTwoja wizyta zaczyna się już za 2 godziny, o {{time}}.\n\nUsługa: {{service}}\nMistrz: {{master}}\nData: {{date}}\nGodzina: {{time}}\n\nDo zobaczenia!\n{{brandName}}',
          en: 'Hi {{clientName}},\n\nYour appointment starts in 2 hours, at {{time}}.\n\nService: {{service}}\nSpecialist: {{master}}\nDate: {{date}}\nTime: {{time}}\n\nSee you soon!\n{{brandName}}',
          uk: 'Привіт, {{clientName}}!\n\nВаш візит розпочнеться за 2 години, о {{time}}.\n\nПослуга: {{service}}\nМайстер: {{master}}\nДата: {{date}}\nЧас: {{time}}\n\nДо зустрічі!\n{{brandName}}',
        },
      },
      telegram: {
        BOOKING_REMINDER_24H: {
          pl: '⏰ Przypomnienie: Twoja wizyta jest jutro\n\n👤 Specjalista: {{master}}\n💇 Usługa: {{service}}\n📅 Data: {{date}}\n🕐 Godzina: {{time}}',
          en: '⏰ Reminder: your appointment is tomorrow\n\n👤 Specialist: {{master}}\n💇 Service: {{service}}\n📅 Date: {{date}}\n🕐 Time: {{time}}',
          uk: '⏰ Нагадування: ваш візит завтра\n\n👤 Спеціаліст: {{master}}\n💇 Послуга: {{service}}\n📅 Дата: {{date}}\n🕐 Час: {{time}}',
        },
        BOOKING_REMINDER_2H: {
          pl: '⏰ Przypomnienie: Twoja wizyta jest za 2 godziny\n\n👤 Specjalista: {{master}}\n💇 Usługa: {{service}}\n📅 Data: {{date}}\n🕐 Godzina: {{time}}',
          en: '⏰ Reminder: your appointment is in 2 hours\n\n👤 Specialist: {{master}}\n💇 Service: {{service}}\n📅 Date: {{date}}\n🕐 Time: {{time}}',
          uk: '⏰ Нагадування: ваш візит за 2 години\n\n👤 Спеціаліст: {{master}}\n💇 Послуга: {{service}}\n📅 Дата: {{date}}\n🕐 Час: {{time}}',
        },
      },
    }
    ```
  - The `telegram` strings are the current `bot.reminder.heading*` + `'\n\n'` + `bot.reminder.details` output verbatim (AD-3) — cross-check them against `src/locales/{pl,en,uk}.json` (`bot.reminder.*`, around line 1502) before moving on. Any drift here silently changes every salon's Telegram reminder.
  - `templates.ts` will land at roughly 130 lines. Well under 500.

- [x] **Step 3: `resolveReminderBody()` takes a channel**
  - Files: `src/lib/notifications/template-store.ts`
  - `loadReminderTemplates(channel: string)` is **unchanged** — it is already channel-parameterized.
  - `resolveReminderBody(templates, channel, type, language)` — insert `channel: ReminderChannel` as the **second** parameter (after the map, before `type`), and change the fallback chain to `DEFAULT_REMINDER_BODIES[channel][type][language] ?? DEFAULT_REMINDER_BODIES[channel][type][DEFAULT_LANGUAGE]`. Import `type ReminderChannel` alongside `ReminderType`.
  - Update the doc comment to mention the channel. Nothing else in this file changes.

- [x] **Step 4: Email — render the admin body into the existing wrapper**
  - Files: `src/lib/notifications/email.ts`
  - Change the signature of `sendBookingReminderToClient` (line 136) to:
    ```ts
    export async function sendBookingReminderToClient(
      to: string,
      body: string,          // already rendered + placeholder-substituted plain text
      hoursAhead: 24 | 2,
      brandName: string,
      lang: Language
    ): Promise<void>
    ```
    The `data: BookingData` param is **removed** — after this change nothing in the function reads it (AD-5). Do not leave it as an unused param.
  - Keep `const t = emailT(lang)`, `year`, `when`, and `subject` **exactly as they are** — the subject line, `whenTomorrow`/`whenSoon`, and the footer key are all unchanged.
  - Keep the `<!DOCTYPE …>` wrapper, the outer/inner tables, the brand header row (lines 148-156) and the footer row (lines 170-176) byte-for-byte.
  - Replace **only** the middle content cell (currently lines 157-169 — the heading `<p>`, the greeting `<p>`, and the 4-row detail `<table>`) with:
    ```html
    <tr><td style="padding-top:28px;">
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body)}</p>
    </td></tr>
    ```
    `white-space:pre-wrap` is what makes the admin's newlines render — the same declaration `sendContactFormToAdmin` already uses at line 210, so this is an in-file precedent, not a new pattern.
  - Add `escapeHtml` to the imports from `./templates`.
  - After this, `emailNotif.reminder.heading` and `emailNotif.reminder.greeting` are orphaned — handled in Step 10, **not here**.
  - The other three exported functions and `BookingData` are untouched.

- [x] **Step 5: Telegram — `client-telegram.ts` becomes a pure transport**
  - Files: `src/lib/notifications/client-telegram.ts`, `tests/lib/notifications/client-telegram.test.ts`
  - New signature:
    ```ts
    export async function sendClientBookingReminder(params: {
      botToken: string
      chatId: string
      text: string
    }): Promise<Error | null> {
      return postPlainText(params.botToken, params.chatId, params.text)
    }
    ```
  - Delete the now-orphaned `ReminderLabels` interface, the `botT` import, and the `Language` type import. `postPlainText` is unchanged.
  - Update the file header comment: it currently says the message is "composed via `botT()`" logic implicitly — restate it as "takes a pre-rendered plain-text body (composed by `reminders.ts` from `NotificationTemplate` / `DEFAULT_REMINDER_BODIES.telegram`); this module is transport only."
  - Update the test in the same step (5 tests, all currently passing `lang`/`hours`/`labels`):
    - `baseParams` becomes `{ botToken: 'SECRET_TOKEN', chatId: '123', text: '<some rendered text>' }`.
    - The "correct URL and plain-text body" test asserts `body.text` equals the passed `text` exactly and `body.parse_mode` is `undefined`.
    - Replace the "selects the 2h heading when hours is 2" test — heading selection is no longer this module's job — with a test that the passed text is forwarded verbatim including newlines/emoji (e.g. render `DEFAULT_REMINDER_BODIES.telegram.BOOKING_REMINDER_2H.en` through `renderTemplate` and assert it round-trips). Keep the "never leaks the token", "Error on not-ok", and "Error on reject" tests as-is.

- [x] **Step 6: Wire all three channels in `reminders.ts`**
  - Files: `src/lib/notifications/reminders.ts`
  - Imports: add `type TemplateVars` and `type ReminderChannel` as needed from `./templates`.
  - Before the window loop, next to the existing `smsTemplates` line (36), load each channel's map **once per run**, each gated on that channel actually being usable so an unused channel costs zero queries:
    ```ts
    const smsSender = getSmsSender(config)
    const smsTemplates = smsSender ? await loadReminderTemplates('sms') : null
    const emailTemplates = config.notifEmailEnabled ? await loadReminderTemplates('email') : null
    const clientBotUsable = config.clientBotEnabled && !!config.clientBotToken
    const telegramTemplates = clientBotUsable ? await loadReminderTemplates('telegram') : null
    ```
  - Per appointment, right after `clientData` is built (line 154-157), hoist the language and the shared vars **once** instead of rebuilding them inside the SMS block:
    ```ts
    const lang = (appt.clientLanguage as Language) || DEFAULT_LANGUAGE
    const templateVars: TemplateVars = {
      clientName: clientData.name,
      date: clientData.date,
      time: clientData.time,
      service: clientData.service,
      master: clientData.master,
      brandName,
    }
    ```
  - Email block (lines 159-186): keep the `try/catch` + `logNotification` structure **exactly as-is** (`sendBookingReminderToClient` still throws; the SMS/Telegram senders still return `Error | null` — do not unify the three error styles). Only the call changes:
    ```ts
    const emailBody = renderTemplate(
      resolveReminderBody(emailTemplates!, 'email', window.type, lang),
      templateVars
    )
    await sendBookingReminderToClient(appt.client.email, emailBody, window.hours, brandName, lang)
    ```
  - Telegram block (lines 188-210): replace the `lang`/`hours`/`labels` arguments with the rendered text:
    ```ts
    const telegramBody = renderTemplate(
      resolveReminderBody(telegramTemplates!, 'telegram', window.type, lang),
      templateVars
    )
    const sendErr = await sendClientBookingReminder({
      botToken: config.clientBotToken!,
      chatId: appt.client.telegramChatId!,
      text: telegramBody,
    })
    ```
  - SMS block (lines 212-233): drop the now-duplicated local `lang` and inline vars object; use `resolveReminderBody(smsTemplates!, 'sms', window.type, lang)` and `renderTemplate(body, templateVars)`.
  - **Do not change** the window math, the day-bucket query, `appointmentStartUtc`, the three `NotificationLog` dedup checks, the `emailDone && clientTelegramDone && smsDone` skip guard, the `{ sent, skipped }` shape, the outer `try/catch`, or the never-throw contract.
  - `clientBotEligible`'s existing definition (`config.clientBotEnabled && !!config.clientBotToken && !!appt.client.telegramChatId`) stays — `clientBotUsable` is only the load gate; do not conflate the two.
  - Verify the file stays under 500 lines (expect ~255).

- [x] **Step 7: Admin API — channel becomes a real parameter**
  - Files: `src/app/api/admin/reminder-templates/route.ts`
  - Imports: add `REMINDER_CHANNELS`, `MAX_BODY_LENGTH`, `type ReminderChannel` from `@/lib/notifications/templates`. Add `function isReminderChannel(v: string): v is ReminderChannel` mirroring the existing `isReminderType`.
  - `GET` (lines 40-61): drop the `where: { channel: 'sms' }` filter — `findMany()` with no filter (the table only ever holds reminder rows). Key the `stored` map as `` `${r.channel}:${r.type}:${r.language}` ``. Wrap the existing type × language loops in an outer `for (const channel of REMINDER_CHANNELS)` and emit `{ type, language, channel, body: body ?? DEFAULT_REMINDER_BODIES[channel][type][language], isDefault: body === undefined }`. Response grows from 6 to 18 entries; the shape per entry is unchanged, so the client contract holds.
  - `PutSchema` (line 25): `body: z.string().max(640)` → `z.string().max(4000)`. The real cap is per-channel and is checked in the loop.
  - `PUT` validation loop (lines 73-92): replace `if (entry.channel !== 'sms')` with `if (!isReminderChannel(entry.channel))` (same `ApiError('VALIDATION_ERROR', ...)`), and add, after the channel check:
    ```ts
    if (entry.body.length > MAX_BODY_LENGTH[entry.channel]) {
      throw new ApiError('VALIDATION_ERROR', `Body too long for channel ${entry.channel}`, 400)
    }
    ```
    (`entry.channel` is narrowed to `ReminderChannel` by the guard above it.)
  - The write loop (lines 94-113) is **unchanged** — it already keys on `entry.channel` and already implements blank→`deleteMany` / non-blank→`upsert`. Do not touch it.
  - Do **not** add `invalidateTenantConfigCache()` — templates are read straight from `NotificationTemplate` per cron run.
  - Do not "fix" the raw-`NextResponse` 401 guards (noted-and-accepted in `handoff/sms-notifications_feedback.md`'s Minor section; out of scope).

- [x] **Step 8: Admin UI — extract the field, add the channel switcher**
  - Files: `src/app/admin/settings/reminder-templates/ReminderTemplateField.tsx` (new), `src/app/admin/settings/reminder-templates/ReminderTemplatesForm.tsx`
  - **`ReminderTemplateField.tsx`** — extract the whole per-locale `FormField` render body currently at `ReminderTemplatesForm.tsx:167-231`, plus the `insertPlaceholder` helper (lines 62-87), into a `'use client'` component:
    ```tsx
    interface ReminderTemplateFieldProps {
      control: Control<FormValues>
      name: string            // the RHF field key, also the <textarea> DOM id
      label: string           // LANGUAGE_NAMES[lang]
      placeholder: string     // DEFAULT_REMINDER_BODIES[channel][type][lang]
      channel: ReminderChannel
    }
    ```
    Behavior identical to today with three changes: `rows={channel === 'sms' ? 3 : 8}`, `maxLength={MAX_BODY_LENGTH[channel]}`, and the `estimateSmsSegments` readout + `diacriticsHint` render **only when `channel === 'sms'`** (AD-4 / non-goals). Keep the `label` + "Reset to default" header row, the `Textarea` bound via `FormField`/`Controller` with explicit `value`/`onChange`/`onBlur` (**never `register()`** — the documented 2026-08-07 ref footgun), the placeholder chips, and `<FormMessage />`. Expect ~110 lines.
  - **`ReminderTemplatesForm.tsx`** — keep the file's overall structure; change:
    - `fieldName(channel, type, lang)` → `` `${channel}__${type}__${lang}` ``.
    - `formSchema` → `z.record(z.string().max(4000))`.
    - `loadTemplates()` — unchanged logic, but key on the new 3-part `fieldName`. **The `if (!row.isDefault)` guard stays** (AD-9). Do not populate default rows.
    - New `const [channel, setChannel] = React.useState<ReminderChannel>('sms')`.
    - A segmented switcher rendered above the sections: `REMINDER_CHANNELS.map(c => <Button type="button" key={c} size="sm" variant={c === channel ? 'default' : 'outline'} aria-pressed={c === channel} onClick={() => setChannel(c)}>{t(CHANNEL_LABEL_KEYS[c])}</Button>)` inside a `flex flex-wrap gap-2`. `type="button"` is mandatory — a bare `<button>` inside a `<form>` submits.
    - Below the switcher, a one-line muted `<p className="text-sm text-muted-foreground">{t(CHANNEL_DESC_KEYS[channel])}</p>` (the email one carries the "only the message text is editable, header/branding/footer are fixed" explanation).
    - Two `CHANNEL_LABEL_KEYS` / `CHANNEL_DESC_KEYS` `Record<ReminderChannel, string>` constants next to the existing `TYPE_TITLE_KEYS`.
    - The two `SettingsSection`s render `<ReminderTemplateField … />` per enabled locale for the **currently selected channel only**.
    - `onSubmit` builds the payload across **all three channels**: `REMINDER_CHANNELS.flatMap(c => REMINDER_TEMPLATE_TYPES.flatMap(type => enabledLocales.map(language => ({ type, language, channel: c, body: values[fieldName(c, type, language)] ?? '' }))))`. The `?? ''` is what preserves AD-9 for channels the admin never opened.
    - Everything else (`handleSubmit(onSubmit, onInvalid)`, the `onInvalid` toast, the `FormSkeleton` loading state, the inline Save button, the post-save `loadTemplates()` + `form.reset`) is unchanged. Do **not** wire this page into the shared `settings-form` / `settings-dirty` sidebar contract.
    - Do **not** pass `shouldUnregister: true` to `useForm` (AD-8 depends on the v7 default).
  - Both files must stay under 500 lines (expect ~200 and ~110).

- [x] **Step 9: Page metadata + template-editor i18n keys**
  - Files: `src/app/admin/settings/reminder-templates/page.tsx`, `src/components/admin/adminNavItems.ts` (verify only), `src/locales/{pl,en,uk}.json`
  - `page.tsx`: update `metadata.description` from `'Author SMS reminder body text per language'` to `'Author reminder body text per channel and language'`. Nothing else on this page changes (`enabledLocales` threading, the auth guard, the eyebrow header all stay).
  - `adminNavItems.ts` needs **no code change** — only the label copy behind `admin.nav.reminderTemplates` changes.
  - Locale edits (identical key sets in all three files):
    - **Change** `admin.nav.reminderTemplates` — it currently reads "Szablony SMS" / the SMS-specific equivalent, and this string is also the topbar page title. New: pl `"Szablony przypomnień"`, en `"Reminder templates"`, uk `"Шаблони нагадувань"`.
    - **Change** `admin.settings.reminderTemplates.pageDesc` to cover all channels, e.g. en: `"Edit the reminder message for each channel and enabled language."` (pl/uk equivalents).
    - **Add** under `admin.settings.reminderTemplates`: `channelSms`, `channelEmail`, `channelTelegram` (switcher labels — "SMS" / "Email" / "Telegram" is fine in all three locales), and `channelSmsDesc`, `channelEmailDesc`, `channelTelegramDesc`. The email description must state that only the message text is editable and that the email header, branding and footer stay unchanged; the SMS one keeps the cost framing; the Telegram one notes it is the full message text sent to the client's chat.
    - **Keep unchanged**: `section24hTitle`, `section2hTitle`, `transactionalOnlyNote`, `resetToDefault`, `segmentCounter`, `encodingGsm7`, `encodingUcs2`, `diacriticsHint`, `loadFailed`, `saveFailed`, `saveSuccess`.
  - **Footgun:** `scripts/i18n-check.mjs` only scans literal `t('…')` call sites (`CALL_REGEX`, line 59). Keys held in a `Record` constant (`TYPE_TITLE_KEYS`, and the new `CHANNEL_LABEL_KEYS`/`CHANNEL_DESC_KEYS`) are **invisible to it** — a typo there passes `i18n:check` and `tsc` and only shows up as a raw key string in the browser. Hand-verify every key in those records against `pl.json` after adding them.
  - Run `npm run i18n:check`.

- [x] **Step 10: Remove the locale keys this feature orphaned**
  - Files: `src/locales/{pl,en,uk}.json`
  - Steps 4 and 5 make five keys dead. Delete from **all three** files:
    - `emailNotif.reminder.heading`
    - `emailNotif.reminder.greeting`
    - `bot.reminder.heading24h`
    - `bot.reminder.heading2h`
    - `bot.reminder.details`
  - **Gate each deletion on a grep** over `src/` (and `tests/`) proving zero remaining references — do this *after* Steps 4/5 land, never before.
  - **Keep** `emailNotif.reminder.subject`, `.whenTomorrow`, `.whenSoon`, `.footer` (still used by the subject/footer, Step 4) and the whole `emailNotif.confirmation.*` block including `serviceLabel`/`masterLabel`/`dateLabel`/`timeLabel` — the reminder stopped using those four labels but the **confirmation** email still does. Deleting them would break a shipped, out-of-scope template.
  - Delete nothing else. This is a scoped orphan cleanup, not a locale audit — do not touch pre-existing unused keys you happen to notice (mention them in the feedback file instead).
  - Re-run `npm run i18n:check` (deleting the same keys from all three files keeps parity green).

- [x] **Step 11: SMS setup help panel**
  - Files: `src/app/admin/settings/notifications/SmsInstructions.tsx` (new), `src/app/admin/settings/notifications/SmsSettingsSection.tsx`, `src/locales/{pl,en,uk}.json`
  - `SmsInstructions.tsx` — `'use client'`, no props, `useTranslation()` only. Structure per AD-11: a small heading row (`<p className="text-sm font-medium">{t('admin.settings.sms.help.title')}</p>` + a muted subtitle) followed by three `<details>` blocks, all **closed by default**, using the exact markup from `src/components/admin/SmtpInstructions.tsx:21-36` (`className="group/details border rounded-lg overflow-hidden bg-card"`, the `<summary>` with `cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden`, and the `ChevronDown` with `group-open/details:rotate-180`). `ChevronDown` is a confirmed `lucide-react` export (already imported by `SmtpInstructions.tsx`). **No outer `<Card>`.** Each panel body is `<div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">` with one `<p>` per step. No `<button>` anywhere inside (see AD-11). Expect ~70 lines.
    - Panel 1 — Twilio: where to create the account, where the Account SID and Auth Token live in the Twilio console, which field each goes into, where the sender number comes from and that it must be E.164, and the trial-account "verified recipients only" gotcha.
    - Panel 2 — SMSAPI.pl: where to generate the OAuth2 token, which field it goes into, that a registered/approved sender name is required and where it comes from, and what happens without one.
    - Panel 3 — enabling/disabling: save credentials before testing (the test button is disabled while the form is dirty), send a test SMS to your own number, then turn on "Send SMS reminders" — and note that the 24h/2h reminder toggles above must also be on; turning the toggle off stops SMS immediately while credentials stay saved.
  - `SmsSettingsSection.tsx` — render `<SmsInstructions />` as the **first child** inside the existing `<SettingsSection>`, above the `notifSmsEnabled` toggle. That is the only change to this file; do not touch the fields, the test-send handler, or the `isDirty` gating.
  - Locale keys — add an `admin.settings.sms.help` object (inside the existing `admin.settings.sms` block, around line 845 of each file) with exactly these 18 keys in all three locales: `title`, `subtitle`, `twilioTitle`, `twilioStep1`–`twilioStep4`, `smsApiTitle`, `smsApiStep1`–`smsApiStep4`, `enableTitle`, `enableStep1`–`enableStep4`. Copy is written directly with `t('…')` literals, so `i18n:check` covers these.
  - Keep every string plain (no `<b>`/`<br/>` markup) so no `Trans` component is needed — plain `t()` only.
  - This step is independent of Steps 1-10 and can be implemented/reviewed on its own if the earlier steps stall.

- [x] **Step 12: Tests**
  - Files: `tests/lib/notifications/templates.test.ts`, `tests/lib/notifications/client-telegram.test.ts` (updated in Step 5)
  - `templates.test.ts`:
    - The `renderTemplate` / `validateTemplateBody` / `estimateSmsSegments` describes are **unchanged** — proof those helpers stayed channel-agnostic (AD-4).
    - Rewrite the `DEFAULT_REMINDER_BODIES` describe to loop `REMINDER_CHANNELS × REMINDER_TEMPLATE_TYPES × SUPPORTED_LANGUAGES`: every entry is non-empty, and every `{{token}}` it contains is in `TEMPLATE_PLACEHOLDERS`.
    - Add: every default body fits its channel's `MAX_BODY_LENGTH` (catches a default that the API would reject on first save).
    - Add: the six `sms` defaults are still ≤ 1 or 2 SMS segments via `estimateSmsSegments` — cheap regression guard on the cost-sensitive channel.
    - New `escapeHtml` describe: escapes `&`, `<`, `>`, `"`, `'`; `&` is escaped first so `<` does not become `&amp;lt;` (assert `escapeHtml('a & b <c>')` === `'a &amp; b &lt;c&gt;'`); a body with no special characters round-trips unchanged.
    - Add: `renderTemplate` + `escapeHtml` composed over an email default with a `&`-containing service name produces `&amp;` exactly once.
  - **Do not** add a Prisma-mocked test for `notifyBookingReminders()` / `reminders.ts` — the repo has no such harness (same call as the prior iteration).
  - **Do not** add a test for `email.ts` — it imports `sendEmail` from `@/lib/email`, which is why `escapeHtml` lives in `templates.ts` in the first place.
  - `npm run test` must stay green. Baseline: **39 files / 376 tests, 0 failures.** The test count will shift slightly (client-telegram rewrite + new templates cases) — that's expected; zero failures is the gate.

- [x] **Step 13: DOX pass (required before the task is done)**
  - `prisma/AGENTS.md` (line 20) — change "`channel` is `"sms"` only as of this iteration — the column exists so email/Telegram bodies can move onto the same table later without a migration" to record that all three channels (`sms | email | telegram`) now write rows, and that this landed **without a migration** exactly as the column was designed for. Keep the absent-row-means-default contract text.
  - `src/lib/AGENTS.md`:
    - line 20 (`reminders.ts`) — the cron now resolves **all three** channels' bodies from `NotificationTemplate`, with one `loadReminderTemplates(channel)` per enabled channel per run and a single shared `TemplateVars` per appointment.
    - line 22 (`templates.ts` / `template-store.ts`) — new `REMINDER_CHANNELS` / `ReminderChannel` / `MAX_BODY_LENGTH`, the channel-outermost `DEFAULT_REMINDER_BODIES` shape, `escapeHtml()` and *why* it lives here rather than in `email.ts`, and `resolveReminderBody()`'s new channel parameter. Note that `estimateSmsSegments` remains SMS-only.
    - line 19 (`notifications/` overview) — `client-telegram.ts` is now transport-only (takes pre-rendered text; no longer composes via `botT`).
    - line 30 (client-facing language resolution) — the reminder email/Telegram chrome is no longer built from `emailNotif.reminder.heading`/`.greeting` or `bot.reminder.*`; the reminder **body** comes from the template system while the email subject/header/footer still come from `emailNotif.*`. Confirmation copy is unchanged and still fully `emailNotif.*`-driven — make the reminder-vs-confirmation split explicit so nobody "restores" the deleted keys.
  - `src/app/api/AGENTS.md` (line 19) — `admin/reminder-templates` `GET` now returns all three channels (18 entries, no `?channel=` param) and `PUT` validates against `REMINDER_CHANNELS` with a per-channel length cap.
  - `src/app/admin/AGENTS.md`:
    - line 37 — the `reminder-templates/` description: three-channel editor with a hand-rolled segmented channel switcher (no Tabs primitive exists in this repo), the per-locale field extracted into `ReminderTemplateField.tsx`, the SMS-only segment counter, and the "blank field = default, only touched fields persist" invariant.
    - line 34 — note that `SmsSettingsSection.tsx` renders a co-located `SmsInstructions.tsx` help panel (native `<details>`, no Card, mirroring `src/components/admin/SmtpInstructions.tsx`).
  - `tests/AGENTS.md` — add a dated (2026-08-23) bullet for the multi-channel template coverage + `escapeHtml`, and record that `client-telegram.test.ts` was rewritten for the transport-only signature.
  - Report in the feedback file any AGENTS.md deliberately left unchanged and why.

---

## Acceptance Criteria

- [x] `npm run test` passes, 0 failures (baseline 39 files / 376 tests; counts may shift, failures may not) — final: 39 files / 382 tests, 0 failures
- [x] `npm run i18n:check` passes — pl/en/uk key sets identical, all literal `t()` references resolve
- [x] `npm run lint` shows zero new problems in any file this feature touches (pre-existing baseline: 79 problems, all in untouched files — cross-check paths, don't just compare totals) — final: still 79 problems, none in touched files
- [x] **No file under `prisma/migrations/` was created or modified, and `prisma/schema.prisma` changed by one comment line only**
- [x] Every touched/created file is under 500 lines
- [x] `DEFAULT_REMINDER_BODIES.sms.*` is character-for-character identical to the six strings shipped in the previous iteration
- [x] `DEFAULT_REMINDER_BODIES.telegram.*` reproduces the current `bot.reminder.heading* + "\n\n" + bot.reminder.details` output verbatim per locale — a salon that never opens the editor sees an identical Telegram reminder
- [x] The reminder email keeps its existing subject line, `<html lang>`, brand header row, and footer row byte-for-byte; only the middle content cell changed
- [x] The rendered email body is HTML-escaped exactly once, after substitution — a service or client name containing `&` or `<` renders literally and cannot break the layout
- [x] `estimateSmsSegments`, the segment counter, and the diacritics hint appear **only** on the SMS tab
- [x] Booking confirmation / cancellation / update / contact-form notifications are untouched on all channels; `notifications/index.ts`, `telegram.ts`, and `sms/` have no diff
- [x] `src/app/api/cron/reminders/route.ts` has no diff
- [x] Saving after editing one Email field does **not** write DB rows for any untouched channel/type/locale (AD-9 verified for all three channels, not just SMS)
- [x] Clearing a field on any channel deletes its row and restores the built-in default
- [x] The five orphaned locale keys are gone from all three files and grep confirms zero references
- [x] The SMS help panel renders collapsed by default inside the existing SMS settings section, does not submit the form when toggled, and every string comes from a locale key present in all three files
- [x] DOX pass completed (Step 13)

---

## Constraints & Risks

**Must not be touched**

- `prisma/migrations/`, `prisma/app.db` — AD-1 says this feature is migration-free. If the coder believes a migration is needed, that is a signal to **stop and report**, not to generate one.
- `src/app/api/cron/reminders/route.ts` — the `Bearer <CRON_SECRET>` guard and route shape (`src/app/api/AGENTS.md`).
- `src/lib/notifications/sms/*`, `src/lib/notifications/telegram.ts`, `src/lib/notifications/index.ts`, `src/app/api/admin/sms-settings/**` — the SMS transport, admin/salon Telegram, and credential handling are all out of scope.
- The confirmation/cancellation/update/contact-form email + Telegram templates and their `emailNotif.confirmation.*` keys.
- The `settings-form` / `settings-dirty` sidebar contract — `reminder-templates/` is deliberately a self-contained inline-save page; do not wire it in. `notifications/` **is** wired in and must stay wired in (Step 11 adds a display-only child, nothing that touches form state).
- `telegramBotToken`'s pre-existing plaintext storage and unmasked GET — known, out of scope.
- The raw-`NextResponse` 401 guards in `reminder-templates/route.ts` — explicitly noted-and-accepted in the previous review.

**Critical dependencies / ordering**

- Step 2 must land before Steps 3-8 compile (`REMINDER_CHANNELS`, `MAX_BODY_LENGTH`, `escapeHtml`, and the reshaped `DEFAULT_REMINDER_BODIES` are the shared contract).
- Steps 4 and 5 must land before Step 10 — the orphan-deletion grep is only valid after the last reference is gone.
- Step 11 is fully independent and may be done first or last.
- No new npm dependency is permitted. `lucide-react`, `react-hook-form`, `zod`, `sonner`, `@hookform/resolvers` are all already present; there is **no** Tabs/Accordion/Collapsible primitive and none may be added.

**Risks**

- *Reshaping `DEFAULT_REMINDER_BODIES` is a breaking change to four call sites.* `tsc` catches all four (`template-store.ts`, `route.ts`, `ReminderTemplatesForm.tsx`, `templates.test.ts`) — but only if the coder actually type-checks; `npm run lint` alone will not surface every one.
- *`resolveReminderBody()`'s new `channel` argument sits in the middle of the parameter list.* All three arguments after the map are strings/string-unions, so a mis-ordered call (`(map, type, lang)` left over from the old shape) may still type-check in some positions. Verify each of the three call sites in `reminders.ts` passes its own literal channel.
- *Telegram default drift.* If the six `telegram` defaults don't reproduce the current `bot.*` output exactly, every salon's Telegram reminder silently changes wording on deploy. Cross-check against `src/locales/*.json` before committing (Step 2's last bullet).
- *`client-telegram.test.ts` breaks by design.* It is not optional collateral — it must be updated in Step 5, in the same commit as the signature change.
- *Record-held i18n keys escape `i18n-check`.* `TYPE_TITLE_KEYS`, `CHANNEL_LABEL_KEYS`, `CHANNEL_DESC_KEYS` hold bare string literals outside any `t('…')` call, so `scripts/i18n-check.mjs` cannot see them. A typo passes every automated gate and surfaces as a raw dotted key in the UI. Hand-verify.
- *Deleting locale keys.* Low risk but irreversible-ish; each deletion is grep-gated in Step 10, and `emailNotif.confirmation.*` labels must survive (the reminder stopped using four of them, the confirmation email did not).
- *RHF unmounted-field values.* AD-8's channel switcher relies on react-hook-form v7's default `shouldUnregister: false` to keep values for channels the admin has navigated away from. If that flag is ever flipped, an edit made on the Email tab would vanish when the admin switches to Telegram and saves.
- *Form-binding footgun.* Inputs must be bound via `FormField`/`Controller` with explicit `value`/`onChange`/`onBlur`, never `register()` — `src/components/ui/input.tsx` / `textarea.tsx` are plain function components under React 18 and `register()`'s ref silently never attaches (documented 2026-08-07 bug in this exact folder). Applies to the extracted `ReminderTemplateField.tsx` too.
- *Bare `<button>` inside a form submits.* Both the channel switcher buttons and the placeholder chips need `type="button"` (the chips already have it — don't lose it in the extraction).
- *Help-panel copy accuracy.* Twilio's and SMSAPI.pl's console navigation paths can change. Keep the wording at the level of "Console → Account → API keys & tokens" rather than pixel-precise UI directions, and flag in the feedback file that the user should proofread the panel against their actual accounts.
- *Build/dev server.* Do **not** run `npm run dev` or `npm run build` — a one-shot build can corrupt `.next/` under the user's concurrently running dev server. Verify with `npm run test` / `npm run lint` / `npm run i18n:check` only.

**Manual verification the user will need to perform** (report this at the end of implementation, in Russian, informal "ты", per the project's reporting preference):

1. Restart the dev server (new/renamed files + locale changes).
2. Admin → Settings → Reminder templates: the page title/nav label is no longer SMS-specific; the SMS / Email / Telegram switcher works; all fields start **blank** with the default visible as grey placeholder text.
3. Confirm the segment counter + diacritics hint appear on the SMS tab only.
4. Edit one Email 24h field, save, reload — only that field keeps text; the others are still blank (i.e. no default text was persisted). `npx prisma studio` → `NotificationTemplate` should hold exactly one row.
5. Clear that field, save, reload — the row is gone and the default placeholder is back.
6. Create a booking ~2h out, hit `GET /api/cron/reminders` with the `CRON_SECRET` bearer token: the email arrives with the salon's header/footer intact and the custom body in the middle; the Telegram message matches the old wording exactly (if never customized); the SMS is unchanged. Call it a second time and confirm nothing re-sends.
7. Admin → Settings → Notifications: the SMS section now shows a collapsed "How to set this up" panel; expanding each of the three sections does not submit or reset the form; switch UI language to EN and UK and confirm the copy is translated.
