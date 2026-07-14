# Review: guard-master-actions
**Date:** 2026-07-14
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `createMaster` (line 44-51): `await auth()` + `!["SUPERADMIN","ADMIN"].includes(...)` check is the first statement in the function body, before `formData` parsing, Zod validation, `prisma.user.findFirst`, `bcrypt.hash`, and `prisma.user.create`. Returns `{ error: "Unauthorized" }`, which type-checks against `MasterFormState` (`error?: string`).
- [x] `updateMaster` (line 102-110): Same guard as first statement, before `formData` parsing and `prisma.user.update`. Returns `{ error: "Unauthorized" }`, valid `MasterFormState`.
- [x] `deleteMaster` (line 158-162): Same guard as first statement, before `prisma.user.delete`. Function signature is `Promise<void>`; unauthorized path uses `throw new Error("Unauthorized")` rather than a `return` statement — correctly matches the void return type, no TS mismatch.
- [x] `resetMasterPassword` (line 169-176): Same guard as first statement, before password generation, `bcrypt.hash`, and `prisma.user.update`. Returns `{ success: false, error: "Unauthorized" }`, matching `Promise<{ success: boolean; newPassword?: string; error?: string }>`.
- [x] `getMasterPassword` (line 193-211): Guard present (pre-existing), unchanged in structure/content — no evidence of modification.
- [x] No code path in any of the five functions reaches a Prisma call or a success return before the guard clause executes.
- [x] No duplicate/shadowed `session` declarations. Control flow after each guard is intact.
- [x] Role allow-list `["SUPERADMIN", "ADMIN"]` matches `src/middleware.ts`'s intent: `/admin/masters` is not in the `superadminOnly` array, confirming ADMIN is meant to reach this page and the fix doesn't narrow access beyond the existing page-level guard.
- [x] Scope containment confirmed by orchestrator via `git status` after review: only `src/app/admin/masters/actions.ts` modified. No caller files touched.

## Summary
All five exported Server Actions in `src/app/admin/masters/actions.ts` now perform the identical fail-closed session/role check as the very first statement in their function bodies, correctly matching each function's own return type. No database read/write or success path is reachable without first passing the guard. This closes the privilege-escalation gap (any authenticated CLIENT/MASTER session could previously create/delete/rename master accounts or reset their passwords by calling these Server Actions directly) without narrowing legitimate ADMIN/SUPERADMIN access. Clean, minimal, correctly-typed security fix.
