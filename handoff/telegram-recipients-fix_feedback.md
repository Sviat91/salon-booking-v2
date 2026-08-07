# Review: telegram-recipients-fix
**Date:** 2026-08-07
**Verdict:** APPROVED

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
None found.

## Passed Checks
- [x] `TelegramRecipientsField.tsx`: `useFormContext`/`register()` fully removed; only import from `react-hook-form` is `useFieldArray` — no orphan imports.
- [x] Row-map callback param renamed `field` → `row`, `key={row.id}` uses the `useFieldArray` id (not index) — matches D1/risk note on row-key regression.
- [x] Both recipient `<Input>` elements are bound via `FormField` with explicit `name`/`value={field.value ?? ''}`/`onChange`/`onBlur` — no `field.ref` and no `{...field}` spread anywhere in this file.
- [x] `maxLength={64}` present on both inputs, matching `recipientSchema`'s `.max(64)` (D6).
- [x] No `FormItem`/`FormControl`/`FormMessage`/`useFormField` used inside the recipient rows — confirmed against the actual `src/components/ui/form.tsx` source: `FormField` is exactly `<FormFieldContext.Provider><Controller {...props} /></FormFieldContext.Provider>`, emits no DOM, so the `flex items-center gap-2` row layout is untouched (D2 verified against real source).
- [x] Doc comment at top of `TelegramRecipientsField.tsx` states the `forwardRef`/React 18 rationale as instructed.
- [x] `NotificationSettingsForm.tsx`: `onInvalid(errors: FieldErrors<FormValues>)` added, logs via `console.error` and toasts the existing `admin.settings.notifications.saveFailed` key. Wired as `form.handleSubmit(onSubmit, onInvalid)`.
- [x] `diffRecipients(form.formState.defaultValues?.recipients ?? [], recipients)` call site matches the plan's specified sourcing.
- [x] `recipient-diff.ts`: all 9 plan-specified semantics traced by hand against the real implementation, each produces the exact expected bucket contents the test file asserts.
- [x] `toDeleteIds: string[]` (not rows) — removes the need for a `r!.dbId` assertion at the `onSubmit` call site.
- [x] Forbidden-touch files confirmed untouched: `src/components/ui/input.tsx`, `src/components/ui/form.tsx`, `src/app/admin/settings/SettingsForm.tsx` (stale-dependency bug still present, out of scope as planned), `recipient-schema.ts`, the `FormSkeleton` loading branch.
- [x] DOX pass: `src/app/admin/AGENTS.md`, `src/components/AGENTS.md`, `tests/AGENTS.md` all match the plan's specified content and format.
- [x] `saveFailed` key reuse confirmed pre-existing — zero new i18n surface.
- [x] Hunt for bug-class recurrence: `value={field.value ?? ''}` necessary for `label`, harmless for `chatId`; `maxLength={64}` only caps typed length, no new silent-failure path introduced.

## Orchestrator follow-up (post-review, independently re-run)
Reviewer had no Bash access and could not execute `tsc`/`eslint`/`vitest` itself; orchestrator re-ran all three directly after this review — see session log. Results: clean.

## Summary
Faithful, surgical execution of the plan. The exact regression vector (a `ref`/`{...field}` spread reaching a non-`forwardRef` `Input`) is confirmed absent everywhere in the touched files.
