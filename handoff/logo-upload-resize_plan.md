# Plan: Auto-resize oversized logo uploads client-side

**Date:** 2026-08-04
**Status:** Implemented (steps 1-2 complete; manual verification of large-image upload behavior pending)
**Mode:** LIGHT (standard canvas-resize pattern, no architecture decision, contained to one file + one new utility)

## Problem

Uploading a large logo (e.g. a hi-res "Loom & Blade" style PNG export) in `/admin/settings` → Logo produces a broken image with no error shown to the admin. Root cause: `/api/upload/route.ts` only checks MIME type and byte size (max 4MB) — it accepts the file and writes it to disk regardless of pixel dimensions. The image then renders via `next/image`, which requests optimized variants through Next's built-in `/_next/image` endpoint — and that request 400s (confirmed in console: `GET /_next/image?url=...&w=256&q=75 400`, repeated for every requested size). Next's image optimizer uses Sharp internally, which has a default decode-pixel-count safety limit; a very large source image (huge width×height, regardless of file byte size) exceeds it and gets rejected. The upload itself "succeeds" (no error), so the admin has no idea why the logo shows broken afterward.

## Decision

Resize the image **client-side, before upload** — cap the longest side at a safe maximum so it can never trigger this limit, and skip processing entirely for images already under the cap (no quality loss for normal-sized logos).

## Implementation Steps

- [x] **Step 1: New client-safe utility**
  - File: `src/lib/image-resize.ts` (new)
  - Export `async function resizeImageIfNeeded(file: File, maxDimension = 2000): Promise<File>`.
  - Logic: load the file into an `Image`/`createImageBitmap`, read natural width/height. If both are already `<= maxDimension`, return the original `file` unchanged (no re-encode, no quality loss). Otherwise, compute a scale factor to bring the longest side down to `maxDimension` (preserve aspect ratio), draw onto an offscreen `<canvas>` at the new dimensions, and export via `canvas.toBlob()` — **using the original file's MIME type** (`file.type`) so a PNG stays PNG (preserves transparency, no lossy re-encode) and a JPEG stays JPEG (quality ~0.9). Wrap the resulting `Blob` back into a `File` with the same `name`/`type` so the rest of the upload flow (which reads `file.type`/`file.name`) doesn't need to change.
  - Must be safely importable from a `"use client"` component only — uses `document.createElement('canvas')`/`Image()`/`URL.createObjectURL`, all browser-only APIs. No new npm dependency — plain Canvas API.
  - Clean up: revoke any `URL.createObjectURL()` object URL after use (avoid a memory leak on repeated uploads).
  - 2000px is deliberately generous for a logo (`config.logoWidth`/`logoHeight` default to 200×80 and are admin-adjustable, but nothing in this UI needs a multi-thousand-pixel source) — comfortably resolves the reported failure without visibly degrading quality for any realistic logo image.

- [x] **Step 2: Wire into `LogoEditor.tsx`'s two upload call sites**
  - File: `src/app/admin/settings/LogoEditor.tsx`
  - Both `<input type="file">` `onChange` handlers (light logo ~line 273-276, dark logo ~line 319-322) currently call `uploadImage(file, ...)` directly on the raw selected `File`. Import `resizeImageIfNeeded` from `@/lib/image-resize` and await it on the selected file before calling `uploadImage`, e.g.:
    ```ts
    onChange={async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const resized = await resizeImageIfNeeded(file)
      uploadImage(resized, onLogoUpload, () => {}, onLogoUploadStart, (code) => code ? t(apiErrorKey(code)) : t('admin.masters.uploadFailed'))
    }}
    ```
  - Match the exact existing surrounding code style/guard clauses in each handler — do not otherwise restructure these handlers.

## Acceptance Criteria

- [x] `npm run lint` / `npx tsc --noEmit` / `npm run test` clean, no new issues (pre-existing lint errors in unrelated files are untouched by this change).
- [x] `src/lib/image-resize.ts` has no non-browser-API imports (no React, no Next-specific imports).
- [ ] Uploading a very large image (e.g. 6000×4000) through either logo slot no longer produces a broken image or `/_next/image` 400s — it renders correctly.
- [ ] Uploading an already-reasonably-sized image (e.g. 400×200) is byte-identical to before (the `<= maxDimension` early-return path, no re-encode).
- [ ] PNG transparency is preserved after resize (verify by uploading a transparent-background PNG logo and confirming no white/black fill appears).
- [ ] Only `LogoEditor.tsx` and the new `image-resize.ts` are changed — no other upload call site (master photos, page-content images, etc.) touched in this pass.
- [ ] Every touched/new file stays under 500 lines.

## Out of scope
- The two "Uncaught Error: Minified React error #422/#425" hydration errors seen in the same console dump — very plausibly a side effect of the broken-image render state (Next's `<Image>` component behaving differently server vs. client when the underlying image request fails), but not confirmed. Fix the image sizing first; if the hydration errors still reproduce afterward with a properly-sized logo, that needs a separate investigation — do not attempt a speculative fix for it in this pass.
- Applying the same client-side resize to other upload spots (master profile photos, content-page photo widgets, etc.) — the utility is written generically enough to be reused there later, but wiring it into those call sites is a separate, deliberately-scoped follow-up, not part of this fix.
- Any change to `src/app/api/upload/route.ts`'s server-side validation (its 4MB/MIME-type checks are unrelated to this specific pixel-dimension issue and stay as-is).
