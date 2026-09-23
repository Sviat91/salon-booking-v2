# Review: notification-bots-sidebar-save
**Date:** 2026-09-23
**Verdict:** APPROVED (one minor fixed directly)

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [x] Stale dirty flag after deleting an already-saved dirty bot: `NotificationBotCard.tsx`'s `remove()` called `onSaved()` on successful delete but never `onDirtyChange?.(false)` — the card's isDirty-reporting effect has no unmount cleanup, so the parent's `dirtyIds` Set never dropped that id, leaving Save Settings stuck enabled (until a full page reload) with nothing actually unsaved. Not data-lossy (the ref itself is correctly cleaned up, so `saveAllDirty()` just silently skips the gone id). **Fixed directly by orchestrator** — added `onDirtyChange?.(false)` right before `onSaved()` in `remove()`'s success path, mirroring `removeDraft()`'s existing pattern. Verified `npx tsc --noEmit`, `npm run lint`, and `npm run test` (578/578) all clean after the fix.

## Passed Checks
- [x] Exactly one `settings-dirty` dispatch site, in `NotificationSettingsForm.tsx`, combining `formState.isDirty || botsDirty`; no race with the sidebar's last-write-wins listener.
- [x] New-draft dirty formula correctly stays `false` for an untouched draft (traced against real initial state).
- [x] Existing-bot dirty formula matches the actual `Bot` type; `idsEqual` correctly order-insensitive; `recipientsEqual` intentionally order-sensitive per the plan's own caveat.
- [x] `onSubmit` calls `saveAllDirty()` safely inside the existing try, after the main PATCH succeeds; traced that it cannot throw (every card's `save()` and `load()` self-catch).
- [x] `SmsSettingsSection`'s `isDirty={formState.isDirty}` prop untouched.
- [x] `forwardRef` + `displayName` convention matches `BookingManagement.tsx`'s shape in both new components.
- [x] All three touched files well under 500 lines (356 / 176 / 346).

## Summary
Implementation matches the plan closely: the single-dispatch-site root-cause fix is correctly applied, both dirty formulas trace out correctly, `saveAllDirty()` is safely placed, and the specified untouched areas stayed untouched. The one real defect (stale dirty flag on delete) was fixed directly — trivial, well-understood, matching an existing pattern already in the same file. Approved.
