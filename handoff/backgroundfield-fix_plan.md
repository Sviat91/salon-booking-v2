# Plan: Fix BackgroundField default tab (Solid, not Picture)

## Context
`demo-widget/src/admin/pages/SettingsPage/BackgroundField.tsx` currently
defaults to highlighting the "Picture" tab and always renders an image
upload placeholder. This does not match real production
`src/app/admin/settings/BackgroundSection.tsx`, which defaults
`bgType` to `'solid'` and only renders the Picture content when Picture is
explicitly selected. This is a structural-fidelity bug (same class as the
Settings-layout bug fixed earlier this session) — fix it to match real
behavior exactly, keeping the whole thing inert (no state, no persistence),
per the "real structure, inert data" rule for this whole demo admin.

Real component behavior (verified by reading `BackgroundSection.tsx` in
full):
- 3-way tab pill: Solid / Gradient / Picture. Default highlighted = **Solid**.
- Real labels/copy (from `src/locales/en.json` → `admin.settings.general.*`,
  must reuse verbatim):
  - Section label: "Page Background"
  - Tabs: "Solid" / "Gradient" / "Picture"
  - Solid field label: "Background Color", hint: "Main background color of pages"
  - Picture hint (unchanged, already in file): "Image will be centered and cover the full page background."
- **Light theme instance only** (the call in the "Light Theme" section):
  under the Solid tab, show a "Background Color" field.
- **Dark theme instance** (the call in the "Dark Theme Colors" section):
  under the Solid tab, show **nothing extra** — real component's dark
  instance has no separate solid-color picker (its dark solid color is
  the already-present "Dark Background" swatch in the color grid below).
- Tabs do NOT need to be genuinely clickable (user confirmed this is
  optional/"лишнее") — a static, non-interactive pill with Solid
  highlighted is sufficient, consistent with this file's existing
  non-interactive `<span>` tab pattern.
- Since tabs are static and always show Solid, the Gradient/Picture content
  blocks are unreachable dead markup if kept — do not keep them. Only render
  the Solid-tab content (or nothing, for dark).

## Changes

### 1. `demo-widget/src/admin/pages/SettingsPage/BackgroundField.tsx`
- Add a `dark?: boolean` prop (default `false`), mirroring the real
  component's `prefix` convention (light = no prefix, dark = `prefix="dark"`).
- Tab pill: highlight `'Solid'` instead of `'Picture'`.
- Replace the always-shown image-upload block with:
  - `!dark`: an inert "Background Color" field, styled like the other
    static color fields already in `index.tsx` (label + color swatch +
    hex text, non-interactive — no `<input type="color">`, since this
    field is not one of the two approved live fields). Use a plausible
    static hex value (e.g. `#ffffff`) and the real hint text "Main
    background color of pages".
  - `dark`: render nothing below the tab pill.
- Remove now-unused `Upload`/`ImageIcon` imports and the Picture-tab
  markup entirely (dead code under a tab that's never selectable).
- Update the file's top comment to reflect the new default-tab fix (one
  line, no need to re-explain the whole history).

### 2. `demo-widget/src/admin/pages/SettingsPage/index.tsx`
- Line ~139 (Light Theme section): keep `<BackgroundField />` (light = default).
- Line ~151 (Dark Theme Colors section): change to `<BackgroundField dark />`.
- No other changes in this file.

## Out of scope (explicitly, per user)
- Making the tabs genuinely clickable/interactive.
- Gradient tab content (drop it — not selectable, don't build dead UI for it).
- Any change to Settings' overall card/field density (separately confirmed
  out of scope last session).

## Verification
- [x] `npm run build` (demo-widget) succeeds with no new errors. (orchestrator ran it — clean build, no TS/vite errors)
- [x] `grep -rn "BackgroundField" demo-widget/src/admin/pages/SettingsPage/index.tsx` shows light call with no prop, dark call with `dark` prop.
- [x] Visual: Light Theme section shows Solid tab highlighted + a "Background Color" swatch/hex field, no image-upload UI visible by default.
- [x] Visual: Dark Theme Colors section shows Solid tab highlighted + nothing else under it (no color field, no image-upload UI).
- [x] No leftover unused imports (`Upload`, `ImageIcon` only kept if still used).

## Status
- [x] Implemented by coder
- [x] Reviewed — APPROVED, no issues (see `backgroundfield-fix_feedback.md`)
- [x] Verified by orchestrator (build + diff)
