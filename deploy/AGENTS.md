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
    `./uploads:/app/public/uploads`. The volume alone does not make uploaded
    files servable at runtime — see AD-14.
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
  - AD-10: the `Dockerfile` builder stage sets a placeholder `AUTH_SECRET`
    (never used at runtime, does not carry into the `runner` stage) before
    `RUN npm run build`. Next.js's build-time "Collecting page data" step
    imports every API route module, including ones that load
    `src/lib/encryption.ts` — which throws at import time if `AUTH_SECRET` is
    empty — and `.dockerignore` deliberately excludes the real `.env` from
    the build context (AD-7). Without the placeholder, every build fails.
  - AD-11: **any command in `install.sh` that doesn't need interactive
    stdin must redirect it from `/dev/null`.** The documented usage is
    `curl ... | sudo bash -s --`, so bash's own stdin *is* the pipe it is
    still reading the rest of the script from. A subprocess that attaches to
    inherited stdin (e.g. `docker compose exec` — `-T` only disables the
    pseudo-TTY, it does not detach stdin) can silently consume bytes off
    that same pipe, causing bash to hit EOF on its own script early with
    *no visible error* — this bit the real first test-VPS run (2026-08-03):
    everything after the SUPERADMIN bootstrap step — Nginx, certbot, the
    final summary with the password — silently never ran.
  - AD-12: `.env` always sets `AUTH_TRUST_HOST="true"` (not user-configurable,
    not prompted for). This install always sits behind Nginx (AD-1) with
    `NODE_ENV=production`; without it Auth.js/NextAuth refuses to trust the
    Host/`X-Forwarded-*` headers Nginx forwards and every `/api/auth/*` call —
    including the login-page redirect check in `src/middleware.ts` — fails
    with a generic 500 "problem with the server configuration". This bit the
    first real test-VPS run (2026-08-03): the login button appeared to do
    nothing because the redirect check itself was erroring. `.env` also
    always sets `AUTH_URL="https://${DOMAIN}"` alongside it — `trustHost`
    alone was not enough to stop the sign-out redirect from resolving to the
    container's own internal hostname:port (e.g. `http://3d5b8024ced0:3000`)
    instead of the public domain, also caught on the same test run.
  - AD-13: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `NEXT_PUBLIC_SITE_URL` are
    passed as Docker **build args** (`docker-compose.yml.template`'s
    `build.args`, sourced automatically from the instance's own `.env` —
    a separate mechanism from `env_file`, which only affects the running
    container, not the build), not just runtime env. Next.js inlines
    `NEXT_PUBLIC_*` vars into the client bundle during `next build` itself;
    since the build stage has no access to the real `.env` (AD-7/AD-10),
    every Turnstile widget across the whole app silently rendered with an
    undefined site key until this was added — discovered on the first real
    test-VPS deploy (2026-08-03). Neither value is secret (the Turnstile
    *site* key and the public domain are meant to be visible in page HTML/JS
    — unlike `TURNSTILE_SECRET_KEY`, which stays server-only and must never
    be passed as a build arg).
  - AD-14: `nginx.conf.template` serves `/uploads/` directly from disk
    (`alias ${INSTANCE_DIR}/uploads/`), bypassing the Node app entirely — do
    **not** remove this and fall back to proxying `/uploads/*` through
    Next.js. Next.js's standalone server (`output: 'standalone'`) only
    detects files under `public/` that exist at process boot; the AD-5
    volume mount means uploaded files land on disk correctly, but any file
    written to `public/uploads/` *while the container is already running*
    (i.e. every real upload, ever) is invisible to Next's own static-file
    resolution until the next container restart — it renders the app's
    404 page (`Content-Type: text/html`, RSC `Vary` headers) instead of the
    image, with no error anywhere in the app's own logs. Confirmed on the
    first real test-VPS run (2026-08-04): `docker compose exec app cat
    /app/public/uploads/<file>` read the exact right bytes at the exact
    right path, yet `curl http://127.0.0.1:<port>/uploads/<file>` — even
    hitting the container directly, bypassing Nginx — still 404'd, while a
    build-baked asset (`/dark.png`) served fine on the same request. `envsubst`
    must include `${INSTANCE_DIR}` (added alongside `${DOMAIN}`/`${APP_PORT}`)
    for this to render correctly — see the nginx-render step in `install.sh`.
    This location block only covers direct `GET /uploads/*` requests — it
    does **not** cover `next/image`'s own `/_next/image` optimizer route,
    which still runs inside the Node process and hits the identical
    boot-time-snapshot limitation from the other direction (and separately
    requires `sharp` to be a real `dependencies` entry, not just present on a
    dev machine — standalone mode refuses to optimize without it, another
    thing that bit this same 2026-08-04 run). Rather than converting every
    `<Image>` consumer of `/uploads/*` content to a plain `<img>` one at a
    time (already done piecemeal for a few — favicon/logo previews, master
    photo previews — before the scope of the problem was clear), `next.config.mjs`
    sets `images.unoptimized: true` project-wide: every `<Image>` renders a
    plain `<img src>` and never calls `/_next/image` at all, which fixes
    every current and future consumer in one place instead of requiring a
    per-component fix each time a new one is added. `sharp` stays installed
    (harmless, and `output: 'standalone'` still checks for it at boot even
    with the optimizer disabled) but is no longer load-bearing for this.
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
