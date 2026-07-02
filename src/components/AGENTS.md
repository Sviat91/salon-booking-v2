# AGENTS.md — src/components

## Purpose

Shared React components. `ui/` holds shadcn/ui primitives (Radix-based). Domain folders (`admin/`, `auth/`, `home/`, `profile/`, `reviews/`, `layout/`, `providers/`) hold feature-specific components. Top-level `.tsx` files are booking-flow components used directly by `src/app/[masterId]` and the landing page.

## Ownership

Presentation and client-side interaction only. Data fetching goes through React Query hooks; server calls go through `src/lib/api/` or route handlers — components don't embed business logic that belongs in `src/lib/`.

## Local Contracts

- `ui/` components follow shadcn/ui conventions (CVA variants, Radix primitives, `cn()` from `src/lib/utils.ts`) — when adding a new primitive, match the existing pattern (e.g. `button.tsx`) rather than hand-rolling styles.
- M3 design tokens live in `src/styles/m3-tokens.css` — component styling should reference CSS custom properties from there, not hardcode colors/spacing that duplicate a token.
- `booking-management/` is a self-contained feature module with its own contract — see [booking-management/AGENTS.md](booking-management/AGENTS.md).
- Files must stay under 500 lines — split large components (state, handlers, sub-panels) into siblings or a co-located folder, following the pattern already used in `booking-management/`.

## Work Guidance

- i18next strings come from `src/locales/{en,pl,uk}.json` (Polish is default) — don't hardcode user-facing text.

## Verification

- No dedicated component test layer today; covered indirectly via `tests/app/api/**` (behavioral) and manual browser verification for UI changes.

## Child DOX Index

- [booking-management/AGENTS.md](booking-management/AGENTS.md) — booking management feature module
