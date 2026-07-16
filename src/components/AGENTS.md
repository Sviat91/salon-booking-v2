# AGENTS.md — src/components

## Purpose

Shared React components. `ui/` holds shadcn/ui primitives (Radix-based). Domain folders (`admin/`, `auth/`, `home/`, `profile/`, `reviews/`, `layout/`, `providers/`) hold feature-specific components. Top-level `.tsx` files are booking-flow components used directly by `src/app/[masterId]` and the landing page.

## Ownership

Presentation and client-side interaction only. Data fetching goes through React Query hooks; server calls go through `src/lib/api/` or route handlers — components don't embed business logic that belongs in `src/lib/`.

## Local Contracts

- `ui/` components follow shadcn/ui conventions (CVA variants, Radix primitives, `cn()` from `src/lib/utils.ts`) — when adding a new primitive, match the existing pattern (e.g. `button.tsx`) rather than hand-rolling styles.
- `ui/skeleton.tsx` is the shared loading-placeholder primitive (`animate-pulse rounded-md bg-muted` div). `admin/skeletons/` composes it into route-shaped patterns (`StatCardsSkeleton`, `TableSkeleton`, `FormSkeleton`) consumed by `admin/**/loading.tsx` files — see [../app/admin/AGENTS.md](../app/admin/AGENTS.md) for the `loading.tsx` convention. Reuse these composed patterns instead of hand-building a new one per route.
- `ui/` primitives are `"use client"` files. A Server Component may render them as JSX (`<Button>`, `<DialogPrimitive.Close render={<Button/>}>` — the base-ui polymorphic pattern already used in `dialog.tsx`/`sheet.tsx`), but must NOT directly call a plain function they export (e.g. `buttonVariants()`) — that throws `TypeError: ... is not a function` at request time only, since the client-boundary bundling replaces the export with a reference that isn't invocable on the server. This doesn't surface in `next build` (dynamic routes aren't rendered at build time) or in a read-only code review — it only shows up on an actual request. If a Server Component needs a button-styled link, use `<Button variant="..." render={<Link href="..." />}>`, not `className={buttonVariants(...)}`.
- M3 design tokens live in `src/styles/m3-tokens.css` — component styling should reference CSS custom properties from there, not hardcode colors/spacing that duplicate a token.
- Most UI should use the tenant-customizable semantic layer (`bg-primary`/`bg-accent`/`bg-muted`/etc in `src/styles/globals.css`, backed by `TenantConfig`). A few decorative/status colors intentionally bypass this and reference raw `--md-*` vars directly (e.g. `badge.tsx`'s `success`/`warning`/`destructive` variants, `admin/StatCard.tsx`'s tonal cards) — these are deliberately fixed across tenants, not a bug; don't "fix" them by swapping in tenant tokens without checking whether that collapses distinct colors into one (several semantic tokens key off the same single `--color-primary` field).
- `booking-management/` is a self-contained feature module with its own contract — see [booking-management/AGENTS.md](booking-management/AGENTS.md).
- Files must stay under 500 lines — split large components (state, handlers, sub-panels) into siblings or a co-located folder, following the pattern already used in `booking-management/`. `DataExportModal.tsx` follows this via its co-located `data-export/` folder (`types.ts`, `exportFormat.ts`, `ExportResultView.tsx`).
- `ui/dropdown-menu.tsx` is authored against the project's **Tailwind v3** config — use base-ui's `data-[open]`/`data-[closed]` arbitrary-attribute variants (and `[var(--x)]` arbitrary values), not v4-only syntax (`data-open:`, `(--x)`, `outline-hidden`, `**:`, `not-*:`).

## Work Guidance

- i18next strings come from `src/locales/{en,pl,uk}.json` (Polish is default) — don't hardcode user-facing text. `admin/` components use the `admin.*` namespace (see [../app/admin/AGENTS.md](../app/admin/AGENTS.md) for the client/server split rule) — `"use client"` files call `useTranslation()` directly; a component shared between a Server Component caller and a client caller (e.g. `AppointmentStatusBadge.tsx`, which computes its own status label) is itself `"use client"` rather than requiring every caller to pre-translate.
- Components fetching `/api/tenant-config` via react-query use two established `queryKey`s depending on need: `['tenant-config-contact']` for the salon-contact-info subset (`support/`, `privacy/`, `terms/` pages, `BookingSuccess(Panel).tsx`), and `['tenant-config']` for branding fields like `brandName`/`logoUrl`/`darkLogoUrl` (`BrandHeader.tsx`, `Footer.tsx`). Match the existing key for the data you need — mixing keys defeats react-query's per-page cache dedup between components that want the same fields. Never hardcode a fallback brand asset (image or name) — an absent `TenantConfig` value means render nothing, with `'Salon Booking'` (the Prisma `@default`) as the only acceptable text fallback.

## Verification

- No dedicated component test layer today; covered indirectly via `tests/app/api/**` (behavioral) and manual browser verification for UI changes.

## Child DOX Index

- [booking-management/AGENTS.md](booking-management/AGENTS.md) — booking management feature module
