# Review: i18n Remediation — Admin & Master Dashboard (Part 3/3)
**Date:** 2026-07-16
**Verdict:** APPROVED (after one fix round — see Resolution below)

## Resolution (2026-07-16, re-check round)
All 4 Minor/Syntax items below were fixed by the coder and independently re-verified by the reviewer against the working tree:
- `DbBrowserClient.tsx` (2 spots) — raw `d.error` fallback dropped, always shows translated generic message.
- `AppointmentModal.tsx` — raw `d.error` fallback dropped; confirmed the form's `isValid()` guard already makes the route's "X is required" branches unreachable, so no distinct codes needed.
- `SuperAdminCredentials.tsx` — added 3 new distinct error codes (`NO_PASSWORD_SET`, `INVALID_CURRENT_PASSWORD`, `EMAIL_ALREADY_IN_USE`) to the route, `KNOWN_ERROR_CODES`, and all 3 locale files with real pl/uk translations; client now resolves via `apiErrorKey()`.
- `date-fns-locale.ts` — import switched from `@/lib/i18n` to `@/lib/i18n-shared`, restoring the server/client boundary rule.

Final verification (coder-run, re-checked by reviewer for plausibility): `i18n-check` green (1065 keys × 3 locales), lint unchanged from baseline (47 problems), 112/112 tests, build succeeds.

## Critical/Architectural Issues
(none — the infra fix and overall architecture are sound; issues found are scoped/mechanical, not design-level)

## Minor/Syntax Issues

- **Raw English server error text leaks to non-English admins in 3 client consumers**, contradicting the plan's own Group I claim ("resolve through the `apiErrorKey(code) → 'errors.generic'` fallback... rather than rendering the raw string") and the acceptance criterion "Admin CRUD errors localized via `code`":
  - `src/app/admin/db-browser/DbBrowserClient.tsx:48,80` — `d.error ?? t(...)` displays the raw string returned by `src/app/api/admin/db-browser/[table]/route.ts` (e.g. `"Unauthorized"`, `"Invalid table"`, `"Missing id"`) verbatim; that route never sets a `code` field.
  - `src/app/admin/settings/SuperAdminCredentials.tsx:72` — `data.error ?? requestFailedMessage` displays raw strings from `src/app/api/admin/superadmin/credentials/route.ts` (e.g. `"Current password is incorrect"`, `"Email already in use"`, `"Account has no password set"`) verbatim; no `code` field on that route.
  - `src/app/admin/master/calendar/AppointmentModal.tsx:123,127` — `throw new Error(d.error || t('admin.calendar.createAppointmentFailed'))` then `alert(err.message)` — surfaces raw strings from `src/app/api/admin/calendar/appointments/route.ts` (e.g. `"Master ID is required"`, `"Client Name is required"`, `"Invalid data"`) verbatim in a very commonly-used flow (create/edit appointment). This route has no `code` field either.
  - Fix pattern is the one already used correctly elsewhere in this same PR (`MasterForm.tsx:105`, `ClientsTable.tsx:79`, `AppointmentsList.tsx:36`): `d.code ? t(apiErrorKey(d.code)) : t(genericFallbackKey)` — never fall through to the raw `error` string. Either add `code` fields to the 3 routes above, or simply drop the `d.error`/`data.error` fallback and always use the translated generic message.
  - `src/app/admin/AGENTS.md:21` currently states as a hard contract that admin fetch consumers "never render a raw `error` string" — this is not accurate for the 3 files above; update the doc once fixed, or soften the claim in the interim.

- **`src/lib/utils/date-fns-locale.ts:8`** — `import type { Language } from '@/lib/i18n'` imports the type from the client i18next singleton file rather than `@/lib/i18n-shared.ts`, even though this helper is called from Server Components (`admin/page.tsx`, `admin/master/page.tsx`). This is currently *safe* only because it's a type-only import (`import type`, erased at compile time by TS/SWC, no runtime pull of `react-i18next`), but it textually violates the rule just documented in `src/lib/AGENTS.md:19` ("never... have `i18n-server.ts` import from [`i18n.ts`]") and `src/app/admin/AGENTS.md:21` ("never import translation helpers from `src/lib/i18n.ts` in server-only code"). Recommend switching to `import type { Language } from '@/lib/i18n-shared'` for consistency and to remove any future risk if someone turns this into a value import.

## Passed Checks
- [x] `admin.*` namespace present in all 3 locale files with byte-identical structural boundaries (brace-line positions match exactly, lines 104–661, across pl/en/uk) and covers all AD-A1 sub-groups (`nav`, `common`, `dashboard`, `calendar` incl. nested `bulk`, `database`, `gdpr`, `appointments`, `services`, `masters`, `admins`, `settings` incl. nested `general`/`smtp`/`email`/`social`).
- [x] Spot-checked ~20 keys across `nav`, `dashboard`, `calendar`, `database`, `gdpr`, `services`, `masters` — Polish and Ukrainian translations are idiomatic, correctly inflected, and not machine-copied English placeholders (e.g. `mastersActive`: "aktywnych specjalistów" / "активних спеціалістів", `eraseConfirm`'s legal-warning tone preserved in both languages).
- [x] Client/server split (AD-A2) correct in every sampled file: `admin/page.tsx`, `admin/master/page.tsx` use `getServerT()`/`getServerLanguage()` for inline text and pass pre-translated `label`/`sub` strings into the still-pure-props `StatCard.tsx`; `admin/layout.tsx` has no literal text (composition only, consistent with plan note); 27 client components sampled all have `"use client"`/`'use client'` and call `useTranslation()` directly; `AppointmentStatusBadge.tsx` correctly became `"use client"` since it computes its own label and is shared by server+client callers.
- [x] AD-A3 respected: `masters.map((m) => m.name).join(...)` in `admin/page.tsx`, `svc.name` raw render in `ServicesClient.tsx`, and other DB-derived text (client names, service names) are never wrapped in `t()`.
- [x] `getServerT()`/`i18n-server.ts`/`i18n-shared.ts`/`i18n.ts` infra fix verified sound: `i18n.ts` does `export * from './i18n-shared'` preserving 100% of its original public API (confirmed 17 files still import from `@/lib/i18n` unaffected); `i18n-server.ts` uses a private `i18next.createInstance()` with the same 3 resource bundles and same `DEFAULT_LANGUAGE`/`fallbackLng` config as the client instance, so translations stay consistent between server and client rendering — no diverging instance behavior.
- [x] No hardcoded-English regressions found in a targeted grep pass (`confirm(`/`alert(`/`placeholder="[A-Z]`/`title="[A-Z]`/`aria-label="[A-Z]`) across `src/app/admin/**` and `src/components/admin/**` — all confirm/alert calls route through `t()`; the two literal `placeholder=` hits found (`GOCSPX-...`, an email-format example) are legitimate non-translatable example data.
- [x] File size constraint respected — spot-checked largest touched files (`SettingsForm.tsx` 420, `LogoEditor.tsx` 420, `BulkSettingsModal.tsx` 382, `ModernCalendar.tsx` 373, `AppointmentModal.tsx` 361, `MasterForm.tsx` 344) — all comfortably under 500 lines.
- [x] GDPR admin API deviation verified accurate: `GdprTable.tsx:63,72` do `if (res.ok) router.refresh()` with no `else` branch — errors are genuinely swallowed silently pre-existing behavior, not a regression, and not a source of raw-English leakage (nothing is rendered on failure at all).
- [x] `<Metadata>` title/description English-literal deviation is consistent with pre-existing, previously-approved precedent — `src/app/auth/login/page.tsx`'s `generateMetadata()` (from an earlier, already-shipped part) also hardcodes English title/description text (`"Login | ..."`, `"Login to your account"`), so this is a genuine established project convention, not a new gap introduced by this PR.
- [x] DOX diffs (`src/app/admin/AGENTS.md`, `src/components/AGENTS.md`, `src/lib/AGENTS.md`) are concise, accurate (apart from the one overstated claim noted above), operational, and match the repo's existing dense-but-scannable DOX style — no diary entries, no bloat.

## Summary
This is a large, well-executed pass: namespace structure is clean and fully parallel across all three locale files, translation quality on manual spot-check is genuinely good native Polish/Ukrainian rather than placeholder text, the client/server split correctly follows AD-A2 everywhere sampled, DB-derived data is correctly kept untranslated per AD-A3, no file crossed the 500-line limit, and the `i18n-shared.ts` extraction is a legitimately sound fix for a real Next.js RSC/`react-i18next` build-time conflict that preserves the existing public API. However, the Group I sweep (admin API error localization) is not fully complete as claimed: three client consumers (`DbBrowserClient.tsx`, `SuperAdminCredentials.tsx`, `AppointmentModal.tsx`) still fall through to raw, un-translated English server error strings instead of the `apiErrorKey`/generic-fallback pattern used correctly everywhere else in the same PR — this directly contradicts both the plan's Group I completion note and the newly-written `admin/AGENTS.md` contract stating raw error strings are never rendered. These are mechanical, same-pattern fixes (3 files) and don't require re-planning — route back to the coder to apply the established `d.code ? t(apiErrorKey(d.code)) : t(fallback)` pattern to these 3 spots (and optionally add `code` fields to the underlying routes), then re-run `node scripts/i18n-check.mjs` / `npm run lint` / `npm run test` / `npm run build` for final confirmation.

**Files most relevant to the fix:**
- `src/app/admin/db-browser/DbBrowserClient.tsx`
- `src/app/api/admin/db-browser/[table]/route.ts`
- `src/app/admin/settings/SuperAdminCredentials.tsx`
- `src/app/api/admin/superadmin/credentials/route.ts`
- `src/app/admin/master/calendar/AppointmentModal.tsx`
- `src/app/api/admin/calendar/appointments/route.ts`
- `src/lib/utils/date-fns-locale.ts`
- `src/app/admin/AGENTS.md`
