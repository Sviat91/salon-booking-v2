# AGENTS.md — deploy

## Purpose

One-command VPS installer for Salon Booking: Docker-hosted app + host-level
Nginx/Certbot for TLS, namespaced to support multiple independent client
instances on the same VPS. First install only — see `handoff/deploy_plan.md`
for the full design record.

## Ownership

- `install.sh` — the actual "one command" (`curl | sudo bash -s --`), orchestrates
  everything: prerequisite install, secret generation, `.env`/compose render,
  `docker compose up --build`, SUPERADMIN bootstrap, Nginx site + certbot, cron.
- `docker-compose.yml.template` — rendered per-instance via `envsubst`
  (`${PROJECT_NAME}`/`${APP_PORT}`) into the instance directory as `docker-compose.yml`.
- `docker-entrypoint.sh` — container entrypoint; runs `prisma migrate deploy`
  on every start (idempotent), then execs the app.
- `nginx.conf.template` — rendered per-instance into
  `/etc/nginx/sites-available/<name>.conf`; plain HTTP only, `certbot --nginx`
  adds the TLS server block on top.
- `README.md` — operator-facing install instructions and the Russian
  test-VPS manual verification checklist.

## Local Contracts

- **Ubuntu 22.04/24.04 LTS (apt-based) only.** `install.sh` fails fast with a
  clear message on any other distro — do not add support for other package
  managers here.
- **Architecture decisions (binding, see `handoff/deploy_plan.md` for full rationale):**
  - AD-1: Docker runs the app only; Nginx + Certbot run on the host (not
    containerized) so `certbot --nginx` can manage the host's real config and
    renewal timer directly. The app container publishes to `127.0.0.1:<port>`
    only — Nginx is the sole public edge.
  - AD-2: install root `/opt/salon-booking/<name>/`; Docker Compose project/
    container name `salon-<name>`; Nginx site `<name>.conf`; cron file
    `salon-<name>-reminders`. `<name>` is a validated slug
    (`^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`) — the one piece of user input
    interpolated structurally everywhere, rejected outright if invalid.
  - AD-3: `tsx` lives in `package.json` `dependencies` (not `devDependencies`)
    — needed at runtime for the one-off SUPERADMIN bootstrap in a
    `npm ci --omit=dev` image.
  - AD-4: port allocation is idempotent via `/opt/salon-booking/.ports`
    (one `<name>=<port>` line per instance) — a re-run for the same
    `--name` reuses its existing port rather than reassigning one.
  - AD-5: volumes are real host directories created before first `up`, not
    anonymous volumes — `./data:/app/prisma/prisma` (the sqlite file is at
    `prisma/prisma/app.db`, not `prisma/app.db` — see `prisma/AGENTS.md`) and
    `./uploads:/app/public/uploads`.
  - AD-6: hourly cron (`/etc/cron.d/salon-<name>-reminders`, chmod 600 — it
    embeds `CRON_SECRET`) hits `GET /api/cron/reminders`.
  - AD-7: secrets (`AUTH_SECRET`, `CRON_SECRET`, SUPERADMIN password) are
    generated via `openssl rand`, never logged/echoed except in the final
    summary and `CREDENTIALS.txt` (both chmod 600) — never add `set -x` or a
    bare `echo`/`cat` around the sections that generate or write them.
  - AD-8: if the instance directory already exists, abort loudly — no silent
    overwrite, re-clone, or credential regeneration. Re-runs for an existing
    `--name` are a deliberate hard failure, not "smart" merge behavior.
  - AD-9: Ubuntu-only (see above).
  - Upstash Redis REST URL/token are prompted for interactively, same as
    Turnstile keys (external signup, cannot be automated) — required, not
    optional. `rateLimit()` (`src/lib/cache.ts`) has no in-memory fallback
    unlike the app's cache layer; without these, every rate limit in the app
    is silently disabled in production.
- The install script's build context (`docker-compose.yml.template`'s
  `build: .`) is the same instance directory where `install.sh` creates
  `data/`, `uploads/`, and `CREDENTIALS.txt` as siblings — the repo root
  `.dockerignore` (which travels with the clone) must keep excluding
  `/data`, `/uploads`, `/CREDENTIALS.txt`, and `/docker-compose.yml`, or a
  future rebuild bakes live client data/secrets into an image layer.

## Work Guidance

- **Update/upgrade tooling for already-deployed instances is intentionally
  NOT here yet** — explicitly out of scope (user decision, see
  `handoff/deploy_plan.md`). Do not add partial scaffolding for it; a new
  plan should scope that work separately if/when it's requested.
- Any new script here that generates or handles secrets follows AD-7's rule
  above without exception.
- `shellcheck deploy/install.sh deploy/docker-entrypoint.sh` should stay
  clean (or every warning explicitly justified with a
  `# shellcheck disable=` comment).

## Verification

- `shellcheck deploy/install.sh deploy/docker-entrypoint.sh`.
- End-to-end install behavior cannot be verified in this repo's sandbox (no
  VPS/Docker daemon/DNS available) — use the Russian manual checklist in
  `README.md`'s "Проверка на тестовом VPS перед боевым клиентом" section on a
  real disposable test VPS before trusting this against a real client.
