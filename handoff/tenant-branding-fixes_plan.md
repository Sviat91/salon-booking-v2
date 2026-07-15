# Plan: Tenant Branding Fixes + Remaining i18n Date-Locale Gap
**Date:** 2026-07-15
**Status:** In Progress
**Mode:** LIGHT (clear requirements, no architectural unknowns left — scope confirmed with user)

## Background
This app was originally built as a single specific salon ("Somique Beauty") and later
generalized into a multi-tenant product (`TenantConfig` DB row drives branding — see
`src/lib/tenant.ts`, `src/app/admin/settings/**`). Several leftover hardcoded "Somique
Beauty" artifacts from that origin were found by the user while manually testing the
i18n-client work (see `handoff/session_2026-07-15.md`). This plan fixes all of them,
plus closes out the one deliberately-deferred item from `i18n-client_plan.md` (three
files still hardcoding `pl-PL` date formatting).

None of this is under `src/app/admin/**` — it's unrelated to the still-pending
`i18n-admin_plan.md` and does not block or get blocked by it.

## Scope — 6 items, all confirmed with user

### 1. `src/components/LogoDisplay.tsx` — hardcoded logo fallback bug
**Bug:** when `logoPages` includes the current page (admin turned on "show logo here")
but `config.logoUrl`/`config.darkLogoUrl` are both empty, the component falls through
to a hardcoded `/head_logo.png` / `/head_logo_night.png` (real bundled Somique Beauty
image assets) instead of showing nothing.
**Fix:** the final fallback block (current lines 94-111) must return `null` instead of
rendering the hardcoded images. "No logo configured" = no logo shown, full stop.

### 2. `src/components/BrandHeader.tsx` — same bug, mobile-only block
**Bug:** the mobile-only logo block (current lines 47-68, used only on
`src/app/[masterId]/page.tsx`) unconditionally renders `/head_logo.png` /
`/head_logo_night.png` — it isn't wired to `TenantConfig` at all.
**Fix:** fetch tenant config the same way the app already does elsewhere (react-query,
`queryKey: ['tenant-config']`, `fetch('/api/tenant-config')` — matches the existing
convention in `src/app/support/page.tsx` / `privacy/page.tsx` / `terms/page.tsx` /
`BookingSuccessPanel.tsx`, and benefits from query-cache dedup with any other component
on the same page using the same key). Render the block only if `logoUrl`/`darkLogoUrl`
is set (mirrors LogoDisplay's `logoSrc`/`darkLogoSrc` fallback-chain pattern); if not
set, render nothing (not even the wrapper div).

### 3. `src/components/Footer.tsx` — hardcoded brand name + year in copyright
**Bug:** `t('footer.copyright', '© 2025 Somique Beauty. Wszystkie prawa zastrzeżone.')`
— the actual locale-file value (not just the fallback) bakes in "Somique Beauty" AND
the year "2025" literally, in all 3 locale files (`src/locales/{pl,en,uk}.json`,
`footer.copyright` key). Confirmed via grep — this is not a Category-3 missing-key case.
**Fix:**
- Change the `footer.copyright` value in all 3 locale files to interpolate:
  `"© {{year}} {{brandName}}. <rest of existing per-language text>"` (translate the
  static tail per language, same as today, just parameterize the two dynamic parts).
- `Footer.tsx` fetches tenant config the same react-query pattern as item 2 (or reuses
  BrandHeader's fetch if it ends up co-located on a page — but write independently,
  each component fetches its own; the shared `queryKey` means only one network request
  actually fires per page thanks to react-query's cache).
- Render `t('footer.copyright', { year: new Date().getFullYear(), brandName: config?.brandName || 'Salon Booking' })`
  (`'Salon Booking'` is the existing Prisma schema `@default` for `TenantConfig.brandName`
  — use that as the loading/fallback value, NOT "Somique Beauty", to fully remove the
  hardcoded brand from this file).

### 4. Auth pages (4 files) — hardcoded stylized brand text + hardcoded page titles
Files: `src/app/auth/{login,register,forgot-password,reset-password}/page.tsx`.
**Bug A (text logo):** each page hardcodes JSX
`Somique <span className="opacity-70 font-light">beauty</span>` instead of deriving it
from `TenantConfig.brandName`.
**Bug B (page `<title>`):** each page's static `export const metadata` hardcodes
`"Login | Somique Beauty"` etc. — doesn't use `brandName` at all, unlike `layout.tsx`
which already does this correctly (`config.brandName || 'Somique Beauty'` via
`generateMetadata()`).

**Fix A — new shared component `src/components/auth/BrandNameDisplay.tsx`:**
```tsx
// Confirmed split rule (user-approved): split brandName on whitespace.
// - 2+ words: all words except the last render in the normal/bold style;
//   the LAST word renders in the existing light/thin style (opacity-70 font-light).
// - 1 word: render the whole thing in the normal/bold style, no thin part (nothing to split).
export function BrandNameDisplay({ brandName }: { brandName: string }) {
  const words = brandName.trim().split(/\s+/)
  if (words.length <= 1) {
    return <>{brandName}</>
  }
  const main = words.slice(0, -1).join(' ')
  const last = words[words.length - 1]
  return (
    <>
      {main} <span className="opacity-70 font-light">{last}</span>
    </>
  )
}
```
Replace the hardcoded JSX in all 4 auth pages with
`<BrandNameDisplay brandName={config?.brandName || 'Salon Booking'} />` inside the
existing `<span className="font-bold text-2xl tracking-tight text-primary">` wrapper.
Since `login/page.tsx` already does `const config = await prisma.tenantConfig.findFirst()`
for OAuth providers, reuse that same `config` object — don't add a second query on that
page. `register/forgot-password/reset-password` pages: check whether they already fetch
`tenantConfig` for any reason; if not, add one `prisma.tenantConfig.findFirst()` call
(server component, cheap, matches the existing per-page-independent-fetch convention
already used across this codebase — do not introduce a new caching layer for this).

**Fix B — dynamic titles:** convert each page's static `export const metadata: Metadata`
to `export async function generateMetadata(): Promise<Metadata>` that fetches
`brandName` (reuse the tenant config already being fetched for Fix A where the page is
already async — combine into one query) and returns
`title: `${'Login'/'Register'/'Reset Password'/'Forgot Password'} | ${brandName || 'Salon Booking'}`` —
keep each page's existing English label prefix ("Login", "Register", etc.) unchanged,
only replace the trailing `"Somique Beauty"` with the real brand name.

### 5. `src/components/data-export/exportFormat.ts` + `DataExportModal.tsx` — CSV export localization
**Current:** `generateCSV()` hardcodes all row labels in Polish ('Typ danych',
'Wartość', 'Imię i nazwisko', 'Historia zgód', 'Wyrażono'/'Nie wyrażono', etc.) and
`formatDate()` hardcodes `'pl-PL'`. User confirmed: localize this (previously deferred,
now in scope).
**Fix:**
- Add a new `gdpr.export.csv.*` namespace to all 3 locale files covering every label
  currently hardcoded in `generateCSV` (data type, value, date, name, phone, email,
  none/brak, consent history, consent N — granted-date, privacy policy, terms,
  notifications, given/not-given, withdrawn-date, withdrawal-method, unknown).
- Change `generateCSV(data: UserDataExport, t: TFunction)` to accept a `t` function
  (import `TFunction` type from `i18next`) and replace every hardcoded string with the
  matching `t('gdpr.export.csv.*')` call. Keep the function pure otherwise (no React).
- Change `formatDate(dateString: string, locale: string)` to accept a `locale` param
  (reuse `localeFor(language)` from `src/lib/i18n.ts`, same pattern as the rest of the
  i18n-client work) instead of hardcoding `'pl-PL'`.
- Update `DataExportModal.tsx`'s `handleDownloadCSV` (current line ~223-228) to pass
  `t` and the current language (`i18n.language` or `useCurrentLanguage()`, whichever
  this file already has access to) into `generateCSV`.
- `generateJSON()` is unaffected — it already just dumps the typed `UserDataExport`
  object with English field names (`personalData`, `consentHistory`, etc.), not
  translated prose; no changes needed there.
- Remove the old "deliberately left in Polish" comment block (lines 25-30) since it no
  longer applies; do not leave a stale comment.

### 7. `src/components/home/HomeClient.tsx` — same hardcoded logo fallback bug, on the actual homepage
**Bug (found by reviewer, missed in original scoping):** identical bug class to Item 1,
but on `src/app/page.tsx`'s backing component — the single most prominent page in the
app. Two separate blocks:
- Desktop block (~lines 101-120): `{showLogo && !(config.logoUrl || config.darkLogoUrl) && (...)}`
  renders hardcoded `/head_logo.png` / `/head_logo_night.png` when no logo is configured.
- Mobile block (~lines 122-162): `{config.logoUrl ? (<real logo>) : (<hardcoded /head_logo.png fallback>)}`
  — same issue, ternary's else-branch shows the hardcoded images instead of nothing.
**Fix:** both blocks must render nothing when `config.logoUrl`/`config.darkLogoUrl` are
unset — remove the hardcoded-fallback JSX entirely (change the desktop block's condition
to just require `showLogo && (config.logoUrl || config.darkLogoUrl)`, and change the
mobile block's ternary to `config.logoUrl && (<real logo only>)` with no else-branch).
Matches Item 1's `LogoDisplay.tsx` fix exactly — same principle, same file family.

### 6. Close out the deferred date-locale gap (3 files, from `i18n-client_plan.md`)
Files: `src/components/booking-management/EditDatetimePanel.tsx`,
`TimeChangeErrorPanel.tsx`, `CancelErrorPanel.tsx`.
**Fix:** identical mechanical pattern already applied to their sibling panels
(`EditProcedurePanel.tsx`, `ConfirmCancelPanel.tsx`, `CancelSuccessPanel.tsx`) in the
last review round — replace the hardcoded `Intl.DateTimeFormat('pl-PL', ...)` /
ad-hoc `language === 'uk' ? 'uk-UA' : ...` ternary with `localeFor(language)` imported
from `@/lib/i18n`. No other logic changes.
Once done, update `handoff/i18n-client_plan.md`'s "Known gap" note (in its report / the
manual-verification list) to reflect that this is now closed — do not leave stale
"deferred" language pointing at fixed files.

## Constraints
- Do not touch `src/app/admin/**` or `src/components/admin/**` — separate future plan.
- Do not touch anything in `handoff/i18n-admin_plan.md`'s scope.
- Keep files under the project's 500-line limit.
- Preserve interpolation-token conventions already established (`{{count}}`, `{{name}}`,
  `{{field}}`, now adding `{{year}}`/`{{brandName}}`) — verbatim across all 3 locale files.
- `'Salon Booking'` (the Prisma schema default for `TenantConfig.brandName`) is the
  correct fallback/loading-state value everywhere in this plan — NOT `'Somique Beauty'`.
  The goal is removing the last hardcoded references to the original single-tenant brand.
- This project uses DOX/AGENTS.md — read and update `src/components/AGENTS.md`,
  `src/components/booking-management/AGENTS.md`, `src/app/auth/AGENTS.md` (if it exists)
  for any new shared component or contract change.

## Implementation Steps
- [x] Step 1: `LogoDisplay.tsx` — remove hardcoded fallback, return `null` when no logo configured
- [x] Step 2: `BrandHeader.tsx` — wire mobile logo block to tenant config, render nothing if unset
- [x] Step 3: `Footer.tsx` + locale files — dynamic `{{year}}`/`{{brandName}}` in copyright
- [x] Step 4: New `BrandNameDisplay.tsx` + wire into all 4 auth pages (text + dynamic `generateMetadata` titles)
- [x] Step 5: Localize `exportFormat.ts`'s `generateCSV`/`formatDate` + new `gdpr.export.csv.*` keys + update `DataExportModal.tsx` call site
- [x] Step 6: Fix remaining 3 date-locale files (`EditDatetimePanel`, `TimeChangeErrorPanel`, `CancelErrorPanel`) with `localeFor()`
- [x] Step 7: `HomeClient.tsx` — remove hardcoded logo fallback in desktop + mobile blocks (reviewer-flagged scoping gap, added post-review)
- [x] Step 8: Re-run `node scripts/i18n-check.mjs` + `npm run lint` (zero warnings) + `npm run test` + `npm run build`

## Acceptance Criteria
- [x] No page shows the Somique Beauty image/text/copyright when no tenant branding is configured.
- [x] Auth page brand text + browser tab title reflect the real configured `brandName`, correctly split per the 2-word/1-word rule.
- [x] Footer copyright shows the real brand name and the current year, in all 3 languages.
- [x] Downloaded CSV export renders its labels in the active UI language; dates in the CSV use the active language's locale.
- [x] All booking-management panels format dates via `localeFor()` — zero remaining hardcoded `pl-PL`/`uk-UA`/`en-US` literals in that directory.
- [x] `i18n-check` passes, `npm run lint` (54 pre-existing baseline problems, unchanged — none in files touched by this plan), `npm run test` green (20 files/112 tests), `npm run build` succeeds.
- [x] DOX pass done for touched directories.

## Manual Verification (for user, after implementation)
1. In Admin Settings, leave the logo fields empty — confirm no Somique logo appears on the homepage or the mobile booking-page header.
2. Change `brandName` in Admin Settings to a two-word name and a one-word name — check both render correctly on the 4 auth pages (text + browser tab title) and in the footer copyright.
3. Download a GDPR CSV export in pl/en/uk — confirm labels are in the selected language.
4. Trigger the 3 previously-broken date panels (edit-datetime, time-change error, cancel error) in uk/en — confirm no Polish month names.
