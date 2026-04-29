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

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Data model — 13 models, check here before DB queries |
| `src/auth.ts` | NextAuth setup, dynamic provider loading |
| `src/middleware.ts` | Route-level auth guards |
| `src/lib/availability.ts` | Core booking availability logic |
| `src/lib/cache.ts` | Redis + in-memory cache wrapper |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/tenant.ts` | TenantConfig retrieval helper |
| `src/config/masters.ts` | Client-safe master list |
| `src/config/masters.server.ts` | Server-only Google resource IDs per master |

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
