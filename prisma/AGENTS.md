# AGENTS.md — prisma

## Purpose

Data model and migration history for the SQLite (libSQL) database at `prisma/app.db`.

## Ownership

`schema.prisma` (models: `User`, `MasterProfile`, `Service`, `MasterService`, `ConsentRecord`, `Schedule`, `Appointment`, `DateOverride`, `TenantConfig`, `NotificationLog`, `PasswordResetToken`, `Account`) and the `migrations/` history.

## Local Contracts

- SQLite has no native enums — role (`CLIENT|MASTER|ADMIN|SUPERADMIN`), appointment status, etc. are plain `String` columns validated at the application layer, not the DB layer. Don't add a Prisma `enum`.
- `User.password`/OAuth tokens, `User.passwordEncrypted`, and `TenantConfig` SMTP/OAuth secrets must be written through `src/lib/encryption.ts` — never add a migration that stores a new secret field in plaintext. (`User.passwordEncrypted` — added 2026-07-14 — stores each master's current password **encrypted at rest** via `encrypt()`, alongside the bcrypt `password` hash used for login; decryptable on demand by ADMIN/SUPERADMIN via the `getMasterPassword` server action in `src/app/admin/masters/actions.ts`.)
- `User` identity for clients is the `(phone, name)` pair (see schema comment on `User`) — two people sharing a phone get separate rows; email uniqueness for admin/master auth is enforced in the register endpoint, not a DB constraint.
- Any schema change requires `npx prisma migrate dev --name <name>` — never hand-edit `migrations/` or `app.db` directly.

## Work Guidance

- After a migration that changes procedure/schedule-related tables, remember cache invalidation is a separate manual step in the calling code (`src/lib/cache.ts` keys) — Prisma migrations don't touch Redis.
- There is no seed script (removed 2026-07-13 — `seed.ts`/`seed.js` hardcoded a `admin@somique.com`/`password123` SUPERADMIN plus a demo master account, unused by any automated path but a landmine if ever run against a real deployment). To bootstrap the first admin, use `scripts/create-admin.ts` (see `../scripts/AGENTS.md`); create a demo master through the admin panel after that.

## Verification

- `npx prisma studio` to inspect data manually after a migration.
- `tests/app/api/**` mock `@/lib/prisma` (see `vi.mock`) rather than hitting a real DB — a schema change needs the mocks updated to match the new shape, not just the migration.
