# Review: Favicon upload fixes (real SVG support + auto-resize)
**Date:** 2026-08-04
**Verdict:** APPROVED (after fixing one critical + one minor finding)

## Critical/Architectural Issues (fixed post-review)
- **Shared `ALLOWED_TYPES` blast radius**: `/api/upload`'s `ALLOWED_TYPES` is shared across 4 upload call sites. `LogoEditor.tsx` already claimed SVG support in its `accept` attribute *before* this plan touched anything — adding `image/svg+xml` to the shared allowlist turned its previously-failing-cleanly SVG uploads into successfully-persisted-but-broken-preview uploads (it still used `next/image`'s `<Image fill>`, which refuses SVG by default, same as the favicon field did before this fix). Resolved: applied the identical `<img>` swap to both light/dark logo previews in `LogoEditor.tsx`, removed its now-unused `next/image` import.

## Minor/Syntax Issues (fixed post-review)
- Stale error message in `upload/route.ts` still said "PNG, JPEG, WebP and GIF" after SVG was added to `ALLOWED_TYPES` — updated to mention SVG.

## Passed Checks
- [x] `ALLOWED_TYPES` includes `"image/svg+xml"`.
- [x] Favicon preview (`FormFields.tsx`) uses a plain `<img>`, correctly replicating the previous `fill` + `object-contain p-1` layout — no regression for existing PNG/JPEG favicons.
- [x] Unused `next/image` import removed from `FormFields.tsx`.
- [x] `image/x-icon` removed from the favicon file input's `accept`.
- [x] `SettingsForm.tsx`'s `uploadFile` correctly branches: SVG skips `resizeImageIfNeeded` entirely, everything else gets resized to 512px first.
- [x] `src/lib/image-resize.ts` untouched — reused as-is from the earlier logo fix.
- [x] `next.config.mjs` untouched — no `dangerouslyAllowSVG` added.
- [x] XSS-safety reasoning (D2) holds — every `faviconUrl`/`logoUrl` reference across the codebase is a plain `src`/`href` (image context, script-inert for SVG); no `dangerouslySetInnerHTML`/`<object>`/`<embed>`/`<iframe>` involving uploaded content anywhere.
- [x] File sizes all well under 500 lines.
- [x] `npm run lint` / `npx tsc --noEmit` / `npm run test` (291/291, independently re-confirmed) all clean.

## Summary
Both the favicon fix and its necessary extension to the logo uploader (surfaced by the reviewer's blast-radius analysis of the shared upload endpoint) are now complete and consistent. SVG favicons and logos both upload, preview, and render correctly; raster favicons/logos get client-side resized before upload; no XSS exposure introduced since uploaded SVG is never inlined into the DOM anywhere in the codebase. One known, low-probability residual (background image and master-photo previews share the same `next/image` pattern but don't advertise SVG support in their `accept` attributes) is documented and deliberately deferred, not silently dropped.
