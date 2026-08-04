# Review: settings-fixes (SUPERADMIN password-crash fix + confirm-password + brand-name consolidation)
**Date:** 2026-08-04
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] Crash fix: `SuperAdminCredentials.tsx:31` captures `const form = e.currentTarget` synchronously before any `await`, and `form.reset()` (not `e.currentTarget.reset()`) is called after `await onSubmit(data)` — correct fix for the React SyntheticEvent-nulling footgun.
- [x] Confirm-password mismatch check (`onValidate` prop) runs synchronously before the API call is invoked, returns early with a client-side message — no wasted network round-trip on mismatch.
- [x] `onValidate` is passed only to the password-change `CredentialForm` instance; the email-change form has no `onValidate` — correctly scoped.
- [x] `confirmPassword` field added only to the password form's `fields` array, not the email form.
- [x] Show/hide toggle is a real local `useState` keyed per-field-id, toggling input `type` with `Eye`/`EyeOff` icons from `lucide-react` (already a dependency, used elsewhere) — no new dependency added. Button is `type="button"` with `tabIndex={-1}`, doesn't interfere with submit or tab order.
- [x] `grep -rn "Somique Beauty\|'Salon Booking'" src` returns zero matches.
- [x] `src/lib/constants/brand.ts` contains exactly `export const DEFAULT_BRAND_NAME = 'Salon'` with zero imports — safe for both server-only Prisma-importing code and client components.
- [x] All 14 originally-listed literal occurrences replaced with `DEFAULT_BRAND_NAME` across `tenant.ts`, `layout.tsx`, `Header.tsx`, `Footer.tsx`, the 4 `auth/*/page.tsx` files, `email.ts`, `notifications/index.ts`.
- [x] `src/app/api/admin/superadmin/credentials/route.ts` confirmed unmodified — consistent with the plan's finding that no bug exists there.
- [x] i18n: `admin.settings.general.confirmPasswordField` and `admin.settings.general.passwordMismatch` present with real, non-empty translations in all three locale files.
- [x] File sizes: `notifications/index.ts` 440 lines (was near the 500-line boundary, now comfortably under after a blank-line trim), all other touched/new files well under 500.
- [x] DOX updated correctly in `src/lib/AGENTS.md` and `src/components/AGENTS.md` — accurate, in-scope corrections tied to the D3 change.
- [x] `BrandNameDisplay.tsx` styling logic untouched as required — `'Salon'` is a single short word so no unintended visual split occurs.

## Summary
All three sub-tasks implemented correctly and match the plan precisely. Crash fix is the correct pattern. Confirm-password logic is properly scoped with a synchronous pre-API check. Show/hide toggle is genuine, no new dependency. Brand-name consolidation is complete and verified via direct grep — zero remaining literal occurrences of the old inconsistent strings. The superadmin credentials API route was correctly left untouched. No critical or minor issues found.
