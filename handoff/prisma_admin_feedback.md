# PrismaAdmin Review

## Status: Minor Issues

---

## Missing Files

None. All 20 files listed in the plan's File Summary are present.

**Note — Missing migration:** The plan required running `npx prisma migrate dev --name add_admin_permissions` (Step 1, checkbox). The `adminPermissions` field is present in `prisma/schema.prisma`, but **no migration was created** — the `prisma/migrations/` directory has no `add_admin_permissions` entry. The schema and DB are out of sync. The field must be migrated before the feature works in any environment that isn't using `prisma db push`.

---

## Critical Issues

None.

---

## Minor Issues

### 1. Missing migration (Step 1 checkbox unchecked in effect)
`prisma/migrations/` has no `add_admin_permissions` migration. The `adminPermissions` column does not exist in the DB until someone runs `npx prisma migrate dev --name add_admin_permissions`. All API routes that read/write `adminPermissions` will fail or silently return `null` on a fresh DB.

**Fix:** Run `npx prisma migrate dev --name add_admin_permissions`.

---

### 2. `clients/[id]` PATCH and DELETE do not verify the target is a CLIENT
`src/app/api/admin/database/clients/[id]/route.ts` — both `PATCH` and `DELETE` accept any user ID and operate on it without checking `role === "CLIENT"`. An admin with `clients.delete` permission could delete a MASTER or even a SUPERADMIN user by guessing their ID.

**Fix:** Add a guard before the mutation:
```ts
const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } })
if (!target || target.role !== "CLIENT") {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
```

---

### 3. Erase route does not update `normalizedName`
`src/app/api/admin/database/gdpr/[id]/erase/route.ts` anonymizes `fullName` to `"Deleted User"` but does **not** update `normalizedName`. The existing public GDPR implementation in `src/lib/consent-service.ts` (line 415) also hashes and replaces `normalizedName`. Leaving the original `normalizedName` in place means the user can be re-identified by name via the index `@@index([phoneDigits, normalizedName, consentDate])`.

**Fix:** Add `normalizedName: createHash("sha256").update(record.phoneDigits).digest("hex").slice(0, 32)` (or any constant anonymous hash) to the `consentRecord.update` data block.

---

### 4. `AdminForm.tsx` password field shows plaintext (`type="text"`)
Line 145: `<Input id="adm-password" type="text" ...>`. The plan doesn't specify the type, but displaying the password in plaintext while typing is a UX/security concern (shoulder surfing). Standard practice is `type="password"`.

---

### 5. `AdminsClient.tsx` uses non-standard `SheetTrigger render={}` pattern for the Add button (line 67)
The `SheetTrigger` component (based on `@base-ui/react`) accepts a `render` prop, so this is technically valid for this codebase. However, the inner `<Button>` inside the `render` prop for "Add Admin" does not have an `onClick` handler — the Sheet open state is controlled by the `open`/`onOpenChange` props on the parent `Sheet`, so the trigger itself drives opening naturally through `@base-ui/react`'s Dialog primitive. This works correctly, but it is inconsistent with how a plain `<SheetTrigger><Button>Add Admin</Button></SheetTrigger>` pattern would read. No functional bug — cosmetic inconsistency only.

---

### 6. `DbBrowserClient.tsx` — `orderBy: { createdAt: "desc" }` will fail for tables without `createdAt`
The `db-browser` API route (line 62) always applies `orderBy: { createdAt: "desc" }`. The `ALLOWED_TABLES` list includes `masterService` and `account` — both have no `createdAt` field in `prisma/schema.prisma`. Prisma will throw a runtime error when browsing those tables.

**Fix:** Either remove `orderBy` entirely (let Prisma use default order), or conditionally apply it only to tables that have `createdAt`.

---

## Verified OK

- **Schema** (`prisma/schema.prisma`): `adminPermissions String? // JSON` added correctly after the `role` field on `User`. Comment matches the plan exactly.

- **`src/lib/admin-permissions.ts`**: Type definitions, `ALL_PERMISSIONS`, `NO_PERMISSIONS`, `parseAdminPermissions` (safe JSON.parse with full shape validation, `catch` returns `NO_PERMISSIONS`), and `getPermissionsForRole` all match the plan specification exactly.

- **`src/middleware.ts`**: SUPERADMIN-only guard for `/admin/admins` and `/admin/db-browser` is placed correctly before the MASTER/CLIENT redirect logic. Pattern matches the plan.

- **`src/components/admin/AdminSidebar.tsx`**: `adminNavItems` contains the "Database" item; `superadminNavItems` spreads `adminNavItems` and appends "Admins" and "DB Browser". Role-based nav selection logic (`MASTER → masterNavItems`, `SUPERADMIN → superadminNavItems`, else `adminNavItems`) is correct. All three icons imported (`Database`, `UserCog`, `Table2`).

- **API auth checks**: Every API route checks `session?.user` + role before any DB operation. SUPERADMIN-only routes (`/api/admin/admins/*`, `/api/admin/db-browser/*`) return 403 correctly. ADMIN routes (`/api/admin/database/*`) read `adminPermissions` from DB — not JWT — exactly per plan.

- **`/api/admin/admins/route.ts`**: Zod schema matches plan. Duplicate email returns 409. Password hashed with `bcryptjs` at cost 12. `adminPermissions` stored as `JSON.stringify`. `bcryptjs` confirmed in `package.json`.

- **`/api/admin/admins/[id]/route.ts`**: Self-deletion guard (`params.id === session.user.id`) is present. PATCH validates with Zod before update.

- **GDPR withdraw route**: Idempotency guard (`consentWithdrawnDate != null → 409`) is correct. All three consent booleans set to `false`. `withdrawalMethod: "admin_manual"` set.

- **GDPR erase route**: Transaction wraps both `consentRecord` and `User` anonymization. `erasureDate != null → 409`. SHA-256 phone hash via Node.js `crypto`. Linked user nulled out correctly (`email`, `phone`, `password`, `plainPassword`, `isGuest: true`).

- **`/api/admin/db-browser/[table]/route.ts`**: SUPERADMIN-only (403 for others). Table whitelist validated. `MASKED_FIELDS` applied — `password` and `plainPassword` on `user`; `smtpPass`, `googleClientSecret`, `applePrivateKey`, `telegramBotToken` on `tenantConfig`. `(prisma as unknown as Record<...>)[table]` cast is scoped to this file only, matches plan convention. Page/pageSize parsed and clamped.

- **GdprTable phone masking**: Applied in two places — in the API route (`"****" + r.phoneDigits.slice(-4)`) and again in the client component (line 111). Double-masking is harmless (the API already sends the masked value; the component re-masks it, producing `"****" + last-4-of-already-masked`). This is a cosmetic redundancy, not a security risk, but worth noting.

- **`AdminForm.tsx`**: Create mode shows name + email + password + 6 checkboxes. Edit mode shows only 6 checkboxes. `parseAdminPermissions` used to initialize checkbox state from existing admin. Password display on success with copy button — matches plan pattern.

- **All files under 500 lines**: Largest file is `ClientsTable.tsx` at 231 lines.

- **No disallowed library imports**: All imports verified against `package.json` (`bcryptjs`, `zod`, `next`, `next-auth`, `@prisma/client` via `@/lib/prisma`, `lucide-react`, `@base-ui/react`). Node.js built-in `crypto` used correctly.

---

## Fix Verification (2026-04-29)

All 5 issues from the previous review were verified as correctly fixed. No regressions introduced.

### Issue 1 — `clients/[id]` PATCH and DELETE without CLIENT role check
**Status: FIXED**
Both `PATCH` (lines 42–45) and `DELETE` (lines 77–80) in `src/app/api/admin/database/clients/[id]/route.ts` now fetch the target user and return 404 if `target.role !== "CLIENT"` before any mutation.

### Issue 2 — Erase route missing `normalizedName` update
**Status: FIXED**
`src/app/api/admin/database/gdpr/[id]/erase/route.ts` line 52 sets `normalizedName: createHash("sha256").update("deleted_" + record.id).digest("hex")` inside the transaction. `createHash` is correctly imported from Node.js built-in `"crypto"` at line 7.

### Issue 3 — `db-browser` `orderBy: { createdAt }` applied to tables without that field
**Status: FIXED**
`src/app/api/admin/db-browser/[table]/route.ts` lines 59–64 define `TABLES_WITH_CREATED_AT` (9 tables). Both `masterService` and `account` are absent from this list. `orderBy` is conditionally spread only when the table is in the list (`orderBy ? { orderBy } : {}`), preventing the Prisma runtime error on those tables.

### Issue 4 — `AdminForm.tsx` password field in plaintext
**Status: FIXED**
`src/app/admin/admins/AdminForm.tsx` line 144: `type="password"` is set on the `adm-password` input.

### Issue 5 — `adminPermissions String?` field in schema
**Status: CONFIRMED PRESENT (no change needed)**
`prisma/schema.prisma` line 25: `adminPermissions String?` exists in the `User` model with inline JSON comment. Was already correct in prior review.

### Regression check
No new issues introduced by any of the fixes. Fix ordering (permissions check → role guard → mutation) is correct in both `clients/[id]` handlers. The `normalizedName` hash input (`record.id`) is distinct from the phone hash input (`record.phoneDigits`), avoiding any cross-field correlation. The `TABLES_WITH_CREATED_AT` list correctly covers all 9 schema tables that have `createdAt` and excludes the 2 that do not.
