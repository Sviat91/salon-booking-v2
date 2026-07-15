# AGENTS.md — src/components/booking-management

## Purpose

Self-service flow letting an existing client find, cancel, or change (time/procedure) their own booking without logging in — search by phone+name, then panel-driven confirm/edit/success/error states.

## Ownership

Everything a client sees while managing an existing booking: search, panel state machine, and the API calls that back it. Booking *creation* lives outside this module (`src/components/BookingForm.tsx` and friends).

## Local Contracts

- `index.ts` is the only public entry point — import `BookingManagement` (default export) and `BookingManagementRef` from `.`, never reach into internal files from outside this folder.
- `state/useBookingManagementState.ts` owns the panel state machine; `PanelRenderer.tsx` maps state → panel component. New panels/states must be wired through both, not routed ad hoc from `BookingManagement.tsx`.
- `api/bookingManagementApi.ts` is the only place that calls `src/app/api/bookings/**` from this module — don't `fetch()` directly from a panel component.
- On a non-OK response, `api/bookingManagementApi.ts` functions throw `ApiError` (carries an optional `code` from the route's `{ error, code }` body). Hooks/panels must render `t(apiErrorKey(err.code))` (from `src/lib/errors/apiErrorKey.ts`), never the raw `ApiError.message` — that field is a dev-only diagnostic (often untranslated/mixed-language) and must not reach the UI. Add a new mutation the same way: `throw new ApiError(...)` on failure, `setActionError(t(apiErrorKey((error as ApiError).code)))` in `onError`.
- `hooks/useTurnstileSession.ts` gates mutating actions (cancel, time/procedure change) behind Cloudflare Turnstile — don't bypass it when adding a new mutating panel.
- `BookingManagement.tsx` (297 lines) and `PanelRenderer.tsx` (423 lines) are near the 500-line project limit — extend by adding new panel/hook files, not by growing these two further.

## Work Guidance

- Naming pattern: `<Action><Result>Panel.tsx` (e.g. `CancelSuccessPanel.tsx`, `TimeChangeErrorPanel.tsx`) — follow it for new panels so `PanelRenderer.tsx` stays predictable.
- Panels formatting a booking date/time with `Intl.DateTimeFormat` must pass `localeFor(language)` (from `@/lib/i18n`, `language` via `useCurrentLanguage()`) as the locale argument — never a hardcoded `'pl-PL'`/`'uk-UA'`/`'en-US'` literal or an ad-hoc ternary. All panels in this directory follow this today.

## Verification

- Related API behavior is covered under `tests/app/api/**` (bookings endpoints); no dedicated unit tests for this module's state machine today — verify panel transitions manually when changing `useBookingManagementState.ts`.
