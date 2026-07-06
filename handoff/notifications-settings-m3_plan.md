# Plan: Notifications Settings page — M3 restyle

**Date:** 2026-07-06
**Status:** Complete

## Goal
Restyle the admin Notifications settings page to the established M3 Settings visual language (eyebrow header + `SettingsSection` cards), changing only presentation chrome while preserving all data, save, and conditional-gating logic exactly.

## Architecture Decisions

- **Reuse, don't invent.** There is NO dedicated design mockup for this page in `Somique Beauty Design System/` (confirmed absent). Apply the exact language already shipped on the main Settings, Email, and Social pages: page header → eyebrow (`text-xs font-medium uppercase tracking-wider text-primary` reading `Configuration`) + muted subtitle; each logical group → one `SettingsSection`. Do not introduce new colors, spacing scales, icons, or copy claims beyond what already exists in these files.
- **Correct file locations (the task brief was slightly off).** The form is co-located at `src/app/admin/settings/notifications/NotificationSettingsForm.tsx` (NOT `src/components/admin/`). The page is `src/app/admin/settings/notifications/page.tsx`.
- **`SettingsSection` import path.** From the co-located form, import via the alias used by Email/Social forms: `import { SettingsSection } from '@/app/admin/settings/FormFields'`. Its API is `title: string`, `description?: string`, `action?: ReactNode`, `children` — no icon slot.
- **Three logical sections map 1:1 to the three existing `Card`s:** `Email`, `Telegram`, `Reminders`. Each becomes a `SettingsSection` with the same title. Descriptions are optional; if added, they must be grounded in copy already present in the form (suggested strings below), not new claims.
- **THIS FORM IS SPECIAL — it drives the sidebar Save button.** Unlike the Email/Social forms (self-contained inline save only), this form participates in the shared sidebar-save flow:
  - `<form id="settings-form" ...>` (line 146) is targeted by `AdminSidebar.tsx` line 150 (`form="settings-form"`).
  - The `useEffect` dispatching `new CustomEvent('settings-dirty', { detail: { isDirty: formState.isDirty } })` (lines 86–90) is consumed by `AdminSidebar.tsx` lines 65–71 to enable/disable that button.
  - `form.reset(values)` after a successful save (line 131) clears the dirty state.
  These three pieces MUST remain byte-for-byte. The restyle only swaps the visual wrappers around the fields.
- **Keep the existing inline Save `<Button>` (lines 288–290) as-is.** It coexists with the sidebar button today; removing it would be an unrequested behavior change. Leave it, only optionally wrapping it in the Email/Social footer chrome (see Step 4).
- **Preserve the `ToggleRow` helper unchanged.** This form uses a bespoke multi-toggle row (label + `On/Off` text + `Switch`), which is deliberately different from the Email form's single bordered-box toggle. Do NOT convert `ToggleRow` to the bordered-box style — multiple toggles per section (Reminders has two) make the compact row the correct primitive. Change only the outer `Card` wrapper, never the toggle rows themselves or their `Switch` logic.
- **No hardcoded/non-M3 colors or emoji were found.** The form already uses M3 tokens throughout (`text-muted-foreground`, `text-destructive`, `bg-muted`, etc.) and has no raw emoji icons. There is nothing to clean up on that front — do not go hunting for phantom issues.
- **Preserve all conditional gating verbatim:** the email toggle disabled when `!smtpConfigured` (plus its `text-destructive` "SMTP not configured" hint linking to `/admin/settings/email`), and the reminder toggles disabled when `!anyChannelEnabled` (plus the "Enable at least one channel above…" hint). These move with the fields into the new sections unchanged.

## Implementation Steps

- [x] Step 1: Restyle the page header
  - Files: `src/app/admin/settings/notifications/page.tsx`
  - Details: Keep the `auth()` guard, `redirect('/admin')`, `metadata`, and the outer `<div className="flex flex-col gap-6">` wrapper EXACTLY as-is (do not add `max-w-*` — this matches the Email page). Replace only the inner header `<div>`: remove the `<h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>` (the topbar already supplies the "Notifications" title via `adminNavItems.ts`), and set the block to the shipped eyebrow pattern:
    - `<p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>`
    - `<p className="mt-1 text-sm text-muted-foreground">Configure email and Telegram channels for booking confirmations, reminders, and contact form alerts.</p>` (reuse the existing subtitle copy verbatim).

- [x] Step 2: Swap the three `Card` blocks for `SettingsSection` in the form
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Details: For each of the three `Card`/`CardHeader`/`CardTitle`/`CardContent` blocks, replace the wrapper with a `SettingsSection` whose `title` equals the old `CardTitle` text. Move the former `CardContent` children in as-is (they will sit in `SettingsSection`'s built-in `flex flex-col gap-6 p-6`, so drop the now-redundant `className="space-y-4"` that was on `CardContent`). Keep every `FormField`, `ToggleRow`, `FormMessage`, `FormDescription`, `<code>`, the SMTP-not-configured `<a>` link, and all `disabled`/conditional props exactly. Suggested (optional, grounded) descriptions:
    - Email → `title="Email"`, e.g. `description="Send booking confirmations and reminders by email. Requires SMTP configured under Email Settings."`
    - Telegram → `title="Telegram"`, e.g. `description="Admin alerts for new bookings and contact form submissions via a Telegram bot."`
    - Reminders → `title="Reminders"`, e.g. `description="Automated appointment reminders, sent on the channels enabled above."`
    - If unsure, omit `description` rather than invent — title-only sections are valid.

- [x] Step 3: Update imports and preserve save plumbing
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Details: Remove the now-orphaned `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'`. Add `import { SettingsSection } from '@/app/admin/settings/FormFields'`. Leave ALL other imports (`Switch`, `Form*`, `Input`, `Button`, `useForm`, `zodResolver`, `z`, `toast`) untouched. Do NOT touch: the `formSchema`, `ToggleRow` component, `useForm`/`defaultValues`, both `useEffect`s (the `settings-dirty` dispatch and the `load()` fetch of `/api/admin/notification-settings` + `/api/admin/email-settings`), `onSubmit` and its PATCH to `/api/admin/notification-settings`, `form.reset(values)`, `<form id="settings-form" ...>`, the loading state, and the `watch`/`anyChannelEnabled`/`smtpConfigured` derivations.

- [x] Step 4: (Optional, for visual consistency) align the inline submit footer
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Details: Optionally wrap the existing inline `<Button type="submit" disabled={isSaving || !formState.isDirty}>` in `<div className="flex border-t pt-4">…</div>` to match the Email/Social footer chrome. Keep the button's `type`, `disabled` expression, and label logic (`isSaving ? 'Saving…' : 'Save Settings'`) unchanged. If this looks visually off against the stacked `SettingsSection` cards, leave the button bare — this step is cosmetic only and must not alter behavior.

- [x] Step 5: Verify
  - Files: n/a (checks only)
  - Details: Run `npm run lint` (zero-warning tolerance), `npm run build`, and `npm run test`. Do NOT start a dev server. Manually reason that both save paths still work: sidebar "Save Settings" (enabled only when dirty, via `settings-dirty` + `id="settings-form"`) and the inline button.

## Acceptance Criteria

- [x] `npm run lint`, `npm run build`, and `npm run test` all pass (pre-existing baseline failures on master unchanged; no new regressions from this change — verified via `git stash` comparison).
- [x] Page header matches the Email/Social pattern: eyebrow `Configuration` + muted subtitle, no `<h1>`.
- [x] The three field groups render as `SettingsSection` cards (Email / Telegram / Reminders) matching the shipped Settings visual language.
- [x] `id="settings-form"`, the `settings-dirty` CustomEvent dispatch, and `form.reset(values)` are unchanged — the sidebar Save button still enables on edit and disables after save.
- [x] All conditional gating is intact: email toggle disabled + destructive hint when SMTP unconfigured; reminder toggles disabled + hint when no channel enabled.
- [x] `ToggleRow`, the `Switch` toggles, form schema, data fetching, and the PATCH target `/api/admin/notification-settings` are untouched.
- [x] No `Card*` imports remain unused; `SettingsSection` imported from `@/app/admin/settings/FormFields`.
- [x] File stays under 500 lines (290 lines).

## Constraints & Risks

- **Do NOT touch** `src/app/api/admin/notification-settings/route.ts`, `src/app/api/admin/email-settings/route.ts`, `AdminSidebar.tsx`, `adminNavItems.ts`, or `FormFields.tsx` — this is a presentation-only change to two files.
- **Highest-risk regression:** breaking the shared sidebar-save wiring. The `settings-dirty` dispatch (lines 86–90), `id="settings-form"` (line 146), and `form.reset(values)` (line 131) are load-bearing across files; any edit near them must leave them byte-identical.
- **Do not remove the inline Save button** or the auth guard in `page.tsx` — both are existing behavior, out of scope for a cosmetic restyle.
- **Do not restyle `ToggleRow`** into the Email form's bordered-box toggle; preserve the compact multi-toggle rows.
- **Do not add `max-w-*`** to the page wrapper (kept consistent with the Email page, which also omits it).
- Only two files change: `src/app/admin/settings/notifications/page.tsx` and `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`.
