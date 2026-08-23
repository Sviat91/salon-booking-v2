# Plan: Fix "Also apply to dark theme" background checkbox (no-op bug)

**Date:** 2026-08-23
**Status:** In Progress
**Mode:** LIGHT (orchestrator-authored plan; well-understood, no architectural decisions)

## Goal

The "Also apply to dark theme" checkbox in Admin → Settings → Light Theme → Page Background saves `TenantConfig.bgApplyToDark` to the DB correctly, but nothing at render time ever reads that flag — the dark theme's background is always built purely from `darkBgType`/`darkBgImageUrl`/`darkBgGradient*`, completely independent of the light theme's settings or the checkbox. So checking it and uploading a light-theme picture has zero visible effect on the dark theme. Confirmed by reading `src/app/layout.tsx`'s two background-override blocks (lines 94-137) — `bgApplyToDark` does not appear anywhere in that file.

Fix: when `bgApplyToDark` is true and the light theme's `bgType !== 'solid'`, the dark-theme override block should render using the **light theme's** `bgType`/`bgImageUrl`/`bgGradientFrom`/`bgGradientTo`/`bgGradientAngle` values instead of the dark-specific ones — i.e. actually apply the light background to dark mode, matching the checkbox's own label. When the flag is false (or light `bgType === 'solid'`, in which case the checkbox isn't even shown), behavior is unchanged: dark keeps using its own independent `darkBg*` fields.

## Root Cause

`src/app/layout.tsx`:
- Light override (lines 96-115): reads `config.bgType`/`bgImageUrl`/`bgGradient*`, targets `html:not(.dark) body`.
- Dark override (lines 118-137): reads `config.darkBgType`/`darkBgImageUrl`/`darkBgGradient*`, targets `.dark body`. **Never reads `config.bgApplyToDark`.**

`bgApplyToDark` is correctly threaded through the admin form (`BackgroundSection.tsx`, `SettingsForm.tsx`, `actions.ts`) and saved to `TenantConfig` — the bug is purely in `layout.tsx` never consulting it.

## Implementation Step

- [x] **Fix `src/app/layout.tsx`'s dark theme bg override block (lines 116-137)**
  - Before the existing `darkBgType !== 'solid'` check, compute:
    ```ts
    const cfg = config as any
    const useLightBg = cfg.bgApplyToDark && cfg.bgType !== 'solid'
    const effectiveDarkBgType = useLightBg ? cfg.bgType : cfg.darkBgType
    const effectiveDarkBgImageUrl = useLightBg ? cfg.bgImageUrl : cfg.darkBgImageUrl
    const effectiveDarkBgGradientAngle = useLightBg ? cfg.bgGradientAngle : cfg.darkBgGradientAngle
    const effectiveDarkBgGradientFrom = useLightBg ? cfg.bgGradientFrom : cfg.darkBgGradientFrom
    const effectiveDarkBgGradientTo = useLightBg ? cfg.bgGradientTo : cfg.darkBgGradientTo
    ```
  - Gate the block on `effectiveDarkBgType !== 'solid'` instead of `cfg.darkBgType !== 'solid'`.
  - Use the `effective*` variables (not the raw `darkBg*`/`bg*` ones) inside the gradient/picture branches — same CSS output shape as today, just sourced from the right config depending on `useLightBg`.
  - Keep every selector, `!important`, and the `.admin-layout` transparency override exactly as they are — this is a data-source change only, not a CSS/selector change.
  - Do not touch the light-theme override block (lines 94-115) — it is correct as-is and unrelated to this bug.
  - Do not touch `BackgroundSection.tsx`, `SettingsForm.tsx`, or `actions.ts` — the save path already works correctly; only the read/render path was broken.

## Acceptance Criteria

- [ ] With `bgApplyToDark` checked and light `bgType = 'picture'` with an uploaded image: switching to dark theme shows that same image as the page background (not the dark-specific fields, even if they hold a different stored value).
- [ ] With `bgApplyToDark` unchecked: dark theme continues to use its own independent `darkBgType`/`darkBgImageUrl`/`darkBgGradient*` exactly as before this fix (no regression).
- [ ] With light `bgType = 'solid'` (checkbox not even shown in the UI in this case): dark theme behavior is unchanged regardless of the stored `bgApplyToDark` value.
- [ ] `npm run lint`, `npm run test`, `npx tsc --noEmit` all stay clean — no new failures.
- [ ] `git diff` shows changes confined to `src/app/layout.tsx`.

## Manual verification the user should perform

1. Restart the dev server.
2. Admin → Settings → Light Theme → Page Background: pick "Picture", upload an image, check "Also apply to dark theme", save.
3. Switch the site to dark theme (toggle) — confirm the same uploaded image now shows as the background.
4. Uncheck "Also apply to dark theme", save — confirm dark theme reverts to whatever is configured in the Dark Theme section's own Page Background (or its default if untouched).
