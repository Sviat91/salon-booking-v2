# Plan: Master password recovery (encrypt-at-rest + decrypt-on-demand) & AUTH_SECRET fail-fast

**Date:** 2026-07-14
**Status:** In Progress
**Mode:** FULL (planner-written plan; architectural decisions on fail-fast key validation + new sensitive server action + reversal of an earlier same-day approach)

## Goal
Store master login passwords **encrypted-at-rest** (reversible, via the existing `src/lib/encryption.ts` AES-256-GCM) instead of plaintext, let an ADMIN/SUPERADMIN reveal a master's current password on explicit button click, fix the premature-modal-close bug on master creation, and make `src/lib/encryption.ts` fail loudly when `AUTH_SECRET` is missing (Roadmap Priority 2 items 9 + 10).

## Background / current state (verified live — do not trust the superseded plan)
An earlier LIGHT pass today **deleted** the `plainPassword` column and stripped every read/write of it; those edits are in the working tree (not the approach we want, but they are the current baseline you build on):
- Migration `prisma/migrations/20260714171031_remove_plain_password/` already dropped the old column from the local dev DB. `User` currently has `password String?` and **no** password-plaintext column.
- `src/app/admin/masters/actions.ts`, `MasterForm.tsx`, `MastersClient.tsx`, `page.tsx` already have **zero** `plainPassword` references. The GDPR erase route and `consent-service.ts` already have **no** `plainPassword: null` line. `db-browser` route's `MASKED_FIELDS.user` is currently `["password"]`.
- `.env.example` does **not** list `AUTH_SECRET` at all (confirmed). `tests/setup/env.ts` does **not** set `AUTH_SECRET`.

This plan re-introduces the field as **ciphertext** (new column `passwordEncrypted`), never as plaintext.

## Architecture Decisions
- **Reuse `src/lib/encryption.ts` verbatim** — the same `encrypt()`/`decrypt()` already used for `TenantConfig.smtpPass`/`googleClientSecret`/`applePrivateKey`/`telegramBotToken`. No new crypto, no new key, no key-management UI (user explicitly rejected DB-backed key storage; a single `AUTH_SECRET` env var is the accepted solution).
- **New column name is `passwordEncrypted` (ciphertext), NOT `plainPassword`** — the value stored is AES-256-GCM ciphertext, decryptable only server-side.
- **Ciphertext never reaches the browser except on explicit demand.** `passwordEncrypted` is *not* added to the masters list query/type (`page.tsx`/`MastersClient.tsx`/`MasterForm`'s `Master` type). It is fetched and decrypted only inside a dedicated server action when the admin clicks "Show current password".
- **The decrypt server action does its own auth check.** Server Actions can be invoked directly (bypassing page/middleware guards), so `getMasterPassword` calls `auth()` and requires `SUPERADMIN`/`ADMIN` itself — mirroring `src/app/api/admin/db-browser/[table]/route.ts` and `src/app/api/admin/superadmin/credentials/route.ts`.
- **`AUTH_SECRET` fail-fast is at module-load (import time), not lazy-in-function.** Chosen because: (a) it matches the user's explicit intent ("if the project doesn't start, we get a clear error"); (b) Next.js loads `.env` during both `next build` and runtime, so a correctly-configured deploy is unaffected; (c) the four importers (`api/auth/[...nextauth]/route.ts`, `api/admin/email-settings/route.ts`, `api/admin/social-settings/route.ts`, `lib/email.ts`) will surface the error immediately at cold-start/build instead of silently encrypting with a public key; (d) tests are protected by setting `AUTH_SECRET` in `tests/setup/env.ts` (Step 10). A lazy throw inside `encrypt()`/`decrypt()` was considered and rejected as needless indirection with no concrete benefit here.
- **Existing masters have `passwordEncrypted = NULL`** after the additive migration (they predate this change). `getMasterPassword` must return a friendly error (not crash) in that case — the admin uses "Generate new password" to set one.
- The one-time return values (`createMaster.generatedPassword`, `resetMasterPassword.newPassword`) and the existing reset UI are **kept as-is** — they're a good UX on top of the new show-on-demand capability, not the problem.

## Implementation Steps

- [x] **Step 1 — Schema + migration**
  - Files: `prisma/schema.prisma`
  - In the `User` model, add `passwordEncrypted String?` immediately after the `password String?` line (line 21). Keep it nullable.
  - Run `npx prisma migrate dev --name add_password_encrypted` (real migration per `prisma/AGENTS.md` — never `db push`). This adds the column and regenerates the Prisma client so `passwordEncrypted` becomes a typed field.

- [x] **Step 2 — `encryption.ts` fail-fast on missing `AUTH_SECRET`** (Roadmap item 10)
  - Files: `src/lib/encryption.ts`
  - Replace line 6 (`const secret = process.env.AUTH_SECRET || 'fallback-secret-development-only'`) and update the comment above it. New behavior:
    ```ts
    const secret = process.env.AUTH_SECRET
    if (!secret) {
      throw new Error('AUTH_SECRET environment variable is required and must not be empty — refusing to start with an insecure default encryption key.')
    }
    ```
    Keep the existing `ENCRYPTION_KEY = crypto.createHash('sha256').update(secret).digest()` line right after (now `secret` is guaranteed a non-empty string).
  - Do **not** touch the `encrypt()`/`decrypt()` bodies or their try/catch behavior — out of scope (see Constraints).

- [x] **Step 3 — Store encrypted password on create & reset + new decrypt action**
  - Files: `src/app/admin/masters/actions.ts`
  - Add imports at the top: `import { encrypt, decrypt } from "@/lib/encryption"` and `import { auth } from "@/auth"`.
  - `createMaster` — in the `prisma.user.create` `data` object, add `passwordEncrypted: encrypt(plainPassword),` right after `password: hashedPassword,`. (Leave the local `const plainPassword = generatePassword()` and the `return { success: true, generatedPassword: plainPassword }` unchanged.)
  - `resetMasterPassword` — change `data: { password: hashedPassword }` to `data: { password: hashedPassword, passwordEncrypted: encrypt(passwordToSet) }`. (Leave `return { success: true, newPassword: passwordToSet }` unchanged.)
  - Add a new exported server action at the end of the file:
    ```ts
    export async function getMasterPassword(
      masterId: string
    ): Promise<{ password?: string; error?: string }> {
      const session = await auth()
      if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
        return { error: "Unauthorized" }
      }
      const user = await prisma.user.findUnique({
        where: { id: masterId },
        select: { passwordEncrypted: true },
      })
      if (!user) return { error: "Master not found" }
      if (!user.passwordEncrypted) {
        return { error: "No stored password yet — use \"Generate new password\" to set one." }
      }
      const password = decrypt(user.passwordEncrypted)
      if (!password) return { error: "Failed to decrypt password." }
      return { password }
    }
    ```

- [x] **Step 4 — `MasterForm.tsx`: remove premature-close bug + add "Show current password"**
  - Files: `src/app/admin/masters/MasterForm.tsx`
  - **(a) Remove the auto-close `useEffect`** (lines 76-79). The create-success screen (`if (state.success && state.generatedPassword)`, lines 102-134) already has a working `<Button onClick={onSuccess}>Done</Button>` — that is the correct way to close. After removing the `useEffect`, `useEffect` is no longer imported/used anywhere in the file, so change the React import on line 3 from `import { useEffect, useState } from "react"` to `import { useState } from "react"`.
  - **(b) Import the new action**: change line 11 to also import `getMasterPassword` from `"./actions"`.
  - **(c) Add state** (near the other reset state, ~line 52-54):
    ```ts
    const [shownPassword, setShownPassword] = useState<string | null>(null)
    const [showError, setShowError] = useState<string | null>(null)
    const [isLoadingPassword, setIsLoadingPassword] = useState(false)
    const [shownCopied, setShownCopied] = useState(false)
    ```
  - **(d) Add a handler** (near `handleResetPassword`):
    ```ts
    async function handleShowPassword() {
      if (!master) return
      setIsLoadingPassword(true)
      setShowError(null)
      const res = await getMasterPassword(master.id)
      if (res.password) setShownPassword(res.password)
      else setShowError(res.error ?? "Failed to load password")
      setIsLoadingPassword(false)
    }
    ```
  - **(e) Add UI inside the existing `{master && (...)}` "Access Recovery" block** (~lines 266-322), as a **separate subsection ABOVE** the existing "Current / New Password" reset section, clearly distinct from it. Follow the exact visual pattern already used for `resetPasswordState.password` display (read-only `Input className="font-mono"` + icon copy `Button` with `Copy`/`Check` swap). Concretely:
    - A `<Button type="button" variant="outline" onClick={handleShowPassword} disabled={isLoadingPassword}>{isLoadingPassword ? "Loading…" : "Show current password"}</Button>`.
    - When `shownPassword` is set, render a read-only `<Input readOnly value={shownPassword} className="font-mono" />` next to a copy icon button that writes `shownPassword` to the clipboard and toggles `shownCopied` (2s reset), mirroring lines 303-315.
    - When `showError` is set, render `<p className="text-sm text-destructive">{showError}</p>`.
    - Give the subsection its own small heading/label (e.g. `<Label>Current password</Label>`) so it reads as a separate action from "Generate new password".
  - **(f) Do NOT** pre-fetch or auto-load the password on form open — it must only be fetched on the explicit button click. Do **not** redesign the existing reset ("Generate" + save) flow; it already persists the encrypted value via Step 3.

- [x] **Step 5 — Confirm list types stay clean (no re-add)**
  - Files: `src/app/admin/masters/page.tsx`, `src/app/admin/masters/MastersClient.tsx`
  - Verify these already contain **no** `plainPassword` and add **nothing** for `passwordEncrypted` — the encrypted value must never be part of the list payload. This is a confirmation step; if a stray `plainPassword` reference is found, remove it, but do not introduce `passwordEncrypted` here. (`MasterForm`'s local `Master` type likewise stays without any password field.)

- [x] **Step 6 — GDPR erase clears the new field**
  - Files: `src/app/api/admin/database/gdpr/[id]/erase/route.ts`
  - In the `tx.user.update` `data` object (~lines 64-71), add `passwordEncrypted: null,` right after `password: null,`.

- [x] **Step 7 — Consent-service erasure clears the new field**
  - Files: `src/lib/consent-service.ts`
  - In the `tx.user.updateMany` `data` object (~lines 434-441), add `passwordEncrypted: null,` right after `password: null,`.

- [x] **Step 8 — Confirm superadmin credentials route needs no change**
  - Files: `src/app/api/admin/superadmin/credentials/route.ts`
  - **No edit.** SUPERADMIN self-service password change is a different flow: the admin chooses their own password and there is no "show it to me later" requirement, so it never populates `passwordEncrypted`. Leave `data: { password: hashed }` as-is. (This step exists so the coder consciously skips it rather than blindly adding a write.)

- [x] **Step 9 — Mask the new field in DB Browser**
  - Files: `src/app/api/admin/db-browser/[table]/route.ts`
  - Change `MASKED_FIELDS.user` (line 24) from `user: ["password"],` to `user: ["password", "passwordEncrypted"],` — consistent defense-in-depth with how `TenantConfig`'s encrypted fields are masked in the same map.

- [x] **Step 10 — Set `AUTH_SECRET` in the test env**
  - Files: `tests/setup/env.ts`
  - Add a line matching the existing pattern (this file IS the vitest `setupFiles` entry — verified in `vitest.config.ts:12`):
    ```ts
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-placeholder'
    ```
  - Rationale: once Step 2 lands, any test that transitively imports `encryption.ts` (auth route, email/social settings, `lib/email.ts`) would throw at import without this.

- [x] **Step 11 — Document `AUTH_SECRET` in `.env.example`**
  - Files: `.env.example`
  - Add an entry with a short comment (the file currently omits it entirely). Place near the top, e.g.:
    ```
    # NextAuth secret — also the root of AES-256-GCM encryption for stored secrets (OAuth/SMTP/master passwords).
    # REQUIRED: the app refuses to start if this is empty. Generate with: openssl rand -base64 32
    AUTH_SECRET=<random_secret_string>
    ```

- [x] **Step 12 — DOX pass** (mandatory, do not defer to orchestrator)
  - `prisma/AGENTS.md` (line 14): the parenthetical currently says `User` no longer has a plaintext column and passwords are "never persisted in recoverable form". Correct it: `User.passwordEncrypted` now stores the master's password **encrypted at rest** via `src/lib/encryption.ts`, decryptable on demand by ADMIN/SUPERADMIN — and add `passwordEncrypted` to the list of fields that must be written through `encryption.ts`.
  - `src/lib/AGENTS.md` (line 15): note that `encryption.ts` now **requires** `AUTH_SECRET` and throws at import if it is missing/empty, and that `User.passwordEncrypted` (master passwords) is one of its consumers.
  - `src/app/admin/AGENTS.md`: add a Local Contract note that master passwords are stored encrypted and can be revealed on explicit admin request via the `getMasterPassword` server action (which enforces its own ADMIN/SUPERADMIN check) — an intentional exception to the "never render decrypted secrets back into the page" rule that applies to `settings/`.
  - `ROADMAP.md`:
    - Item 9 (line 37): rewrite — closed via **encrypt-at-rest (`passwordEncrypted`) + decrypt-on-demand**, replacing the earlier delete-outright approach.
    - Item 10 (line 39): mark done — `encryption.ts` now fails fast (throws at import) when `AUTH_SECRET` is missing/empty; documented in `.env.example` and set in `tests/setup/env.ts`.
    - "Уже сделано (сессия 2026-07-14)" block (lines 93-95): correct the item-9 entry to describe the final encrypted design and add an item-10 entry.

- [x] **Step 13 — Verify**
  - `npx tsc --noEmit` clean.
  - `npm run lint` — no new problems vs. the established baseline (do a `git stash`/compare if unsure; the project has a known non-zero lint baseline).
  - `npm run build` succeeds.
  - `npm run test` — no **new** failures vs. the known-unstable baseline (~11 pre-existing failing test files per ROADMAP Priority 4; confirm the AUTH_SECRET change didn't add any).
  - `grep -rn "plainPassword" src prisma` — only hits should be the local `plainPassword` variable in `actions.ts` and the historical `remove_plain_password` migration SQL; no DB-column references.
  - `grep -rn "fallback-secret-development-only" src` — returns nothing.

## Acceptance Criteria
- [x] `passwordEncrypted String?` exists on `User`; additive migration `add_password_encrypted` applied via `prisma migrate dev`.
- [x] `createMaster` and `resetMasterPassword` write `encrypt(...)` into `passwordEncrypted` alongside the bcrypt `password` hash.
- [x] `getMasterPassword` exists, performs its own `auth()` + ADMIN/SUPERADMIN check, and returns the decrypted password only to authorized callers (friendly error when `passwordEncrypted` is null or on unauthorized).
- [x] `MasterForm` no longer auto-closes on create (the `useEffect` is gone, `useEffect` import removed); the generated-password screen stays until "Done" is clicked.
- [x] `MasterForm` edit view has a **separate** "Show current password" action (reveal-on-click, copyable) distinct from the existing "Generate new password" reset flow; nothing is pre-fetched on open.
- [x] `passwordEncrypted` is absent from the masters list query/types (`page.tsx`, `MastersClient.tsx`, `MasterForm`'s `Master` type) — it is fetched only inside `getMasterPassword`.
- [x] GDPR erase route and `consent-service.ts` set `passwordEncrypted: null` on erasure.
- [x] `db-browser` masks `passwordEncrypted`.
- [x] `encryption.ts` throws a clear error at import when `AUTH_SECRET` is missing/empty; `AUTH_SECRET` documented in `.env.example` and set in `tests/setup/env.ts`.
- [x] `superadmin/credentials/route.ts` unchanged (reasoning recorded).
- [x] DOX updated: `prisma/AGENTS.md`, `src/lib/AGENTS.md`, `src/app/admin/AGENTS.md`, `ROADMAP.md` (items 9 & 10 + session-done block).
- [x] `tsc`/`build` clean; `lint`/`test` no new failures vs. baseline.

## Constraints & Risks
- **Do NOT** re-create a `plainPassword` (plaintext) column or store the password unencrypted anywhere. The new column holds ciphertext only.
- **Known separate gap — do NOT fix here:** `createMaster`/`updateMaster`/`deleteMaster`/`resetMasterPassword` in `actions.ts` currently perform **no** auth/role check of their own (they rely on the page/middleware). `getMasterPassword` (this plan) *does* add its own check, but the others remain unguarded server actions. Flagged for a separate follow-up; adding checks to them is out of scope for this pass.
- **Residual, out of scope:** `encrypt()` still `catch`es unexpected errors and returns the original plaintext string, and `decrypt()` returns the input on failure (legacy-plaintext tolerance). This plan only fixes the missing-`AUTH_SECRET` silent-default case per the user's explicit scope; the catch-returns-plaintext behavior is unchanged and can be raised separately.
- **Do NOT** build any key-management UI or DB-backed encryption-key storage — user explicitly decided a single `AUTH_SECRET` env var is the accepted solution.
- **Do NOT** alter `TenantConfig`'s existing encrypted fields' storage/behavior beyond what naturally follows from the `AUTH_SECRET` fail-fast change.
- **Build/deploy note:** after Step 2, any environment (CI, prod, local) that runs `next build` or the app without `AUTH_SECRET` set will now fail loudly — this is the intended outcome. Ensure `AUTH_SECRET` is present wherever the app is built/run.
- **Migration data note:** masters created before this change have `passwordEncrypted = NULL`; "Show current password" returns the friendly "no stored password yet" message for them until their password is reset.
- **No dev server / stagewise checkpoint:** stop after implementation for the user's manual test — (1) create a new master and confirm the modal stays open showing the generated password until "Done"; (2) edit an existing master, click "Show current password", confirm the correct current password is revealed (reset it first if it predates the change); (3) generate/reset a new password and confirm "Show current password" then reveals the new one; (4) confirm the app errors clearly if `AUTH_SECRET` is unset.
