# Plan: consolidate Notification Bots into the Notifications settings page + compact master picker

**Date:** 2026-09-23
**Mode:** LIGHT (orchestrator-written; scope is well-understood — this is a rework of code built in
the previous session, not new architecture)

## User feedback (2026-09-22/23, screenshots)
1. Having a separate `/admin/settings/notification-bots` page (own sidebar nav entry) split from
   `/admin/settings/notifications` (the general bot's settings) is confusing — "не надо разносить
   это по разным вкладкам" (don't spread this across different tabs). Fold the additional-bots
   manager directly into the existing Notifications page, as a second section below the existing
   Telegram (general bot) section. Remove the separate admin nav entry and page.
2. The per-master scope checkbox list (one row per master, all masters listed vertically) is too
   sprawling ("зачем ты так расширяешь эту?"). Replace it with a compact dropdown multi-select:
   closed = one line showing a short summary, click opens a checklist, stays open while toggling
   multiple masters, closes on clicking the trigger again or clicking outside. **User confirmed this
   exact option** (as opposed to inline toggle-chips) via a preview.
3. Likely root cause of "bot token didn't save" / "notification didn't arrive at the new bot": the
   per-card Save button sits at the bottom of a tall card (past the master checklist), easy to miss
   — the user apparently didn't scroll to it. Not a backend bug (Stage 2/3 were reviewed and the
   token-persistence path is correct); the fix is making the flow harder to miss by putting it in the
   familiar Notifications-page context. No dispatch/persistence code changes are needed for this —
   confirmed by re-reading `bots-store.ts`'s `updateBot`/`createBot` token handling, which is correct.

## Scope — ADMIN surface only
The master's own page (`/admin/master/notification-bots`) has no other "notifications settings"
page to merge into — it stays exactly as-is, unchanged. This is purely an admin-side IA fix plus a
shared-component UI change (the master picker lives in `NotificationBotCard.tsx`, used by both
surfaces, but is only ever rendered when `canEditScope` is true, i.e. only on the admin surface —
so the master surface's rendered output is unaffected by the picker change too).

## Steps

- [x] Step 1: Fold `NotificationBotsManager` into the Notifications settings page
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Details: read the file first (it's a large RHF-bound form). Add a new
    `<SettingsSection title={t('admin.settings.notificationBots.sectionTitle')}
    description={t('admin.settings.notificationBots.sectionDesc')}>` block immediately after the
    existing "Telegram channel" `SettingsSection` (the one containing `notifTelegramEnabled`,
    `telegramBotToken`, `TelegramRecipientsField`), rendering
    `<NotificationBotsManager apiBase="/api/admin/notification-bots" canEditScope />` inside it.
    This section is **not** part of the `<form id="settings-form">`'s own submit — it manages its
    own state and saves via its own per-card Save buttons, exactly like `MasterCalendarField` rows
    already do inside `GoogleCalendarSettingsForm.tsx`'s single page. Import
    `NotificationBotsManager` from `@/components/admin/notification-bots/NotificationBotsManager`.
  - Do not touch any existing field/logic in this form — additive only.

- [x] Step 2: Delete the now-orphaned admin page + its nav entry
  - Files: delete `src/app/admin/settings/notification-bots/page.tsx` and
    `src/app/admin/settings/notification-bots/loading.tsx` (and the now-empty directory);
    `src/components/admin/adminNavItems.ts` — remove the `notificationBots` entry from
    `adminNavItems` (the admin list) only. **Leave the `masterNavItems` entry untouched** — the
    master page is not moving.
  - The API routes under `src/app/api/admin/notification-bots/**` are unchanged (still used by the
    now-embedded component).

- [x] Step 3: Compact master multi-select — new `MasterMultiSelect.tsx`
  - Files: `src/components/admin/notification-bots/MasterMultiSelect.tsx` (new)
  - Details: replaces the inline `masters.map(...)` checkbox-list block currently in
    `NotificationBotCard.tsx` (the `scope === 'SELECTED'` branch inside the `canEditScope` arm).
    Props: `{ masters: MasterOption[]; selectedIds: string[]; onChange: (ids: string[]) => void }`.
    Behavior (user-confirmed shape):
    - Closed state: a single-line button styled like the existing `Input`/`Select` trigger
      (`h-9`, bordered, rounded, `max-w-xs` to match the `Select` next to it), showing a summary:
      0 selected → `t('admin.settings.notificationBots.noMastersSelected')`; else the first
      selected master's name, plus `+N` when more than one is selected (e.g. `"Anna +2"`) — new key
      `admin.settings.notificationBots.mastersSelectedSummary` with `{{name}}`/`{{count}}`
      interpolation (see i18n step for exact shape), or reuse `scopeSummarySelected`'s `{{names}}`
      joined-list style if that reads better at a glance — coder's call, keep it one line.
    - Click toggles an `open` boolean; when open, render an absolutely-positioned panel
      (`absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-md`, matching
      `ProcedureSelect.tsx`'s dropdown-panel styling for visual consistency) containing one
      `Checkbox` + label row per master (reuse the existing `Checkbox` UI component, same as
      today's list) — clicking a checkbox toggles that master via `onChange` and does **not**
      close the panel.
    - Closing: clicking the trigger button again toggles `open` closed; **and** a standard
      click-outside close — a `useRef` on the outer wrapper + a `useEffect` adding a `mousedown`
      listener on `document` while `open` is true, closing when the click target is outside the
      ref (plain vanilla React, no new dependency; remove the listener in the cleanup and when
      `open` becomes false). Do not reuse `ProcedureSelect.tsx`'s "click hits the parent's own
      background" technique — that only works because that component owns a large empty click
      target; here the picker sits inside a dense card with many other controls, so it needs a
      real outside-click listener.
    - `masters.length === 0` → keep showing `t('admin.settings.notificationBots.noMasters')`
      below the trigger (as today), trigger disabled.
    - Keep the whole file well under 500 lines — it should land around 60-90 lines.

- [x] Step 4: Wire `MasterMultiSelect` into `NotificationBotCard.tsx`
  - Files: `src/components/admin/notification-bots/NotificationBotCard.tsx`
  - Details: replace the `{scope === 'SELECTED' && (<div className="flex flex-col gap-1.5 mt-1">
    {masters.map(...)} ...</div>)}` block with
    `{scope === 'SELECTED' && <MasterMultiSelect masters={masters} selectedIds={masterIds}
    onChange={setMasterIds} />}`. Delete the now-unused `toggleMaster` function and the `Checkbox`
    import if nothing else in this file uses it (check before removing). Everything else in this
    file (save/test/delete logic, token handling, recipients field) is untouched.

- [x] Step 5: i18n
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: add whatever new key(s) `MasterMultiSelect` ends up needing (a "no masters selected"
    placeholder and a compact summary string — exact keys per Step 3's implementation) to the
    existing `admin.settings.notificationBots` group in all three files, key-identical, real
    translations (not pl-copies) for en/uk. Run `node scripts/i18n-check.mjs` after.

- [x] Step 6: Verification
  - Commands: `npm run lint` (zero warnings), `npm run test`, `node scripts/i18n-check.mjs`. Do
    **not** run `npm run dev` or `npm run build`.
  - Confirm via `npx eslint` on every touched/new file individually too (fast, catches issues in
    files the full lint run's pre-existing 79-problem baseline could mask).

- [x] Step 7: DOX pass
  - Files: `src/app/admin/AGENTS.md`, `src/components/AGENTS.md` (whichever currently documents
    the notification-bots pages/components from the previous session — find and update, don't
    duplicate). Update: additional bots now live inside `/admin/settings/notifications` (no
    separate admin page/nav entry — only the master surface still has its own page), and the new
    `MasterMultiSelect` component. Remove any stale reference to the deleted admin page.

## Explicitly out of scope
- No change to the master's own `/admin/master/notification-bots` page or its nav entry.
- No change to `bots-store.ts`, any API route, the dispatch helper (`bots.ts`), or any of the four
  notifiers — Stage 2/3 backend logic is correct and untouched.
- No change to `BotRecipientsField.tsx`.
- No new npm dependency.

## Manual verification (чеклист для пользователя)
1. Зайди в `/admin/settings/notifications` — должен появиться новый раздел с ботами прямо под
   существующим Telegram-блоком, отдельного пункта "Notification bots" в меню больше нет.
2. Создай/отредактируй бота, выбери "SELECTED", открой выбор мастеров — должен открываться
   компактный список, в закрытом виде — одна строка с кратким summary.
3. **Обязательно нажми Save на самой карточке бота** (она видна сразу на этой странице, без
   отдельного перехода) — проверь, что токен сохранился (обнови страницу, поле токена должно
   показывать плейсхолдер "оставить пустым, чтобы сохранить текущий", а не требовать токен заново).
4. Сделай тестовую запись у мастера, входящего в охват бота — сообщение должно прийти. У мастера
   НЕ входящего в охват — не должно.
5. Проверь мастерскую страницу `/admin/master/notification-bots` — она не изменилась, должна
   работать как раньше.
