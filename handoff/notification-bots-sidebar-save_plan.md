# Plan: wire bot-card edits into the sidebar "Save Settings" button

**Date:** 2026-09-23
**Mode:** LIGHT (orchestrator-written; own code from this session, well-understood scope)

## User's request
On `/admin/settings/notifications`, editing a bot card (label/token/enabled/scope/recipients)
does not enable the sidebar "Save Settings" button (`AdminSidebar.tsx`'s bridged submit button,
`form="settings-form"`, `disabled={!isDirty}`) or the page's own inline bottom "Save" button —
both only track `formState.isDirty` from the RHF-bound settings fields, unaware that
`NotificationBotsManager`'s cards manage their own independent local state. The user wants
editing a bot to also enable these buttons, and clicking them to actually save the bot changes
too — "как и везде" (like everywhere else on the site).

## Root cause found by the orchestrator (verify, don't just trust)
- `AdminSidebar.tsx`'s `isDirty` state is **last-write-wins**: `document.addEventListener(
  'settings-dirty', (e) => setIsDirty(e.detail.isDirty))`. There is no aggregation across
  multiple dispatchers — if `NotificationBotsManager` dispatched its own `settings-dirty` event
  independently of `NotificationSettingsForm`'s existing one (`useEffect` on `formState.isDirty`),
  the two would race and whichever fires last would silently overwrite the other's signal. **Do
  not add a second dispatcher.** There must be exactly one dispatch site, combining both signals.
- `NotificationSettingsForm.tsx` line 328 has its own inline submit button
  (`disabled={isSaving || !formState.isDirty}`) separate from the sidebar-bridged one — both need
  the combined signal, not just the sidebar one.
- Clicking the sidebar button does a **native form submit** targeting
  `<form id="settings-form">` — it does not know about the bot cards' independent per-card
  `fetch` calls. `onSubmit` must explicitly also trigger any dirty card's save.

## Design
1. **`NotificationBotCard.tsx`** — convert to `React.forwardRef`, exposing via
   `useImperativeHandle`:
   ```ts
   export interface NotificationBotCardHandle {
     isDirty: boolean
     save: () => Promise<void>
   }
   ```
   - `save` is the exact same internal `save()` function already wired to the Save button's
     `onClick` — just also reachable via the ref. No change to its internal logic/error handling.
   - `isDirty` computed each render (no new state, derive from existing `label`/`token`/`enabled`/
     `scope`/`masterIds`/`recipients` local state vs. the `bot` prop):
     - Existing bot (`bot !== null`): `label.trim() !== bot.label || token.trim() !== '' ||
       enabled !== bot.enabled || (canEditScope && (scope !== bot.scope ||
       !idsEqual(masterIds, bot.masterIds))) || !recipientsEqual(recipients, bot.recipients)`.
       `idsEqual`/`recipientsEqual` are small local helpers (sorted-array / normalized-JSON
       compare — order-insensitive for `masterIds` via a sorted copy; `recipientsEqual` trims
       `chatId`/`label` and compares in order, good enough for normal add/edit/remove usage).
     - New draft (`bot === null`): dirty iff it has **meaningful** content — `label.trim() !== ''
       || token.trim() !== '' || recipients.some(r => r.chatId.trim() !== '') || (canEditScope &&
       scope === 'SELECTED' && masterIds.length > 0)`. An untouched freshly-added draft must NOT
       be dirty (clicking "Add bot" then never touching it must not make Save Settings try to
       save an empty draft and surface a validation toast).
   - Everything else in this file (all the JSX, the Test/Delete buttons, the token-mask placeholder,
     the scope checkboxes, `MasterMultiSelect`) is untouched. Update the default export to
     `React.forwardRef(...)` and give it a `displayName` (repo convention — check `BookingManagement.tsx`
     for the exact `forwardRef` + `displayName` shape already used elsewhere in this codebase).

2. **`NotificationBotsManager.tsx`**:
   - `React.forwardRef` exposing `useImperativeHandle(ref, () => ({ saveAllDirty }))`:
     ```ts
     export interface NotificationBotsManagerHandle { saveAllDirty: () => Promise<void> }
     ```
     `saveAllDirty` collects every mounted card ref (bots + drafts) from a `Map<string,
     NotificationBotCardHandle>`, calls `.save()` on every one whose `.isDirty` is true (in
     parallel via `Promise.all`), then `load()`s once at the end. Each card's own `save()` already
     toasts its own success/failure and leaves the card's local state as-is on failure (per its
     existing behavior) — no new error-aggregation UI needed here.
   - New optional prop `onDirtyChange?: (dirty: boolean) => void`. Track dirty card ids in a
     `React.useState<Set<string>>`; each rendered `<NotificationBotCard>` gets a new
     `onDirtyChange={(dirty) => setDirtyIds((prev) => { ... add/remove this card's key ... })}`
     prop that the card calls from a `useEffect` on its own computed `isDirty` (so the card
     doesn't need to know about the Set, just reports its own boolean). A `useEffect` on the
     aggregated `dirtyIds.size` calls `props.onDirtyChange?.(dirtyIds.size > 0)`.
   - Use a stable per-card key for both the `ref` Map and the dirty-tracking Set — bots use
     `bot.id`, drafts use their existing `draft-N` id (already the `key` prop today).
   - `NotificationBotCard`'s `Props` interface gains `onDirtyChange?: (dirty: boolean) => void`.

3. **`NotificationSettingsForm.tsx`**:
   - `const botsManagerRef = React.useRef<NotificationBotsManagerHandle>(null)` and
     `const [botsDirty, setBotsDirty] = React.useState(false)`.
   - Pass `ref={botsManagerRef}` and `onDirtyChange={setBotsDirty}` to `<NotificationBotsManager>`.
   - Derive `const isDirty = formState.isDirty || botsDirty` once, near the existing
     `formState`/`telegramEnabled` derivations. Use it in exactly two places:
     - The `settings-dirty` dispatch effect (line ~96-100): `detail: { isDirty }`, dependency
       array `[isDirty]`.
     - The inline bottom submit button (line 328): `disabled={isSaving || !isDirty}`.
   - **Do not touch** `SmsSettingsSection`'s `isDirty={formState.isDirty}` prop (line 279) — that
     is a different, unrelated usage; leave it exactly as `formState.isDirty`.
   - In `onSubmit`, after the existing successful PATCH + `form.reset(...)` block, add
     `await botsManagerRef.current?.saveAllDirty()`. Keep this inside the existing `try` so a
     thrown error still lands in the existing `catch`/toast path; a bot-save failure itself
     doesn't throw (each card's `save()` catches internally), so this call effectively can't
     abort the main settings save — it runs, toasts per-card outcomes, and returns.

## Explicitly out of scope
- No change to `AdminSidebar.tsx` itself (its `settings-dirty` listener and button are already
  correct once there's exactly one well-formed dispatcher).
- No change to the master's own `/admin/master/notification-bots` page — it has no
  `SETTINGS_SAVE_BRIDGE_ROUTES` entry and no `<form id="settings-form">`, so this bridge doesn't
  apply there; the master page keeps working exactly as it does today (per-card save only).
- No retrofit of `MasterCalendarField`/Google Calendar's settings page to this same pattern —
  not asked, don't touch it.
- No change to `NotificationBotCard`'s validation/error-handling logic, only how it's invoked.

## Verify
- [x] `npx tsc --noEmit` clean (forwardRef/useImperativeHandle typing is correct).
- [x] `npm run lint` clean on every touched file.
- [x] `npm run test` green (existing suites unaffected — no test currently renders these
      components with React Testing Library, so no test file should need changes; if one does,
      report why rather than loosening an assertion).
- [ ] Manual verification (relay to user, in Russian): edit a bot's label only (don't click its
      own Save) → sidebar button and the bottom Save button should both light up → click either
      one → the bot's change is persisted (reload the page, confirm) and the main settings save
      also went through. Add a new empty draft via "Add bot" and don't touch it → Save Settings
      must NOT light up because of it. Type a few characters into a new draft's label → Save
      Settings lights up → clicking it creates the bot.
