# AGENTS.md — prisma

## Purpose

Data model and migration history for the SQLite (libSQL) database at `prisma/app.db`.

## Ownership

`schema.prisma` (models: `User`, `MasterProfile`, `Service`, `MasterService`, `ConsentRecord`, `Schedule`, `Appointment`, `DateOverride`, `TenantConfig`, `TelegramNotificationRecipient`, `NotificationLog`, `PasswordResetToken`, `Account`, `Discount`, `DiscountService`, `DiscountRedemption`) and the `migrations/` history.

## Local Contracts

- SQLite has no native enums — role (`CLIENT|MASTER|ADMIN|SUPERADMIN`), appointment status, etc. are plain `String` columns validated at the application layer, not the DB layer. Don't add a Prisma `enum`.
- `User.password`/OAuth tokens, `User.passwordEncrypted`, and `TenantConfig` SMTP/OAuth secrets must be written through `src/lib/encryption.ts` — never add a migration that stores a new secret field in plaintext. (`User.passwordEncrypted` — added 2026-07-14 — stores each master's current password **encrypted at rest** via `encrypt()`, alongside the bcrypt `password` hash used for login; decryptable on demand by ADMIN/SUPERADMIN via the `getMasterPassword` server action in `src/app/admin/masters/actions.ts`.)
- `User` identity for clients is the `(phone, name)` pair (see schema comment on `User`) — two people sharing a phone get separate rows; email uniqueness for admin/master auth is enforced in the register endpoint, not a DB constraint.
- Any schema change requires `npx prisma migrate dev --name <name>` — never hand-edit `migrations/` or `app.db` directly.
- `Service.name` and `MasterProfile.bio` are per-locale columns, not translations tables: `name_pl`/`name_en`/`name_uk` (`name_pl` is NOT NULL — the canonical default) and `bio_pl`/`bio_en`/`bio_uk` (all nullable). `TenantConfig.enabledLocales` is a JSON string array (default `["pl","en","uk"]`) gating which locales an admin can author. Resolve a display value with `resolveLocalized()`/`parseEnabledLocales()` from `src/lib/localized-content.ts` — never read the bare `name`/`bio` fields (they no longer exist).
- `Appointment.clientLanguage String @default("pl")` (NOT NULL) stores the client's UI language at booking time, validated against `SUPPORTED_LANGUAGES` and defaulted to `pl` by `POST /api/book` for missing/invalid input — never written directly from an unvalidated request field. Used only by `src/lib/notifications/index.ts` to pick the language of the **client-facing** confirmation/reminder copy; admin/salon-facing copy always stays `DEFAULT_LANGUAGE`.
- `TelegramNotificationRecipient` (`id`, `chatId`, `label?`, `createdAt`) replaces the old single `TenantConfig.notifAdminChatId String?` field (removed) — a flat, unrelated list of chat IDs the salon's admin/salon-facing Telegram notifications broadcast to (see `src/lib/notifications/index.ts` in `../src/lib/AGENTS.md`). No FK; implicitly tenant-scoped since there is one `TenantConfig` singleton.
- `Appointment.originalPrice`/`finalPrice`/`discountId` are a **nullable snapshot** written by all three `appointment.create` sites (`booking-service.ts`, `master/appointments`, `admin/calendar/appointments`); `null` means "pre-discounts row" and readers fall back to the live `MasterService.priceOverride ?? Service.price` via `resolveAppointmentPrice()` (`src/lib/discounts/shared.ts`) — there is no backfill. `Discount.masterId` mirrors `Service.masterId` semantics (`null` = admin/global, filled = that master's own). `Discount.code` is stored uppercase-normalized via `normalizeDiscountCode()` — that is what makes the `@unique` index case-insensitive on SQLite. `label`/`percent` are deliberately **not** denormalized onto `Appointment` — `Appointment.discountId` is `onDelete: SetNull`, so deleting a `Discount` drops the join but the percentage stays derivable from the price snapshot (`discountPercentFromSnapshot()`).

## Work Guidance

- After a migration that changes procedure/schedule-related tables, remember cache invalidation is a separate manual step in the calling code (`src/lib/cache.ts` keys) — Prisma migrations don't touch Redis.
- There is no seed script (removed 2026-07-13 — `seed.ts`/`seed.js` hardcoded a `admin@somique.com`/`password123` SUPERADMIN plus a demo master account, unused by any automated path but a landmine if ever run against a real deployment). To bootstrap the first admin, use `scripts/create-admin.ts` (see `../scripts/AGENTS.md`); create a demo master through the admin panel after that.
- `DATABASE_URL`'s relative sqlite path (`file:./prisma/app.db`) resolves relative to `schema.prisma`'s own directory, not the repo root — the live dev database is actually `prisma/prisma/app.db`, not the empty stray file at `prisma/app.db`. Back up/inspect the right file. `prisma migrate dev --create-only` also requires an interactive TTY when a column change would drop non-null data (e.g. adding a required column); in a non-interactive shell, generate the raw SQL instead with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`, hand-edit the `INSERT...SELECT` to preserve data, place it in a manually created timestamped `migrations/<ts>_<name>/migration.sql`, then run plain `npx prisma migrate dev` to apply it.

## Verification

- `npx prisma studio` to inspect data manually after a migration.
- `tests/app/api/**` mock `@/lib/prisma` (see `vi.mock`) rather than hitting a real DB — a schema change needs the mocks updated to match the new shape, not just the migration.
