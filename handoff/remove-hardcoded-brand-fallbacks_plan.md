# Plan: Remove hardcoded brand-asset fallbacks (logo, favicon, OG preview)

**Date:** 2026-08-04
**Status:** Complete
**Mode:** LIGHT (mechanical removal of hardcoded fallback paths + conditional rendering, no architecture/schema changes; written by orchestrator)

## Problem

User instruction (translated): logos and other branding assets must never fall back to a hardcoded file in `public/` — only the theme-toggle icon (`dark.png`/`light.png`, being made admin-configurable in the separate `handoff/theme-toggle-icon_plan.md` FULL-mode task, currently in progress) is allowed to keep a hardcoded default. Everywhere else, if the admin hasn't configured an asset, the app must render **nothing** for that asset (or a generic non-branded placeholder), not a leftover hardcoded image. Once the hardcodes are removed, the now-unreferenced files must be deleted from `public/`.

Five hardcoded fallback sites found (confirmed via grep — no other references exist):

1. `src/components/LogoDisplay.tsx:49-50` — `config.logoUrl || "/head_logo.png"`, `config.darkLogoUrl || config.logoUrl || "/head_logo_night.png"`
2. `src/components/home/HomeClient.tsx:52-54` — same pattern, plus `config.brandName || "Logo"` (leftover hardcoded alt-text string, same category of bug as the "Somique Beauty" fallback fixed earlier this session — should use `DEFAULT_BRAND_NAME` instead)
3. `src/components/BrandHeader.tsx:53` — `selectedMaster?.avatar || '/head_logo.png'` (master avatar placeholder, not actually a "logo" but uses the same hardcoded asset)
4. `src/app/layout.tsx:23` — `faviconUrl = (config as any).faviconUrl || '/logo.png'`
5. `src/app/layout.tsx:42,48` — `openGraph.images` / `twitter.images` hardcoded to `'/prev.png'`, no config field backs this at all today

## Decisions

### D1 — LogoDisplay.tsx / HomeClient.tsx: drop the hardcoded image fallback, render conditionally

Both components already gate rendering behind `if (config.logoUrl || config.darkLogoUrl)` (or the `showLogo` check) before drawing two `<Image>` tags (one `dark:hidden`, one `hidden dark:block`). The bug: when only ONE of `logoUrl`/`darkLogoUrl` is set, the other still falls through to the hardcoded `/head_logo*.png` file instead of just not rendering.

Change:
```ts
const logoSrc = config.logoUrl              // was: config.logoUrl || "/head_logo.png"
const darkLogoSrc = config.darkLogoUrl || config.logoUrl   // was: ...|| "/head_logo_night.png"
```
Keep the `config.darkLogoUrl || config.logoUrl` fallback — that's a config-to-config fallback (reuse the light logo for dark mode if no separate dark logo was uploaded), not a hardcoded-asset fallback, and is legitimate/intended behavior, not part of this bug.

Then render each `<Image>` conditionally on its own src being truthy, e.g.:
```tsx
{logoSrc && <Image src={logoSrc} alt={...} ... className="h-auto dark:hidden" />}
{darkLogoSrc && <Image src={darkLogoSrc} alt={...} ... className="h-auto hidden dark:block" />}
```
This exactly mirrors the pattern `BrandHeader.tsx` already uses correctly for its own `logoSrc`/`darkLogoSrc` (lines 68-86) — copy that shape.

Apply to **both** call sites in `LogoDisplay.tsx` (the `logoFullscreen`/`below` branch around line 52-63, AND the normal positioned branch around line 66-91 — both currently render both `<Image>` tags unconditionally) and to `HomeClient.tsx`'s equivalent JSX (read the file past line 90 to find its render block — same dual-Image structure, same fix).

Also in `HomeClient.tsx`: change `const brandName = config.brandName || "Logo"` to use `DEFAULT_BRAND_NAME` from `@/lib/constants/brand` (import it) instead of the literal `"Logo"` string — same class of hardcoded-brand-string bug already fixed everywhere else earlier this session.

### D2 — BrandHeader.tsx: master avatar, no hardcoded logo fallback

Remove `selectedMaster?.avatar || '/head_logo.png'`. Replace with the exact "no photo" placeholder pattern already used in `src/components/MasterSelector.tsx:169-183` (initials-letter div on `bg-muted`, conditional render) — adapted to `BrandHeader.tsx`'s circular `h-20 w-20 rounded-full` container instead of `MasterSelector`'s `fill`-based rectangle:

```tsx
{selectedMaster?.avatar ? (
  <Image
    src={selectedMaster.avatar}
    alt={`${selectedMaster?.name || 'Master'} - Beauty Master`}
    width={80}
    height={80}
    className="h-20 w-20 object-cover"
  />
) : (
  <div className="flex h-20 w-20 items-center justify-center bg-muted text-foreground text-2xl font-bold">
    {selectedMaster?.name?.[0]?.toUpperCase() || '?'}
  </div>
)}
```
(Use `'?'` or similar single-glyph fallback if `selectedMaster?.name` is also unavailable — check what `MasterSelector.tsx` assumes about `master.name` always being present and stay consistent.)

### D3 — layout.tsx favicon: no icon metadata at all when unset

Remove `|| '/logo.png'`. When `config.faviconUrl` is falsy, omit the `icons` key entirely from the returned `Metadata` object (don't emit `icon`/`shortcut`/`apple` at all), rather than setting it to any hardcoded path:

```ts
const faviconUrl = (config as any).faviconUrl || null
// ...
return {
  ...,
  ...(faviconUrl ? { icons: { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl } } : {}),
  ...
}
```
This matches what the user explicitly asked for earlier this session ("if there's no favicon, there should be no favicon at all, not some default") — Next will emit no `<link rel="icon">`, browser falls back to its own default blank/generic tab icon.

### D4 — layout.tsx OG/Twitter preview image: omit when unset, no schema addition

No `TenantConfig` field backs an OG preview image today, and adding one is out of scope for this pass (would need a new upload field + settings UI, not just a fallback removal). Simplest correct fix, consistent with D3's "omit entirely when nothing configured" approach: drop the hardcoded `'/prev.png'` and omit `images` from both `openGraph` and `twitter` metadata objects entirely (don't set the key at all). Do **not** invent a fallback to `logoUrl`/`faviconUrl` for this — that would be new speculative behavor beyond what was asked; open a separate feature request later if a configurable OG image is wanted.

### D5 — Delete the now-orphaned files from `public/`

After D1-D4 land, re-grep the whole repo (not just `src/`) for `head_logo.png`, `head_logo_night.png`, `logo.png`, `prev.png` to confirm zero remaining references (including e.g. `manifest.json`/metadata files if any exist), then delete all four from `public/`. Do **not** touch `public/dark.png` or `public/light.png` — those stay as the theme-toggle icon's hardcoded default (explicitly sanctioned exception), and are being made admin-overridable in the separate `handoff/theme-toggle-icon_plan.md` task.

## Implementation Steps

- [x] **Step 1**: `src/components/LogoDisplay.tsx` — apply D1 to both render branches.
- [x] **Step 2**: `src/components/home/HomeClient.tsx` — apply D1 (image fallback removal + conditional render + `DEFAULT_BRAND_NAME` import for the `brandName` fallback).
- [x] **Step 3**: `src/components/BrandHeader.tsx` — apply D2.
- [x] **Step 4**: `src/app/layout.tsx` — apply D3 (favicon) and D4 (OG/Twitter images).
- [x] **Step 5**: Re-grep the full repo for `head_logo.png`, `head_logo_night.png`, `logo.png`, `prev.png` — confirm zero references remain, then `rm` all four from `public/`.
- [x] **Step 6**: Verification — `npm run lint`, `npx tsc --noEmit`, `npm run test`. Do NOT run `npm run dev`/`npm run build`.

## Acceptance Criteria

- [x] With `logoUrl`/`darkLogoUrl`/`faviconUrl` all null in `TenantConfig`, the home page, booking page, and `<head>` render with zero references to `/head_logo.png`, `/head_logo_night.png`, or `/logo.png`.
- [x] With only `darkLogoUrl` set (no `logoUrl`), light mode shows no logo image at all (not a hardcoded fallback) — dark mode shows the configured dark logo.
- [x] With no favicon configured, `generateMetadata()`'s returned object has no `icons` key at all.
- [x] With no favicon/OG image configured, `openGraph.images`/`twitter.images` are omitted, not set to `/prev.png`.
- [x] `BrandHeader.tsx` shows an initials-letter placeholder (not `/head_logo.png`) when the selected master has no avatar.
- [x] `public/head_logo.png`, `public/head_logo_night.png`, `public/logo.png`, `public/prev.png` no longer exist.
- [x] `public/dark.png` and `public/light.png` are untouched.
- [x] `npm run lint` / `npx tsc --noEmit` / `npm run test` all clean (touched files are lint-clean; repo-wide `lint` has pre-existing unrelated errors in untouched files — see report).
- [x] Every touched file stays under 500 lines.

## Post-review fixes (reviewer feedback, NEEDS CHANGES round)

- [x] `src/components/home/HomeClient.tsx:130` — mobile logo block's outer gate was `{config.logoUrl && (...)}`, causing dark-only logo config to render nothing on mobile. Fixed to `{(config.logoUrl || config.darkLogoUrl) && (...)}` to match the desktop block's gate.
- [x] `src/components/BrandHeader.tsx:67` — comment referenced deleted `head_logo` asset; updated to `{/* Логотип показывается только на мобильных устройствах */}`.
- [x] Re-verified: `npm run lint` (no new errors introduced — pre-existing repo-wide errors unchanged), `npx tsc --noEmit` (clean), `npm run test` (291/291 passing).

## Out of scope

- Adding a dedicated admin-configurable OG/social-preview-image field — flagged in D4 as a possible future feature, not implemented here.
- Any change to `dark.png`/`light.png` or the theme-toggle icon — that's the separate FULL-mode `handoff/theme-toggle-icon_plan.md` task, must not be run in parallel with this one (sequential agent execution only).
- Any change to `src/lib/tenant.ts`'s `DEFAULT_CONFIG` — no schema fields are added or removed by this plan, only fallback logic in the consuming components.
