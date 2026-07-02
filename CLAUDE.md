# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint with zero warnings tolerance
npm run test         # Run Vitest tests
npx vitest run tests/some.test.ts  # Run a single test file
npx prisma migrate dev --name <name>  # Create and apply a migration
npx prisma studio    # Open Prisma database browser
npx tsx scripts/consent-cli.ts       # GDPR admin CLI
```

## Important

- After finishing the task, always give a list of that the user need to check manually. Explain it clearly, step by step.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript — path alias `@/*` → `src/*`
- **Prisma 5** with SQLite via libSQL adapter — DB file at `prisma/app.db`
- **NextAuth v5 beta** — JWT strategy, dynamic OAuth providers from DB
- **React Query** + **React Hook Form** + **Zod** for data/form layers
- **Tailwind CSS** + **shadcn/ui** components
- **Upstash Redis** for distributed cache (in-memory fallback when unavailable)
- **i18next** — Polish as default locale, files in `src/locales/`

## Architecture

### Routing

```
src/app/
  page.tsx              # Landing page (master selection, prefetched data)
  [masterId]/           # Per-master booking flow
  admin/                # SUPERADMIN/ADMIN dashboard
  auth/                 # Login, register, password reset pages
  profile/              # Authenticated client pages
  support/              # GDPR self-service page
  api/                  # All API routes
```

Middleware in `src/middleware.ts` enforces auth guards on `/admin`, `/profile`, and auth redirect logic.

### Auth Flow

`src/auth.ts` loads the credentials provider (bcrypt) plus OAuth providers (Google, Apple, Telegram) dynamically from `TenantConfig` in the database. Secrets are encrypted at rest (`src/lib/encryption.ts`). The edge-compatible config is split in `src/auth.config.ts`.

Roles: `CLIENT | MASTER | ADMIN | SUPERADMIN`. New registrations default to `CLIENT`; elevate to `SUPERADMIN` directly in the DB to bootstrap the first admin account.

### Booking System

1. Client visits `/[masterId]` — master IDs map to config in `src/config/masters.ts` (client-safe) and `src/config/masters.server.ts` (Google Calendar/Sheet IDs).
2. `GET /api/availability` runs `src/lib/availability.ts` — combines `Schedule` (weekly template), `DateOverride` (day-off or custom hours), existing `Appointment` records, and Google Sheets exception rules (category-based procedure blocking).
3. `POST /api/book` creates the `Appointment` row and writes the Google Calendar event.
4. Each master has isolated cache keys: `procedures:v2:<masterId>`, `availability:<masterId>:<dates>`.

### Caching

`src/lib/cache.ts` wraps Upstash Redis with an in-memory TTL fallback. Always invalidate both layers when mutating procedures or schedule data.

### GDPR

Three public API endpoints under `/api/consents/` (export, erase, withdraw) implement the full GDPR self-service flow. Erasure anonymises personal data with SHA-256 phone hashing. Rate limited via Redis token bucket.

### Admin

`/admin` (ADMIN/SUPERADMIN): full salon management — masters, services, schedules, date overrides, appointments.  
`/admin/master` (MASTER): own schedule/overrides and appointment view.  
Tenant branding, SMTP, and OAuth config are stored in `TenantConfig` and surfaced through the admin settings UI.

### Multi-Tenancy

A single `TenantConfig` row drives: CSS theme variables, logo, OAuth provider credentials (encrypted), SMTP settings, and legal info. Loaded in `src/app/layout.tsx` for metadata and injected as CSS custom properties.

## Key Files

| File                           | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `prisma/schema.prisma`         | Data model — 13 models, check here before DB queries |
| `src/auth.ts`                  | NextAuth setup, dynamic provider loading             |
| `src/middleware.ts`            | Route-level auth guards                              |
| `src/lib/availability.ts`      | Core booking availability logic                      |
| `src/lib/cache.ts`             | Redis + in-memory cache wrapper                      |
| `src/lib/prisma.ts`            | Prisma client singleton                              |
| `src/lib/tenant.ts`            | TenantConfig retrieval helper                        |
| `src/config/masters.ts`        | Client-safe master list                              |
| `src/config/masters.server.ts` | Server-only Google resource IDs per master           |

## Environment Variables

Required in `.env` (see `.env.example` for full list):

```
DATABASE_URL="file:./app.db"
AUTH_SECRET=                         # nextauth secret
GOOGLE_APPLICATION_CREDENTIALS_JSON= # service account JSON (base64 or raw)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
# Per-master Google resource IDs:
GOOGLE_CALENDAR_ID=
GOOGLE_SHEET_ID=
GOOGLE_CALENDAR_ID_YULIIA=
GOOGLE_SHEET_ID_YULIIA=
```

Optional: `N8N_WEBHOOK_URL`, `N8N_SECRET_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SITE_URL`

## Constraints

- Files must stay under **500 lines** — refactor immediately if exceeded.
- Never import a library without verifying it exists in `package.json`.
- `src/config/masters.server.ts` must **never** be imported in client components.
- Encrypted secrets (OAuth credentials, SMTP password) must go through `src/lib/encryption.ts`, never stored in plaintext.

## DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root CLAUDE.md (this file is the main DOX rail)
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

- [src/app/AGENTS.md](src/app/AGENTS.md) — Next.js App Router: pages, auth guards, routing
  - [src/app/api/AGENTS.md](src/app/api/AGENTS.md) — API route handlers
  - [src/app/admin/AGENTS.md](src/app/admin/AGENTS.md) — Admin & master dashboard UI
- [src/components/AGENTS.md](src/components/AGENTS.md) — React component library, shadcn/ui primitives
  - [src/components/booking-management/AGENTS.md](src/components/booking-management/AGENTS.md) — client self-service booking management module
- [src/lib/AGENTS.md](src/lib/AGENTS.md) — core business logic: availability, cache, notifications, GDPR, validation
- [src/config/AGENTS.md](src/config/AGENTS.md) — master configuration (client-safe vs server-only split)
- [prisma/AGENTS.md](prisma/AGENTS.md) — data model, migrations, seeding
- [scripts/AGENTS.md](scripts/AGENTS.md) — operational CLI scripts
- [tests/AGENTS.md](tests/AGENTS.md) — Vitest test suite
- [docs/AGENTS.md](docs/AGENTS.md) — legacy docs, superseded by this file
- [handoff/AGENTS.md](handoff/AGENTS.md) — session summary log (`/sesend` / `/sesstart`)
