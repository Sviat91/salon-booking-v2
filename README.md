# Salon Booking V2

Self-hosted, white-label booking platform for beauty/wellness salons. Clients book appointments with a specific master through a public booking page; salon staff manage services, schedules, discounts, and content through an admin panel. Built to be deployed as one independent instance per salon.

## Features

- 📅 **Booking system** — per-master availability, schedules, date overrides, conflict-free slot booking
- 👥 **Multi-master** — any number of masters, each with their own services, schedule, and booking page (`/[masterId]`), managed dynamically from the DB (no hardcoded master list)
- 🎟️ **Discounts** — percentage discounts (automatic or promo-code), scoped by service/day-hour window/date period, admin- and master-managed
- 📄 **Content pages & galleries** — admin-manageable content blocks/tabs and photo widgets on the homepage and each master's page
- 🤖 **Telegram** — interactive client booking bot, plus admin/salon notifications and client reminders (24h/2h before an appointment)
- 🛡️ **GDPR compliance** — self-service data export, erasure, and consent withdrawal
- 🌍 **Multi-language** — Polish (default), English, Ukrainian, configurable per tenant
- 🔐 **Auth & roles** — `CLIENT` / `MASTER` / `ADMIN` / `SUPERADMIN`, credentials + dynamic OAuth (Google/Apple/Telegram) providers configured per tenant
- 🎨 **Multi-tenant branding** — logo, theme colors, legal info configured per deployment via the admin panel
- 🌙 **Dark/light theme**, 📱 **mobile-responsive admin**, ✨ Framer Motion transitions with reduced-motion support

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma 5** + SQLite (via libSQL adapter)
- **NextAuth v5 beta** — JWT sessions, dynamic OAuth providers
- **React Query**, **React Hook Form**, **Zod**
- **Tailwind CSS** + **shadcn/ui**
- **Upstash Redis** — caching falls back to in-memory when unconfigured, but rate limiting has no fallback and requires it (see Environment Variables below)
- **grammy** (Telegram bot), **i18next**

See `CLAUDE.md` for the full architecture reference (routing, auth flow, booking system internals, caching, key files).

## Local Development

```bash
git clone https://github.com/Sviat91/salon-booking-v2.git
cd salon-booking-v2
npm install
cp .env.example .env   # fill in the values below
npx prisma migrate dev
npx tsx scripts/create-admin.ts --email=admin@example.com --password=<your-password> --name="Super Admin"
npm run dev
```

Open `http://localhost:3000`, log in at `/auth/login` with the SUPERADMIN account you just created, and configure the tenant (branding, masters, services) from `/admin`.

### Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | SQLite file path — resolves relative to `prisma/schema.prisma`'s directory, not the repo root (the default value creates `prisma/prisma/app.db`) |
| `AUTH_SECRET` | Yes | NextAuth secret, also roots the AES-256-GCM encryption used for stored OAuth/SMTP/master-password secrets. App refuses to start if empty. Generate with `openssl rand -base64 32` |
| `CRON_SECRET` | Yes | Authenticates `GET /api/cron/reminders` — must be called on a schedule (hourly is fine) or client 24h/2h reminders never fire. Generate the same way |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Yes | Cloudflare Turnstile keys for the booking form's bot protection — **domain-bound**, register per deployment at Cloudflare |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | No (local dev) | `cacheGet`/`cacheSet` fall back to an in-memory cache when unset, but `rateLimit()` has no fallback — every rate limit in the app is silently disabled without these. The production installer (`deploy/install.sh`) requires them |
| `SENTRY_DSN` | No | Error monitoring |
| `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_MASTER_CALL`, `N8N_SECRET_TOKEN`, `N8N_SECRET_HEADER` | No | Support-form and master-contact-form webhook integration |

Telegram bot tokens are **not** environment variables — they're configured per tenant from `/admin` → Settings, stored (encrypted) in `TenantConfig`.

### Useful Commands

```bash
npm run dev           # Start development server
npm run build          # Production build
npm run lint            # ESLint, zero warnings tolerance
npm run test             # Run the Vitest suite
npx vitest run tests/some.test.ts   # Run a single test file
npx prisma migrate dev --name <name>   # Create and apply a migration
npx prisma studio        # Open Prisma's DB browser
npm run i18n:check        # Verify pl/en/uk locale files are in sync
npx tsx scripts/create-admin.ts --email=... --password=... --name="..."   # Bootstrap the first SUPERADMIN
```

## Production Deployment

A single command installs a fully working, HTTPS-secured instance on a fresh **Ubuntu 22.04/24.04** VPS — Docker for the app, Nginx + Certbot on the host, works for multiple independent salon instances on the same server:

```bash
curl -fsSL https://raw.githubusercontent.com/Sviat91/salon-booking-v2/main/deploy/install.sh | sudo bash -s -- --name=<client-slug>
```

Before running it, have ready: a domain pointed at the VPS (A record), an Upstash Redis database, a Cloudflare Turnstile site registered for that domain, and an admin contact email. The script ends by printing the instance URL and the generated SUPERADMIN login — see **[`deploy/README.md`](deploy/README.md)** for the full flow, what gets installed, and a manual verification checklist to run once on a disposable test VPS before trusting it against a real client. Architecture rationale lives in [`deploy/AGENTS.md`](deploy/AGENTS.md).

Updating an already-deployed instance to a newer version is not yet automated — first install only, for now.

## Testing

```bash
npm run test                          # full suite
npx vitest run tests/lib/             # unit tests
npx vitest run tests/app/api/         # API route tests
npx vitest run tests/some.test.ts     # a single file
```

See `tests/AGENTS.md` for the suite's conventions (mocking `@/auth`, Prisma mock setup, etc.). For the full pre-launch plan — manual bootstrap, booking/Telegram/admin walkthroughs, Turnstile/rate-limit verification, load testing — see **[`TESTING_PLAN.md`](TESTING_PLAN.md)**.

## GDPR

Three public self-service endpoints under `/api/consents/`: export, erasure (SHA-256 phone hashing, anonymizes personal data), and consent withdrawal. Rate-limited via Redis token bucket. Exposed to clients through the `/support` page.

## Documentation

- **`CLAUDE.md`** — the canonical architecture/contract reference for this repo (routing, auth, booking internals, caching, constraints). Read this first for anything beyond a quick start.
- **`ROADMAP.md`** — project history and what's been shipped, by session.
- **`deploy/README.md`** / **`deploy/AGENTS.md`** — deployment flow and infrastructure decisions.
- **`TESTING_PLAN.md`** — end-to-end pre-launch testing plan (automated + manual + security + load).
- Nested `AGENTS.md` files throughout `src/`, `prisma/`, `scripts/`, `tests/` — domain-specific contracts for those subtrees.
