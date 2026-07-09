# Review: Client Profile / self-service cabinet M3 Pass — Stage 4

**Date:** 2026-07-09
**Verdict:** APPROVED

## Critical/Architectural Issues
None.

## Minor/Syntax Issues
None.

## Passed Checks

- [x] `statusColor()` in `profile/page.tsx` — all 5 return values match plan exactly (chip tints for CONFIRMED/PENDING/CANCELLED, muted for COMPLETED/default).
- [x] Both status render sites converted `<div>`→`<span>` with chip classes, matching plan exactly.
- [x] All dead-token swaps (Steps 2-4) across `profile/page.tsx` (14 sites + h1), `profile/edit/page.tsx` (3 sites), `LinkBookingsCard.tsx` (1 site) match plan literally.
- [x] Grep for full dead-token list across all 4 files → zero matches.
- [x] `EditAppointmentModal.tsx` confirmed genuinely unmodified — already fully semantic, no dead tokens.
- [x] All functional logic untouched: `useQuery`/401 redirect, `canModifyLocally` gate, `handleCancelAppointment`, `handleEditSaved`, `handleRepeat`, `handleSignOut`, `statusLabel()`, `upcomingWithFlags` memo in `page.tsx`; `updateProfileMutation`/`changePasswordMutation` in `edit/page.tsx`; `linkMutation`/validation/auto-hide in `LinkBookingsCard.tsx`.
- [x] No new hardcoded hex, no new npm imports.
- [x] Line counts unchanged: 354 / 248 / 129 / 267.

## Hard-exclusion check (orchestrator-verified with live `git diff`, post-review)

Reviewer lacked Bash/git access (recurring tool-access quirk, same as every prior stage).
Orchestrator ran `git diff --stat -- src/components/profile/EditAppointmentModal.tsx
src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/button.tsx
src/components/ui/PhoneInput.tsx src/components/ThemeToggle.tsx src/components/LanguageToggle.tsx
src/app/support/page.tsx src/components/booking-management/` — **empty output**. `git status
--porcelain` confirms only the 3 intended files (`profile/page.tsx`, `profile/edit/page.tsx`,
`LinkBookingsCard.tsx`) are modified. `wc -l` confirms unchanged line counts.

## Summary

All 4 in-scope files match the plan's literal before/after specifications exactly — status chip
conversion, dead-token hygiene, and `<h1>` weight change. `EditAppointmentModal.tsx`,
`booking-management/**`, `/support`, and all shared primitives confirmed untouched via live git
diff. APPROVED — ready for user browser verification.

---

## Revision 2 Review — "Past" section restructure

**Date:** 2026-07-09
**Verdict:** APPROVED

### Passed Checks

- [x] Past section wrapped in a single `<Card>` with the toggle button as its direct child (not a bare `div`).
- [x] Expanded list uses a `divide-y divide-border` container instead of stacked `Card`s per item.
- [x] Each row shows only service name (truncated), date via `formatDate` (no time range), and a "Book again" button — no specialist line, no status chip.
- [x] `showPast` state, chevron rotation logic, `handleRepeat`, `formatDate` unchanged and still in use.
- [x] `statusColor`/`statusLabel` retained in the file and still used by the Upcoming section's chip — not removed even though dropped from past rows.
- [x] Upcoming section, greeting card, `LinkBookingsCard`, `EditAppointmentModal`, empty-state — untouched by this restructure.
- [x] No accessibility or key/null-safety regressions — "Book again" stays a native, keyboard-reachable `<button>`, `key={a.id}` is stable.

### Hard-exclusion / diff-scope check (orchestrator-verified with live `git diff`, pre-review)

Orchestrator ran `git diff -- src/app/profile/page.tsx` directly before sending to review and
confirmed the Past-block region diff matches the plan's literal target exactly — single `Card`
wrapper, `divide-y` compact rows, no time/specialist/status on past rows — layered on top of the
already-approved Stage 4 changes (status chips + token hygiene) with no other region touched.

### Summary

The Past section now reads as a single collapsible card with a compact list inside, matching the
user's browser feedback. File is 342 lines (down from 354, well under the 500-line limit). No
regressions to state, handlers, or the Upcoming section. APPROVED — ready for user browser
verification.
