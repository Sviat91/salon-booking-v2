# Review: logo-upload-resize
**Date:** 2026-08-04
**Verdict:** APPROVED (one minor finding fixed post-review)

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
- **Fixed after review**: unhandled `img.onerror` rejection in `src/lib/image-resize.ts` — a corrupt/unloadable file selection would have thrown an unhandled promise rejection instead of gracefully falling through. Wrapped the image-load promise in try/catch, falling back to returning the original `file` unchanged on error (consistent with the file's existing "if we can't safely resize, pass the original through" fallback philosophy for the `!ctx`/`!blob` cases).

## Passed Checks
- [x] `resizeImageIfNeeded(file, maxDimension = 2000)` signature matches spec.
- [x] Early-return path: unchanged original `File`, no re-encode, if both dimensions already `<= maxDimension`.
- [x] Proportional downscale preserving aspect ratio.
- [x] Re-encodes with the *original* file's MIME type — PNG stays PNG (transparency preserved), JPEG stays JPEG at quality 0.9.
- [x] Result wrapped back into a `File` with the same name/type.
- [x] `URL.revokeObjectURL()` called in a `finally` block — no leak on success or error.
- [x] Zero non-browser-API imports — pure Canvas/Image/URL browser APIs.
- [x] Both `LogoEditor.tsx` file-input handlers (light + dark logo) await `resizeImageIfNeeded()` before `uploadImage(...)`, no other restructuring.
- [x] `src/app/api/upload/route.ts` and all other upload call sites confirmed untouched.
- [x] File sizes: `image-resize.ts` ~50 lines, `LogoEditor.tsx` 454 lines — both well under 500.
- [x] `canvas.toBlob` null case and `ctx` null case both fall back to the original file rather than crashing.
- [x] `npm run lint` / `npx tsc --noEmit` clean after the post-review fix.

## Summary
Clean, faithful implementation matching the plan. The only gap (unhandled rejection on a corrupt file) was non-blocking and has been fixed directly. Ready to ship.
