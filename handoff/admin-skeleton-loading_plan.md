# Plan: Skeleton Loading States for Admin Route Transitions
**Date:** 2026-07-16
**Status:** In Progress
**Mode:** LIGHT

## Goal
ROADMAP.md (Priority 4, 2026-07-16 entry): "переходы между вкладками в админке
выглядят подтормаживающими" — navigating between admin sidebar tabs currently shows no
visual feedback while the destination route's Server Component fetches its data, making
navigation feel unresponsive/laggy even though it's just normal fetch latency. Add
Next.js `loading.tsx` files (which Next.js automatically wraps a route segment's async
page in a `<Suspense>` boundary with) so navigation gives instant visual feedback via a
skeleton placeholder instead of an apparent freeze.

## Scope
**In:** `loading.tsx` for every ASYNC Server Component admin route (confirmed via
`grep -n "export default async function"` across `src/app/admin/**/page.tsx`):
1. `src/app/admin/loading.tsx` (dashboard, `admin/page.tsx`)
2. `src/app/admin/services/loading.tsx`
3. `src/app/admin/masters/loading.tsx`
4. `src/app/admin/admins/loading.tsx`
5. `src/app/admin/database/loading.tsx`
6. `src/app/admin/database/clients/loading.tsx`
7. `src/app/admin/database/gdpr/loading.tsx`
8. `src/app/admin/db-browser/loading.tsx`
9. `src/app/admin/settings/loading.tsx`
10. `src/app/admin/settings/notifications/loading.tsx`
11. `src/app/admin/master/loading.tsx` (master's own dashboard)
12. `src/app/admin/master/services/loading.tsx`
13. `src/app/admin/master/schedule/loading.tsx`

**Out:** `src/app/admin/calendar/page.tsx` and `src/app/admin/settings/{email,social}/page.tsx`
are NOT `async` Server Components (calendar is `"use client"` with its own existing
spinner-based loading state; email/social settings pages are synchronous) — a
route-level `loading.tsx` would not trigger meaningfully for them since there's no
Suspense-worthy async boundary. Do not add `loading.tsx` for these three. Do not modify
`admin/calendar/page.tsx`'s existing inline spinner logic — out of scope for this round
(it already has its own loading state, just not skeleton-styled; leave as-is, not worth
the churn for one file with a working, if plain, spinner).

## Implementation Steps
- [x] 1. Create the shadcn/ui `Skeleton` primitive (this codebase doesn't have one yet —
  confirmed via search): `src/components/ui/skeleton.tsx`, the standard shadcn pattern —
  a `<div>` with `animate-pulse rounded-md bg-muted` plus a `className` prop for
  overrides, matching this repo's existing shadcn component conventions (see any other
  file in `src/components/ui/` for the exact style/export pattern to mirror, e.g.
  `button.tsx` for how `cn()` and prop-forwarding are typically done here).
- [x] 2. Build 2-3 small REUSABLE composed skeleton patterns (do not hand-build 13 fully
  bespoke layouts — that's excessive for this task; compose from the `Skeleton` primitive
  instead), placed in `src/components/admin/skeletons/` (new directory):
  - `StatCardsSkeleton.tsx` — a row of pulsing card-shaped blocks, for the dashboard.
  - `TableSkeleton.tsx` — a header bar + N pulsing row-shaped blocks (accept a `rows`
    prop, default ~6), for all list/table pages (services, masters, admins, database
    clients/gdpr, db-browser).
  - `FormSkeleton.tsx` — a few pulsing label+input-shaped block pairs, for settings-style
    pages.
  Keep these small and generic — they only need to roughly suggest the destination
  page's shape, not pixel-match it.
- [x] 3. Add the 13 `loading.tsx` files listed in Scope. Each is a minimal Server
  Component (no `"use client"` needed) that composes the primitives above to loosely
  match its route's actual content:
  - Dashboard (`admin/loading.tsx`): `StatCardsSkeleton` + a `TableSkeleton` below (for
    "Today's Appointments").
  - List/table pages (services, masters, admins, database, database/clients,
    database/gdpr, db-browser): `TableSkeleton`.
  - Settings-style pages (settings, settings/notifications): `FormSkeleton`.
  - Master dashboard (`admin/master/loading.tsx`): `TableSkeleton` (it lists
    appointments).
  - Master services (`admin/master/services/loading.tsx`): `TableSkeleton`.
  - Master schedule (`admin/master/schedule/loading.tsx`): a simple generic block
    skeleton is fine here (the calendar grid itself is complex; don't attempt to
    replicate its exact shape — a plain rounded pulsing rectangle roughly matching the
    calendar card's `rounded-[20px]` outer shape, matching the visual chrome, is
    sufficient) — reuse `Skeleton` directly rather than building a 4th composed
    component just for this one case.
  Wrap each in whatever outer padding/container makes it sit reasonably in place of the
  real content (check the target page's actual root wrapper classes for a close-enough
  match, e.g. reuse `max-w`/padding conventions already visible in that page.tsx, so the
  skeleton doesn't visually jump when the real content replaces it).

## Constraints
- Every new file must respect the repo's 500-line limit (trivially true here — these are
  all small files).
- Follow this repo's DOX chain: read root `CLAUDE.md`, `src/app/admin/AGENTS.md`, and
  `src/components/AGENTS.md` before creating files under those trees.
- No new npm dependencies — this is pure Tailwind + a `<div>`, matching the standard
  shadcn `Skeleton` implementation exactly (no library needed).
- Don't touch any existing `page.tsx` file's data-fetching logic — this round is
  additive-only (new `loading.tsx` + new skeleton components), zero risk to existing
  behavior.

## Verification
- [x] `npm run lint`, `npm run test`, `npm run build` — all clean (lint at/below
  baseline).
- [ ] Manual (user): click through each admin sidebar tab (and the 2 nested database/
  settings sub-tabs, master dashboard/services/schedule) and confirm a skeleton briefly
  appears instead of a blank/frozen-feeling transition.

## Acceptance Criteria
- [x] All 13 async admin routes have a `loading.tsx` using the shared skeleton
  primitives.
- [x] No route without an async Server Component page got an unnecessary/no-op
  `loading.tsx`.
- [x] `npm run lint` + `npm run test` + `npm run build` pass; DOX pass done for
  `src/app/admin/AGENTS.md`/`src/components/AGENTS.md` if this introduces a new durable
  pattern worth recording (new `src/components/admin/skeletons/` directory).
