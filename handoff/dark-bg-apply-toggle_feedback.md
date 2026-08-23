# Review: Fix "Also apply to dark theme" background checkbox (no-op bug)
**Date:** 2026-08-23
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `useLightBg` conditional (`cfg.bgApplyToDark && cfg.bgType !== 'solid'`) exactly matches the admin UI's own checkbox gate (`!prefix && bgType !== 'solid'` in `BackgroundSection.tsx`) — the flag can never be true while light bgType is solid in a way the UI would allow.
- [x] Light-theme override block is untouched — reads only `cfg.bgType`/`bgImageUrl`/`bgGradient*`, zero reference to `bgApplyToDark`, confirming the flag only affects the dark block's data source.
- [x] CSS output shape (selectors, `.dark body`/`.dark body::before`/`.dark .admin-layout` rules, `!important` flags) unchanged — only template-literal values swapped from raw `darkBg*` to `effective*` variables.
- [x] Solid-type guard preserved via explicit early return when `effectiveDarkBgType === 'solid'`.
- [x] Picture-type missing-image guard preserved: `effectiveDarkBgType === 'picture' && effectiveDarkBgImageUrl` prevents an empty `url('')` background.
- [x] `effective*` variables correctly fall back to `cfg.darkBg*` fields when `useLightBg` is false, matching pre-fix behavior byte-for-byte.
- [x] `BackgroundSection.tsx`, `SettingsForm.tsx`, `actions.ts` untouched — save path was already correct, only the render path needed fixing.

## Independently Verified (orchestrator — reviewer role had no Bash access)
- `git diff --stat` → confined to `src/app/layout.tsx` (12 insertions, 5 deletions).
- `npx tsc --noEmit` → clean, zero output.
- `npm run test` → 39 files / 382 tests passed, 0 failures.
- `npm run lint` → 79 pre-existing problems, identical to baseline, none new.

## Summary
Small, correctly scoped fix. The dark-theme background override in `layout.tsx` now honors `bgApplyToDark`: when checked and the light theme's background isn't solid, dark mode renders using the light theme's own gradient/picture values instead of its independent `darkBg*` fields; when unchecked, behavior is unchanged. No regressions, no scope creep, all verification clean. Approved as-is.
