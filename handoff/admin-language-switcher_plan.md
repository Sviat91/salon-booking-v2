# Plan: Native Admin Language Switcher + Server-Refresh Fix
**Date:** 2026-07-16
**Status:** In Progress
**Mode:** LIGHT

## Goal
Admin/master dashboard gets a real in-app language switcher (mirrors the client-facing
one), eliminating reliance on the Google Translate browser extension. Fix the latent gap
where switching language doesn't refresh Server-Component-rendered admin content
(dashboard stats, settings pages, etc. via `getServerT()`) until the next navigation.

## Root cause context (already diagnosed, not part of this fix)
The admin UI currently has zero wiring to `useLanguage()`/`setLanguage()`
(`src/contexts/LanguageContext.tsx`). What looked like a language-switch bug during manual
testing was the Google Translate extension fighting React reconciliation — not an app
defect. Building the real switcher below removes the need for that workaround entirely.

## Scope
**In:** `src/contexts/LanguageContext.tsx` (add `router.refresh()`),
`src/components/admin/AdminTopBar.tsx` (mount the switcher).
**Out:** any change to `LanguageToggle.tsx` itself — reuse as-is, it's already
theme-aware and works via the shared `LanguageProvider` (mounted app-wide in
`src/app/providers.tsx`, already wraps `/admin`).

## Implementation Steps
- [x] 1. `src/contexts/LanguageContext.tsx` — import `useRouter` from `next/navigation`;
  call `router.refresh()` inside `setLanguage()` after the cookie is set (before or after
  `setLanguageState`, whichever avoids a visible flash — coder's judgment). This must not
  run on initial mount/sync effect, only on an actual user-triggered language change.
- [x] 2. `src/components/admin/AdminTopBar.tsx` — import and render `LanguageToggle` from
  `@/components/LanguageToggle`, placed between the page title and the
  Search/Bell/Avatar cluster (or immediately before Search — coder's call on the exact
  slot, keep it visually consistent with the existing icon-button spacing/gap).
- [x] 3. Verify no double-refresh loop or console errors from `router.refresh()` firing
  during the language-context's own mount-sync effect (only the `setLanguage()` callback
  should refresh, not the `useEffect` that syncs from localStorage on first paint).

## Verification
- [x] `npm run lint` (zero new warnings vs baseline), `npm run test`, `npm run build`.
- [ ] Manual: open `/admin`, switch language via the new toggle, confirm sidebar nav,
  top bar title, AND dashboard stat cards (Server Component content) all update without
  a page reload or extra click/navigation.
- [ ] Manual: confirm switching language on a client-facing page (e.g. `/`) still works
  exactly as before (no regression from the added `router.refresh()`).

## Acceptance Criteria
- [ ] Admin language switcher visible and functional, styled consistent with existing
  `AdminTopBar` icon buttons.
- [ ] All admin content (client + server rendered) updates language in one action, no
  stale segments requiring navigation.
- [ ] No regression to existing client-facing language switching.
