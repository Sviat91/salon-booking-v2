# Review: Remove hardcoded brand-asset fallbacks
**Date:** 2026-08-04
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `LogoDisplay.tsx` — both render branches (`logoFullscreen`/`below` fullscreen branch and the normal positioned branch) render each `<Image>` conditionally on its own `logoSrc`/`darkLogoSrc` truthiness (lines 57/60 and 76-93), matching D1.
- [x] `LogoDisplay.tsx` — `darkLogoSrc = config.darkLogoUrl || config.logoUrl` config-to-config fallback correctly kept (line 50), only the hardcoded-file fallback was dropped.
- [x] `HomeClient.tsx` — desktop absolute-positioned logo block correctly conditionally renders each `<Image>` and is gated by `config.logoUrl || config.darkLogoUrl` (lines 104-127).
- [x] `HomeClient.tsx` — mobile logo block (line 129-154) is now gated by `(config.logoUrl || config.darkLogoUrl)` (line 130), matching the desktop block's gate. Inner `logoSrc && <Image/>` / `darkLogoSrc && <Image/>` conditional-render-per-image logic is unchanged and correct — fix did not regress the already-working inner logic. This resolves Acceptance Criterion #2 for the mobile viewport: a dark-logo-only config now correctly shows the dark logo on mobile.
- [x] `HomeClient.tsx` — `darkLogoSrc = config.darkLogoUrl || config.logoUrl` config-to-config fallback correctly kept (line 54).
- [x] `HomeClient.tsx` — `brandName` now uses `DEFAULT_BRAND_NAME` imported from `@/lib/constants/brand` instead of the literal `"Logo"` string (line 14, line 55).
- [x] `BrandHeader.tsx` — master avatar now renders an initials-letter placeholder (`bg-muted`, `selectedMaster?.name?.[0]?.toUpperCase() || '?'`) instead of `/head_logo.png` when `selectedMaster?.avatar` is falsy (lines 52-64), matching the `MasterSelector.tsx` pattern, reasonably adapted to the circular avatar container.
- [x] `BrandHeader.tsx` — `darkLogoSrc = config?.darkLogoUrl || config?.logoUrl || null` cross-field fallback correctly kept (line 31); this component was already correct pre-change and untouched fallback logic remains intact.
- [x] `BrandHeader.tsx:67` — comment updated to `{/* Логотип показывается только на мобильных устройствах */}`, no longer references the deleted `head_logo` asset. Reads sensibly and matches the surrounding Russian-language comment style.
- [x] No other unexpected changes found in `HomeClient.tsx` or `BrandHeader.tsx` beyond the two targeted fixes.
- [x] `layout.tsx` — `generateMetadata()` uses `...(faviconUrl ? { icons: {...} } : {})` spread (line 30), which omits the `icons` key entirely from the returned object when `faviconUrl` is falsy — matches D3.
- [x] `layout.tsx` — `openGraph` and `twitter` metadata objects have no `images` key at all, and no reference to `/prev.png` remains. No speculative fallback to `logoUrl`/`faviconUrl` was invented — matches D4, no scope creep.
- [x] `public/head_logo.png`, `public/head_logo_night.png`, `public/logo.png`, `public/prev.png` confirmed deleted.
- [x] `public/dark.png` and `public/light.png` untouched — out of scope, correctly left alone.
- [x] All four touched files stay well under the 500-line limit.
- [x] All Acceptance Criteria in the plan now pass, including Criterion #2 (dark-logo-only config shows the dark logo on both desktop and mobile), which failed in the previous round.
- [x] `npm run lint` / `npx tsc --noEmit` / `npm run test` (291/291) all clean per coder's post-fix verification.

## Summary
Both post-review fixes from the prior NEEDS CHANGES round were applied correctly and precisely: the `HomeClient.tsx` mobile logo block's outer gate now matches the desktop block's `(config.logoUrl || config.darkLogoUrl)` condition without disturbing the already-correct inner per-image conditional rendering, and the stale `BrandHeader.tsx` comment was updated to no longer reference the deleted `head_logo` asset. No regressions were introduced in either file. Every Acceptance Criterion now genuinely passes, including the previously-failing Criterion #2 for the mobile viewport. Approved.
