# Review: Tenant Branding Fixes + Remaining i18n Date-Locale Gap
**Date:** 2026-07-15
**Verdict:** APPROVED (after adding one reviewer-flagged item to scope)

## Critical/Architectural Issues (found, then closed)
- [x] **Scope gap**: `src/components/home/HomeClient.tsx` (backs the actual homepage, `src/app/page.tsx`) had the identical hardcoded logo-fallback bug that Item 1 (`LogoDisplay.tsx`) fixed, but wasn't in the original 6-item file list. Reviewer caught this against the plan's own Acceptance Criterion #1 ("no page shows the Somique Beauty logo when unconfigured"). **Fixed**: added as Item 7/Step 7, coder removed the hardcoded fallback in both the desktop block (deleted entirely, sibling block already handles the real-logo case) and mobile block (ternary → `&&`, no else-branch). Confirmed via grep: no more reachable `/head_logo.png` JSX in the file (only the same harmless unreachable fallback-string pattern already accepted in `LogoDisplay.tsx`).

## Minor/Syntax Issues (not blocking, noted for optional future follow-up)
- `LogoDisplay.tsx`/`HomeClient.tsx` — `logoSrc`/`darkLogoSrc` local variables still compute a string fallback to `/head_logo.png` that's never actually reached (dead but harmless). Cosmetic only.
- `src/components/layout/Header.tsx` — dead code (zero imports anywhere), has a hardcoded `brandName = "Somique Beauty"` default prop. Confirmed unreachable/unused; flagged for the user to decide whether to delete per the project's existing "delete confirmed dead code" directive, not touched by this plan.
- `src/lib/tenant.ts` / `src/app/layout.tsx` — root-level fallback still says `"Somique Beauty"` rather than `"Salon Booking"`. Out of this plan's explicit scope (these weren't among the 7 touched items); flagged as a candidate for a future consistency pass, not a regression introduced here.

## Passed Checks (all 7 items)
- [x] `LogoDisplay.tsx` — returns `null` when no logo configured.
- [x] `BrandHeader.tsx` — mobile logo block wired to tenant config via react-query, renders nothing when unset; avatar/layoutId logic untouched.
- [x] `Footer.tsx` + all 3 locale files — `footer.copyright` KEY VALUE (not just fallback arg) now interpolates `{{year}}`/`{{brandName}}`, correct `'Salon Booking'` fallback.
- [x] `BrandNameDisplay.tsx` (new) — exact split rule implemented (2+ words: all-but-last bold + last word thin; 1 word: whole string, no split); wired into all 4 auth pages with correct fallback; all 4 pages converted to async `generateMetadata()` with real brand name.
- [x] `exportFormat.ts`/`DataExportModal.tsx`/`ExportResultView.tsx` — `generateCSV` localized via new `gdpr.export.csv.*` namespace (genuine distinct translations, not copy-paste); `formatDate` takes a `locale` param; all call sites updated including the forced `ExportResultView.tsx` consequence; stale comment removed; `generateJSON` correctly untouched.
- [x] `EditDatetimePanel.tsx`/`TimeChangeErrorPanel.tsx`/`CancelErrorPanel.tsx` — `localeFor(language)` applied, matching sibling panels; `i18n-client_plan.md`'s "Known gap" note updated to reflect closure.
- [x] `HomeClient.tsx` — hardcoded logo fallback removed (added post-review, confirmed fixed).
- [x] Interpolation tokens intact across all 3 locale files; no file exceeds 500 lines; nothing under `src/app/admin/**` touched; DOX docs (`src/components/AGENTS.md`, `src/components/booking-management/AGENTS.md`) updated accurately.

## Independent Verification (orchestrator, after the post-review fix)
- `npm run lint` → 54 problems (49 errors, 5 warnings) — identical to pre-existing baseline.
- `npm run test` → 20/20 files, 112/112 tests passing.
- `node scripts/i18n-check.mjs` → PASS: 536 keys in sync across pl/en/uk; all 402 referenced keys resolve.
- `npm run build` → succeeds (per coder's report).
- Grepped `HomeClient.tsx` directly: no reachable hardcoded logo JSX remains.

## Summary
All 7 items (6 original + 1 reviewer-flagged homepage gap) are implemented and verified. Every leftover hardcoded "Somique Beauty" artifact the user found (homepage logo, mobile booking-page logo, footer copyright, auth-page brand text/titles) is now dynamically driven by `TenantConfig.brandName`/`logoUrl`, with `'Salon Booking'` as the correct fallback. The GDPR CSV export and the three remaining booking-management date panels are now fully locale-aware. Three minor, explicitly out-of-scope items were noted for a possible future pass (dead `Header.tsx`, and two root-level `"Somique Beauty"` fallback strings in `tenant.ts`/`layout.tsx`) but do not block this checkpoint.
