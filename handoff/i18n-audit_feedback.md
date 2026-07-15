# Review: Full-App i18n Audit — Phase 0 (Foundation)
**Date:** 2026-07-15
**Verdict:** APPROVED (with minor, non-blocking follow-ups)

## Critical/Architectural Issues
None found. All six architecture decisions (AD-1 through AD-6) are honored:
- AD-1: `src/lib/errors/apiErrorKey.ts` is a pure function with a whitelist `Set` of the exact 25 unique enumerated codes from the plan, correct `errors.generic` fallback for unknown/undefined/empty code. No premature refactor of `bookingManagementApi.ts`/consumers (correctly deferred to the client sub-plan).
- AD-2: `src/lib/validation/client-validators.ts` — every validator (`validatePhone`, `validateEmail`, `validateName`, `validateRequired`, `validateTurnstileToken`) now returns an i18n key in `error`, and `errorParams` was added cleanly for `fieldRequired`'s `{{field}}` interpolation without touching any call sites (correctly deferred).
- AD-3: `src/lib/utils/date-formatters.ts` converted to locale-aware factories (`get*Formatter(locale = 'pl-PL')`), with the old module-level consts kept as pl-PL-bound instances for backward compatibility — verified all 4 existing call sites (`BookingForm.tsx`, `BookingSuccessPanel.tsx`, `SlotsList.tsx`, `EditAppointmentModal.tsx`) still import/call the same names with no args, so behavior is unchanged. `formatISODate` untouched. File is 100 lines, well under the 500-line limit. `localeFor()` added to `src/lib/i18n.ts` correctly.
- AD-4: `LanguageContext.tsx` writes the `lang` cookie both in `setLanguage()` and in the post-mount sync effect; `src/lib/i18n-server.ts` reads it via `next/headers cookies()` with correct `isValidLanguage` validation and `DEFAULT_LANGUAGE` fallback. `getServerT()` is not yet imported anywhere (correct — it's foundation-only infra for the admin sub-plan) and the hydration pattern is preserved, so no SSR/CSR mismatch risk was introduced.
- AD-5: Correctly NOT wired yet — `errors.boundaryTitle/boundaryDesc/reload` keys exist in all 3 locale files, but `ErrorBoundary.tsx` itself is untouched, matching the plan's explicit scoping of Phase 0 to steps 0.1–0.8 only.
- AD-6: Notification templates, CSV/JSON export bodies, and privacy/terms legal body text were all confirmed untouched.

`eslint.config.js`'s new `files: ['scripts/**/*.mjs']` override only adds `globals.node` for `.mjs` files — narrowly scoped, does not touch the existing `**/*.{ts,tsx,js,jsx}` block or loosen any rule elsewhere.

`scripts/i18n-check.mjs` does what's claimed: flattens all 3 JSONs into dot-path key sets, asserts identical membership, separately regex-scans `src/**` for `t('...')`/`i18n.t('...')` literal calls and reports keys missing from all 3 files. Wired as `npm run i18n:check` in `package.json`.

`tests/lib/validation/client-validators.phone.test.ts` correctly asserts against the new key-based contract, not stale prose expectations.

## Minor/Syntax Issues
- [x] `src/locales/pl.json` — `theme.switchToLight`/`switchToDark` read "Przełącz na jasną **motyw**" / "ciemną **motyw**" (should be "jasny"/"ciemny" motyw). Plan flagged this as optional. **Fixed by orchestrator post-review.**
- [x] Verification gap: reviewer lacked Bash access. **Closed by orchestrator** — see Independent Verification below.

## Independent Verification (run by orchestrator after review)
- `npm run test`: PASS
- `npm run lint`: baseline confirmed unchanged
- `node scripts/i18n-check.mjs`: key parity PASS across pl/en/uk; Category-3 missing-key gaps remain as expected (owned by client/admin sub-plans)

## Summary
Phase 0 is a clean, faithful implementation of the plan: every one of the 8 steps and all 6 architecture decisions are correctly scoped and executed, with no scope creep into the client/admin sub-plans' territory. Locale JSON key parity, interpolation-token preservation, and translation plausibility all check out. Approved — proceed to the client sub-plan in a future session (per user's one-plan-at-a-time cadence).
