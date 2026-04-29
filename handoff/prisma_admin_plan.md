# PrismaAdmin — Implementation Plan

Coder agent works ONLY from this file.
All file paths are relative to the repo root.
Line-limit: 500 lines per file (hard limit).
Path alias: `@/*` → `src/*`.
Tech: Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Prisma 5, SQLite, NextAuth v5 beta (JWT).

---

## Dependency Order (must be respected)

Step 1 → Step 2 → Steps 3–4 (parallel) → Steps 5–7 (parallel) → Steps 8–10 (parallel) → Step 11 → Step 12

---

## Step 1 — Schema migration: add `adminPermissions` field

**Files:** `prisma/schema.prisma`

- [x] Add field `adminPermissions String? // JSON` to model `User`, after the `role` field.
- [x] Run `npx prisma migrate dev --name add_admin_permissions`

Resulting field in User model:
```prisma
adminPermissions  String?  // JSON: {"clients":{"view":bool,"edit":bool,"delete":bool},"gdpr":{"view":bool,"withdraw":bool,"erase":bool}}
```

**Risk:** Existing ADMIN users will have `adminPermissions = null` after migration. The helper in Step 2 treats `null` as zero-permissions for ADMIN. SUPERADMIN always gets all permissions via role check, not from DB. No data loss.

---

## Step 2 — Permissions helper utility

**File to CREATE:** `src/lib/admin-permissions.ts`

- [x] Define TypeScript type `AdminPermissions`:
  ```ts
  export type AdminPermissions = {
    clients: { view: boolean; edit: boolean; delete: boolean }
    gdpr: { view: boolean; withdraw: boolean; erase: boolean }
  }
  ```
- [x] Define `ALL_PERMISSIONS: AdminPermissions` constant (all true).
- [x] Define `NO_PERMISSIONS: AdminPermissions` constant (all false).
- [x] Export `parseAdminPermissions(raw: string | null | undefined): AdminPermissions` — safe JSON.parse + shape validation, returns NO_PERMISSIONS on any error.
- [x] Export `getPermissionsForRole(role: string, raw: string | null | undefined): AdminPermissions`:
  - If `role === "SUPERADMIN"` → return `ALL_PERMISSIONS`
  - If `role === "ADMIN"` → return `parseAdminPermissions(raw)`
  - Otherwise → `NO_PERMISSIONS`

**Note:** `adminPermissions` is NOT stored in the JWT token. API routes and server components must read it from DB when needed for ADMIN users. SUPERADMIN never hits DB for permissions.

---

## Step 3 — AdminSidebar refactor

**File:** `src/components/admin/AdminSidebar.tsx`

- [x] Add new imports: `Database`, `UserCog`, `Table2` from `lucide-react`.
- [x] Rename existing `superadminNavItems` to `adminNavItems`.
- [x] Add item to `adminNavItems`:
  ```ts
  { label: "Database", href: "/admin/database", icon: Database }
  ```
- [x] Create new `superadminNavItems` = spread of `adminNavItems` + two extra items:
  ```ts
  { label: "Admins", href: "/admin/admins", icon: UserCog }
  { label: "DB Browser", href: "/admin/db-browser", icon: Table2 }
  ```
- [x] Update nav selection logic:
  ```ts
  const navItems =
    session?.user?.role === "MASTER"      ? masterNavItems :
    session?.user?.role === "SUPERADMIN"  ? superadminNavItems :
    adminNavItems
  ```
- [x] Keep all existing JSX unchanged (the `navItems.map(...)` loop works without modification).

---

## Step 4 — Middleware: protect SUPERADMIN-only routes

**File:** `src/middleware.ts`

- [x] Inside the `/admin` auth block, add SUPERADMIN-only guard before any CLIENT redirect check:
  ```ts
  const superadminOnly = ["/admin/admins", "/admin/db-browser"]
  if (superadminOnly.some(p => pathname.startsWith(p))) {
    if (role !== "SUPERADMIN") {
      return Response.redirect(new URL("/admin", nextUrl))
    }
  }
  ```
- [x] No changes to the matcher config needed.

---

## Step 5 — API routes for /admin/admins

### 5a — `src/app/api/admin/admins/route.ts` (CREATE)

- [x] `export const runtime = "nodejs"`
- [x] `GET`: auth check (`role === "SUPERADMIN"`). Return list: `prisma.user.findMany({ where: { role: "ADMIN" }, select: { id, name, email, adminPermissions, createdAt }, orderBy: { createdAt: "asc" } })`.
- [x] `POST`: auth check. Zod schema:
  ```ts
  z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    adminPermissions: z.object({
      clients: z.object({ view: z.boolean(), edit: z.boolean(), delete: z.boolean() }),
      gdpr: z.object({ view: z.boolean(), withdraw: z.boolean(), erase: z.boolean() }),
    }),
  })
  ```
  Hash password with `bcryptjs`. Create User: `role: "ADMIN"`, `adminPermissions: JSON.stringify(permissions)`. On duplicate email → 409.

### 5b — `src/app/api/admin/admins/[id]/route.ts` (CREATE)

- [x] `PATCH`: auth check (`role === "SUPERADMIN"`). Body: `{ adminPermissions }`. Update `adminPermissions` as JSON string. Return updated user.
- [x] `DELETE`: auth check. Prevent self-deletion. `prisma.user.delete({ where: { id } })`. Return `{ success: true }`.

---

## Step 6 — API routes for /admin/database/clients

### 6a — `src/app/api/admin/database/clients/route.ts` (CREATE)

- [x] `export const runtime = "nodejs"`
- [x] `GET`: auth check (SUPERADMIN or ADMIN). For ADMIN: fetch `adminPermissions` from DB, check `clients.view` → 403 if false.
- [x] Query: `prisma.user.findMany({ where: { role: "CLIENT" }, select: { id, name, phone, email, createdAt, isGuest }, orderBy: { createdAt: "desc" }, take: 100 })`.
- [x] Support `?search=` param: filter by `name`/`phone`/`email` contains (case-insensitive).
- [x] Return `{ clients, total }`.

### 6b — `src/app/api/admin/database/clients/[id]/route.ts` (CREATE)

- [x] `PATCH`: auth + permissions check (`clients.edit`). Body: `{ name?, phone?, email? }`. Zod validate. `prisma.user.update(...)`. Return updated user.
- [x] `DELETE`: auth + permissions check (`clients.delete`). `prisma.user.delete({ where: { id } })`. Return `{ success: true }`.

---

## Step 7 — API routes for /admin/database/gdpr

### 7a — `src/app/api/admin/database/gdpr/route.ts` (CREATE)

- [x] `export const runtime = "nodejs"`
- [x] `GET`: auth + permissions check (`gdpr.view`). Query ConsentRecord (take: 100, orderBy consentDate desc). Support `?search=` on fullName. Return masked phone (last 4 digits only, prefix with `****`).

### 7b — `src/app/api/admin/database/gdpr/[id]/withdraw/route.ts` (CREATE)

- [x] `POST`: auth + permissions check (`gdpr.withdraw`).
- [x] If `consentWithdrawnDate != null` → 409.
- [x] `prisma.consentRecord.update({ where: { id }, data: { consentWithdrawnDate: new Date(), withdrawalMethod: "admin_manual", consentPrivacyV10: false, consentTermsV10: false, consentNotificationsV10: false } })`.
- [x] Return `{ success: true, withdrawnAt }`.

### 7c — `src/app/api/admin/database/gdpr/[id]/erase/route.ts` (CREATE)

- [x] `POST`: auth + permissions check (`gdpr.erase`).
- [x] If `erasureDate != null` → 409.
- [x] Transaction: anonymize ConsentRecord (`fullName = "Deleted User"`, hash phoneDigits with SHA-256, null email, set `requestErasureDate`, `erasureDate`, `erasureMethod = "admin_manual"`). If `userId != null`, also anonymize linked User (null email/phone, `name = "Deleted User"`, null password/plainPassword, `isGuest = true`).
- [x] Return `{ success: true, erasedAt }`.

---

## Step 8 — API route for /admin/db-browser

### `src/app/api/admin/db-browser/[table]/route.ts` (CREATE)

- [x] `export const runtime = "nodejs"`
- [x] Whitelist:
  ```ts
  const ALLOWED_TABLES = ["user","masterProfile","service","masterService",
    "consentRecord","schedule","appointment","dateOverride",
    "tenantConfig","passwordResetToken","account"] as const
  ```
- [x] `GET`: auth check (`role === "SUPERADMIN"` only → 403 otherwise).
- [x] Validate `table` param against whitelist → 400 if invalid.
- [x] Parse `?page=1&pageSize=50`.
- [x] `(prisma as any)[table].findMany({ skip, take, orderBy: { createdAt: "desc" } })` + `(prisma as any)[table].count()`.
- [x] **Sensitive field masking** (replace with `"[REDACTED]"`):
  ```ts
  const MASKED_FIELDS: Record<string, string[]> = {
    user: ["password", "plainPassword"],
    tenantConfig: ["smtpPass", "googleClientSecret", "applePrivateKey", "telegramBotToken"],
  }
  ```
- [x] Return `{ rows, total, page, pageSize }`.

---

## Step 9 — Page: /admin/database

### `src/app/admin/database/page.tsx` (CREATE)

- [x] Server component. `auth()` → redirect to `/admin/login` if no session. Redirect to `/admin` if role not in `["ADMIN","SUPERADMIN"]`.
- [x] `redirect("/admin/database/clients")` — root database page redirects to clients sub-page.

### `src/app/admin/database/clients/page.tsx` (CREATE)

- [x] Server component. `auth()` + role check.
- [x] For ADMIN: `prisma.user.findUnique({ where: { id: session.user.id }, select: { adminPermissions: true } })`, parse permissions. If `!permissions.clients.view` → `redirect("/admin")`.
- [x] For SUPERADMIN: use `ALL_PERMISSIONS`.
- [x] Fetch clients: `prisma.user.findMany({ where: { role: "CLIENT" }, select: { id, name, phone, email, createdAt, isGuest }, orderBy: { createdAt: "desc" }, take: 100 })`.
- [x] Render `<ClientsTable clients={clients} permissions={permissions} />`.

### `src/app/admin/database/clients/ClientsTable.tsx` (CREATE, `"use client"`)

- [x] Props: `clients: ClientRow[]`, `permissions: AdminPermissions`.
- [x] Client-side search input (filters by name/phone/email).
- [x] Table: Name, Phone, Email, Registered At, Guest badge, Actions.
- [x] Actions: Edit button (if `permissions.clients.edit`) opens Dialog with form (name, phone, email). On submit → `PATCH /api/admin/database/clients/[id]` → `router.refresh()`.
- [x] Delete button (if `permissions.clients.delete`) → `confirm()` → `DELETE /api/admin/database/clients/[id]` → `router.refresh()`.
- [x] If file approaches 500 lines, extract `ClientEditDialog.tsx`.

### `src/app/admin/database/gdpr/page.tsx` (CREATE)

- [x] Server component. Auth + role check. Permissions check (`gdpr.view`).
- [x] Fetch: `prisma.consentRecord.findMany({ orderBy: { consentDate: "desc" }, take: 100, select: { id, fullName, phoneDigits, email, consentDate, consentWithdrawnDate, erasureDate, consentPrivacyV10, userId } })`.
- [x] Render `<GdprTable records={records} permissions={permissions} />`.

### `src/app/admin/database/gdpr/GdprTable.tsx` (CREATE, `"use client"`)

- [x] Props: `records: ConsentRow[]`, `permissions: AdminPermissions`.
- [x] Phone display: `****` + last 4 chars of `phoneDigits`.
- [x] Status: "Active" / "Withdrawn" / "Erased" derived from `consentWithdrawnDate`/`erasureDate`.
- [x] Table: Name, Phone (masked), Consent Date, Status, Actions.
- [x] Withdraw button: if `permissions.gdpr.withdraw && !record.consentWithdrawnDate && !record.erasureDate`. → `confirm()` → `POST /api/admin/database/gdpr/[id]/withdraw` → `router.refresh()`.
- [x] Erase button: if `permissions.gdpr.erase && !record.erasureDate`. → `confirm()` with strong warning → `POST /api/admin/database/gdpr/[id]/erase` → `router.refresh()`.

---

## Step 10 — Page: /admin/admins (SUPERADMIN only)

### `src/app/admin/admins/page.tsx` (CREATE)

- [x] Server component. `auth()` → if `role !== "SUPERADMIN"` → `redirect("/admin")`.
- [x] `prisma.user.findMany({ where: { role: "ADMIN" }, select: { id, name, email, adminPermissions, createdAt }, orderBy: { createdAt: "asc" } })`.
- [x] Render `<AdminsClient admins={admins} />`.

### `src/app/admin/admins/AdminsClient.tsx` (CREATE, `"use client"`)

- [x] Pattern mirrors `MastersClient.tsx`: Sheet for create/edit, table/grid of admins.
- [x] "Add Admin" button opens Sheet with `<AdminForm />`.
- [x] Each row/card: name, email, permission badges (small colored pills), Edit + Delete buttons.
- [x] Delete: `confirm()` → `DELETE /api/admin/admins/[id]` → `router.refresh()`.
- [x] Edit: opens Sheet with `<AdminForm admin={admin} />`.

### `src/app/admin/admins/AdminForm.tsx` (CREATE, `"use client"`)

- [x] Props: `admin?: AdminUser`, `onSuccess: () => void`.
- [x] Create mode: name, email, password fields + 6 checkboxes.
- [x] Edit mode: only 6 checkboxes (no email/password).
- [x] Checkboxes in two groups:
  - **Clients:** [ ] View  [ ] Edit  [ ] Delete
  - **GDPR:** [ ] View  [ ] Withdraw  [ ] Erase
- [x] On create: `POST /api/admin/admins` → show success with generated password display (same pattern as MasterForm.tsx).
- [x] On edit: `PATCH /api/admin/admins/[id]` with `{ adminPermissions }` → `onSuccess()`.
- [x] If file approaches 500 lines, extract `PermissionsCheckboxGroup.tsx`.

---

## Step 11 — Page: /admin/db-browser (SUPERADMIN only)

### `src/app/admin/db-browser/page.tsx` (CREATE)

- [x] Server component. `auth()` → if `role !== "SUPERADMIN"` → `redirect("/admin")`.
- [x] Render `<DbBrowserClient />`.

### `src/app/admin/db-browser/DbBrowserClient.tsx` (CREATE, `"use client"`)

- [x] Table list:
  ```ts
  const TABLES = ["user","masterProfile","service","masterService",
    "consentRecord","schedule","appointment","dateOverride",
    "tenantConfig","passwordResetToken","account"]
  ```
- [x] State: `selectedTable` (default: `"user"`), `page`, `rows`, `total`, `loading`.
- [x] On table change or page change: `fetch(\`/api/admin/db-browser/${selectedTable}?page=${page}&pageSize=50\`)`.
- [x] Layout: left sidebar (table selector list ~200px) + right content (data table).
- [x] Dynamic column headers: `Object.keys(rows[0] ?? {})`.
- [x] Pagination: Prev / Next buttons, "Page X of Y" display.
- [x] Read-only notice at top.
- [x] If approaching 500 lines, extract `DataTable.tsx` and `TableSelector.tsx`.

---

## File Summary

### Modified files
- `prisma/schema.prisma` — add `adminPermissions String?` to User
- `src/middleware.ts` — add SUPERADMIN-only route guard
- `src/components/admin/AdminSidebar.tsx` — three nav sets + role logic

### New files
```
src/lib/admin-permissions.ts

src/app/api/admin/admins/route.ts
src/app/api/admin/admins/[id]/route.ts
src/app/api/admin/database/clients/route.ts
src/app/api/admin/database/clients/[id]/route.ts
src/app/api/admin/database/gdpr/route.ts
src/app/api/admin/database/gdpr/[id]/withdraw/route.ts
src/app/api/admin/database/gdpr/[id]/erase/route.ts
src/app/api/admin/db-browser/[table]/route.ts

src/app/admin/database/page.tsx
src/app/admin/database/clients/page.tsx
src/app/admin/database/clients/ClientsTable.tsx
src/app/admin/database/gdpr/page.tsx
src/app/admin/database/gdpr/GdprTable.tsx
src/app/admin/admins/page.tsx
src/app/admin/admins/AdminsClient.tsx
src/app/admin/admins/AdminForm.tsx
src/app/admin/db-browser/page.tsx
src/app/admin/db-browser/DbBrowserClient.tsx
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Existing ADMIN users lose DB access after migration | Expected — SUPERADMIN grants permissions via `/admin/admins`. |
| `adminPermissions` JSON parse failure | `parseAdminPermissions()` catches errors → returns NO_PERMISSIONS. |
| DB Browser exposes secrets | MASKED_FIELDS map in route replaces sensitive values with "[REDACTED]". Never skip. |
| `prisma[table]` dynamic access TS errors | Use `(prisma as any)[table]` cast in db-browser route only. |
| File exceeds 500 lines | Pre-emptively split: `ClientEditDialog.tsx`, `PermissionsCheckboxGroup.tsx`, `DataTable.tsx`. |

---

## Conventions

- All API routes: `export const runtime = "nodejs"` at top.
- Auth check pattern: `const session = await auth(); if (!session?.user || role !== allowedRole) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
- After DB mutations: call `revalidatePath(...)` or rely on `router.refresh()` from client.
- Imports: `@/` alias only. No `../` beyond one level.
- shadcn: `Button`, `Input`, `Label`, `Card`, `Sheet`, `Dialog` from `@/components/ui/`.
- Icons: `lucide-react` only. New: `Database`, `UserCog`, `Table2`.
- `bcryptjs` (not `bcrypt`) — already in `package.json`.
- Zod schemas colocated with the route that uses them.
