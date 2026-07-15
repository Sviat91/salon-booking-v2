# Plan: i18n Remediation — Client-Facing Surfaces
**Date:** 2026-07-15
**Status:** Implemented by coder; reviewer requested two minor/mechanical fixes (`ContactMasterPanel.tsx` raw-error leak, `localeFor()` consistency in 3 panels) — both applied and re-verified. See note under Acceptance Criteria for one still-documented out-of-scope deviation.

> Part 2 of 3. **Prerequisite: `handoff/i18n-audit_plan.md` Phase 0 must be DONE first**
> (errors.* namespace, apiErrorKey(), expanded validation.*, locale-aware date
> formatters, uk profile keys, `i18n-check` script). This plan wires those into the
> client UI and fixes all client-facing hardcoded/missing strings.
> Covers: landing, booking flow, profile, auth, support, GDPR self-service, and all
> shared client components. Admin/master is Part 3 (`i18n-admin_plan.md`).

## Goal
Every client-facing string renders in the active language (pl/en/uk): no hardcoded
Polish/Russian literals, no missing-key English fallbacks, and all API errors mapped
via `code → t()`.

## Scope
**In:** `src/app/page.tsx`, `src/app/[masterId]/**`, `src/app/profile/**`,
`src/app/auth/**`, `src/app/support/**`, `src/components/**` EXCEPT `src/components/admin/**`.
**Out:** admin/master (Part 3); privacy/terms legal body; email templates; dev comments.

## Architecture Decisions
Inherits AD-1..AD-6 from `i18n-audit_plan.md`. Local application notes:
- **Booking-management error wiring (AD-1):** `bookingManagementApi.ts` throws
  `ApiError` carrying `code`; hooks/panels render `t(apiErrorKey(err.code))`. Delete the
  hardcoded `code→Polish` map in `cancelBooking` (superseded by the i18n namespace).
- **EditProcedurePanel magic-string (L186):** it compares
  `extensionCheckResult.reason === 'konflikt z kolejną rezerwacją'`. The extension-check
  API (`/api/bookings/[id]/check-extension`) must return a stable `reason` CODE, and the
  panel maps it via i18n — do NOT keep comparing translated prose. Confirm the API's
  `result.status/reason` contract when wiring.
- **New keys go under the most specific existing namespace** (`auth.*`, `form.*`,
  `consent.*`, `management.*`, `booking.*`, `profile.*`, `gdpr.*`, `errors.*`); create a
  new namespace only if none fits.

## Implementation Steps

### Group A — Booking-management module (error architecture + hardcoded Polish)
- [x] A1: `src/components/booking-management/api/bookingManagementApi.ts`
  - Add `class ApiError extends Error { code?: string }`. In each `!response.ok` branch,
    parse `{ error, code }` and `throw new ApiError(json.error ?? '', json.code)` (keep
    `error` only as a dev message). Remove the hardcoded `code→Polish` block in
    `cancelBooking` (L344–362) and the Polish `let detail = '…'` fallbacks — the UI now
    resolves text from `code`. Preserve HTTP-429→`RATE_LIMITED` mapping via code.
- [x] A2: `src/components/booking-management/hooks/useBookingMutations.ts`
  - Wire `useTranslation`. Replace `setActionError(error.message)` (L89,136,176,201) and
    the L240 fallback with `setActionError(t(apiErrorKey((error as ApiError).code)))`.
    Replace `handleSearchError('Nie udało się…' + error.message)` (L60) with a translated
    `t('management.searchFailed')` (add key) + optional code mapping. Replace the Polish
    `throw new Error('Wybierz procedurę.' | 'Brak wybranej rezerwacji.' | 'Brak wybranego
    nowego terminu.')` guards with thrown coded errors OR pre-checked `setActionError(t(...))`.
- [x] A3: `src/components/booking-management/hooks/useBookingHandlers.ts`
  - Wire `useTranslation`. Replace hardcoded Polish `setFormError('Podaj imię, nazwisko
    i numer telefonu (min. 9 cyfr).')` (L50,54), `setFormError('Potwierdź weryfikację
    Turnstile…')` (L52,60), `setActionError('Wybierz procedurę')` (L127) with keys
    (`management.searchFormIncomplete`, `management.turnstileRequired` [exists],
    `management.selectProcedure` [exists] / add as needed).
- [x] A4: `src/components/booking-management/PanelRenderer.tsx`
  - L411 `?? 'Wystąpił nieznany błąd.'` → `?? t('errors.generic')` (wire `t`).
- [x] A5: `src/components/booking-management/ContactMasterPanel.tsx`
  - L65 `Błąd serwera: ${status}` and L74 `'Wystąpił błąd podczas wysyłania wiadomości'`
    → `t('errors.network')` / `t('errors.generic')` (component already uses `t`).
  - **Post-review fix:** first pass only swapped the two hardcoded fallback strings but
    still surfaced the raw `data.error` server prose (e.g. "Wiadomość musi mieć co
    najmniej 10 znaków") on validation errors. Reviewer caught this — corrected to throw
    `ApiError(data.error ?? '', data.code)` from `/api/master/contact` (which already
    returns `VALIDATION_ERROR`/`INVALID_PAYLOAD`/`RATE_LIMITED`, all in
    `KNOWN_ERROR_CODES`) and render `t(apiErrorKey(err.code))`, matching the same
    pattern as `useBookingMutations.ts`. No API change needed.
- [x] A6: `src/components/booking-management/EditProcedurePanel.tsx`
  - Replace the L186 Polish magic-string reason comparison with a code check + i18n
    (coordinate with the check-extension API `reason` contract; add `management.reason*`
    keys). Leave the `zł`/`min` price concatenations (use `t('common.currency')` /
    `t('booking.minutes')` if trivially safe; otherwise low priority).
  - **Post-review fix:** `EditProcedurePanel.tsx`, `ConfirmCancelPanel.tsx`, and
    `CancelSuccessPanel.tsx` each hand-rolled their own
    `language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'pl-PL'` date-locale
    ternary instead of the centralized `localeFor(lang)` helper (`src/lib/i18n.ts`) —
    reviewer flagged the duplication plus a real inconsistency (`en` mapped to `en-US`
    here vs. `en-GB` via `localeFor`, used in `src/app/profile/page.tsx`). All three now
    call `localeFor(language)`.
- [x] A7: Verify remaining booking-management panels render only via `t()`
  - Files: all `src/components/booking-management/*Panel*.tsx`, `ResultsPanel.tsx`,
    `EditDatetimePanel.tsx`, `DirectTimeChangePanel.tsx`, success panels.
  - Details: These already use `useTranslation`; confirm no leftover literals besides
    `{price} zł` currency suffix. Fix any found; otherwise leave.

### Group B — Category 3: fill missing keys referenced by `t('key','fallback')`
- [x] B1: Run `node scripts/i18n-check.mjs` (from Phase 0) to get the authoritative list
  of referenced-but-missing keys, scoped to client files.
- [x] B2: Auth components — add every missing key to all 3 files
  - Files: `src/locales/{pl,en,uk}.json`; sources `src/components/auth/RegisterForm.tsx`,
    `LoginForm.tsx`, `ResetPasswordForm.tsx`, `ForgotPasswordForm.tsx`, `UserDropdown.tsx`.
  - Details (confirmed missing seed set): `auth.createAccount, auth.registrationFailed,
    auth.autoLoginFailed, auth.registrationError, auth.passwordsDoNotMatch,
    consent.requiredForRegistration, form.password, form.confirmPassword,
    form.namePlaceholder, form.emailPlaceholder, form.phonePlaceholder, form.optional`
    + whatever B1 adds from Login/Reset/Forgot/UserDropdown. Provide pl/en/uk copy.
- [x] B3: Profile pages — add missing keys
  - Files: `src/locales/*`; sources `src/app/profile/page.tsx` (25 two-arg calls),
    `src/app/profile/edit/page.tsx` (15), `src/components/profile/LinkBookingsCard.tsx`
    (10), `src/components/profile/EditAppointmentModal.tsx` (12).
  - Details: Diff via B1; add missing under `profile.*` (and ensure they land in uk.json
    too, now that its profile namespace exists). Preserve `{{count}}` etc.
- [x] B4: Support + booking form — add missing keys
  - Files: `src/locales/*`; sources `src/app/support/page.tsx` (5),
    `src/components/BookingForm.tsx` (15).
- [x] B5: Confirm the "already-existing key" two-arg calls need NO change
  - Details: `Footer.copyright`, `DayCalendar.calendar.*`, `SlotsList.slots.*`,
    `MasterSelector.master.*` keys exist → leave. (Documented so reviewer doesn't flag.)

### Group C — Hardcoded literals in shared client components
- [x] C1: `src/components/ThemeToggle.tsx`
  - Wire `useTranslation`; replace Russian L33 `aria-label` and L37 `alt` with
    `t('theme.switchToLight'/'theme.switchToDark')` (keys already exist). Fix the pl copy
    bug ("jasną/ciemną motyw" → "jasny/ciemny") in `pl.json` while here.
- [x] C2: `src/components/ErrorBoundary.tsx` (class component — AD-5)
  - `import i18n from '@/lib/i18n'`; render `i18n.t('errors.boundaryTitle')`,
    `i18n.t('errors.boundaryDesc')`, `i18n.t('errors.reload')` (keys from Phase 0).
- [x] C3: `src/components/ui/PhoneInput.tsx`
  - L306 "Wprowadź kod ręcznie" → `t('form.enterCodeManually')` (add key). Verify no
    other hardcoded literals in this primitive.
- [x] C4: `src/components/ConsentWithdrawalModal.tsx`
  - Replace leftover hardcoded Polish L302 / L320–321 with existing
    `gdpr.withdraw.eraseDataHint` / `gdpr.withdraw.alreadyProcessedMessage` via `t()`.
- [x] C5: `src/components/data-export/ExportResultView.tsx`
  - Replace hardcoded Polish JSX (L31–61) with `t('gdpr.export.*')` (keys exist);
    it already has `t`. Add any missing sub-keys.
- [x] C6: `src/components/data-export/exportFormat.ts` (downloadable CSV/JSON)
  - Decision per AD-6: either localize headers via a passed-in `t`/lang, or leave Polish
    (data-file, not screen). Coder's discretion; if leaving Polish, add a code comment
    noting the deliberate choice. Flag in handoff.

### Group D — Validators wiring (consume AD-2 key-returns)
- [x] D1: Update every caller of `client-validators.ts` to render `t(result.error)`
  - Files: search callers of `validatePhone/validateEmail/validateName/validateBookingForm/
    validateSearchForm/validateTurnstileToken` (e.g. `BookingForm.tsx`, search panels,
    GDPR modals). Wrap returned keys in `t()` at the render/setError site.
  - Details: The validators now return `validation.*` keys (Phase 0 Step 0.5). Ensure no
    caller displays the raw key.

### Group E — App page wrappers & landing
- [x] E1: Landing `src/app/page.tsx` + `src/components/home/HomeClient.tsx` +
  `MasterSelector.tsx` — confirm full `t()` coverage; fix any inline literals.
- [x] E2: Auth page wrappers `src/app/auth/{login,register,reset-password,forgot-password}/page.tsx`
  - These are server wrappers rendering client forms; check for inline heading/subtitle
    literals and route them through `t()` (convert tiny wrappers to client or move text
    into the form component — prefer moving into the already-client form).
- [x] E3: `src/app/support/page.tsx`, `src/app/profile/page.tsx`, `profile/edit/page.tsx`
  - Already client + using `t`; after Group B key fills, confirm zero fallbacks resolve
    to English via `i18n-check`.

### Group F — Verification
- [x] F1: `node scripts/i18n-check.mjs` → zero referenced-but-missing keys in client files;
  identical key sets across pl/en/uk.
- [x] F2: `npm run lint` (zero warnings) + `npm run test`.
- [x] F3: Add/extend tests: a unit test asserting `apiErrorKey` covers every enumerated
  code; a test asserting no hardcoded Cyrillic/Polish in the touched client files
  (optional guard). Update `tests/` per `tests/AGENTS.md`.

## Acceptance Criteria
- [x] `i18n-check` passes (no missing keys, identical key sets) for all client files.
- [x] No hardcoded user-facing Polish/Russian literal remains in in-scope client files
      (verified by re-running the Cyrillic + diacritics greps from the audit — only
      legit hits remain: procedure-translator, string-normalization, i18n endonym,
      currency `zł`, comments). NOTE: the date-locale gap previously noted here for
      `EditDatetimePanel.tsx`, `TimeChangeErrorPanel.tsx`, `CancelErrorPanel.tsx` (still
      hardcoding `Intl.DateTimeFormat('pl-PL', ...)`) is now closed — see
      `handoff/tenant-branding-fixes_plan.md` Step 6, which applied the same
      `localeFor(language)` fix already used in their sibling panels.
- [x] All booking-management API errors display translated text driven by `code`;
      switching language changes the error text.
- [x] Auth register/login/reset forms render fully in pl and uk (no English leakage).
- [x] Dates in client UI render in the active language's locale (AD-3) — fixed in
      `EditProcedurePanel.tsx` and `src/app/profile/page.tsx`; the remaining sibling
      booking-management panels were closed out by `tenant-branding-fixes_plan.md` Step 6.
- [x] `npm run lint` + `npm run test` pass; DOX pass done for touched dirs.

## Constraints & Risks
- Do NOT alter API route business logic; only consume `code`. The raw `error` text
  becomes dev-only.
- `ApiError` change ripples through every consumer — update ALL of them (Group A), or
  errors silently fall back to `errors.generic`.
- The EditProcedurePanel reason-code change depends on the check-extension API contract;
  if the API returns prose, either add a `reasonCode` field (small API change, allowed
  as it is presentation-support) or keep a documented mapping — decide during A6 and
  note it; escalate to planner if it needs an API contract change.
- Keep interpolation tokens verbatim. Keep files < 500 lines.
- Stagewise: stop after this Part for user verification before starting admin (Part 3).
