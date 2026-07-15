# AGENTS.md — scripts

## Purpose

One-off operational scripts run via `tsx` or `node`, outside the Next.js app — SUPERADMIN bootstrap plus i18n locale-file verification.

## Ownership

`create-admin.ts`: idempotent (checks for an existing `SUPERADMIN` before creating one), bootstraps the first SUPERADMIN account from CLI flags — no hardcoded credentials.

`i18n-check.mjs`: plain Node ESM script (no `tsx`, no path-alias resolution needed) run via `npm run i18n:check` — flattens `src/locales/{pl,en,uk}.json`, asserts identical key sets across all 3, and scans `src/**` for `t('key')`/`i18n.t('key')` string-literal calls to report any referenced key missing from all 3 locale files. It's the objective acceptance gate for locale-file completeness; exits 1 if either check fails.

## Local Contracts

- Root `CLAUDE.md` documents a `npx tsx scripts/consent-cli.ts` GDPR admin CLI command, but that file does not exist in this folder — that command is currently broken/stale. Don't assume it exists; verify before referencing it in new docs or automation.
- `create-admin.ts` takes `--email --password --name` flags (validated via `zod`, same minimum-length bar as `/api/admin/admins` — password `min(6)`), bcrypt cost 12 to match the live admin-creation endpoints. It refuses to run if a `SUPERADMIN` already exists — that's a deliberate first-bootstrap-only guard, not a bug; adding more admins after that point goes through the admin panel's Admins page (`/api/admin/admins`), which is session-authenticated. (2026-07-13: replaced the old hardcoded-credential `create-superadmin.ts`, which shipped a fixed `admin@salon.local`/`Admin1234!` login — a real risk if ever run unmodified against production. `prisma/seed.ts`/`seed.js`, which had the same problem — `admin@somique.com`/`password123` plus a demo master — were deleted the same day; there is no seed script anymore, see `../prisma/AGENTS.md`.)
- `.mjs` scripts in this folder need Node globals (`console`, `process`) for lint — root `eslint.config.js` has a dedicated `files: ['scripts/**/*.mjs']` override for this (the general `**/*.{ts,tsx,js,jsx}` globals block doesn't match `.mjs`).

## Work Guidance

- New operational scripts go here, run via `npx tsx scripts/<name>.ts` (TypeScript) or `node scripts/<name>.mjs` (plain ESM, no path-alias resolution), and should be idempotent like `create-admin.ts` (safe to re-run without duplicating data).

## Verification

- Manual: run against a dev DB and confirm via `npx prisma studio` or a login attempt.
- `i18n-check.mjs`: `npm run i18n:check` (or `node scripts/i18n-check.mjs`).
