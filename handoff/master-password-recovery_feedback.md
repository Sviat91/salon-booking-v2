# Review: Master password recovery (encrypt-at-rest + decrypt-on-demand) & AUTH_SECRET fail-fast

**Date:** 2026-07-14
**Verdict:** APPROVED

## Per-step verification

1. **Schema + migration** — PASS. `prisma/schema.prisma:22` has `passwordEncrypted String?` right after `password String?`, nullable. `prisma/migrations/20260714174620_add_password_encrypted/migration.sql` is a single clean `ALTER TABLE "User" ADD COLUMN "passwordEncrypted" TEXT;` — additive, no data loss, migration ordering is consistent with the prior `20260714171031_remove_plain_password` migration in the same folder.

2. **encryption.ts fail-fast** — PASS. `src/lib/encryption.ts:6-9`: `const secret = process.env.AUTH_SECRET; if (!secret) { throw new Error(...) }` executes at true module top-level (not inside a function), so it fires on import. No `fallback-secret-development-only` string remains anywhere in `src/`. `encrypt()`/`decrypt()` bodies and their catch-returns-original-value behavior are byte-for-byte unchanged from what the plan described as out of scope.

3. **actions.ts** — PASS. `createMaster` adds `passwordEncrypted: encrypt(plainPassword)` alongside the bcrypt hash; `resetMasterPassword` adds `passwordEncrypted: encrypt(passwordToSet)`. New `getMasterPassword` action added exactly as planned.

   **Security-critical line-by-line re-derivation of `getMasterPassword`:**
   - `const session = await auth()` — real server-side session fetch, not client-trusted input.
   - `if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) return { error: "Unauthorized" }` — happens **before** any Prisma query or `decrypt()` call. Null session, undefined role, or wrong role all reject (fails closed).
   - Only after this gate does it run `prisma.user.findUnique({ select: { passwordEncrypted: true } })` — minimal field selection.
   - `decrypt()` only invoked after the role check and after confirming `passwordEncrypted` is non-null.
   - No code path returns `password` without passing the role check first.

4. **MasterForm.tsx** — PASS. `useEffect` fully removed, no leftover import/usage/broken JSX. `handleShowPassword` only invoked via explicit button `onClick`, never on mount. "Show current password" subsection has its own heading, sits clearly separate from "Generate new password".

5. **List types stay clean** — PASS. `page.tsx`, `MastersClient.tsx`, `MasterForm.tsx`'s local `Master` types all have zero password fields. Ciphertext never reaches the browser except via `getMasterPassword`'s return value.

6. **GDPR erase route** — PASS. `passwordEncrypted: null,` added after `password: null,`.

7. **consent-service.ts** — PASS. `passwordEncrypted: null,` present alongside `password: null,`.

8. **superadmin/credentials/route.ts** — PASS, genuinely untouched as intended.

9. **db-browser masking** — PASS. `MASKED_FIELDS.user` is `["password", "passwordEncrypted"]`.

10. **tests/setup/env.ts** — PASS. `AUTH_SECRET` placeholder set matching existing pattern.

11. **.env.example** — PASS. `AUTH_SECRET` documented with comment/placeholder.

12. **DOX pass** — PASS, accurate: `prisma/AGENTS.md`, `src/lib/AGENTS.md`, `src/app/admin/AGENTS.md`, `ROADMAP.md` all correctly describe the final design with no contradictions against the code.

13. **Verify** — Reviewer has no Bash access; nothing read contradicts the orchestrator-reported clean `tsc`/`build`/`lint`/`test`.

## Scope creep check
None. No files touched beyond the plan's list.

## Constraints & Risks confirmed honored
- `createMaster`/`updateMaster`/`deleteMaster`/`resetMasterPassword` still have zero self-contained auth/role checks — confirmed unchanged, explicitly out of scope for this pass.
- `encrypt()`/`decrypt()`'s catch-and-return-original-value fallback behavior unchanged.

## Summary
Clean, well-scoped implementation matching the plan exactly across all 13 steps. `getMasterPassword`'s auth check is fail-closed and precedes all data access/decryption. Defense-in-depth around keeping `passwordEncrypted` out of the masters list payload is genuinely honored. No critical or minor issues found.

## Follow-up recommended (not fixed in this pass, flagged by both planner and reviewer)
- `createMaster`/`updateMaster`/`deleteMaster`/`resetMasterPassword` in `src/app/admin/masters/actions.ts` perform no auth/role check of their own — they rely entirely on page rendering/middleware, which do not actually block a `MASTER`-role (or, depending on further checking, even lower-privileged) session from invoking these Server Actions directly. Recommend adding this as a new, explicit Roadmap security item and fixing it as its own bounded unit — the same `auth()` + role-check pattern already used in `getMasterPassword` applies directly.
