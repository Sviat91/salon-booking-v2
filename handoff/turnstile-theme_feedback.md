# Review: Turnstile theme wiring
**Date:** 2026-08-04
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `src/lib/turnstile-theme.ts` matches the plan exactly: pure function, `typeof document === 'undefined'` guard returning `'light'`, no React import, 4 lines of logic.
- [x] All 9 listed call sites import `getTurnstileTheme` and pass `theme: getTurnstileTheme()` inside the existing `turnstile.render({...})` options object:
  - `src/app/support/page.tsx:79`
  - `src/components/DataExportModal.tsx:133`
  - `src/components/BookingForm.tsx:145`
  - `src/components/DataErasureModal.tsx:164`
  - `src/components/ConsentWithdrawalModal.tsx:151`
  - `src/components/auth/ForgotPasswordForm.tsx:46`
  - `src/components/auth/LoginForm.tsx:58`
  - `src/components/auth/RegisterForm.tsx:60`
  - `src/components/booking-management/hooks/useTurnstileSession.ts:31`
- [x] No reordering of surrounding options in any file — `theme` was inserted cleanly without disturbing other keys.
- [x] No unrelated logic changed in any of the 9 files — no new state, no MutationObserver, no re-render-on-toggle code added.
- [x] Grep for `turnstile\.render\(` across the repo returns exactly the same 9 source files — no missed or extra call sites.
- [x] Grep for `getTurnstileTheme` returns exactly the same 9 files + the new utility file — nothing wired in unexpectedly, nothing left unwired.
- [x] `src/lib/turnstile-client.ts` (a separate, pre-existing Turnstile helper) confirmed untouched — scope stayed contained.

## Summary
Clean, minimal, surgical change matching the plan precisely — a tiny pure utility wired into all 9 existing `turnstile.render()` call sites, each gaining exactly one new line, no other changes anywhere. No critical or minor issues found.
