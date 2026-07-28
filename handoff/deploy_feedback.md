# Review: One-command VPS deployment (Docker + host Nginx/Certbot)
**Date:** 2026-07-28
**Verdict:** NEEDS CHANGES → **APPROVED after fix pass (see bottom)**

## Critical/Architectural Issues

- [ ] **`.dockerignore` doesn't exclude the live-data directories the install script creates in the same tree used as the Docker build context** — `.dockerignore`:1-24, `deploy/install.sh`:196-198, `Dockerfile`:20. `install.sh` `git clone`s directly into `$INSTANCE_DIR` (line 197) and then creates `$INSTANCE_DIR/data` and `$INSTANCE_DIR/uploads` as top-level siblings inside that same directory (line 198). `docker-compose.yml.template`'s `build: .` uses that exact directory as the Docker build context, and `Dockerfile`:20 does `COPY . .` in the builder stage. `.dockerignore` excludes `*.db`/`public/uploads/` (paths that exist in the *source repo*) but never excludes the new `/data`, `/uploads`, or `CREDENTIALS.txt` paths that only exist in the *deployed instance* directory. Any future rebuild (e.g. an operator manually running `docker compose up -d --build`) would sweep the live SQLite DB (client PII + password hashes), uploaded photos, and — if not yet deleted — the plaintext `CREDENTIALS.txt` SUPERADMIN password into a cached Docker builder layer on the host disk. Not exercised by the stated Acceptance Criteria (only tests `down`/`up`, never a second `--build`). Fix: add `/data`, `/uploads`, `/CREDENTIALS.txt` (and optionally `/docker-compose.yml`) to `.dockerignore`.

## Minor/Syntax Issues

- [ ] Missing deliverable: plan Step 9 requires a persisted Russian-language manual verification checklist for a disposable test VPS. It only exists in agent chat output, not in any repo file. Persist it (append to `deploy/README.md` or a new file).
- [ ] `EMAIL_RE` in `deploy/install.sh`:63 is overly permissive (accepts shell metacharacters/quotes in local-part/domain-part). No actual injection path today, but tighten defensively since this value lands in `certbot -m` and `CREDENTIALS.txt`.
- [ ] DOX gap: `deploy/` is a new durable directory (6 files) with no `deploy/AGENTS.md`, and root `CLAUDE.md`'s Child DOX Index isn't updated to reference it.

## Passed Checks

- [x] `output: 'standalone'` correct; `.next/standalone/` confirmed to trace in Prisma client + locale JSON.
- [x] `tsx` and `prisma` (CLI) both correctly moved to `dependencies`; entrypoint invokes `./node_modules/.bin/prisma` directly, no `npx`.
- [x] Dockerfile generates the Prisma client for the correct runtime platform (musl/Alpine, `openssl` installed in builder+runner).
- [x] R-3 (`public/` not auto-copied in standalone mode) correctly handled via explicit `COPY --from=builder /app/public ./public`.
- [x] R-5/AD-5 DB path traced end-to-end and correct: resolves to `/app/prisma/prisma/app.db` inside the container, matching the compose volume mount `./data:/app/prisma/prisma`. `public/uploads` is a genuine host bind mount.
- [x] Secrets handling: no `set -x`/`set -v` anywhere; secrets generated via `openssl rand`, only echoed in the final summary/`CREDENTIALS.txt`; `.env`/`CREDENTIALS.txt`/cron file all `chmod 600` + `chown root:root`.
- [x] AD-8 idempotency check runs immediately after arg validation, strictly before any state-mutating step.
- [x] AD-2 slug/domain/email validation happens before first use everywhere.
- [x] `/dev/tty` prompting correctly supports the documented `curl | sudo bash -s --` pattern.
- [x] Admin-bootstrap/migrate split matches AD-3/Step-3 exactly.
- [x] Health-check retry loop (bounded, `/api/health`) replaces a blind sleep.
- [x] Nginx template is plain-HTTP-only as required; certbot flags match the plan.
- [x] Multi-instance namespacing consistent, no cross-instance collision path found.
- [x] Scope discipline: no update/upgrade scaffolding, Ubuntu/apt-only fail-fast, all files well under 500 lines.
- [x] Both `shellcheck disable=SC2016` comments genuinely justified.
- [x] `.env.example` correctly left unchanged.

## Summary

Well-reasoned, carefully-traced implementation. Gets the two highest-stakes items right: no secrets logged/echoed outside the deliberate final summary, and the tricky DB-path/volume-mount interaction (R-5) is correctly wired end-to-end. One genuine architectural gap the plan itself didn't anticipate: `.dockerignore` needs excludes for `/data`, `/uploads`, `CREDENTIALS.txt` to prevent a future rebuild from baking client PII/photos/the plaintext admin password into a Docker layer. Three low-severity minor items round it out. Given no VPS/Docker daemon/DNS is available in this sandbox, the coder's verification (clean build/tsc/test/shellcheck plus genuine manual trace of the actual `.next/standalone` output tree) is considered honest and appropriately rigorous for what's testable here — independently re-derived and held up. What's still missing is not more sandbox testing but the actually-required deliverable: the Russian verification checklist needs to be persisted to a file, not left in chat.

---

## Fix-verification pass (2026-07-28) — APPROVED

All 4 items resolved, verified against actual file contents (not just the coder's self-report):

1. **`.dockerignore`** — `/data`, `/uploads`, `/CREDENTIALS.txt`, `/docker-compose.yml` added, root-anchored (`.dockerignore:32-35`). Resolved.
2. **Russian verification checklist** — persisted in `deploy/README.md:60-123` ("Проверка на тестовом VPS перед боевым клиентом"), covers all 9 required points. Item 9's `client_max_body_size 5M` claim cross-checked against `deploy/nginx.conf.template:14` and the app's 4MB upload cap (`src/app/api/upload/route.ts:8`) — accurate. Resolved.
3. **`EMAIL_RE`** — tightened to `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$` at `deploy/install.sh:63`; interactive re-prompt and non-interactive hard-fail flows both unchanged. Resolved.
4. **DOX gap** — `deploy/AGENTS.md` created (Purpose/Ownership/Local Contracts/Work Guidance/Verification), matches sibling AGENTS.md shape; root `CLAUDE.md:207` Child DOX Index updated. Content spot-checked against actual code, no drift. Resolved.

Blast-radius check: only `.dockerignore`, one regex line in `install.sh`, and Markdown/docs were touched — no application source files — so skipping a full `build`/`tsc`/`test` re-run for this fix pass was justified.

**No regressions found. Ship it.**
