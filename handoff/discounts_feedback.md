# Review: Discounts (automatic + promo-code)
**Date:** 2026-07-27
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none — see "judgment items" notes below, both explicitly accepted as-is per plan)

## Passed Checks
- [x] `POST /api/book` never trusts a client-supplied price; server recomputes at stage 'final' before the transaction; tampered/invalid discountCode → DISCOUNT_INVALID, no appointment created
- [x] `oncePerClient` re-checked inside `$transaction` (booking-service.ts:259-266), covered by a dedicated race test
- [x] Authorization matrix (canManageDiscount/authorizeDiscountScope) matches AD-8 exactly, including the ADMIN-on-master-scope=null divergence
- [x] Server-side service-scope re-verification against listMasterOfferedServiceIds in both createDiscount and updateDiscount
- [x] Telegram middleware ordering: registerPromoHandlers before registerContactHandlers, promo listener calls next() for every non-PROMO step
- [x] Happy-hour window uses the same Intl.DateTimeFormat/Europe-Warsaw idiom as booking-service.ts, not Date.getDay()
- [x] pickBestDiscount never sums, deterministic tie-break (percent desc, createdAt asc, id asc)
- [x] All new/changed files under 500 lines (BookingForm.tsx 354, discounts/server.ts 268, actions.ts 213, DiscountListClient.tsx 238, DiscountForm.tsx 149)
- [x] No native confirm()/alert() reintroduced — useConfirm() used
- [x] AD-6 read-site migration spot-checked at admin/page.tsx, both calendar GET routes, ViewAppointmentModal.tsx — all correct
- [x] Migration SQL is a clean additive table-rebuild preserving existing Appointment rows, nullable new columns, no data loss
- [x] Schema models match AD-1 verbatim; DOX pass done in prisma/AGENTS.md and src/lib/AGENTS.md
- [x] Nav wiring and both admin/master discounts page guards match Step 22

## Judgment items (flagged by coder, reviewed, accepted as-is)
- `enabledLocales` prop on `DiscountListClient` kept for signature parity, never destructured — no lint issue, documented inline.
- `admin.discounts.codeRequired` i18n key is present in all 3 locales but genuinely unused (`superRefine` only ever emits `codeFormat`) — dead key, not a broken feature, doesn't fail `i18n:check`.
- P2002 handling via a safe `typeof`/`in`-narrowed duck-type check — reasonable, no prior project precedent existed.

## Summary
Exceptionally faithful implementation of a large, carefully-specified 27-step plan. All ten priority-ordered risk areas — server-side price trust, the oncePerClient transaction race, the authorization matrix, server-side service-scope re-verification, Telegram middleware ordering (the single highest-risk item per the plan), timezone handling, the stacking rule, file size limits, confirm()/alert() usage, and the AD-6 read-site migration — verified correct by reading the actual code, not inferred from checkboxes. No critical, architectural, or minor issues found.
