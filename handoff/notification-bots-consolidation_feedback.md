# Review: notification-bots-consolidation
**Date:** 2026-09-23
**Verdict:** APPROVED (one cosmetic doc-comment fixed directly)

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [x] Stale route reference in doc comment: `src/components/admin/notification-bots/NotificationBotsManager.tsx` — the JSDoc comment still said "Shared list + 'add bot' surface for `/admin/settings/notification-bots` (canEditScope) and `/admin/master/notification-bots`", but the first route was deleted by this plan's Step 2 (the component is now embedded inside `/admin/settings/notifications` instead). **Fixed directly by orchestrator** — comment now describes the embedded-vs-standalone split accurately. Verified `npx eslint` clean.

## Passed Checks
- [x] Step 1: `NotificationBotsManager` correctly added as a new `SettingsSection` immediately after the existing Telegram section in `NotificationSettingsForm.tsx`, not wrapped in any RHF binding, doesn't touch the surrounding form's submit/dirty-tracking — purely additive.
- [x] Step 2: `src/app/admin/settings/notification-bots/` no longer exists. Master page/nav entry untouched. Admin nav no longer has a `notificationBots` entry.
- [x] Step 3: `MasterMultiSelect.tsx` (85 lines) implements a real click-outside listener (`document.mousedown` + ref check + cleanup) — not the `ProcedureSelect` background-click trick. Stays open across multiple toggles. Closed-state summary correct for 0/1/many selected. Empty-masters case still shows the hint and disables the trigger.
- [x] Step 4: `toggleMaster` and the unused `Checkbox` import correctly removed from `NotificationBotCard.tsx` — no dead code. Everything else in that file untouched.
- [x] i18n parity across pl/en/uk for the two new keys, real per-language translations.
- [x] File sizes: `NotificationSettingsForm.tsx` 432, `NotificationBotCard.tsx` 289, `MasterMultiSelect.tsx` 85 — all well under 500.
- [x] Both DOX files (`src/app/admin/AGENTS.md`, `src/components/AGENTS.md`) updated accurately, no stale references.
- [x] No regression risk to the rest of `NotificationSettingsForm.tsx` (email/Telegram/SMS sections, submit, `settings-dirty` bridge) — the new section is entirely self-managed, mirroring the `GoogleCalendarSettingsForm`/`MasterCalendarField` precedent.
- [x] Master surface (`/admin/master/notification-bots`) confirmed unaffected.

## Summary
Implementation matches the plan closely and correctly across all 7 steps. The additional-bots manager now lives inside the Notifications settings page without disturbing existing form logic; the orphaned admin page/nav entry were removed while the master surface stayed untouched; `MasterMultiSelect` implements a genuine outside-click listener, stays open across multiple toggles, and produces correct summaries. Dead code was properly removed. i18n and DOX are consistent. One trivial stale doc-comment was found and fixed directly. Approved.
