# Review: og-image (Dynamic OG/Twitter preview card)
**Date:** 2026-08-06
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none — the one flagged issue, a misleading test title in `tests/lib/og-image.test.ts:102`, was fixed in a follow-up round and re-verified: 36/36 tests pass.)

## Passed Checks
- [x] `import sharp` is absent from module scope in `src/lib/og-image.ts` — only `await import('sharp')` inside `loadOgLogo`'s try block.
- [x] `loadOgLogo`'s try/catch wraps every fallible operation (`readFile`, dynamic `import('sharp')`, `sharp()` init, `.metadata()`, `.resize()...toBuffer()`) and always returns `null` on failure, never rethrows.
- [x] `UPLOAD_URL` regex is genuinely traversal-safe: `..`, subdirs, absolute URLs, and `/public/uploads/...` all correctly rejected.
- [x] `src/app/opengraph-image.tsx` exports `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `size`, `contentType`; no `alt` export, no `fonts` option, no edge runtime.
- [x] `src/app/layout.tsx` has zero diff — confirmed independently via `git diff src/app/layout.tsx` (empty output). No `twitter-image.tsx` file exists.
- [x] AD-3/deviation-note reasoning (WebP succeeds via sharp decode rather than being rejected — rejection happens downstream in satori/`ImageResponse`, not in `loadOgLogo`) is technically correct and was the right call, documented transparently in the plan rather than silently resolved.
- [x] Test coverage is real: `brandFontSize` boundary cases, `safeColor`'s CSS-injection case, `resolveUploadPath`'s traversal/subdir/absolute-URL rejections, `loadOgLogo`'s real temp-file round trip proving both `LOGO_MAX_UPSCALE=2` and the 800×340 box-fit — all with actual sharp-generated PNGs, no mocks.
- [x] No dead code, no scope creep — exactly the three plan-specified files created, plus three AGENTS.md DOX edits.
- [x] `git diff --name-only` (orchestrator, independently run): only the three AGENTS.md files show as modified tracked files; the three new files (`src/lib/og-image.ts`, `src/app/opengraph-image.tsx`, `tests/lib/og-image.test.ts`) are untracked additions, exactly as planned.
- [x] `npm run lint` (orchestrator, independently run): 46 pre-existing problems, unchanged baseline.
- [x] `npm run test` (orchestrator, independently run): 36 test files, 345 tests, all passing.

## Summary
Careful, well-scoped implementation of an architecturally sensitive feature (the route's module graph is imported during Next.js metadata resolution for every page, so nothing may throw at module scope). The lazy `sharp` import is properly isolated inside a complete try/catch, the upload-path traversal guard is genuinely safe, the route correctly omits `alt`/`fonts`/edge runtime, and `layout.tsx` is untouched exactly as required to preserve Next's file-convention OG/Twitter merge. The one cosmetic issue found in review (a test title contradicting its own assertion) was fixed and re-verified. Approved as final.
