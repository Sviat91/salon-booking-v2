# Plan: Fix SUPERADMIN password-change crash + unify default brand-name fallback

**Date:** 2026-08-04
**Status:** In Progress
**Mode:** LIGHT (one well-understood React bug pattern + a mechanical string-consolidation, no architecture decisions)

## Problem 1 — password-change crashes with "Cannot read properties of null (reading 'reset')"

`src/app/admin/settings/SuperAdminCredentials.tsx`'s `CredentialForm.handleSubmit` (lines 25-41) does:
```ts
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  ...
  try {
    await onSubmit(data)
    ...
    e.currentTarget.reset()   // <-- crashes here
```
React nulls out a SyntheticEvent's `currentTarget` as soon as the synchronous portion of an event handler finishes — accessing it after an `await` is a well-known React footgun and throws exactly this error. This is what the user hit on their first password-change attempt (before even getting to the real "wrong password" validation on a later attempt).

### Fix (D1)
Capture the form element synchronously, before the `await`:
```ts
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  const form = e.currentTarget   // captured synchronously, safe to use after await
  setStatus(null)
  setLoading(true)
  const data0 = new FormData(form)
  ...
  try {
    await onSubmit(data)
    setStatus({ ok: true, message: t('admin.settings.general.savedSuccessfully') })
    form.reset()
  } catch (err) { ... }
}
```

## Problem 2 — no way to catch a mistyped new password, no way to verify it while typing

The password-change form (same file, `SuperAdminCredentials.tsx`) has only one "new password" field — a typo there is undetectable until the next login fails. The user asked for two things: a confirm-password field, and a way to reveal what was typed.

### Fix (D2)
- Add a `confirmPassword` field to the password-change `CredentialForm` instance only (not the email-change form — that one has no "new password" concept).
- Client-side check in `handleSubmit` (or in the password form's `onSubmit` callback) before calling the API: if `newPassword !== confirmPassword`, set the error status immediately (`t('admin.settings.general.passwordMismatch')`, new key) and return — do not call the API.
- Add a show/hide toggle (eye icon) to password-type `<Input>` fields **in this component only** — a small local `type={showPassword ? 'text' : 'password'}` state per field, toggled by a button positioned inside/beside the input. Check `src/components/ui/PhoneInput.tsx` or any existing show/hide-password pattern in the codebase first and reuse it if one already exists (e.g. the login/register password fields, or `admin/masters/MasterForm.tsx`'s "Show current password" feature) rather than inventing a new one — match whatever icon/lib the codebase already uses for this (likely `lucide-react`'s `Eye`/`EyeOff`).

## Problem 3 — inconsistent, confusing default brand-name fallback

Confirmed via `grep -rn "Somique Beauty\|'Salon Booking'" src` — the "no brand name configured yet" fallback is duplicated as a **literal string in 14 separate places**, and inconsistently: some say `"Somique Beauty"` (looks like someone else's real, already-branded business), others say `"Salon Booking"`. The user's complaint: an unconfigured fresh install should never look like it already belongs to a specific business — it should read as an obvious placeholder.

Locations (all confirmed via grep, do not miss any):
- `src/lib/tenant.ts:5` — `DEFAULT_CONFIG.brandName`
- `src/app/layout.tsx:20` — page `<title>`/OG metadata
- `src/components/layout/Header.tsx:16` — `Header`'s default prop value
- `src/components/Footer.tsx:44` — copyright line
- `src/app/auth/{login,register,forgot-password,reset-password}/page.tsx` — 2 occurrences each (metadata title + `BrandNameDisplay` prop) = 8 occurrences
- `src/lib/email.ts:57,115`
- `src/lib/notifications/index.ts:36,171,466`

### Fix (D3)
1. New file `src/lib/constants/brand.ts` (new, ~3 lines): `export const DEFAULT_BRAND_NAME = 'Salon'`. Must have **zero other imports** — this needs to be safely importable from both server-only code (`tenant.ts`, which imports Prisma at module scope) and client components (`Header.tsx`, `Footer.tsx`), so it cannot live inside `tenant.ts` itself or anything that pulls in Prisma/`next/cache`.
2. Replace all 14 literal occurrences listed above with `DEFAULT_BRAND_NAME` (import from `@/lib/constants/brand`), removing the inconsistency between `"Somique Beauty"` and `"Salon Booking"` entirely — zero literal fallback strings should remain after this (verify with the same grep before calling this done).
3. Do **not** attempt to make this fallback a translated instructional sentence (e.g. "Set your name in Settings") — `BrandNameDisplay` (`src/components/auth/BrandNameDisplay.tsx`) specifically splits the brand name on whitespace and styles the *last word* differently, which is designed for a short 1-3 word brand name, not a sentence; a longer instructional string would render with an unintended visual split. `'Salon'` is short, neutral, renders correctly everywhere including that component, and fully resolves the "looks like someone else's real business" complaint without touching `BrandNameDisplay`'s styling logic or threading translation into server-side email/notification code that doesn't currently need it.

## Problem 4 — "wrong password" on the credentials-change form

Reviewed `src/app/api/admin/superadmin/credentials/route.ts` — the logic is correct: it looks up the **currently logged-in session user's own** stored password hash and does a straightforward `bcrypt.compare`. No bug found here. This is almost certainly the user testing with a stale/wrong password (e.g. a manually-noted old password from a previous install, rather than the one actually generated for the current fresh deployment) — **not a code fix, just a note for the final report to tell the user this explicitly** so they re-check which credentials they're using.

## Implementation Steps

- [x] **Step 1**: Fix the `e.currentTarget` crash in `src/app/admin/settings/SuperAdminCredentials.tsx` per D1.
- [x] **Step 2**: Add confirm-password field + client-side mismatch check + show/hide toggle to the password-change form in the same file, per D2. Check for an existing show/hide-password pattern elsewhere in the codebase (e.g. `admin/masters/MasterForm.tsx`) before inventing a new one.
- [x] **Step 3**: New key(s) needed in all three locale files (`pl`/`en`/`uk`, `npm run i18n:check` enforces parity): `admin.settings.general.confirmPasswordField` (label), `admin.settings.general.passwordMismatch` (error message). Real translations, never empty strings.
- [x] **Step 4**: Create `src/lib/constants/brand.ts` with `DEFAULT_BRAND_NAME` per D3.1.
- [x] **Step 5**: Replace all 14 literal occurrences with `DEFAULT_BRAND_NAME` per D3.2. Re-run `grep -rn "Somique Beauty\|'Salon Booking'" src` afterward — must return zero matches.
- [x] **Step 6**: DOX — add a one-line bullet to `src/lib/AGENTS.md` noting `DEFAULT_BRAND_NAME` in `src/lib/constants/brand.ts` is the single source of truth for the unconfigured-tenant fallback, and that no file should hardcode its own literal fallback string.
- [x] **Step 7**: Verification — `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run i18n:check`. Do NOT run `npm run dev`/`npm run build`.

## Acceptance Criteria

- [x] Password-change form no longer crashes; submitting with a correct current password + matching new/confirm password succeeds; a mismatched new/confirm pair is caught client-side with a clear message before any API call; a wrong current password still shows the existing server-driven "current password incorrect" message (untouched, already correct).
- [x] Show/hide toggle works on the password fields in this form.
- [x] `grep -rn "Somique Beauty\|'Salon Booking'" src` returns zero matches.
- [x] `src/lib/constants/brand.ts` has no imports besides its own export.
- [x] `npm run lint`/`tsc`/`test`/`i18n:check` all clean, no new issues.
- [x] Every touched file stays under 500 lines.
- [x] `git diff --stat` touches only: `SuperAdminCredentials.tsx`, the 4 `auth/*/page.tsx` files, `layout.tsx`, `Header.tsx`, `Footer.tsx`, `email.ts`, `notifications/index.ts`, `tenant.ts`, the new `constants/brand.ts`, 3 locale files, `src/lib/AGENTS.md` (also `src/components/AGENTS.md`, updated to keep its doc text consistent with the new fallback — it referenced the literal `'Salon Booking'` string being replaced).

## Out of scope
- The "wrong current password" report — confirmed not a bug, no code change (Problem 4 above).
- Any deeper i18n/translated-instructional-message version of the brand fallback (D3.3) — deliberately kept as a short neutral word.
- Anything unrelated to these two components/thirteen-plus files.
