# Review: i18n Remediation — Client-Facing Surfaces
**Date:** 2026-07-15
**Verdict:** APPROVED (after one round of minor fixes)

## Critical/Architectural Issues
None. The highest-risk item — booking-management's error architecture (`ApiError`/`apiErrorKey`) — was implemented correctly and completely across `bookingManagementApi.ts`, `useBookingMutations.ts`, and `useBookingHandlers.ts`; every mutation's `onError` path resolves through `t(apiErrorKey(code))`. The additive `reasonCode` field on the check-extension route (`src/app/api/bookings/[id]/check-extension/route.ts`) is a clean, non-breaking change matching its real business logic.

## Minor/Syntax Issues (both fixed and re-verified)
- [x] `ContactMasterPanel.tsx` — previously displayed raw untranslated Polish server prose instead of routing through `code`. **Fixed**: now throws `ApiError(data.error ?? '', data.code)` and renders only `t(apiErrorKey(...))`; raw server text never reaches the UI. Confirmed at lines 8-9 (imports), 66-68 (throw), 75 (render).
- [x] `EditProcedurePanel.tsx`, `ConfirmCancelPanel.tsx`, `CancelSuccessPanel.tsx` — previously hand-rolled a `uk-UA`/`en-US`/`pl-PL` ternary instead of the centralized `localeFor()` helper (inconsistent with `en-GB` used elsewhere). **Fixed**: all three now import and call `localeFor(language)` from `@/lib/i18n`; no leftover ternary in any file (grep-confirmed zero matches).

## Passed Checks
- [x] Every consumer of `bookingManagementApi.ts` (search, updateProcedure, update, updateTime, cancel, checkExtensionAvailability, contact) resolves errors via `code → apiErrorKey → t()`, never raw `error.message`.
- [x] `ThemeToggle.tsx`, `ErrorBoundary.tsx` (correct class-component `i18n` singleton usage), `PhoneInput.tsx`, `ConsentWithdrawalModal.tsx`, `ExportResultView.tsx` — all hardcoded literals replaced with `t()`.
- [x] `exportFormat.ts` CSV/JSON headers deliberately left Polish with a documented comment (data artifact, not on-screen UI) — acceptable per plan's AD-6 discretion.
- [x] `BookingForm.tsx` (sole validator caller) wraps all 3 call sites with `t(result.error, result.errorParams)`.
- [x] New `AuthFooterLinks.tsx` component genuinely used by all 4 auth page wrappers, not orphaned.
- [x] `src/locales/{pl,en,uk}.json` — identical key sets (519 keys × 3), real distinct translations, interpolation tokens preserved.
- [x] No admin-scope files touched; no unauthorized API business-logic changes beyond the one flagged additive `reasonCode` field.
- [x] Remaining hardcoded `pl-PL` date literals in `EditDatetimePanel.tsx`/`TimeChangeErrorPanel.tsx`/`CancelErrorPanel.tsx` are an accurately-documented, pre-existing, intentionally out-of-scope gap — not a regression, not silently expanded.

## Independent Verification (orchestrator, after both review rounds)
- `npm run lint` → 54 problems (49 errors, 5 warnings) — identical to pre-existing baseline, zero new issues.
- `npm run test` → 20/20 files, 112/112 tests passing.
- `node scripts/i18n-check.mjs` → PASS: 519 keys in sync across pl/en/uk; all 385 referenced `t()`/`i18n.t()` keys resolve (zero missing).
- `npm run build` → succeeds (per coder's report).

## Summary
Client-facing i18n remediation (Part 2 of 3) is complete and verified. All booking-management API errors now display translated text driven by `code`, switching language changes error text correctly, auth forms render fully in pl/en/uk, and dates use the centralized locale mapping consistently. Approved — proceed to the admin plan (Part 3) in a future session, per the user's one-plan-at-a-time cadence.
