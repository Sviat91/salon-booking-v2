# Plan: Fix hardcoded Polish date formatting in booking flow

**Date:** 2026-07-17
**Status:** Done

## Bug

User found: on the booking success panel (and likely elsewhere in the client booking flow), all text localizes correctly EXCEPT the date, which always renders in Polish (e.g. "sobota, 18 lipca 2026" instead of "субота, 18 липня 2026" when UI language is Ukrainian).

## Root cause

`src/lib/utils/date-formatters.ts`'s formatters (`fullDateFormatter`, `formatTimeRange`, etc.) accept an optional `locale` parameter but default to `'pl-PL'` if omitted. `src/lib/i18n-shared.ts` already exports `localeFor(lang: Language): string` (maps `pl`→`pl-PL`, `uk`→`uk-UA`, `en`→`en-GB`) — this is the established pattern already correctly used elsewhere (e.g. `DayCalendar.tsx`, `ViewAppointmentModal.tsx` via `dateFnsLocale`). The 4 files below call the formatters without passing a locale, so they silently fall back to Polish.

## Scope — 4 call sites, mechanical fix

- [x] **`src/components/BookingSuccessPanel.tsx`** (line ~55-56): `fullDateFormatter.format(startDate)` → `getFullDateFormatter(localeFor(language)).format(startDate)`; `formatTimeRange(startDate, endDate)` → `formatTimeRange(startDate, endDate, localeFor(language))`. Confirm `language` is already in scope (component already uses `useCurrentLanguage()` per Group C of the multilang-fields work) or import it.
- [x] **`src/components/BookingForm.tsx`** (line ~183-184): same pattern — `terminLabel` construction.
- [x] **`src/components/SlotsList.tsx`** (line ~61): `formatTimeRange(...)` → pass `localeFor(language)`.
- [x] **`src/components/profile/EditAppointmentModal.tsx`** (line ~47): same.

## Details

- Import `getFullDateFormatter` (not the pre-built `fullDateFormatter` singleton, which is locale-frozen) where a full date is needed; keep using `formatTimeRange` but pass the locale as its existing third parameter.
- Import `localeFor` from `@/lib/i18n-shared`.
- Each file needs the current `language` in scope — check whether it already has it (via `useCurrentLanguage()` or a prop) before adding a new hook call.
- Do NOT touch `src/lib/utils/date-formatters.ts` itself — its API already supports this correctly, only callers are missing the argument.
- Do NOT touch `notifications/index.ts`'s `formatDate` (uses `'pl-PL'` intentionally — notification dates go in the recipient-appropriate copy per the Group F audience split already implemented; out of scope here, don't conflate).

## Verify

- `npm run build`, `npm run lint` (zero warnings), `npm run test` all green.
- Manually: on `/[masterId]`, switch UI language to `uk`, complete a booking, confirm the success panel's date reads in Ukrainian (weekday + month names), not Polish. Same check in `en`. Check the slot list and the "edit appointment" modal (client profile) show times/dates consistent with the current language too.

## Constraints

- 500-line file limit — none of the 4 files are near it; not a concern here.
- Purely a formatting-call fix — no schema, no new dependencies, no architectural change.
