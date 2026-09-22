# AGENTS.md — src/app

## Purpose

Next.js 14 App Router tree: public booking pages, auth pages, client profile pages, the admin/master dashboard, and all API route handlers.

## Ownership

Routing, page composition, and server/client component boundaries for everything under this path. Business logic lives in `src/lib/` and is imported here, not duplicated.

## Local Contracts

- `src/middleware.ts` (repo root of `src/`, not under this folder) enforces auth guards on `/admin`, `/profile`, and login redirects — route-level access control changes belong there, not in page components.
- Route handlers under `api/` follow the contract in [api/AGENTS.md](api/AGENTS.md).
- Admin/master dashboard pages follow the contract in [admin/AGENTS.md](admin/AGENTS.md).
- Files must stay under 500 lines (root constraint) — split page components into `src/components/` pieces rather than growing a single `page.tsx`.
- `providers.tsx` is the single app-wide client provider stack (`ErrorBoundary` → `SessionProvider` → `QueryClientProvider` → `LanguageProvider` → `ConfirmDialogProvider` → `MasterProvider` → `LayoutGroup`, plus `AppToaster`); anything needing `useTranslation()` must be mounted inside `LanguageProvider`.
- `opengraph-image.tsx` is the root-segment metadata file convention producing the single site-wide 1200×630 OG/Twitter card from `TenantConfig` (`runtime = 'nodejs'` + `dynamic = 'force-dynamic'`, same reason as `/api/tenant-config`); `twitter:image` is auto-filled from `openGraph.images` by Next, so there is deliberately **no** `twitter-image.tsx`; `layout.tsx` must never declare `openGraph.images`/`twitter.images` (that suppresses the file-convention merge) and no child segment may declare an `openGraph`/`twitter` key without also carrying `images`, or that page loses the card; the module's static import graph is evaluated while resolving metadata for **every** page, so it must stay import-light and must never throw at module scope.
- `[masterId]/page.tsx`'s desktop two-column grid uses fixed `lg:grid-cols-[24rem_24rem]` tracks (= the `max-w-sm` both column wrappers declare), never `auto` — `auto` tracks are sized from content max-content width, so procedures loading, a `BookingManagement` panel switch, slots appearing or a language switch re-measured both tracks and slid the centred grid sideways (2026-07-28 and 2026-09-22 jitter reports). Mobile keeps `w-full max-w-sm mx-auto` block flow, which is already width-stable.

## Work Guidance

- Prefer Server Components for data-fetching pages; mark `"use client"` only where interactivity requires it.
- `[masterId]/` is the per-master booking flow entry point — master IDs are validated dynamically against `GET /api/masters` (DB-backed), never hardcoded.

## Verification

- `npm run lint` (zero warnings tolerance) and `npm run build` after routing or layout changes.

## Child DOX Index

- [api/AGENTS.md](api/AGENTS.md) — API route handlers
- [admin/AGENTS.md](admin/AGENTS.md) — Admin & master dashboard UI
