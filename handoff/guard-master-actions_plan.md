# Plan: Add auth/role checks to unguarded master-management Server Actions

**Date:** 2026-07-14
**Status:** Complete
**Mode:** LIGHT (orchestrator-written plan; replicates the `getMasterPassword` pattern from the same file, no architectural decisions)

## Goal

`src/app/admin/masters/actions.ts` has five exported Server Actions. Only the newest one, `getMasterPassword` (added earlier today), checks the caller's session/role before doing anything. `createMaster`, `updateMaster`, `deleteMaster`, and `resetMasterPassword` have **zero** auth checks of their own — they rely entirely on the `/admin/masters` page being reachable only by an authorized session (middleware + page rendering). That's not a real security boundary: Next.js Server Actions are invoked via a POST to a stable action ID that ships in the client bundle, so any authenticated session (including `CLIENT` or `MASTER` role, or a `MASTER` who discovers the action ID) can call these directly, bypassing the page entirely. Concretely today: any logged-in user could create a MASTER account, rename/delete any master, or reset any master's password, without ever loading `/admin/masters`.

Fix: add the exact same fail-closed check already used in `getMasterPassword` (added this session, already reviewed) to the other four actions.

## Reference pattern (already in the file, `getMasterPassword`)

```ts
const session = await auth()
if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
  return { error: "Unauthorized" }
}
```

`auth` is already imported at the top of `actions.ts` (`import { auth } from "@/auth"`, added earlier today for `getMasterPassword`) — no new import needed.

`["SUPERADMIN", "ADMIN"]` is the correct allow-list to match: `src/middleware.ts` does not list `/admin/masters` in its `superadminOnly` array (only `/admin/admins` and `/admin/db-browser` are SUPERADMIN-only), meaning the page itself is already intended to be reachable by both `ADMIN` and `SUPERADMIN` — this plan must not narrow that to SUPERADMIN-only, just close the gap that lets other roles bypass it entirely via direct action calls.

## Implementation Steps

- [x] Step 1: `createMaster` (`src/app/admin/masters/actions.ts`, ~line 44)
  - Add the auth check as the first line inside the function body (before parsing `formData`).
  - Return shape already supports it: `MasterFormState` has `error?: string`, so `return { error: "Unauthorized" }` on failure, matching the pattern other validation failures in this function already use.

- [x] Step 2: `updateMaster` (~line 97)
  - Same check, same return shape (`MasterFormState`), first line of the function body.

- [x] Step 3: `deleteMaster` (~line 148)
  - Currently `export async function deleteMaster(id: string): Promise<void>`. Add the same check as the first line; on failure, `throw new Error("Unauthorized")` (idiomatic for a `void`-returning Server Action — Next.js surfaces thrown errors from Server Actions to the caller). Do not change the function's return type or its caller in `MastersClient.tsx` — a thrown error is sufficient to stop the mutation and requires no caller changes.

- [x] Step 4: `resetMasterPassword` (~line 154)
  - Signature is `Promise<{ success: boolean; newPassword?: string; error?: string }>`. Add the same check as the first line; on failure, `return { success: false, error: "Unauthorized" }`.

- [x] Step 5: Verify
  - `npx tsc --noEmit` clean.
  - `npm run build` succeeds.
  - `npm run lint` — no new problems vs. the current baseline (54 problems / 49 errors / 5 warnings, per this session's prior runs).
  - `npm run test` — no new failures vs. the known ~11-failing-file baseline.
  - Grep to confirm all five exported actions in the file now start with the same `auth()` check pattern (five matches for `const session = await auth()` in this file, or equivalent).
  - Read the final file once to confirm no duplicate/shadowed `session` variable issues and no broken control flow (each check must come before any DB read/write in its function).

## Acceptance Criteria

- [x] All five actions in `src/app/admin/masters/actions.ts` (`createMaster`, `updateMaster`, `deleteMaster`, `resetMasterPassword`, `getMasterPassword`) reject callers whose session is missing or whose role is not `SUPERADMIN`/`ADMIN`, before any Prisma read or write.
- [x] No change to `MastersClient.tsx`, `MasterForm.tsx`, `page.tsx`, or any other caller — the fix is entirely inside `actions.ts`.
- [x] `tsc`/`build` clean; `lint`/`test` no new failures vs. baseline.

## Constraints & Risks

- **DO NOT** add a granular permissions system (e.g. extending `User.adminPermissions` JSON with a "masters" category) — out of scope, this is a coarse role-gate fix matching the existing coarse role-gate used everywhere else for this page (middleware, `getMasterPassword`).
- **DO NOT** change any function's success-path behavior, return shape (beyond adding the unauthorized-error case), or the calling components — this is purely adding a guard clause to each function.
- **DO NOT** touch `getMasterPassword` — it already has this check, added and reviewed earlier today.
- No dev server — stop after implementation for the user's manual test: confirm `/admin/masters` still works normally when logged in as ADMIN/SUPERADMIN (create, edit, delete, reset password all still succeed). A negative test (confirming a MASTER/CLIENT session gets rejected) requires either a second test account or reasoning through the code — note in your report which you did.
