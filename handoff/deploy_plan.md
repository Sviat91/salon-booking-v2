# Plan: One-command VPS deployment (Docker + host Nginx/Certbot)

**Date:** 2026-07-28
**Status:** In Progress

## Goal

A single command run on a fresh Ubuntu VPS installs a fully working, HTTPS-secured instance of Salon Booking, prints the SUPERADMIN login/password, and supports multiple independent instances (different clients) on the same VPS. Updating already-deployed instances later is explicitly **out of scope** for this pass — first install only.

## Reconnaissance (verified this session — read before disputing a decision)

- **R-1** Repo: `https://github.com/Sviat91/salon-booking-v2.git` (confirmed via `git remote -v`).
- **R-2** `next.config.mjs` does **not** set `output: 'standalone'`. Without it, a Docker image must ship the full `node_modules` + `.next` (much larger, slower builds). Adding `output: 'standalone'` is small, standard, and directly required for a sane Docker image — in scope for this plan.
- **R-3** **Standalone-mode gotcha**: Next.js's standalone output does **not** copy the `public/` directory automatically — the Dockerfile must `COPY public ./public` explicitly into the runtime stage, or uploaded logos/photos silently 404.
- **R-4** `src/app/api/upload/route.ts:44` writes uploaded files to `path.join(process.cwd(), "public", "uploads")`. This directory **must** be a persistent volume — otherwise every rebuild/redeploy silently deletes every master's uploaded photos/logos.
- **R-5** **Critical DB path gotcha** (also documented in `prisma/AGENTS.md`): `DATABASE_URL="file:./prisma/app.db"` in `.env` resolves **relative to `schema.prisma`'s own directory** (`prisma/`), not the repo root — so the real file lands at `prisma/prisma/app.db`, confirmed present on disk right now. Get the Docker volume mount path wrong here and migrations silently run against a path that isn't actually persisted, and the "same" DB appears to reset on redeploy.
- **R-6** `tsx` is **not** in `package.json` at all (checked directly, zero matches). `npx tsx scripts/create-admin.ts` (the documented admin-bootstrap command) currently works only via `npx` transiently fetching `tsx` from the registry on every invocation. In a production image built with `npm ci --omit=dev`, this either requires outbound registry access at deploy time or fails. Must be resolved (AD-3).
- **R-7** `CRON_SECRET` already exists in `.env.example` and gates `GET /api/cron/reminders` (`src/app/api/cron/reminders/route.ts:14-16`) — returns 500 if unset. **Nothing in the repo currently calls this endpoint on a schedule.** Without a host cron entry, 24h/2h client reminders silently never fire. In scope for this plan (AD-6).
- **R-8** `scripts/create-admin.ts` already exists and is the documented, tested way to bootstrap the first SUPERADMIN (flags, zod validation, bcrypt cost 12, refuses if a SUPERADMIN already exists — per `ROADMAP.md` session 2026-07-13 notes). Reuse it verbatim; do not reimplement admin creation.
- **R-9** `.env.example` fields: `AUTH_SECRET` (required, app refuses to start if empty), `UPSTASH_REDIS_REST_URL`/`TOKEN` (optional — in-memory cache fallback per `src/lib/cache.ts`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` (required for the booking form's bot protection to function; domain-bound, must be supplied by the operator — cannot be generated), `SENTRY_DSN` (optional), `CRON_SECRET` (required per R-7), `N8N_*` (optional, support-form integration).
- **R-10** No `Dockerfile`, `docker-compose.yml`, or `deploy/` directory exists anywhere in the repo yet — this is greenfield.

## User decisions (confirmed this session — do not re-litigate)

- **Multiple client instances on one shared VPS** must be supported (not one-VPS-per-client). The script must pick a free port per instance and namespace all names (container, systemd/cron entries, Nginx site file) by the project name, not assume it's the only instance on the box.
- Cloudflare Turnstile site/secret keys are **prompted for** by the script (operator registers the domain on Cloudflare beforehand, standard 2-minute manual step — cannot be automated).
- **Update/upgrade tooling for already-deployed instances is explicitly out of scope.** Do not build it, do not leave partial scaffolding for it. First install only.

## Architecture Decisions

### AD-1 — Docker for the app, host-level Nginx + Certbot (not containerized)

Rationale given to the user, now binding: Docker solves cross-VPS Node/native-module version drift (the actual reliability risk when reselling to many different servers) and gives free process supervision (`restart: unless-stopped`) — but Nginx and Certbot run directly on the host so `certbot --nginx` can edit the host's real Nginx config and manage its own renewal timer exactly the way the user described, with zero extra plumbing. The app container publishes to `127.0.0.1:<port>` only (never `0.0.0.0`) — host Nginx is the only public-facing edge.

### AD-2 — Directory & naming convention

- Install root: `/opt/salon-booking/<project-name>/` (the repo clone + generated `.env` + `docker-compose.yml` live here).
- Docker Compose project name **and** container name: `salon-<project-name>` (Compose's `-p` flag / `container_name` in the compose file) — guarantees no collision between instances' Docker resources.
- Nginx site file: `/etc/nginx/sites-available/<project-name>.conf`, symlinked into `sites-enabled/`.
- Host cron entry: `/etc/cron.d/salon-<project-name>-reminders`.
- `<project-name>` must be validated as a safe slug (`^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`, lowercase, no spaces/shell metacharacters) before being interpolated into any path, container name, or file — it is the one piece of user input used structurally everywhere, so a bad value here must be rejected outright, not sanitized-and-continued.

### AD-3 — `tsx` availability at deploy time (resolves R-6)

Add `tsx` to `package.json` **`dependencies`** (not `devDependencies`) — it is genuinely needed at runtime (once, during install) in a `npm ci --omit=dev` production image. It's a small package; this is simpler and more robust than trying to run the bootstrap step during the Docker build (impossible — no DB volume mounted yet at build time) or maintaining a separate compiled variant of `create-admin.ts`.

### AD-4 — Port allocation, idempotent across re-runs

A registry file `/opt/salon-booking/.ports` (one `<project-name>=<port>` line per instance, created on first use). On each run: if `<project-name>` already has an entry, reuse that port (idempotent — a re-run for the same client doesn't silently reassign ports and orphan the Nginx config). Otherwise scan upward from `3001` for the first port with nothing listening (`ss -ltn` or equivalent), reserve it in the registry, and use it.

### AD-5 — Volume mounts (resolves R-4/R-5)

```yaml
volumes:
  - ./data:/app/prisma/prisma      # the real sqlite file lives at prisma/prisma/app.db (R-5) — mount that exact path
  - ./uploads:/app/public/uploads  # persisted photo/logo uploads (R-4)
```
Both `./data` and `./uploads` are created by the install script under `/opt/salon-booking/<project-name>/` **before** `docker compose up`, so they exist as real host directories (not anonymous volumes) — makes backup trivial (`tar` the instance directory) and avoids Docker silently creating them root-owned in a way that surprises a later `docker compose down -v`.

### AD-6 — Reminders cron (resolves R-7)

Install script writes `/etc/cron.d/salon-<project-name>-reminders`:
```
0 * * * * root curl -fsS -m 10 -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/reminders >> /var/log/salon-<project-name>-cron.log 2>&1
```
Hourly is sufficient for 24h/2h-granularity reminders (matches the existing reminder logic's own tolerance — do not invent a tighter schedule). `CRON_SECRET` is embedded in the cron file itself, which is why `/etc/cron.d/*` files must be created with `chmod 600` (root-only readable) — a normal `crontab -l` visible-to-the-owning-user file would leak the secret to any user who can read it.

### AD-7 — Secrets generation & handling

- `AUTH_SECRET`, `CRON_SECRET`: `openssl rand -base64 32`, generated by the script, never prompted.
- SUPERADMIN password: `openssl rand -base64 18` (readable-enough, strong).
- SUPERADMIN email: prompt for it (the operator's/client's real admin email — needed for password-reset flows later; do not fabricate one).
- `.env` file: `chmod 600`, owned by root, never echoed to stdout in full (individual generated values may be echoed once at the very end as part of the final summary, deliberately, since that's the whole point of the script — but the script must never `cat .env` or log it elsewhere, e.g. no `set -x` around the block that writes it).
- Final summary is also written to `/opt/salon-booking/<project-name>/CREDENTIALS.txt` (chmod 600) since terminal scrollback is easy to lose — the script's final printed output must explicitly tell the operator to copy this out and delete the file.

### AD-8 — Idempotency / re-run safety

If `/opt/salon-booking/<project-name>/` already exists when the script runs, **abort with a clear error** ("instance already installed; this script does not support updates yet") rather than silently overwriting, re-cloning over, or regenerating a new SUPERADMIN password on top of an existing one. This is a deliberate, simple safety rail given update tooling is explicitly out of scope this pass — do not attempt to make re-runs "smart," just make them refuse loudly.

### AD-9 — Supported OS

Target **Ubuntu 22.04/24.04 LTS** only (`apt`-based). Do not attempt to support other distros/package managers in this pass — say so in the script's header comment and fail fast with a clear message if `apt-get` isn't found, rather than silently misbehaving on an unsupported host.

## Implementation Steps

- [x] **Step 1: `next.config.mjs`** — add `output: 'standalone'` (R-2). Verify `npm run build` still succeeds locally and produces `.next/standalone/`.

- [x] **Step 2: `package.json`** — move `tsx` into `dependencies` (AD-3). Add it if genuinely absent from the lockfile too (`npm install tsx --save-exact`... use whatever version range matches the project's existing pinning convention for similar small deps — check `package.json` for whether deps are pinned exact or `^`-ranged before choosing).

- [x] **Step 3: `Dockerfile`** (new, repo root)
  - Multi-stage: `deps` (npm ci, full deps for build), `builder` (`npm run build`, produces standalone output), `runner` (slim, `node:20-alpine` or match whatever Node version `package.json`'s `engines` field specifies if present — check first).
  - Runner stage: copy `.next/standalone`, `.next/static`, and **`public/`** (R-3 — do not forget this, standalone mode does not include it automatically).
  - Runner stage also needs `prisma/schema.prisma` + the generated Prisma client present (check whether `npx prisma generate` output lands inside `node_modules/.prisma` — if so it must be copied from the builder stage, since standalone mode's dependency-tracing does usually catch this automatically for Prisma, but **verify this explicitly by actually running the built image**, don't assume).
  - Entrypoint (a small `docker-entrypoint.sh`, not inline in `CMD`): run `npx prisma migrate deploy` against the mounted volume, **then** conditionally run the SUPERADMIN bootstrap (`scripts/create-admin.ts`) — but only do this from the *install script* (Step 6), not unconditionally on every container start, since `create-admin.ts` already refuses if a SUPERADMIN exists (R-8) so it's technically idempotent, but running it as a routine part of every container restart is unnecessary noise/risk. Keep migrate-deploy in the entrypoint (must run on every start, including future manual restarts); keep admin bootstrap as a one-off `docker compose exec` call from `install.sh` right after first `up`.
  - `EXPOSE 3000`; the compose file maps this to the allocated host port on `127.0.0.1` only (AD-1).

- [x] **Step 4: `docker-compose.yml`** (template, committed to the repo at `deploy/docker-compose.yml.template` — `install.sh` copies it into the instance directory and substitutes `${PROJECT_NAME}`/`${APP_PORT}` via `envsubst` or equivalent, then writes the final `docker-compose.yml` next to the instance's `.env`)
  - Single `app` service per AD-1/AD-2/AD-5.
  - `restart: unless-stopped`.
  - `env_file: .env`.

- [x] **Step 5: `deploy/nginx.conf.template`** (new) — the server block from AD-1, with `${DOMAIN}`/`${APP_PORT}` placeholders. Plain HTTP block only — `certbot --nginx` (Step 6) is what adds the TLS server block and the 80→443 redirect; do not pre-write HTTPS directives, they'd conflict with what certbot generates.

- [x] **Step 6: `deploy/install.sh`** (new, the actual "one command") — orchestrates everything above, in order:
  1. Require root (`id -u` check) and Ubuntu/apt (AD-9). Fail fast with a clear message otherwise.
  2. Parse args: `--name=`, `--domain=`, `--email=` (all optional; prompt interactively for whichever is missing — generalizes the user's "skip the prompt if given" request from just `--name` to all three, since it's the same idea applied consistently, not scope creep). Validate `--name` against AD-2's slug pattern immediately; re-prompt (don't just error out) if interactive and invalid.
  3. AD-8 idempotency check on `/opt/salon-booking/<name>`.
  4. Install prerequisites if missing: Docker (official `get.docker.com` script), Docker Compose plugin, `nginx`, `certbot` + `python3-certbot-nginx` (all via `apt-get`, `-y`, non-interactive).
  5. Prompt for Turnstile site/secret keys (required — explain in one line why, per R-9/user decision) and SUPERADMIN email.
  6. AD-4 port allocation.
  7. AD-7 secret generation; write `.env` (chmod 600).
  8. `git clone https://github.com/Sviat91/salon-booking-v2.git /opt/salon-booking/<name>` (R-1). Create `./data` and `./uploads` dirs (AD-5) before first `up`.
  9. Render `docker-compose.yml` from the template (Step 4) into the instance directory.
  10. `docker compose -p salon-<name> up -d --build`.
  11. Wait for the container to report healthy (simple retry loop against `http://127.0.0.1:<port>` or `docker compose ps`, not a blind `sleep`), then `docker compose exec app npx tsx scripts/create-admin.ts --email=<email> --password=<generated> --name="Super Admin"`.
  12. Render `deploy/nginx.conf.template` into `/etc/nginx/sites-available/<name>.conf`, symlink into `sites-enabled`, `nginx -t` (abort with the actual nginx error output if this fails — do not proceed to certbot against a broken config), `systemctl reload nginx`.
  13. `certbot --nginx -d <domain> --non-interactive --agree-tos -m <email> --redirect` (AD-1/R-... the exact flag combination the user asked for).
  14. AD-6 cron file.
  15. Write `CREDENTIALS.txt` (AD-7) and print the final summary: instance URL, admin login URL, SUPERADMIN email + password, explicit "copy this now, delete CREDENTIALS.txt after" instruction.
  - Use `set -euo pipefail` at the top. Every external command that can fail (apt installs, docker build, certbot) must have its failure actually stop the script with a clear message — no silently continuing past a failed step into ones that assume it succeeded.

- [x] **Step 7: `.env.example` — no changes needed** (R-9 already covers every field this plan uses); if Step 3's Dockerfile work surfaces a field that's missing from it, add it there, not just in `install.sh`.

- [x] **Step 8: Root `README.md` or `deploy/README.md`** (new) — the actual "one command" the operator runs on a fresh VPS, e.g.:
  ```
  curl -fsSL https://raw.githubusercontent.com/Sviat91/salon-booking-v2/main/deploy/install.sh | sudo bash -s -- --name=my-salon-client
  ```
  State plainly this only works because the operator (the user) trusts their own repo/script — standard practice for first-party installers (same pattern as Docker's/nvm's own install scripts), not a security gap to apologize for. Document the three things the operator must have ready before running it: a domain already pointed at the VPS's IP (A record), a Cloudflare Turnstile site registered for that domain, and an admin email.

- [x] **Step 9: Verification** (shellcheck clean, build/tsc/test clean — see coder's final report for the full Russian manual-verification checklist; end-to-end deploy genuinely NOT tested, no VPS/Docker daemon available in this sandbox)
  - `shellcheck deploy/install.sh` — must be clean (or every warning explicitly justified with a `# shellcheck disable=` comment explaining why).
  - `npm run build` locally still succeeds after Step 1/2's changes; `npx tsc --noEmit` clean; existing `npm run test` suite unaffected (this plan touches no application logic, only build config + new deploy/ files — if any existing test breaks, that's a sign something in Step 1/2 had an unintended side effect, investigate rather than silence).
  - **Cannot be tested end-to-end in this sandbox** — no real VPS/DNS/Docker daemon available here. The coder must say so explicitly rather than claiming a successful deploy, and the reviewer must not accept "should work" as equivalent to "verified." Produce a step-by-step **manual verification checklist** (in Russian, per this project's standing preference) for the user to run once on a real disposable test VPS before trusting this against a real client.

## Acceptance Criteria

- [ ] `deploy/install.sh` runs start-to-finish on a **fresh** Ubuntu 22.04/24.04 VPS with only `--name`/`--domain`/`--email` (Turnstile keys entered interactively) and ends with a working `https://<domain>` booking page and a printed/`CREDENTIALS.txt` SUPERADMIN login that actually works.
- [ ] Re-running the script for the same `--name` aborts cleanly (AD-8) — does not corrupt or duplicate the existing instance.
- [ ] Running it a second time with a **different** `--name` on the **same** VPS succeeds and does not collide with the first instance's port, container, Nginx site, or cron entry (AD-2/AD-4).
- [ ] Uploaded photos/logos and the sqlite DB survive `docker compose down && docker compose up -d` (AD-5) — this is the concrete, checkable proof that R-4/R-5's volume paths are actually correct, not just plausible-looking.
- [ ] `CRON_SECRET`, `AUTH_SECRET`, and the generated SUPERADMIN password never appear in shell history, `docker compose logs`, or any world-readable file (AD-7).
- [ ] `certbot --nginx` obtains a real certificate and HTTPS works; certbot's own renewal timer is confirmed active (`systemctl list-timers | grep certbot`) — the script doesn't need to configure renewal itself, but the reviewer should confirm the flags used actually trigger certbot's default behavior correctly.
- [x] `npm run build`, `npx tsc --noEmit`, `npm run test` all pass after Steps 1–2's changes, with no unrelated regressions. (Verified — 276/276 tests pass, tsc clean, build produces `.next/standalone/`.)

## Constraints & Risks

- **Do not build any update/upgrade tooling** — explicitly out of scope this pass (user decision).
- **Do not attempt to support non-Ubuntu hosts** — fail fast and say so instead (AD-9).
- **Do not log or print secrets except in the deliberate final summary/`CREDENTIALS.txt`** (AD-7) — this is the single highest-consequence mistake possible in this plan; the reviewer should treat any `echo "$AUTH_SECRET"`/`set -x` spanning the secrets block as a blocking finding.
- **Risk — cannot be end-to-end tested in this environment.** Every step involving `apt`, Docker, Nginx, or Certbot is reasoned from documentation and the project's own code, not from an actual run. Flag this honestly; do not overstate confidence.
- **Risk — Prisma client tracing in standalone mode.** Next.js's file-tracing for `output: standalone` has known rough edges with Prisma's native/generated client in some versions. If the built image fails to find the Prisma client at runtime, the fix is typically an explicit `COPY` of `node_modules/.prisma` and/or `node_modules/@prisma` from the builder stage — call this out in the Dockerfile with a comment even if it isn't needed, so a future debugger isn't starting from zero.
- **Risk — `tsx` moved to `dependencies` (AD-3) slightly grows the production `node_modules`.** Acceptable; flag it, don't avoid it by inventing a more complex alternative.
