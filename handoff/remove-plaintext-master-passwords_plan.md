# Plan: Remove plaintext master password storage (Roadmap Priority 2, item 9)

**Date:** 2026-07-14
**Status:** SUPERSEDED — see `handoff/master-password-recovery_plan.md`. User rejected the "delete outright, show once" approach after implementation: admins need to recover a master's current password on demand, not just at creation. Replaced with an encrypted-at-rest, decrypt-on-demand design (same pattern already used for TenantConfig OAuth/SMTP secrets via `src/lib/encryption.ts`). None of this plan's code changes were committed; the new plan re-does this from scratch.
**Mode:** LIGHT (orchestrator-written plan; mechanical field removal, no architectural decisions)

## Goal

Roadmap item: "Пароли мастеров хранятся в открытом виде (`plainPassword` в базе) — не только хэш, а ещё и читаемый пароль. Утечка базы = утечка паролей."

`User.plainPassword` currently stores the master's password in recoverable plaintext, and `MasterForm.tsx` pre-fills the "Current / New Password" field with it on every edit — meaning any DB read (or DB leak) exposes live master passwords. The correct pattern (already partially in place): generate/reset a password, return it **once** in the action response so the admin can copy it, and never persist it in plaintext. `createMaster`'s `generatedPassword` return and `resetMasterPassword`'s `newPassword` return already do this — the only thing to remove is the *storage* and the *re-display of the old value* on next edit.

## Architecture Decisions

- No new column, no encryption-at-rest for this field — the field is deleted outright. The roadmap's own fix intent is "stop storing it," not "store it more safely." (Encrypting it would still mean it's recoverable by the app, which is the actual risk being closed.)
- `MasterForm.tsx`'s edit view loses the ability to *view* the master's current password (it never should have had this). The reset flow (generate-or-type a new password, shown once) is untouched and remains the only way to give a master a password after creation — matching how the create flow already works.
- All `plainPassword: null` writes (GDPR erase paths, superadmin password change) become dead once the column doesn't exist — delete those lines, don't leave them as harmless no-ops (Prisma will type-error on an unknown field anyway).

## Implementation Steps

- [x] Step 1: `prisma/schema.prisma`
  - Delete line `plainPassword String?` from the `User` model (currently line 22, right after `password`).
  - Run `npx prisma migrate dev --name remove_plain_password` to generate + apply the migration (drops the column) and regenerate the Prisma client.

- [x] Step 2: `src/app/admin/masters/actions.ts`
  - `createMaster` (~line 74): remove `plainPassword: plainPassword,` from the `prisma.user.create` data object. Keep the local `const plainPassword = generatePassword()` and the `return { success: true, generatedPassword: plainPassword }` — those are unrelated to storage, they're the one-time return value.
  - `resetMasterPassword` (~line 162): change `data: { password: hashedPassword, plainPassword: passwordToSet }` to `data: { password: hashedPassword }`.

- [x] Step 3: `src/app/admin/masters/page.tsx`
  - Remove `plainPassword: string | null` from the `MasterWithProfile` type.
  - Remove `plainPassword: true,` from the `select` object in `prisma.user.findMany`.

- [x] Step 4: `src/app/admin/masters/MastersClient.tsx`
  - Remove `plainPassword: string | null` from the local `Master` type (line ~22).

- [x] Step 5: `src/app/admin/masters/MasterForm.tsx`
  - Remove `plainPassword: string | null` from the local `Master` type (line ~17).
  - Change `const [customPassword, setCustomPassword] = useState(master?.plainPassword || "")` to `useState("")` — the field now always starts empty on edit; the admin must explicitly type or generate a new password.
  - Simplify the reset button's `disabled` condition: remove the `|| (customPassword === master?.plainPassword)` clause (that comparison target no longer exists). Result: `disabled={isResetting || (!customPassword && !resetPasswordState.success)}`.
  - Simplify the button label condition: change `(customPassword && customPassword !== master?.plainPassword ? "Save New Password" : "Auto-Generate & Save")` to `(customPassword ? "Save New Password" : "Auto-Generate & Save")`.

- [x] Step 6: `src/app/api/admin/database/gdpr/[id]/erase/route.ts`
  - Remove the `plainPassword: null,` line (~line 69) from the `tx.user.update` data object.

- [x] Step 7: `src/lib/consent-service.ts`
  - Remove the `plainPassword: null,` line (~line 440) from the `tx.user.updateMany` data object.

- [x] Step 8: `src/app/api/admin/superadmin/credentials/route.ts`
  - Change `data: { password: hashed, plainPassword: null }` to `data: { password: hashed }` (~line 51).

- [x] Step 9: `src/app/api/admin/db-browser/[table]/route.ts`
  - Remove `"plainPassword"` from `MASKED_FIELDS.user` (~line 24): `user: ["password", "plainPassword"]` → `user: ["password"]`.

## Acceptance Criteria

- [x] `grep -rn "plainPassword" src prisma` returns nothing (except the migration SQL file itself, which is expected historical record). (Only remaining hits: the intentional local `plainPassword` variable in `actions.ts` unrelated to the DB column, the migration SQL files, and a stale doc reference in `prisma/AGENTS.md` — see deviation note.)
- [x] `npx tsc --noEmit` clean.
- [x] `npm run build` succeeds.
- [x] `npm run lint` — no new warnings/errors vs. current baseline (confirmed identical 54 problems / 49 errors / 5 warnings before and after via `git stash`).
- [x] Migration applied; `prisma/app.db` no longer has a `plainPassword` column on `User` (migration `20260714171031_remove_plain_password` applied via `prisma migrate dev`, confirmed by generated SQL dropping the column).
- [ ] Master creation still returns a one-time generated password in the UI (unchanged behavior) — requires manual UI verification, no dev server run per project convention.
- [ ] Master password reset still works: typing a custom password or clicking "Generate" and saving still returns a one-time new password in the UI — requires manual UI verification.
- [ ] Editing an existing master no longer shows/pre-fills any password value in the "Current / New Password" field — requires manual UI verification.

## Constraints & Risks

- **DO NOT** touch the create/reset flow's one-time return values (`generatedPassword`, `newPassword`) — those are the correct, already-working pattern and stay as-is.
- **DO NOT** add password encryption or any new secret-storage abstraction — out of scope; the fix is "don't store it," not "store it more safely."
- This changes the DB schema — requires a real Prisma migration (not just `db push`), since this is meant to ship to production data eventually. Use `prisma migrate dev`.
- No dev server / stagewise checkpoint: stop after implementation for the user's manual test — create a new master (confirm password shown once), edit that master and confirm the password field is now empty (not pre-filled), reset the master's password (custom and auto-generate) and confirm it still returns a new password each time.
