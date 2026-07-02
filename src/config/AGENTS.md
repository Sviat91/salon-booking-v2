# AGENTS.md — src/config

## Purpose

Per-master configuration, split across a client-safe file and a server-only file.

## Ownership

The `MasterId` union and the hardcoded master list (`olga`, `yuliia`) plus DB-backed dynamic masters (any `User` with `role: "MASTER"`).

## Local Contracts

- `masters.server.ts` must **never** be imported in a client component (root-level constraint). Currently it only re-derives display fields (`name`, `avatar`) from `MasterId` — it does not currently hold Calendar/Sheet resource IDs despite the root `CLAUDE.md` env var list (`GOOGLE_CALENDAR_ID*`, `GOOGLE_SHEET_ID*`) implying otherwise; those env vars have no current consumers in `src/`. Treat that section of the root doc as stale until reconciled — don't assume a Google Calendar/Sheets integration is live.
- `masters.ts` is the single source of truth for hardcoded master IDs/names/avatars — don't duplicate this list elsewhere. Dynamically created masters (via admin UI) are validated against the DB through `isValidMasterIdAsync()`, not this static map.
- `isValidMasterId` (sync, hardcoded-only) vs `isValidMasterIdAsync` (checks DB too) — use the async version wherever a master could have been created after deploy (most server-side checks); the sync version is for fast-path/client checks only.

## Work Guidance

- Adding a new hardcoded master: extend `MasterId`, `MASTERS`, and `MASTER_IDS` together in `masters.ts`; update `masters.server.ts` if it gains real per-master fields.

## Verification

- `tests/config/` covers this folder — run `npx vitest run tests/config`.
