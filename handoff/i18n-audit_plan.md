# Plan: Full-App i18n Audit & Remediation — Foundation + Master Inventory
**Date:** 2026-07-15
**Status:** In Progress

> This is the ENTRY-POINT document for a 3-part plan. Read this first. It holds the
> full audit inventory, the shared architecture decisions, and the cross-cutting
> "Phase 0" foundation work that BOTH sub-plans depend on. The two sub-plans are:
> - `handoff/i18n-client_plan.md` — client-facing surfaces (landing, booking, profile, auth, support, GDPR, shared components).
> - `handoff/i18n-admin_plan.md` — admin + master dashboard (`/admin/**`).
>
> Recommended execution order: **Phase 0 (this file) → client plan → admin plan.**
> Each part is an independent checkpoint: stop for user verification after each
> (per the project's stagewise-checkpoints preference).

## Goal
Make the ENTIRE app render correctly in all 3 supported languages (pl / en / uk) —
every page, error, warning, and admin/master/client screen — by reconciling the
locale files, wrapping every user-facing literal in `t()`, adding every missing key,
and routing API error messages through i18n via their `code` field.

## Scope
**In scope:** everything user-facing in `src/app/**` and `src/components/**`, all API
error strings surfaced to users, client + server validation messages, empty-states,
toasts/alerts, aria-labels/alt text.
**Out of scope (do NOT touch):**
- The legal BODY text of `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`
  (GDPR clauses, "§ …", "Zgodnie z art. 13…"). These stay hardcoded in Polish by
  legal design. Only their *chrome* (titles, notices, buttons) is in scope, and that
  is already covered by `privacy.*` / `terms.*` keys — verify only.
- Russian/mixed-language **code comments** (see Category 5 below): they are NOT
  user-facing and are NOT part of i18n coverage. Optional cosmetic cleanup only.
- Email/notification templates (`src/lib/notifications/**`) — see "Deferred" below.

---

## Audit Findings — the 5 bug categories

The remediation must address five DISTINCT problems. The original "18 files with
Cyrillic" and "393 vs 419 keys" signals were only the tip; the real coverage gaps are
mostly hardcoded **Polish** and **missing-key English-fallback** strings that neither
a Cyrillic grep nor a diacritics grep catches.

### Category 1 — Locale JSON key gaps
- `uk.json` = 393 keys, `en.json` = `pl.json` = 419 keys. The delta is **exactly the
  entire `profile.*` namespace (26 keys)**, missing from `uk.json` only. Confirmed by
  full manual diff: no other cross-file key gaps exist between en and pl, and uk lacks
  nothing else.
- `pl.json` has intentionally-empty `privacy.legalNotice` / `terms.legalNotice` (""):
  correct by design (the "available in Polish only" notice is shown to non-pl users),
  leave as-is.
- Minor copy bug (note, not blocking): `pl.json` `theme.switchToLight/Dark` =
  "Przełącz na jasną/ciemną **motyw**" (should be "jasny/ciemny"). Fix opportunistically.

### Category 2 — Hardcoded literal strings NOT wrapped in `t()`
Real user-facing text rendered directly. Languages found: **Polish** (most),
**Russian** (ThemeToggle), **English** (entire admin area). Full file list in the
two sub-plans. Highlights:
- `src/components/ThemeToggle.tsx` L33/L37 — hardcoded **Russian** `aria-label`/`alt`
  ("Переключить на светлую тему", "Светлая тема"), despite `theme.switchToLight/Dark`
  keys already existing. THE ONLY genuine user-facing Cyrillic bug in the codebase.
- `src/components/booking-management/hooks/useBookingHandlers.ts` — hardcoded Polish
  `setFormError('Podaj imię…')`, `setActionError('Wybierz procedurę')`.
- `src/components/booking-management/hooks/useBookingMutations.ts` — hardcoded Polish
  `throw new Error('Wybierz procedurę.')`, `'Brak wybranej rezerwacji.'`,
  `'Nie udało się sprawdzić dostępności'`, `handleSearchError('Nie udało się…')`.
- `src/components/booking-management/api/bookingManagementApi.ts` — hardcoded Polish
  error fallbacks + a `code→Polish` map inside `cancelBooking` (see Category 4).
- `src/components/ErrorBoundary.tsx` — hardcoded Polish (class component: needs the
  i18n singleton, not the hook — see Architecture Decisions).
- `src/components/booking-management/PanelRenderer.tsx` L411 — `?? 'Wystąpił nieznany błąd.'`.
- `src/components/booking-management/ContactMasterPanel.tsx` L65/L74 — Polish error fallbacks.
- `src/components/ConsentWithdrawalModal.tsx` L302/L320–321 — leftover hardcoded Polish
  paragraphs that duplicate existing `gdpr.withdraw.*` keys.
- `src/components/data-export/ExportResultView.tsx` (uses `t` but has hardcoded Polish
  JSX L31–61) + `src/components/data-export/exportFormat.ts` (CSV/JSON headers, Polish).
- `src/components/ui/PhoneInput.tsx` L306 — "Wprowadź kod ręcznie".
- `src/lib/validation/client-validators.ts` — ALL messages hardcoded Polish (see Cat 3/arch).
- Entire `src/app/admin/**` — hardcoded **English** (see admin plan).

### Category 3 — `t('key', 'English fallback')` where the key is MISSING from all 3 files
The most insidious category: text IS wrapped in `t()`, but the referenced key does not
exist in any locale JSON, so react-i18next renders the inline **English fallback in all
3 languages**. 147 two-argument `t()` calls exist across 17 files; a subset reference
missing keys. Confirmed examples (from `RegisterForm.tsx`): `auth.createAccount`,
`auth.registrationFailed`, `auth.autoLoginFailed`, `auth.registrationError`,
`auth.passwordsDoNotMatch`, `consent.requiredForRegistration`, `form.password`,
`form.confirmPassword`, `form.namePlaceholder`, `form.emailPlaceholder`,
`form.phonePlaceholder`, `form.optional` — none exist in `en/pl/uk.json`.
Heaviest two-arg files: `profile/page.tsx` (25), `RegisterForm` (20), `BookingForm`
(15), `profile/edit/page.tsx` (15), `EditAppointmentModal` (12), `ResetPasswordForm`
(12), `LinkBookingsCard` (10), `LoginForm` (9), `UserDropdown` (7), `support/page.tsx` (5).
NOTE: some two-arg calls DO have existing keys (e.g. `Footer.copyright`,
`calendar.prevMonth`, `slots.*`, `master.selectSubtitle`) and render fine — those are
NOT bugs. The coder must mechanically diff referenced keys vs the JSON (Phase 0 tooling).

### Category 4 — API error messages: raw `error.message` displayed, `code` ignored
API routes return `{ error: "<text>", code: "SOME_CODE" }`. The `error` text is a
MIX of Polish (booking mutation routes) and English (book/consents/contact routes).
~25 distinct codes exist and are consistent. Flow today:
1. API route → `{ error, code }`.
2. `bookingManagementApi.ts` throws `new Error(detail)` where `detail` is either
   `json.error` (raw) or a hardcoded Polish string mapped from `json.code`
   (`cancelBooking` already does `code → Polish`).
3. Consumers (`useBookingMutations.ts` L89/136/176/201/240) do
   `setActionError(error.message)` → raw Polish shown regardless of UI language.
This is the "мешанина" the user is frustrated by. See Architecture Decision below.

Enumerated codes (union across `src/app/api/**`):
`VALIDATION_ERROR, INVALID_PAYLOAD, RATE_LIMITED, TOO_MANY_REQUESTS, TOO_LATE_TO_MODIFY,
TOO_LATE_TO_CANCEL, CONFLICT, MISSING_MASTER, INVALID_PHONE, CONSENT_REQUIRED,
UNAUTHORIZED, INTERNAL_ERROR, DATA_NOT_FOUND, CONSENT_ACK_REQUIRED, ALREADY_ERASED,
ALREADY_PROCESSING, INVALID_NAME, BAD_REQUEST, MISSING_PARAMS, BOOKING_NOT_FOUND,
ALREADY_CANCELLED, VERIFICATION_FAILED, SERVICE_NOT_FOUND, INVALID_TIME, INVALID_DATE,
CONSENT_REQUIRED`.

### Category 5 — Russian / mixed-language dev COMMENTS (NOT user-facing; optional)
17 of the 18 Cyrillic-flagged files contain Cyrillic ONLY in Russian code comments
(e.g. `// Флаг для показа success`, `{/* Сценарий A */}`) or legitimate content:
- `src/lib/procedure-translator.ts` — LEGIT: real pl→uk/en procedure dictionary.
- `src/lib/utils/string-normalization.ts` — LEGIT: Cyrillic→Latin transliteration map + JSDoc.
- `src/lib/i18n.ts` — LEGIT: `'Українська'` language endonym.
- `src/lib/validation/api-schemas.ts` — Russian dev comment only (Zod msgs are English).
- `src/app/api/bookings/all/route.ts` — Cyrillic name in a JSDoc `@example` URL only.
- `src/app/[masterId]/page.tsx` (the "34-hit worst offender") — 100% Russian comments;
  every UI string already uses `t()`. **NOT a UI bug.**
- Plus TurnstileProvider, DayCalendar, BrandHeader, types.ts, PanelRenderer,
  EditProcedurePanel, ContactMasterPanel, useBookingHandlers, useBookingMutations,
  useBookingManagementState — Cyrillic = comments only.
These comments do NOT affect any rendered language. **Treat as OUT of i18n scope.**
Optionally, a separate low-priority cleanup pass may translate comments to English;
do it only if explicitly requested — it is churn with zero user-visible effect.

### Cyrillic-file triage summary (the 18 files)
| File | Verdict |
|---|---|
| `ThemeToggle.tsx` | **BUG** — hardcoded Russian aria-label/alt (Cat 2) |
| `[masterId]/page.tsx` | Not a bug — Russian comments only |
| `api/bookings/all/route.ts` | Not a bug — Cyrillic in JSDoc example |
| `procedure-translator.ts` | Not a bug — real translation dictionary |
| `string-normalization.ts` | Not a bug — transliteration map + JSDoc |
| `lib/i18n.ts` | Not a bug — `Українська` endonym |
| `validation/api-schemas.ts` | Not a bug — Russian dev comment |
| `TurnstileProvider.tsx` | Not a bug — Russian comments only |
| `DayCalendar.tsx` | Not a bug — Russian comments (UI uses `t()`) |
| `BrandHeader.tsx` | Not a bug — Russian JSX comments |
| `booking-management/types.ts` | Not a bug — Russian comment |
| `booking-management/PanelRenderer.tsx` | Comments only for Cyrillic; but has Polish fallback L411 (Cat 2) |
| `booking-management/EditProcedurePanel.tsx` | Comments only for Cyrillic; Polish magic-string reason cmp L186 (Cat 2) |
| `booking-management/ContactMasterPanel.tsx` | Comments for Cyrillic; Polish error fallbacks L65/74 (Cat 2) |
| `booking-management/api/bookingManagementApi.ts` | Comments for Cyrillic; Polish error text + code map (Cat 2/4) |
| `booking-management/hooks/useBookingHandlers.ts` | Comments for Cyrillic; hardcoded Polish (Cat 2) |
| `booking-management/hooks/useBookingMutations.ts` | Comments for Cyrillic; hardcoded Polish + raw error.message (Cat 2/4) |
| `booking-management/state/useBookingManagementState.ts` | Not a bug — Russian comments only |

---

## Architecture Decisions

### AD-1 — API error translation: client-side `code → i18n` mapping (CHOSEN)
Adopt option (a) from the brief. Rationale:
- `t()` needs the ACTIVE language, which lives only in the client (localStorage +
  i18next instance). API routes and the non-React `bookingManagementApi.ts` module
  cannot know the user's language, so they must NOT bake translated text.
- The `{ code }` field already exists for exactly this purpose, and the client already
  switches on `code` in `cancelBooking` — we generalize that (currently → hardcoded
  Polish) to route through i18n instead.
Implementation:
1. Add an `errors.*` namespace to all 3 locale files, keyed by the code values above
   (+ `errors.generic`, `errors.network`).
2. Add a pure helper `src/lib/errors/apiErrorKey.ts` →
   `apiErrorKey(code?: string): string` returning `'errors.' + code` when known,
   else `'errors.generic'`. (Keep a whitelist Set of known codes.)
3. Refactor `bookingManagementApi.ts` to throw an error that PRESERVES the code
   (a tiny `class ApiError extends Error { code?: string }`, or attach `err.code`),
   instead of pre-baking Polish. Keep the raw `error` text only as a dev-side
   `.message` fallback (never shown directly).
4. In React consumers, replace `setActionError(error.message)` /
   `handleSearchError(...error.message)` with `setActionError(t(apiErrorKey(err.code)))`.
   (Wiring per-consumer is in `i18n-client_plan.md`.)
- API route changes: NONE required for text (codes already present). Optionally
  standardize the human `error` text to English later; not needed for correctness.

### AD-2 — Client validators: return keys, not prose
`src/lib/validation/client-validators.ts` are pure functions with no `t()` access,
returning hardcoded Polish. Refactor them to return an i18n KEY (e.g.
`'validation.phoneTooShort'`) in a new `error` shape, and have callers render
`t(result.error)`. Expand the `validation.*` namespace to cover every message
(required/tooShort/tooLong/plFormat/ukFormat/emailInvalid/nameRequired/nameMin/nameMax/
turnstile). This mirrors AD-1 (keys at the boundary, translation at the React edge).

### AD-3 — Locale-aware date/time formatting
`src/lib/utils/date-formatters.ts` hardcodes `pl-PL` in every `Intl.DateTimeFormat`,
so dates render Polish month/weekday names in ALL languages. Convert the module to
locale-aware factory functions that accept a BCP-47 locale derived from the active
language (`pl→pl-PL`, `uk→uk-UA`, `en→en-GB`). Provide a `localeFor(lang)` map in
`src/lib/i18n.ts`. Callers pass the current language (from `useCurrentLanguage()`).
Keep `formatISODate` unchanged (locale-independent).

### AD-4 — Server components need a language COOKIE
Language is stored ONLY in `localStorage` (`LanguageContext`, key `selected-language`),
invisible to Server Components — and several `/admin` pages (e.g. `admin/page.tsx`) are
Server Components with inline text. Decision:
- Mirror the language selection into a cookie (`lang`, non-HttpOnly, 1-year) whenever
  `setLanguage` runs, so the server can read it via `next/headers cookies()`.
- Add `src/lib/i18n-server.ts` exporting `getServerT()` that reads the `lang` cookie
  and returns `i18n.getFixedT(lang)` for Server Components / Server Actions.
- Prefer, where cheap, to keep text inside existing CLIENT children (most admin UI text
  already lives in `*Client.tsx` components) and use `getServerT()` only for the few
  server pages with inline copy. Details in `i18n-admin_plan.md`.
This cookie is also the robust source of truth for any future SSR/metadata localization.

### AD-5 — ErrorBoundary (class component)
`ErrorBoundary` is a React class component and cannot call `useTranslation()`. Use the
i18next singleton directly: `import i18n from '@/lib/i18n'` and render
`i18n.t('errors.boundaryTitle')` etc. Add `errors.boundaryTitle/boundaryDesc/reload`
to all 3 files.

### AD-6 — Deferred (explicitly OUT of this effort; flagged as risk)
- **Email/notification templates** (`src/lib/notifications/**`, Polish): user-facing but
  sent server-side asynchronously; correct localization requires storing each
  recipient's preferred language (schema change) — a separate feature. Do NOT localize
  now; note in report.
- **CSV/JSON export file content** (`data-export/exportFormat.ts`): the on-SCREEN
  `ExportResultView` IS localized here; the downloadable file headers may stay Polish
  or be localized to the active UI language — low priority, coder's discretion, flag it.
- **Translating dev code comments** (Category 5): optional, no user impact.

---

## Implementation Steps — PHASE 0 (foundation; do FIRST, blocks both sub-plans)

- [x] Step 0.1: Reconcile `uk.json` — add the full `profile.*` namespace (26 keys)
  - Files: `src/locales/uk.json`
  - Details: Insert a `profile` block (same position as en/pl: between `common` and
    `admin`) with Ukrainian translations for all 26 keys: `title, hello, noPhone,
    editProfile, signOut, upcoming, master, statusConfirmed, statusPending,
    statusCancelled, statusCompleted, repeat, noAppointmentsAuth, bookNow, errorLoading,
    dataManagement, exportData, exportDataDesc, withdrawConsent, withdrawConsentDesc,
    deleteData, deleteDataDesc, linkSuccess, linkBookingsTitle, linkBookingsDesc,
    linkBookingsBtn`. Use the pl/en text as source; keep `{{count}}` interpolation intact.
- [x] Step 0.2: Build a locale key-diff check (tooling, reused by every later step)
  - Files: `scripts/i18n-check.mjs` (new) — see `scripts/AGENTS.md` for conventions
  - Details: Flatten all 3 JSONs; assert identical key sets; ALSO extract every
    `t('…')` / `i18n.t('…')` string-literal key referenced in `src/**` and report any
    referenced-but-missing keys (drives Category 3). Print a machine-readable report.
    Wire an npm script `i18n:check`. This script is the objective acceptance gate.
- [x] Step 0.3: Create the `errors.*` namespace (AD-1) in all 3 files
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: One key per enumerated code (map `TOO_MANY_REQUESTS`→same as `RATE_LIMITED`),
    plus `errors.generic`, `errors.network`, `errors.boundaryTitle`, `errors.boundaryDesc`,
    `errors.reload`, `errors.validationError`, `errors.tooShortName`, etc. Provide
    pl/en/uk copy for each. Reuse existing Polish text from the API routes as the pl source.
- [x] Step 0.4: Add `apiErrorKey()` helper (AD-1)
  - Files: `src/lib/errors/apiErrorKey.ts` (new)
  - Details: `export function apiErrorKey(code?: string): string` with a `Set` of known
    codes; returns `errors.<code>` or `errors.generic`. Pure, no React. Unit-tested.
- [x] Step 0.5: Expand `validation.*` + refactor client validators to return keys (AD-2)
  - Files: `src/lib/validation/client-validators.ts`, `src/locales/{pl,en,uk}.json`
  - Details: Change each `error: '<Polish>'` to `error: '<validation.key>'`; add the
    new keys to all 3 files. Do NOT change validator call sites yet — that is done in the
    client plan where each caller wraps `t(result.error)`. Note the return-shape change so
    the client plan can update callers.
- [x] Step 0.6: Make date formatters locale-aware (AD-3)
  - Files: `src/lib/utils/date-formatters.ts`, `src/lib/i18n.ts` (add `localeFor`)
  - Details: Convert module-level `Intl.DateTimeFormat('pl-PL', …)` singletons to
    factories keyed by locale, or accept a `locale` arg. Add `localeFor(lang)` map.
    Keep signatures backward-compatible where possible; note any caller-signature change
    for the sub-plans.
- [x] Step 0.7: Language cookie + server `getServerT` (AD-4)
  - Files: `src/contexts/LanguageContext.tsx` (write cookie in `setLanguage` + on mount
    sync), `src/lib/i18n-server.ts` (new)
  - Details: Set `document.cookie = 'lang=<lang>; path=/; max-age=31536000; samesite=lax'`.
    `getServerT()` reads the `lang` cookie via `cookies()` and returns
    `i18n.getFixedT(isValidLanguage(c) ? c : DEFAULT_LANGUAGE)`. Server-only module.
- [x] Step 0.8: Run `npm run lint` + `npm run test` + `node scripts/i18n-check.mjs`
  - Details: All must pass with zero warnings. `i18n-check` must confirm the 3 files now
    have identical key sets (profile + errors + validation additions present in all).

- [x] `scripts/i18n-check.mjs` reports identical key sets across pl/en/uk.
- [x] `errors.*`, expanded `validation.*`, and `profile.*` (uk) exist in all 3 files.
- [x] `apiErrorKey()`, `getServerT()`, `localeFor()`, locale-aware formatters exist and
      are unit-tested where logic is non-trivial.
- [~] `npm run lint` (zero warnings) and `npm run test` pass. `npm run test` passes
      (20 files / 111 tests). `npm run lint` still reports 54 pre-existing/unrelated
      problems (49 errors, 5 warnings) present on `master` before this session
      (confirmed via `git stash -u` diff) — zero new lint issues were introduced by
      Phase 0 changes; the 54 are outside this plan's scope to fix.
- [x] No user-facing component changed yet (Phase 0 is foundation only) — behavior
      identical, keys just now resolvable.
- [x] DOX pass done: update `src/locales`/`src/lib`/`scripts` AGENTS.md if contracts change.

## Constraints & Risks
- **Do not touch** privacy/terms legal body text or notification email templates.
- **500-line file limit** (project rule): `date-formatters.ts` and validators must stay
  under it after refactor; split if needed.
- **libSQL/Prisma & auth untouched** — this effort is presentation-layer only; never
  change API route business logic, only (optionally) error TEXT which is now unused.
- **Hydration:** the language cookie must not reintroduce SSR/CSR mismatch — client
  still initializes to `DEFAULT_LANGUAGE` then syncs (existing pattern); server reads
  cookie only for server-rendered admin text.
- **Interpolation tokens** (`{{count}}`, `{{name}}`, `{{min}}`) must be preserved
  verbatim in every new translation.
- **Reviewer risk:** Category 3 (missing keys) is easy to miss — the `i18n-check`
  script is mandatory to prove completeness objectively.

## Total Scope Summary (for the user's greenlight decision)
- **Locale JSON:** 26 uk keys (profile) + ~30 new `errors.*` + ~10 new `validation.*`
  + all Category-3 missing keys (dozens, quantified by `i18n-check` in Step 0.2) +
  the full new `admin.*` namespace (hundreds — see admin plan). Rough: **400–600 new
  key-values across the 3 files combined.**
- **Client-facing code (`i18n-client_plan.md`):** ~20–25 component/hook files touched
  (booking-management module ~10, auth components ~5, GDPR/data-export ~4, misc
  ThemeToggle/ErrorBoundary/PhoneInput/PanelRenderer/ConsentWithdrawalModal, validators
  callers). Mostly Polish/Russian→keys + Category-3 key fills + AD-1 error wiring.
- **Admin (`i18n-admin_plan.md`):** ~48 files (~28 client + server pages/actions),
  currently 100% hardcoded ENGLISH, zero i18n infra. The single largest chunk; needs a
  brand-new `admin.*` namespace + `useTranslation` wiring + AD-4 server mechanism.
- **API routes:** no text changes required (code-based mapping); optional standardization.
- **Deferred:** email templates, CSV/JSON export file bodies, code-comment cleanup.
