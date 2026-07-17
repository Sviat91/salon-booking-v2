# AGENTS.md — src/lib

## Purpose

Core business logic and services: booking availability, consent/GDPR handling, caching, notifications (email + Telegram), encryption, validation schemas, and misc utilities. This is the layer API routes and pages call into — it owns the rules, not the callers.

## Ownership

Anything framework-agnostic: DB access via Prisma, external service clients (email, Telegram, Turnstile), and pure logic. No `"use client"` code and no direct `NextRequest`/`NextResponse` handling here (that belongs in `src/app/api/`).

## Local Contracts

- `cache.ts` wraps Upstash Redis with an in-memory TTL fallback (`cacheGet`/`cacheSet`/`cacheDel`/`rateLimit`/`cacheSetNX`) — always invalidate **both** layers when mutating procedures or schedule data; a stale in-memory hit survives a Redis-only invalidation.
- `availability.ts` is the single source of truth for bookable slots — combines `Schedule`, `DateOverride`, and existing `Appointment` rows. Don't recompute availability logic elsewhere.
- `encryption.ts` is mandatory for any secret at rest (OAuth client secrets, SMTP password, `User.passwordEncrypted` for master password recovery) — never store or log a plaintext secret from `TenantConfig`. It **requires** `AUTH_SECRET` and throws at import if missing/empty (no insecure fallback key).
- `notifications/` (`index.ts` dispatcher + `email.ts` + `telegram.ts`): public functions never throw — failures are caught and written to `NotificationLog`, not surfaced to the caller. Keep that contract when adding a new notification type.
- `validation/`: `client-validators.ts` has zero dependencies (safe for client bundles); `api-schemas.ts` (Zod) is server-only and is what route handlers should parse request bodies with. `client-validators.ts` validators return an i18n KEY in `ValidationResult.error` (e.g. `'validation.phoneTooShort'`), not display text — callers render it with `t(result.error)`, or `t(result.error, result.errorParams)` for keys with `{{...}}` interpolation (only `validateRequired`'s `fieldRequired` key needs `errorParams` today).
- `errors/apiErrorKey.ts` maps an API route's `{ code }` field to an `errors.*` i18n key (`apiErrorKey(code?) => 'errors.<code>' | 'errors.generic'`) — pure, no React, whitelist-based. Used to translate `{ error, code }` API responses at the React edge instead of displaying the raw (mixed-language) `error` text. The whitelist (`KNOWN_ERROR_CODES`) is exported so tests can assert every enumerated code maps correctly (`tests/lib/errors/apiErrorKey.test.ts`) — add new codes there, not just to `errors.*` in the locale files.
- `i18n-shared.ts` holds the pure language constants/helpers (`Language`, `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `LANGUAGE_NAMES`, `isValidLanguage`, `localeFor(lang)` — BCP-47 `Intl` locale mapping) with **zero React/i18next dependency**. `i18n.ts` (client i18next singleton, `.use(initReactI18next)`) does `export * from './i18n-shared'` so its public API is unchanged; `i18n-server.ts` imports directly from `i18n-shared.ts`, never from `i18n.ts`. Do not move these constants back into `i18n.ts` or have `i18n-server.ts` import from it — `react-i18next`'s `initReactI18next` calls `React.createContext` at module-eval time, which breaks Next's "Collecting page data" build phase (a restricted React build without `createContext`) for any Server Component whose module graph reaches it.
- `i18n-server.ts` is server-only (imports `next/headers`) — `getServerT()` reads the `lang` cookie (mirrored by `src/contexts/LanguageContext.tsx`) and returns a fixed-language translator for Server Components/Actions that can't use `useTranslation()`. It uses its own `i18next.createInstance()` (core `i18next` only, no `react-i18next` plugin) for exactly this reason.
- `localized-content.ts` is the framework-free resolver for per-locale DB columns (`Service.name_pl/en/uk`, `MasterProfile.bio_pl/en/uk`) — `resolveLocalized(field, lang)` picks `field[lang]`, falling back to `pl` then any non-empty variant; `parseEnabledLocales(json)` validates `TenantConfig.enabledLocales`. Client components resolve at render with `useCurrentLanguage()`; server components pass the full `{ pl, en, uk }` object down rather than pre-resolving. Notifications (no viewer locale) always resolve to `DEFAULT_LANGUAGE`.
- `utils/date-formatters.ts` formatters are locale-aware: `get*Formatter(locale = 'pl-PL')` factories plus `formatTimeRange`/`formatFullDateTime`/`formatDateTime(..., locale = 'pl-PL')`. The old `timeFormatter`/`fullDateFormatter`/`dateFormatter`/`shortDateFormatter`/`compactDateFormatter` consts still exist as pl-PL-bound instances for backward compatibility. `formatISODate` remains locale-independent. `utils/date-fns-locale.ts` exports `dateFnsLocale(lang)`, the `date-fns` `Locale`-object equivalent of `localeFor()` — used wherever calendar grids call `date-fns`'s `format()` instead of `Intl.DateTimeFormat` (admin calendar views).
- `admin-permissions.ts` is the only place that parses/grants the `clients`/`gdpr` permission JSON on `User.adminPermissions` — route handlers and admin pages call `getPermissionsForRole()`, they don't parse the JSON themselves.
- `api/error-handler.ts` + `api/error-responses.ts` are the shared error contract for route handlers — see [../app/api/AGENTS.md](../app/api/AGENTS.md).
- Files must stay under 500 lines — `consent-service.ts` (13KB), `booking-helpers.ts` (10KB), `notifications/index.ts` (13KB) are the largest; split further growth into new files rather than extending these.
- Guest phone ownership verification/matching uses full-E.164 comparison via `phonesMatchE164()` in `utils/phone-normalization.ts` (normalizes both sides, never last-9-digits suffix matching). `booking-helpers.ts` no longer holds the dead `verifyBookingAccess`/`matchesSearchCriteria` access helpers — they were unused in production and have been removed.
- `canModifyBooking()` in `booking-helpers.ts` is live (no longer orphaned) — the 24h-modification guard in `bookings/cancel`, `bookings/update-time`, and `bookings/update-procedure` route handlers all call it instead of duplicating the hours-until-appointment math. It denies (`canModify: false`) for invalid/NaN dates.

## Work Guidance

- New environment-dependent config reads go through `env.ts` where one exists for that variable, not scattered `process.env` reads.

## Verification

- `npx vitest run tests/lib/**` covers consent-service (still under the legacy `tests/lib/google/` path name), `utils/`, and `validation/` — extend co-located tests under `tests/lib/` when adding logic here. See [../../tests/AGENTS.md](../../tests/AGENTS.md).
