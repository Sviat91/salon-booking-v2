# AGENTS.md — scripts

## Purpose

One-off operational scripts run via `tsx`, outside the Next.js app — currently just SUPERADMIN bootstrap.

## Ownership

`create-superadmin.ts`: idempotent (checks for an existing `SUPERADMIN` before creating one), creates a hardcoded-credential admin account for initial deployment access.

## Local Contracts

- Root `CLAUDE.md` documents a `npx tsx scripts/consent-cli.ts` GDPR admin CLI command, but that file does not exist in this folder — that command is currently broken/stale. Don't assume it exists; verify before referencing it in new docs or automation.
- `create-superadmin.ts` hardcodes email/password (`admin@salon.local` / `Admin1234!`) — treat this as a bootstrap-only tool; the password must be changed immediately after first login, and this script should not be run against a production DB that already has a real SUPERADMIN.

## Work Guidance

- New operational scripts go here, run via `npx tsx scripts/<name>.ts`, and should be idempotent like `create-superadmin.ts` (safe to re-run without duplicating data).

## Verification

- Manual: run against a dev DB and confirm via `npx prisma studio` or a login attempt.
