# Plan: Hide the ghost sidebar "Save Settings" button on self-contained settings pages

**Date:** 2026-08-03
**Status:** In Progress
**Mode:** LIGHT (single-file conditional-rendering fix, no architectural decisions)

## Problem

`src/components/admin/AdminSidebar.tsx:103` renders the global "Save Settings" button for **every** route under `/admin/settings`:

```tsx
{pathname.startsWith('/admin/settings') && (
  <button type="submit" form="settings-form" disabled={!isDirty} ...>
```

It only works on pages that dispatch a `settings-dirty` CustomEvent and render `<form id="settings-form">` — confirmed today in `SettingsForm.tsx` (main settings), `ClientBotSettingsForm.tsx`, and `NotificationSettingsForm.tsx`.

Three sub-pages do **not** wire into this bridge and instead have their own inline submit button: `EmailSettingsForm.tsx` (`/admin/settings/email`), `SocialSettingsForm.tsx` (`/admin/settings/social`), and the just-shipped `LegalSettingsForm.tsx` (`/admin/settings/legal`). On those three, the sidebar shows a permanently-disabled, non-functional "Save Settings" button alongside the page's own working button — confusing (user found it while testing the Legal Documents page; confirmed via code inspection that Email/Social already had the same issue, pre-existing).

## Decision

Confirmed with user: switch the sidebar button's visibility check from a blanket `startsWith('/admin/settings')` to an explicit allowlist of routes that actually wire the `settings-dirty`/`id="settings-form"` bridge. Do not touch `EmailSettingsForm.tsx`, `SocialSettingsForm.tsx`, or `LegalSettingsForm.tsx` — they keep their own inline save button exactly as-is.

## Implementation Steps

- [x] **Step 1: Add an explicit allowlist in `AdminSidebar.tsx`**
  - File: `src/components/admin/AdminSidebar.tsx`
  - Add a module-level constant near the top of the file (outside any component, so it isn't recreated per render):
    ```ts
    // Routes whose page wires into the settings-dirty bridge below (dispatches
    // 'settings-dirty' + renders <form id="settings-form">). Sub-pages with
    // their own self-contained save button (email, social, legal, ...) must
    // NOT be added here — the button would render permanently disabled.
    const SETTINGS_SAVE_BRIDGE_ROUTES = [
      '/admin/settings',
      '/admin/settings/client-bot',
      '/admin/settings/notifications',
    ]
    ```
  - Replace line 103's condition:
    ```tsx
    {pathname.startsWith('/admin/settings') && (
    ```
    with:
    ```tsx
    {SETTINGS_SAVE_BRIDGE_ROUTES.includes(pathname) && (
    ```
  - Use exact equality (`.includes`), not prefix matching — these are leaf routes with no further nested dynamic segments today, so exact match is correct and safer (a future new settings sub-page defaults to "no ghost button" unless explicitly added here, rather than defaulting to "shows a broken button").

- [x] **Step 2: Verify**
  - Run `npm run lint` (zero-warnings) and `npx tsc --noEmit`. Do NOT run `npm run dev` or `npm run build` (user runs their own dev server; a build can corrupt `.next/`).
  - Manually confirm by reading the three wired forms' route paths match the constant exactly: `SettingsForm.tsx` is rendered at `/admin/settings` (check `src/app/admin/settings/page.tsx`), `ClientBotSettingsForm.tsx` at `/admin/settings/client-bot`, `NotificationSettingsForm.tsx` at `/admin/settings/notifications`.

## Acceptance Criteria

- [x] `npm run lint` shows zero errors/warnings in `AdminSidebar.tsx` (repo-wide lint has pre-existing unrelated errors in other files, confirmed not touched by this change); `npx tsc --noEmit` passes with no output
- [x] Only `src/components/admin/AdminSidebar.tsx` is changed — no edits to any settings form or page
- [x] Sidebar "Save Settings" button still appears (and still works) on `/admin/settings`, `/admin/settings/client-bot`, `/admin/settings/notifications`
- [x] Sidebar "Save Settings" button no longer renders on `/admin/settings/email`, `/admin/settings/social`, `/admin/settings/legal`
- [x] File stays well under 500 lines (it was ~190 lines before this change)

## Out of scope

- Any change to `EmailSettingsForm.tsx`, `SocialSettingsForm.tsx`, `LegalSettingsForm.tsx`, or their pages.
- Unifying the two save-button patterns project-wide — not requested, bigger scope than this fix.
