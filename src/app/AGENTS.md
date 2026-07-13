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

## Work Guidance

- Prefer Server Components for data-fetching pages; mark `"use client"` only where interactivity requires it.
- `[masterId]/` is the per-master booking flow entry point — master IDs are validated dynamically against `GET /api/masters` (DB-backed), never hardcoded.

## Verification

- `npm run lint` (zero warnings tolerance) and `npm run build` after routing or layout changes.

## Child DOX Index

- [api/AGENTS.md](api/AGENTS.md) — API route handlers
- [admin/AGENTS.md](admin/AGENTS.md) — Admin & master dashboard UI
