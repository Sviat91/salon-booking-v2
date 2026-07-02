# AGENTS.md — docs

## Purpose

Legacy human-facing documentation (`API.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`), written in Russian, dated before the current Prisma/SQLite architecture.

## Ownership

Historical/reference material only. Not authoritative.

## Local Contracts

- These files describe a pre-migration architecture (Google Sheets as the procedures/consents store, `src/lib/google/` module) that no longer matches the codebase — the app now uses Prisma/SQLite (`prisma/schema.prisma`) and `src/lib/consent-service.ts`. Do not use these docs to answer questions about current data flow or API behavior; treat root `CLAUDE.md` and the source under `src/` as ground truth.
- Do not delete without asking — they weren't flagged for removal, just superseded.

## Work Guidance

- If asked to update these docs, confirm with the user first whether to refresh them to match the current architecture or archive/remove them, since a full rewrite is a meaningful scope decision.

## Verification

(none — reference material, not exercised by any build or test step)
