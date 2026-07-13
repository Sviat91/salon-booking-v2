# AGENTS.md — scripts

## Purpose

One-off operational scripts run via `tsx`, outside the Next.js app — currently just SUPERADMIN bootstrap.

## Ownership

`create-admin.ts`: idempotent (checks for an existing `SUPERADMIN` before creating one), bootstraps the first SUPERADMIN account from CLI flags — no hardcoded credentials.

## Local Contracts

- Root `CLAUDE.md` documents a `npx tsx scripts/consent-cli.ts` GDPR admin CLI command, but that file does not exist in this folder — that command is currently broken/stale. Don't assume it exists; verify before referencing it in new docs or automation.
- `create-admin.ts` takes `--email --password --name` flags (validated via `zod`, same minimum-length bar as `/api/admin/admins` — password `min(6)`), bcrypt cost 12 to match the live admin-creation endpoints. It refuses to run if a `SUPERADMIN` already exists — that's a deliberate first-bootstrap-only guard, not a bug; adding more admins after that point goes through the admin panel's Admins page (`/api/admin/admins`), which is session-authenticated. (2026-07-13: replaced the old hardcoded-credential `create-superadmin.ts`, which shipped a fixed `admin@salon.local`/`Admin1234!` login — a real risk if ever run unmodified against production. `prisma/seed.ts`/`seed.js`, which had the same problem — `admin@somique.com`/`password123` plus a demo master — were deleted the same day; there is no seed script anymore, see `../prisma/AGENTS.md`.)

## Work Guidance

- New operational scripts go here, run via `npx tsx scripts/<name>.ts`, and should be idempotent like `create-admin.ts` (safe to re-run without duplicating data).

## Verification

- Manual: run against a dev DB and confirm via `npx prisma studio` or a login attempt.
