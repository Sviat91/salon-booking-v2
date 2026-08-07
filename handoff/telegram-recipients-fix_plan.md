# Plan: Telegram notification-recipients — fix silently-blocked Save

**Date:** 2026-08-07
**Status:** In Progress

## Goal

Make "Save Settings" on `/admin/settings/notifications` actually submit when a recipient chat ID has text in it, by replacing the `register()`-based binding in `TelegramRecipientsField.tsx` with the codebase's proven `Controller`-based binding, and make any future validation failure visible instead of silent.

---

## Root Cause — verified, not guessed

This was traced through the installed sources, not inferred from docs. Evidence paths are listed so the coder/reviewer can re-verify.

### The failure chain

**1. `Input` is not `forwardRef`-wrapped, and this project is React 18.**

- `src/components/ui/input.tsx` L6: `function Input({ className, type, ...props }: React.ComponentProps<"input">)` — a plain function component.
- `package.json` L43/L63: `"react": "^18.3.1"`, `"@types/react": "^18.3.3"`.

Under React 18, `ref` is a **reserved prop**: `react/jsx-runtime` strips it out of `props` and stores it on the element. React only attaches it for host / class / `forwardRef` / `memo(forwardRef)` fibers. For a bare function component it logs `Warning: Function components cannot be given refs. Attempts to access this ref will fail.` and **never invokes the ref callback**. It also never reaches `InputPrimitive` via `{...props}`, because it was already removed from `props`.

(Base UI's own primitive *is* `React.forwardRef` — `node_modules/@base-ui/react/input/Input.js` L18 — so this is purely the local wrapper's doing. `@base-ui/react` v1 is written React-19-style, where `ref` is an ordinary prop; on React 18 that assumption does not hold.)

**2. Therefore RHF's `register()` ref never fires, and `_f.ref` stays a stub.**

`register(name)` sets `_fields[name]._f = { ref: { name }, name, mount: true, ... }` at call time and only upgrades `_f.ref` to the real DOM node inside the returned `ref` callback. That callback never runs here, so `_f.ref` remains the plain object `{ name: 'recipients.0.chatId' }`.

**3. RHF reads the typed value off `_f.ref`, not off the event — so every keystroke writes `undefined`.**

In `createFormControl`'s change handler (verified in `node_modules/react-hook-form/dist/index.esm.mjs.map`):

```js
const fieldValue = target.type
  ? getFieldValue(field._f)
  : getEventValue(event);
...
set(_formValues, name, fieldValue);
```

For a real DOM `<input type="text">`, `target.type === 'text'` → truthy → it takes the `getFieldValue(field._f)` branch. And `getFieldValue` ends with:

```js
return getFieldValueAs(isUndefined(ref.value) ? _f.ref.value : ref.value, _f);
```

`_f.ref` is `{ name }`, so `ref.value` is `undefined` and `_f.ref.value` is `undefined` → `getFieldValueAs(undefined, _f)` returns `undefined`.

**Net effect: typing "12345" into the chat ID box sets `_formValues.recipients[0].chatId = undefined`, not `"12345"`.**

**4. `undefined` fails the zod schema — but only for `chatId`.**

`recipient-schema.ts`: `chatId: z.string().trim().max(64)` is **required**, so `undefined` → `invalid_type` ("Required"). `label: z.string()....optional()` **accepts** `undefined`, and `dbId` is never registered so it keeps its real value. This is exactly why the bug is specific to the chat ID box and not the label box.

**5. The validation failure is 100% invisible.**

- `NotificationSettingsForm.tsx` L222 calls `form.handleSubmit(onSubmit)` with **no `onInvalid` second argument**. RHF's handler does `if (onInvalid) { await onInvalid(...) } _focusError(); setTimeout(_focusError);` — with no `onInvalid` that whole branch is a no-op.
- `_focusError` → `_focusInput = (ref, key) => { if (get(_formState.errors, key) && ref.focus) { ref.focus(); return 1 } }` — `_f.ref` is `{ name }` with no `.focus`, so even the focus fallback silently does nothing.
- There is **no `<FormMessage />`** anywhere in the recipients block, so nothing renders the error.
- `isSaving` is set inside `onSubmit`, which never runs → the button label never changes to "Saving…".

**Result: click Save → no fetch, no toast, no error text, no button change. Exactly the reported symptom.**

### Why the "clears back to empty and it works again" detail is consistent

`isDirty` compares `undefined` against the default `''`, so typing *does* enable the button — the user sees an enabled button that does nothing. Any path that puts a real string back into `_formValues.recipients[i].chatId` restores Save: a page reload (`form.reset` writes `''`), or hitting the trash icon so the auto-repair `useEffect` re-`append`s a fresh `{ dbId: null, chatId: '', label: '' }`. Both write through RHF's own APIs, which bypass the broken `getFieldValue` path entirely. Simply deleting the characters does **not** repair it (that keystroke also writes `undefined`), which is why the behaviour felt intermittent across the three earlier rounds.

### Why `Controller` / `FormField` works where `register()` cannot

`useController`'s `onChange` (verified in the same sourcemap) deliberately fabricates a **type-less** target:

```js
const onChange = React.useCallback(
  (event) => _registerProps.current.onChange({
    target: { value: getEventValue(event), name },
    type: EVENTS.CHANGE,
  }), [name]);
```

`target.type` is `undefined` → falsy → `createFormControl` takes the `getEventValue(event)` branch and gets the **real typed string**. `_f.ref` is never consulted for the value. And `useController`'s own ref callback is guarded (`if (field && field._f && elm)`), so a dropped ref is harmless.

This is precisely why `telegramBotToken`, `clientBotToken`, etc. already work on these same pages with the same non-`forwardRef` `Input`. `TelegramRecipientsField.tsx` is the **only** file in `src/` that uses `register()` (verified: `grep '{\.\.\.register('` → 2 hits, both in that file), so there was never a working precedent — it was a novel, untested combination.

---

## Architecture Decisions

**D1 — Bind the recipient inputs with `FormField` (the codebase's `Controller` wrapper), not `useController`, and not raw `register()`.**
`FormField` from `@/components/ui/form` is literally `<FormFieldContext.Provider><Controller {...props} /></FormFieldContext.Provider>` (`form.tsx` L29–40). A context provider emits no DOM, so the existing `flex items-center gap-2` row layout and `flex-1` sizing are untouched. Using `FormField` keeps the whole file consistent with every other form in the project. `useController` would work identically but introduces a third binding style into a codebase that only has one.

**D2 — Do NOT use `FormItem` / `FormControl` / `FormMessage` inside the rows.**
`FormControl` and `FormMessage` call `useFormField()`, which reads `FormItemContext` for an `id`. Without a `FormItem` ancestor that context is `{}` and the generated ids become the literal string `"undefined-form-item"`. Adding `FormItem` per input would inject an extra `<div className="space-y-2">` into each flex row and break the two-inputs-plus-trash-button layout. `FormField`'s `render` prop already exposes `fieldState` directly if an error ever needs displaying, with no context dependency.

**D3 — Never spread the whole `field` object onto `Input`; pass `name`/`value`/`onChange`/`onBlur` explicitly.**
Spreading includes `field.ref`, which under React 18 triggers the "Function components cannot be given refs" dev warning for no benefit (Controller does not need the ref here). Being explicit also documents at the call site *why* this is not `{...field}`.

**D4 — Do NOT modify `src/components/ui/input.tsx`.**
Wrapping it in `React.forwardRef` would technically also fix this (Base UI's primitive already forwards refs) and would silence the warning app-wide — but it changes a primitive used by every form in the project, and it would change `_f.ref` for *all* existing Controller fields from a `{ name }` stub to a live `{ focus, select, setCustomValidity, reportValidity }` object, altering error-focus behaviour everywhere. After three failed rounds the correct move is the change with zero blast radius outside this feature. Recorded as a known constraint in the docs instead.

**D5 — Add an `onInvalid` handler to `handleSubmit`.**
The deepest reason this bug survived three rounds is that a failed submit is indistinguishable from a dead button. `handleSubmit(onSubmit, onInvalid)` converts every future validation failure into a visible toast plus a console entry naming the offending fields. This is the meta-fix and is not optional.

**D6 — Add `maxLength` to the recipient inputs.**
After D1, the only remaining way `recipientSchema` can reject a row is `.max(64)`. Capping input length at the DOM level makes that unreachable by typing, so the recipients block cannot block Save again.

**D7 — Extract the create/update/delete diff into a pure module and unit-test it.**
There is no `@testing-library/react` in `package.json` and `vitest.config.ts` uses `environment: 'node'`, so component-level tests are impossible. The blank-row create/update/delete semantics are the other genuinely risky part of this feature and they are pure data → extracting them is the only way to get regression coverage. `tests/AGENTS.md` L21 already establishes the `tests/app/admin/**` mirror precedent for exactly this (`calendar-utils.test.ts`). This is a **behaviour-preserving extraction** — see Step 3 for the exact semantics that must be reproduced.

---

## Implementation Steps

- [x] **Step 1: Rebind the recipient row inputs to `FormField`**
  - Files: `src/app/admin/settings/notifications/TelegramRecipientsField.tsx`
  - Change the react-hook-form import to `import { useFieldArray } from 'react-hook-form'` — drop `useFormContext` and delete the `const { register } = useFormContext<FormValues>()` line (it becomes an orphan).
  - Add `import { FormField } from '@/components/ui/form'`.
  - Rename the `fields.map((field, index) => ...)` callback parameter from `field` to `row` (and `key={field.id}` → `key={row.id}`) so it does not shadow the `field` handed to `FormField`'s render prop.
  - Replace each of the two `<Input {...register(...)} />` elements with a `FormField`. Exact binding shape (the `value`/`onChange`/`onBlur`/`name` split and the **absence** of `{...field}` / `field.ref` is the load-bearing part):
    ```tsx
    <FormField
      control={control}
      name={`recipients.${index}.chatId` as const}
      render={({ field }) => (
        <Input
          name={field.name}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          maxLength={64}
          placeholder={t('admin.settings.notifications.recipientChatIdPlaceholder')}
          className="flex-1"
        />
      )}
    />
    ```
    …and the mirror of it for `` `recipients.${index}.label` `` with `recipientLabelPlaceholder`, also `maxLength={64}`.
  - `value={field.value ?? ''}` is required, not cosmetic: `label` is `.optional()` in the schema, so its value can legitimately be `undefined` and React would flip the input from controlled to uncontrolled.
  - Do not change the outer `<div className="flex items-center gap-2">`, the `flex-1` classes, the trash `Button`, the `+ Add recipient` `Button`, the `useFieldArray` call, or the `fields.length === 0` auto-repair `useEffect`.
  - Update the file's top doc comment: add one sentence stating that these inputs must stay `Controller`/`FormField`-bound because `src/components/ui/input.tsx` is not `forwardRef`-wrapped under React 18, so `register()`'s ref never attaches and RHF then reads `undefined` off the `_f.ref` stub on every keystroke.

- [x] **Step 2: Make validation failures visible**
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Add `import type { FieldErrors } from 'react-hook-form'` (or extend the existing `react-hook-form` import).
  - Add a handler next to `onSubmit`:
    ```ts
    function onInvalid(errors: FieldErrors<FormValues>) {
      console.error('[NotificationSettingsForm] submit blocked by validation', errors)
      toast.error(t('admin.settings.notifications.saveFailed'))
    }
    ```
  - Change L222 to `onSubmit={form.handleSubmit(onSubmit, onInvalid)}`.
  - Reuse the existing `admin.settings.notifications.saveFailed` key — **do not add a new i18n key** (`npm run i18n:check` enforces pl/en/uk parity and a new key means three edits for no user-visible gain here).
  - `no-console` is not enabled in `eslint.config.js`, so the `console.error` is lint-clean.

- [x] **Step 3: Extract the recipients diff into a pure, testable module**
  - Files: **new** `src/app/admin/settings/notifications/recipient-diff.ts`; edit `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Export from the new file:
    ```ts
    export type BaselineRecipient = { dbId?: string | null; chatId?: string; label?: string } | undefined
    export function diffRecipients(
      baseline: readonly BaselineRecipient[],
      current: readonly RecipientRow[],
    ): { toCreate: RecipientRow[]; toUpdate: RecipientRow[]; toDeleteIds: string[] }
    ```
    The loose `BaselineRecipient` shape is required because `form.formState.defaultValues` is typed `DeepPartial<FormValues>`.
  - Reproduce today's semantics **exactly** (lift, do not redesign — `NotificationSettingsForm.tsx` L159–168):
    - a row "counts" only when `row.chatId.trim()` is non-empty;
    - `toCreate` = current rows with `dbId === null` **and** a non-empty trimmed `chatId`;
    - build `filledByDbId` = `Map<dbId, row>` over current rows with a truthy `dbId` **and** a non-empty trimmed `chatId`;
    - `toDeleteIds` = every baseline row with a truthy `dbId` that is absent from `filledByDbId` (covers both "row removed from the array" and "existing row blanked out" — this is what makes clearing a saved chat ID delete it);
    - `toUpdate` = entries of `filledByDbId` whose `chatId` differs from the matching baseline row, or whose `label || ''` differs from the baseline's `label || ''`.
  - Returning `toDeleteIds: string[]` rather than rows removes the current `r!.dbId` non-null assertion at the call site.
  - In `onSubmit`, replace the inline block with `const { toCreate, toUpdate, toDeleteIds } = diffRecipients(form.formState.defaultValues?.recipients ?? [], recipients)` and point the DELETE `fetch` at `` `/api/admin/notification-settings/recipients/${id}` `` mapping over `toDeleteIds`. Leave the POST/PATCH bodies, the `Promise.allSettled` block, the `results.some(...)` failure check, the `fetchRecipients()` re-read, the `form.reset({ ...settings, recipients: freshRecipients })`, and the success toast **byte-for-byte unchanged**.
  - Move the explanatory comment currently above the inline diff into the new module.

- [x] **Step 4: Unit-test the diff**
  - Files: **new** `tests/app/admin/settings/notifications/recipient-diff.test.ts`
  - No mocks — the module is pure, React-free and Prisma-free (same rationale as `tests/app/admin/master/calendar/calendar-utils.test.ts`).
  - Cases to cover:
    1. Empty baseline + the single blank placeholder row (`{ dbId: null, chatId: '', label: '' }`) → all three buckets empty (**this is the "user pressed Save without touching recipients" path — it must never fire a request**).
    2. Empty baseline + one filled new row → exactly one `toCreate`, nothing else.
    3. One saved row, chat ID edited → exactly one `toUpdate`, nothing else.
    4. One saved row, label edited only → exactly one `toUpdate`.
    5. One saved row, untouched → all buckets empty (no redundant PATCH).
    6. One saved row whose `chatId` was blanked to `''` → its id in `toDeleteIds`, not in `toUpdate`.
    7. One saved row dropped from the array entirely → its id in `toDeleteIds`.
    8. Whitespace-only `chatId` (`'   '`) on a new row → not in `toCreate`.
    9. Mixed: one saved row kept, one saved row deleted, one new filled row, one blank trailing row → one create, zero updates, one delete.

- [x] **Step 5: DOX pass**
  - `src/app/admin/AGENTS.md` — extend the settings-forms bullet (currently L34, the `settings-dirty` / `form="settings-form"` bridge bullet) with: inputs inside these forms must be bound via `FormField`/`Controller` with explicit `value`/`onChange`/`onBlur`, never `register()`, because `src/components/ui/input.tsx` is a plain function component under React 18 — `register()`'s ref silently never attaches and RHF then writes `undefined` into form state on every keystroke, which a required `z.string()` rejects and `handleSubmit` swallows with no visible symptom. Note that `handleSubmit` on these forms must always be given an `onInvalid` callback.
  - `src/components/AGENTS.md` — add one bullet near the other `ui/` primitive notes: `ui/input.tsx` (and any Base-UI-derived primitive written React-19-style) is **not** `forwardRef`-wrapped while the project is on React 18, so refs passed to it are dropped; bind it with `Controller`, not `register()`. Do not "fix" it by wrapping it in `forwardRef` without auditing every form.
  - `tests/AGENTS.md` — add a dated Local Contracts line for `tests/app/admin/settings/notifications/recipient-diff.test.ts` (no mocks by design, pure module), matching the format of the existing 2026-08-05 entries.
  - No other AGENTS.md is affected — no route, schema, or API contract changes here.

---

## Acceptance Criteria

- [~] `npm run lint` passes with zero warnings — clean for every file touched by this plan; the full-repo run has 46 pre-existing errors in unrelated files (`useBookingManagementState.ts`, `HomeClient.tsx`, `Header.tsx`, `TurnstileProvider.tsx`, `MasterContext.tsx`, `availability.ts`, `booking-helpers.ts`, `turnstile.ts`, `tailwind.config.ts`, `test-avail.cjs`, `test-db.cjs`) that predate this change and are out of scope.
- [x] `npm run test` passes, including the new `recipient-diff.test.ts` — full suite: 37 files / 354 tests, 0 failures.
- [x] `npx tsc --noEmit` (or the build's type check) is clean — in particular the `` `recipients.${index}.chatId` `` template literal must resolve against `FieldPath<FormValues>`.
- [x] `node scripts/i18n-check.mjs` passes (no new keys were introduced).
- [~] `grep -rn "register(" src/app/admin/settings/notifications/` returns nothing — no actual `register()` calls remain (2 hits are only the new doc-comment sentence in `TelegramRecipientsField.tsx` explaining *why* `register()` isn't used, as Step 1 explicitly instructed).
- [x] No `field.ref` / `{...field}` spread reaches `<Input>` in `TelegramRecipientsField.tsx`.
- [ ] Manual: typing a chat ID and clicking Save fires `POST /api/admin/notification-settings/recipients` and shows the success toast.
- [ ] Manual: editing an already-saved chat ID and saving fires `PATCH .../recipients/<id>`.
- [ ] Manual: clearing a saved chat ID to empty and saving fires `DELETE .../recipients/<id>`.
- [ ] Manual: pressing Save with only the blank placeholder row fires **no** recipient request and still saves the toggles.
- [ ] Manual: on page load with zero saved recipients, one empty editable row is visible and the Save button is **disabled** (form not falsely dirty).
- [ ] Manual: deleting the last row via the trash icon leaves one blank editable row behind.
- [ ] Manual: `+ Add recipient` appends an additional row and does not clear the row above it.

### UX that must NOT regress (all already agreed and implemented this session)

- [ ] A recipient row is always visible and directly editable — no separate "stage then click Add" step.
- [ ] `+ Add recipient` only ever appends an *extra* row.
- [ ] Blank-`chatId` rows are ignored on save and never POSTed.
- [ ] Blanking a saved row's `chatId` and saving deletes it.
- [ ] The placeholder blank row from `fetchRecipients()` stays part of both `defaultValues` and current values, so the form is never dirty on load.
- [ ] The hydration-safe `FormSkeleton` loading branch in `NotificationSettingsForm.tsx` (L203–218) and its comment are **untouched**, as is the matching branch in `ClientBotSettingsForm.tsx`. That fix is confirmed correct by the user's own devtools overlay (`Server: "Ładowanie…" / Client: "Loading…"`) — do not revert or "simplify" it.

---

## Secondary symptom: "worked once, then stopped responding (200 in network, UI never updated)" — **OUT OF SCOPE, separate root cause, confirmed**

Investigated and identified; deliberately not fixed here.

That report is about **`/admin/settings`** (`src/app/admin/settings/SettingsForm.tsx`), which is **not a react-hook-form form at all** — it is a Next.js server-action form using `useFormState(saveSettings, initialState)` with a plain `useState` `isDirty`. Its bug is at L150–156:

```ts
useEffect(() => {
  if (state.success) { setIsDirty(false); router.refresh() }
}, [state.success, router])
```

After the first successful save, `state.success` is `true` and **stays** `true`. On the second save the action returns `{ success: true }` again, `state.success` does not change value, the effect's dependency list is unchanged, so the effect never re-runs: `setIsDirty(false)` never fires, `router.refresh()` never fires, and the `{state.success && <p>…saved…</p>}` line at L472 was already on screen so nothing visibly changes — while the network tab correctly shows a 200. That is a stale-dependency bug in a `useFormState` effect, wholly unrelated to the RHF `register()`/ref chain above.

Also ruled out as a contributor:

- **`src/components/LogoDisplay.tsx` / the `['tenant-config']` react-query key** — `LogoDisplay` is imported in exactly one place, `src/app/[masterId]/page.tsx` L21/L278, a public booking page. It never mounts under `/admin`, so it cannot affect the admin save bridge.
- **`AdminSidebar.tsx`'s `settings-dirty` bridge itself** — the listener, the `form="settings-form"` submit button and the `SETTINGS_SAVE_BRIDGE_ROUTES` list are correct and shared unchanged by all three bridge routes; the notifications page's failure happens *inside* `handleSubmit`, long after the browser has already dispatched the submit event through the bridge. Do not touch `AdminSidebar.tsx`.

Recommendation for the orchestrator: raise the `SettingsForm.tsx` stale-dep issue as its own one-line follow-up task (a monotonically increasing `savedAt`/nonce in the action's returned state, or keying the effect on the whole `state` object) once this plan lands and is verified. Fixing it inside this plan would mix two unrelated bugs into one review and one manual-verification pass.

---

## Constraints & Risks

**Must not touch**
- `src/components/ui/input.tsx` — see D4.
- `src/components/ui/form.tsx` — `FormField` is used exactly as designed here.
- `src/components/admin/AdminSidebar.tsx` — the bridge is not implicated.
- The `FormSkeleton` loading branches in `NotificationSettingsForm.tsx` and `ClientBotSettingsForm.tsx` — confirmed-correct hydration fix.
- `src/app/api/admin/notification-settings/recipients/**` — the GET/POST/PATCH/DELETE handlers are correct as-is (`CreateSchema`/`UpdateSchema` require `chatId.min(1)`, which is exactly why blank rows must be filtered client-side and are).
- `src/app/admin/settings/notifications/recipient-schema.ts` — `chatId` intentionally allows `''` so the always-present placeholder row validates. Do **not** re-add `.min(1)`; that would recreate the silent-block bug from the other direction.
- `src/app/admin/settings/SettingsForm.tsx` — out of scope, see above.

**Risks**
- *Type inference on the field-array path.* If `FormField`'s `TName` fails to infer from `` `recipients.${index}.chatId` ``, add `as const` (as the current `register()` calls already do) rather than casting to `any` or widening the `FormValues` type.
- *Row-key regression.* `key={row.id}` must stay the `useFieldArray` id. Switching it to `index` would make React reuse Controllers across removals and scramble values.
- *`isDirty` semantics shift (expected, not a bug).* Today, typing then deleting the text leaves the form dirty, because the value became `undefined` and never returned to `''`. After the fix, typing then deleting returns the value to `''` and the Save button correctly disables again. Do not "fix" that back.
- *Existing React dev warnings remain.* `<Input {...field} />` elsewhere in these forms still spreads `field.ref` and will keep logging "Function components cannot be given refs" in dev. That is pre-existing, harmless for Controller-bound fields, and explicitly not in scope — mention it, do not clean it up here.
- *File-size budget.* Both touched files stay well under the 500-line limit; Step 3's extraction reduces `NotificationSettingsForm.tsx`.

**Why this attempt will hold where three did not**

Rounds 1–3 all changed *what values the form should contain* (staging input → editable rows, placeholder row, relaxed schema, diff logic) while leaving intact the one line that makes those values impossible to enter: `{...register(...)}` on a component that cannot receive a ref. The value never left the DOM and entered RHF's store. Step 1 removes that line and routes the value through `getEventValue(event)` — the same path already proven by every other working input on this page. Step 2 guarantees that if anything *does* still reject the submit, it announces itself with a toast and a named-field console entry instead of a dead button, so a fourth round would start with the answer instead of a guess.
