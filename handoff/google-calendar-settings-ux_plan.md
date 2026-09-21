# Plan: Google Calendar settings page — UX fixes

Mode: LIGHT (orchestrator-authored). UI-only: no schema, no API contract change, no Stage 2. Follow-up to Stage 1 (`handoff/google-calendar-sync_plan.md`), found by the user testing `/admin/settings/google-calendar` live (sync itself works end to end).

## Problems (user feedback)

1. **No Save button in the sidebar.** The form already renders `<form id="settings-form">` and dispatches `settings-dirty`, but `/admin/settings/google-calendar` is missing from `SETTINGS_SAVE_BRIDGE_ROUTES` in `src/components/admin/AdminSidebar.tsx`, so the sidebar button never renders. The only Save is an inline button at the very bottom of the page (below the masters list) — the user had to scroll to find it.
2. **The key has to be pasted as text.** The user wants to upload the downloaded `.json` file instead.
3. **The "Service account email" only appears after saving** ("Appears after a valid key is saved.") — confusing. In the JSON file this value is called `client_email`, not "service account email", which made the label unrecognisable.
4. "Test connection" is disabled until the key is saved, with no explanation.

## Files

| File | Change |
|---|---|
| `src/components/admin/AdminSidebar.tsx` | add the route to `SETTINGS_SAVE_BRIDGE_ROUTES` + fix the comment above it if it mentions which pages qualify |
| `src/app/admin/settings/google-calendar/ServiceAccountKeyField.tsx` | NEW — file upload + client-side preview |
| `src/app/admin/settings/google-calendar/GoogleCalendarSettingsForm.tsx` | use the new field; show the email immediately; hint on Test button (now 304 lines — must stay < 500) |
| `src/locales/{pl,en,uk}.json` | new/changed `admin.settings.googleCalendar.*` keys |
| `src/app/admin/AGENTS.md` | update the settings-bridge/Google Calendar wording |

## Steps

### [x] Step 1 — sidebar Save button

Add `'/admin/settings/google-calendar'` to `SETTINGS_SAVE_BRIDGE_ROUTES`. `GoogleCalendarSettingsForm.tsx` already wires the bridge (`id="settings-form"` + `settings-dirty` effect), so this is correct. KEEP the existing inline Save button at the bottom of the form as well (harmless, mirrors other bridged pages' behaviour of having a fallback). Update the comment above the constant only if it becomes inaccurate. Check `src/app/admin/AGENTS.md`'s wording about which pages use the bridge (bullet starting "Some `settings/` forms … drive the shared sidebar 'Save Settings' button") and add Google Calendar to the bridged list, removing any statement that it is self-contained.

### [x] Step 2 — `ServiceAccountKeyField.tsx` (file upload)

A client component used inside the react-hook-form `FormField` for `serviceAccountKey` (keep the field name and the `MASK` behaviour: when a key is already saved the value is `'••••••••'`; saving the mask keeps the existing key, exactly as today).

Props (suggested; adapt to the form's needs): `{ value: string; onChange: (v: string) => void; hasKey: boolean; onParsedEmail: (email: string | null) => void }`.

Behaviour:
- Primary control: a visible button "Choose JSON key file" (`t('admin.settings.googleCalendar.chooseFileBtn')`) wired to a hidden `<input type="file" accept=".json,application/json">`. On select: `file.text()` (or FileReader), enforce a size cap (reject > 16 KB with the invalid message), `JSON.parse` in try/catch, require `type === 'service_account'` and non-empty string `client_email` and `private_key` — **reuse `parseServiceAccountKey` from `src/lib/google-calendar/config.ts` if it is pure and free of Node-only imports (check its imports first)**; otherwise implement the same three checks locally. On success: call `onChange(rawText)` **and mark the form dirty** (the parent must call `form.setValue('serviceAccountKey', text, { shouldDirty: true, shouldValidate: true })` or equivalent — make sure the sidebar Save button becomes enabled), call `onParsedEmail(client_email)`, and show a confirmation line `t('admin.settings.googleCalendar.fileLoaded', { name: file.name })` with the parsed email. On failure: `toast.error(t('admin.settings.googleCalendar.fileInvalid'))`, do not change the value. Reset the input's `value` after each pick so choosing the same file twice re-fires.
- **Never render the private key.** The loaded text lives only in form state; do not show it in any textarea/preview. When a key is already saved (`hasKey`) and nothing new was picked show `t('admin.settings.googleCalendar.keyConfiguredHint')` as today.
- Fallback: keep the existing paste `Textarea` inside a native `<details>` labelled `t('admin.settings.googleCalendar.pasteInsteadLabel')` (closed by default), bound to the same form value, same `MASK` select-on-focus behaviour. When the user types/pastes valid JSON there, also call `onParsedEmail` with the parsed email (silently ignore invalid text — the server still validates on save).
- Inputs bound via `FormField`/`Controller` `value`/`onChange`/`onBlur` (never `register()` — see `src/app/admin/AGENTS.md`).
- Accessibility: the button has visible text; the hidden input has `aria-label` (same key as the button).

### [x] Step 3 — `GoogleCalendarSettingsForm.tsx`

- Replace the inline `Textarea` `FormField` body with the new component (keep `FormField`, label `keyLabel`, description).
- New state `pendingEmail: string | null` set via `onParsedEmail`; the email row shows `pendingEmail ?? serviceAccountEmail`; when it shows `pendingEmail` (i.e. not yet saved) append the muted hint `t('admin.settings.googleCalendar.emailNotSavedHint')`. The Copy button is enabled whenever an email is shown. Clear `pendingEmail` after a successful save (the `load()` already refreshes `serviceAccountEmail`) and when `form.reset` runs.
- Email row label: `t('admin.settings.googleCalendar.serviceAccountEmailLabel')` must now say it is the `client_email` field of the JSON (see i18n). Empty placeholder text becomes "Load the JSON key file to see it." (pl/en/uk).
- Under the Test connection button, when the button is disabled because no key is saved yet or the form is dirty with an unsaved key, show a short muted hint `t('admin.settings.googleCalendar.testAfterSaveHint')` ("Save first, then test the connection."). Do not change the test logic.
- The file must stay < 500 lines (extract if needed).

### [x] Step 4 — i18n (pl / en / uk, all three, same key order; `npm run i18n:check` must pass)

Add: `chooseFileBtn` (en "Choose JSON key file"), `fileLoaded` (en "Loaded: {{name}}"), `fileInvalid` (en "This is not a valid Google service-account key file (expected the downloaded .json with client_email and private_key)."), `pasteInsteadLabel` (en "Or paste the JSON text instead"), `emailNotSavedHint` (en "Read from the file — not saved yet."), `testAfterSaveHint` (en "Save first, then test the connection.").
Change (all three languages): `serviceAccountEmailLabel` → en "Service account email (`client_email` in the JSON file)" (no markdown/HTML — plain text); `serviceAccountEmailEmpty` → en "Load the JSON key file to see it."; `keyDesc`/`keyLabel`/`keyPlaceholder` and any text in the setup-guide (`GoogleCalendarInstructions.tsx` and its locale strings) that says to "copy the whole JSON and paste it" → say to **upload the downloaded `.json` file with the button** (paste remains only as an alternative). Grep the locale files for "paste"/"wklej"/"встав" style wording under `admin.settings.googleCalendar.*` and fix each. Keep Polish/Ukrainian natural and consistent with neighbouring strings.

### [x] Step 5 — DOX

`src/app/admin/AGENTS.md`: reflect that the Google Calendar settings form is bridged (sidebar Save) and uploads the key file (client-side parse, key never rendered, paste fallback). Keep it short; remove stale text ("inline save only", "paste the JSON") if present in any AGENTS.md (grep `google-calendar` across AGENTS.md files).

## Non-goals

No API/route changes, no schema change, no Stage 2, no change to the master calendar-ID fields, no change to how the key is encrypted or returned (still never returned), no layout-jitter investigation (separate deferred item).

## Verification (coder)

1. `npx tsc --noEmit` clean.
2. `npx vitest run` green (report totals; add no tests unless you extract a pure helper worth a tiny test).
3. `npm run i18n:check` passes.
4. `npx eslint` on every touched/new file: no NEW errors.
5. `wc -l` on touched/new files < 500.
6. Grep proof: `/admin/settings/google-calendar` appears in `SETTINGS_SAVE_BRIDGE_ROUTES`; the private key is not rendered anywhere in the new component (no `{...key...}` in JSX, no preview textarea outside the fallback `<details>`).
7. Do NOT run dev/build, no browser, no git stash, no commit. Append a status/results section at the bottom of this file.

## Status / Results (coder)

Steps 1-5 done. Verification: `npx tsc --noEmit` clean; `npx vitest run` 48 files / 486 tests passed; `npm run i18n:check` PASS (1466 keys x3); `npx eslint` on the google-calendar settings folder + AdminSidebar.tsx: no output (clean); line counts: Form 313, ServiceAccountKeyField 120, AdminSidebar 269 (all < 500). Grep: `/admin/settings/google-calendar` is in `SETTINGS_SAVE_BRIDGE_ROUTES`; the key text is never in JSX (only inside the fallback `<details>` Textarea, and even there hidden while a file-loaded key is active).

Decisions / deviations:
- `parseServiceAccountKey` (config.ts) is pure (no imports), reused client-side. It additionally requires `private_key` to contain `BEGIN PRIVATE KEY` (stricter than the plan's non-empty check) - same rule as the server.
- File size cap is 8192 bytes, not 16 KB, to match the form schema `max(8192)` (a bigger file could never be saved).
- While a file-loaded key is active, the paste Textarea shows empty (value not echoed) so the private key is never rendered; typing there replaces the loaded key.
- `KEY_MASK` is now exported from ServiceAccountKeyField.tsx and imported by the form (aliased `MASK`).
- `keyConfiguredHint` moved into the new component (hidden once a file is loaded); form keeps `keyClearHint`, reworded to point at the paste `<details>` (removal is only possible via clearing the pasted field).
- Test button disable logic unchanged; the `testAfterSaveHint` shows when `!hasKey` or the key field is dirty.
- Sidebar comment above the constant left as is (still accurate). `keyPlaceholder` unchanged. DOX: `src/app/admin/AGENTS.md` (Google Calendar bullet + bridged-forms bullet) updated; no other AGENTS.md mentioned inline-save/paste wording.
