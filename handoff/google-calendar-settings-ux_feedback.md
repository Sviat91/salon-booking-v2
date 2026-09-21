# Review: google-calendar-settings-ux

**Date:** 2026-09-21 · **Verdict:** APPROVED with nits (no Critical/Architectural; reviewer's literal verdict line was CHANGES REQUESTED for the minor items below, all resolved by the orchestrator).
Note: the reviewer agent has no Write tool; the orchestrator saved its findings here (condensed).

## Minor (all fixed)
- Stale `pendingEmail` after clearing the textarea / pasting invalid text → `onPasteChange` now calls `onParsedEmail(parseServiceAccountKey(text)?.clientEmail ?? null)` (mask excluded).
- Removing a key after a file pick was awkward (textarea shows `''` while a file-loaded key is active) → added explicit ghost buttons in `ServiceAccountKeyField.tsx`: "Discard file" (restores mask/empty) and "Remove saved key" (sets `''`, dirty → Save clears it); `keyClearHint` reworded in pl/en/uk; new keys `discardFileBtn`, `removeKeyBtn`.
- Literal backticks in `serviceAccountEmailLabel` (plain `t()`), all three locales → removed.

## Not changed (reviewer: acceptable)
`testAfterSaveHint` next to an enabled Test button when the key is cleared but not yet saved (tests the saved key); `copyEmail` declared above `shownEmail` (closure, fine).

## Verified by the reviewer
Private key never rendered/logged/in toasts or aria; `parseServiceAccountKey` is import-free and client-safe; form dirty via `setValue(..., { shouldDirty, shouldValidate })`; invalid file leaves value untouched; same file re-pick works; after save `form.reset` + `setPendingEmail(null)`; MASK = keep, `''` = clear, full JSON = replace (PATCH route); 8192-byte cap cannot reject a real ~2.3–2.6 KB key file and matches zod `max(8192)`; sidebar exact-match route list, button `form="settings-form"`, disabled while clean; react-hook-form rules respected; files < 500; i18n parity; DOX updated.

## Orchestrator re-check after the fixes
`npx tsc --noEmit` clean; `npm run i18n:check` pass; eslint on the settings folder + `AdminSidebar.tsx` clean; `npx vitest run` 48 files / 486 tests pass; `ServiceAccountKeyField.tsx` 143 lines, form 313.

APPROVED
