# Plan: Admin Database section — M3 (Somique) Restyle

**Date:** 2026-07-06
**Status:** Implemented, reviewed (APPROVED), gates verified by orchestrator — pending user manual browser verification

## Goal
Restyle the `/admin/database` section (layout header, Clients table, GDPR table) to the already-established M3 table/card visual language used by Services and Masters, changing only presentation chrome while preserving 100% of the auth/permission gating, confirm-before-destructive-action UX, and mutation logic.

## Structural Assessment (read first — honest fit analysis)

**No mockup exists for this section.** Confirmed: `Somique Beauty Design System/ui_kits/admin/` contains only `AdminSidebar.jsx`, `CalendarPage.jsx`, `DashboardPage.jsx`, `MastersPage.jsx` — nothing for Database. So this stage is **"apply the already-shipped Services/Masters table language," not "match a new mockup."** Do NOT invent new design elements.

**This section is already ~70% consistent — the true gap is small.** Both tables already use semantic tokens throughout; there are **no raw Tailwind color scales** (`bg-green-500` etc.) and **no emoji** anywhere in the tree (verified by grep). `GdprTable.tsx` is especially close to done: it already uses `Badge variant="success"/"warning"/"muted"` for its status column via a clean `StatusBadge` helper. The concrete deltas vs. the Services/Masters convention are:

1. **Table container radius/chrome** (both tables): current `rounded-xl border border-border overflow-hidden` → the established Services chrome is `rounded-[20px] border border-border bg-card shadow-sm overflow-hidden`.
2. **Empty-state radius** (both tables): current `rounded-xl border border-dashed` → `rounded-[20px] border border-dashed` (matches Services/Masters).
3. **Table header cells** (both tables): current `px-4 py-3 text-left font-medium text-muted-foreground` → the established convention is uppercase micro-label headers: `px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground` (thead becomes `bg-muted/50 text-muted-foreground`).
4. **Row treatment** (both tables): current zebra striping `i % 2 === 0 ? "bg-card" : "bg-muted/20"` → the established convention is `<tbody className="divide-y divide-border">` + `<tr className="hover:bg-muted/40 transition-colors">` (no zebra). This is the single biggest visual-language mismatch.
5. **Clients "Type" pills** (`ClientsTable.tsx` only): two raw `<span className="rounded-full …">` pills → `Badge` variants (the only badge-substitution work in this stage; GdprTable already does this).
6. **Section header** (`layout.tsx`): current `<h1>Database</h1>` + subtitle → the established eyebrow (`text-xs font-medium uppercase tracking-wider text-primary`) + muted subtitle. The topbar already supplies the "Database" page title (`adminNavItems.ts` line 66-70, non-`exact`, matches `/admin/database/*` via `pathname.startsWith`), so the `<h1>` is redundant — exactly the pattern removed on Settings/Email/Social/Notifications.

**`DatabaseSubNav.tsx` is already consistent — leave it unchanged.** It is NOT "plain text links": it renders an underline-tab switcher (`border-b-2 -mb-px`, active = `border-primary text-primary`, inactive = `border-transparent text-muted-foreground hover:text-foreground`, container `border-b border-border`) using only semantic tokens. This is a clean M3 tab idiom and there is no competing established sub-nav component to align it to (Settings navigates via the sidebar, not tabs). Do NOT restyle it — that would be manufacturing an unnecessary change.

**The Clients edit `Dialog` stays a `Dialog` (not converted to `Sheet`).** Services/Masters use a right-side `Sheet` for their forms, but the Clients edit affordance is a small modal `Dialog` that is already fully M3-token-clean. The "table/card visual language" this stage applies is about the **list surface**, not the edit affordance; converting Dialog→Sheet is a larger, form-reflow-risky change that is not required for visual consistency and would touch the edit form's structure. Keep the `Dialog` as-is. (If edit-in-Sheet parity is later wanted, that is a separate polish stage.)

## What each surface does (verified — do not assume)

- **`layout.tsx`** — wraps `page.tsx` (a pure redirect to `/admin/database/clients`) and renders the `<h1>` header + `DatabaseSubNav` + `{children}`. No data, no logic.
- **`clients/page.tsx`** — Server Component: `auth()` guard → role check → loads `adminPermissions` for `ADMIN` (or `ALL_PERMISSIONS` for `SUPERADMIN`) via `getPermissionsForRole` → `if (!permissions.clients.view) redirect("/admin")` → queries clients → renders `<ClientsTable clients permissions>`. **No visual chrome; do NOT touch.**
- **`ClientsTable.tsx`** (228 lines, `"use client"`) — search-filtered table (Name/Phone/Email/Registered/Type/Actions). Edit via `Dialog` → `PATCH /api/admin/database/clients/[id]`. Delete via `confirm(...)` → `DELETE /api/admin/database/clients/[id]`. Edit/Delete columns and icons are gated on `permissions.clients.edit`/`permissions.clients.delete`.
- **`gdpr/page.tsx`** — same auth/permission pattern, gated on `permissions.gdpr.view`; loads `consentRecord` rows → renders `<GdprTable records permissions>`. **No visual chrome; do NOT touch.**
- **`GdprTable.tsx`** (158 lines, `"use client"`) — search-filtered table (Name/Phone/Consent Date/Status/Actions). Status via `getStatus` + `StatusBadge` (already `Badge` variants). Withdraw via `confirm(...)` → `POST /api/admin/database/gdpr/[id]/withdraw`; Erase via `confirm(...)` (double-warning copy) → `POST /api/admin/database/gdpr/[id]/erase`. Both action buttons are gated on `permissions.gdpr.withdraw`/`permissions.gdpr.erase` AND on record state (`!consentWithdrawnDate`, `!erasureDate`).

## GDPR / permission safety (CRITICAL — the restyle must not touch any of this)

- **`GdprTable.tsx` confirm-before-destructive-action is irreversible for the affected user** (`src/app/admin/AGENTS.md` line 16). The two `confirm(...)` guards in `handleWithdraw` (line 53) and `handleErase` (lines 61-65, including the multi-line "PERMANENTLY ERASE … CANNOT be undone" copy) MUST remain byte-for-byte. The `loading` state, the `POST` fetch targets, and `router.refresh()` are unchanged.
- **`ClientsTable.tsx` delete confirm** — the `confirm(\`Delete client "${name ?? "this client"}"? This cannot be undone.\`)` guard in `handleDelete` (line 84) MUST remain unchanged.
- **Permission gating stays exactly as written** (`src/app/admin/AGENTS.md` line 14: gate affordances on the parsed permission object, not role). Do NOT alter any of these conditionals — only the icon/button *chrome inside* them may be restyled, and this stage restyles none of the action buttons:
  - Clients: `(permissions.clients.edit || permissions.clients.delete)` column guard (lines 120, 147); inner `permissions.clients.edit` (line 150) and `permissions.clients.delete` (line 166) button guards.
  - GDPR: `(permissions.gdpr.withdraw || permissions.gdpr.erase)` column guard (lines 101, 120); inner `permissions.gdpr.withdraw && !record.consentWithdrawnDate && !record.erasureDate` (lines 123-125) and `permissions.gdpr.erase && !record.erasureDate` (line 135) button guards.
- **Do NOT touch the three server components** (`layout.tsx`'s child `page.tsx`, `clients/page.tsx`, `gdpr/page.tsx`) — they hold all the `auth()`/`getPermissionsForRole`/`redirect` logic and render zero chrome. Leaving them untouched keeps the permission logic provably intact.
- The GDPR/Clients API routes (`src/app/api/admin/database/**`) are **not edited** — referenced only as the mutation contract.

## Architecture Decisions

- **Only presentation changes.** No handler, `fetch`, `useState`, `filter`, `confirm`, permission conditional, or server component may change. Every changed line must trace to a class/JSX-wrapper/Badge swap.
- **Reference conventions are `ServicesClient.tsx` (canonical table) and `MastersClient.tsx` (card list + `Badge success/muted` binary).** Reuse their exact class strings for the container, thead, and rows so Database reads identically. Do NOT invent spacing/radius/color values beyond what those files already use.
- **Badge variant mapping for Clients "Type" column** — replace the two raw `<span>` pills with the shared `Badge` (import `{ Badge } from "@/components/ui/badge"`):
  - Guest (currently `bg-muted text-muted-foreground`) → `<Badge variant="muted">Guest</Badge>` (clean 1:1 token map).
  - Registered (currently `bg-primary/10 text-primary`) → `<Badge variant="success">Registered</Badge>`. **Rationale:** this mirrors the codebase's established binary-state badge vocabulary — Masters `Visible=success / Hidden=muted`, GDPR `Active=success`. It intentionally shifts the hue from brand-primary tint to success-container green for cross-section consistency. **Acceptable fallback** if a reviewer finds green too strong for a mere account "type": `<Badge variant="secondary">Registered</Badge>`. Do NOT use solid `default` (too heavy). Pick one and keep it consistent.
- **Eyebrow header copy** — replace `<h1 className="text-2xl font-bold tracking-tight">Database</h1>` with an eyebrow `<p className="text-xs font-medium uppercase tracking-wider text-primary">Records</p>` (single-noun eyebrow, matching Settings="Configuration"/Masters="Staff"). Keep the existing subtitle `<p className="mt-1 text-sm text-muted-foreground">Manage clients and GDPR consent records.</p>` verbatim. Acceptable alternative eyebrow word: "Data". Do NOT use "Database" (duplicates the topbar title).
- **Semantic tenant-customizable tokens only** for the chrome (`bg-card`, `bg-muted/50`, `bg-muted/40`, `border-border`, `text-muted-foreground`, `text-primary`) — same as Services/Masters. The only fixed `--md-*` tones enter via the `Badge` `success`/`muted` variants (which already encapsulate `--md-success-container` etc.) — do NOT hand-write any `--md-*` class.
- **Keep the informational bits that are already token-clean and not in conflict:** the `<p>N clients/records total</p>` count line, the `<Search>` + `<Input>` search row, and the per-row `<User>` icon in the Clients Name cell. These are consistent and removing them would be unrequested scope creep.
- **File-size:** both files stay far under 500 lines — the swaps are net-neutral (zebra `i % 2` logic is removed; Badge JSX replaces span JSX). No component split needed.

## Implementation Steps
Ordered lowest-risk first. Line numbers reference current files. No handler / `fetch` / permission conditional / `confirm` may change.

- [x] **Step 1: Section header — eyebrow + subtitle**
  - Files: `src/app/admin/database/layout.tsx`
  - Details: In the header block (lines 7-10), replace `<h1 className="text-2xl font-bold tracking-tight">Database</h1>` with `<p className="text-xs font-medium uppercase tracking-wider text-primary">Records</p>`. Keep the subtitle `<p className="mt-1 text-sm text-muted-foreground">Manage clients and GDPR consent records.</p>` verbatim. Keep the wrapping `<div className="mb-2">`, the `<DatabaseSubNav />`, and `{children}` exactly as-is. Do NOT touch `DatabaseSubNav.tsx`.

- [x] **Step 2: Restyle the GDPR table chrome** (do this table first — it's the simpler one; its `Badge` status column is already correct and must stay untouched)
  - Files: `src/app/admin/database/gdpr/GdprTable.tsx`
  - Details:
    - Empty-state div (line 89): `rounded-xl` → `rounded-[20px]` (keep `border border-dashed border-border py-16 text-center` and the rest).
    - Table container div (line 93): `rounded-xl border border-border overflow-hidden` → `rounded-[20px] border border-border bg-card shadow-sm overflow-hidden`.
    - `<thead>` (line 95): `bg-muted/50 border-b border-border` → `bg-muted/50 text-muted-foreground`.
    - Every `<th>` (lines 97-102): `className="px-4 py-3 text-left font-medium text-muted-foreground"` → `className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"` (unchanged header text; keep the Actions `<th>` inside its existing `(permissions.gdpr.withdraw || permissions.gdpr.erase)` guard).
    - `<tbody>` (line 106): add `className="divide-y divide-border"`.
    - `<tr>` (line 111): `className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}` → `className="hover:bg-muted/40 transition-colors"`. The `i` index in `.map((record, i) =>` (line 107) is now unused — either keep the signature and let `i` go unused, or drop `, i` from the map callback. **Prefer dropping `, i`** to avoid a lint "unused var" warning (zero-warning lint tolerance); confirm nothing else references `i`.
    - **Do NOT touch:** `StatusBadge`/`getStatus`, the masked-phone logic (`"****" + record.phoneDigits.slice(-4)`), the count line, the search row, the Withdraw/Erase buttons, both `confirm(...)` guards, the `loading` state, the `POST` fetches, or any permission conditional.

- [x] **Step 3: Restyle the Clients table chrome + Type badges**
  - Files: `src/app/admin/database/clients/ClientsTable.tsx`
  - Details:
    - Add import: `import { Badge } from "@/components/ui/badge"` (alongside the existing `Button`/`Input`/`Label` imports).
    - Empty-state div (line 107): `rounded-xl` → `rounded-[20px]`.
    - Table container div (line 111): `rounded-xl border border-border overflow-hidden` → `rounded-[20px] border border-border bg-card shadow-sm overflow-hidden`.
    - `<thead>` (line 113): `bg-muted/50 border-b border-border` → `bg-muted/50 text-muted-foreground`.
    - Every `<th>` (lines 115-121): `className="px-4 py-3 text-left font-medium text-muted-foreground"` → `className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"` (unchanged header text; keep the Actions `<th>` inside its existing `(permissions.clients.edit || permissions.clients.delete)` guard).
    - `<tbody>` (line 125): add `className="divide-y divide-border"`.
    - `<tr>` (line 127-130): replace `className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}` with `className="hover:bg-muted/40 transition-colors"`. The `i` in `.map((client, i) =>` (line 126) is now unused — **drop `, i`** from the map callback to avoid a lint warning; confirm nothing else uses it.
    - Type column (lines 140-146): replace the two raw `<span>` pills with:
      - `client.isGuest` true → `<Badge variant="muted">Guest</Badge>`
      - else → `<Badge variant="success">Registered</Badge>` (or `variant="secondary"` per the fallback in Architecture Decisions — pick one).
    - **Do NOT touch:** the count line, the search row, the `<User>` icon in the Name cell, the Edit/Delete action buttons and their permission guards, `handleEdit`/`handleDelete`, the delete `confirm(...)`, the `Dialog` edit form (leave it a `Dialog` — see Structural Assessment), `editTarget`/`saving`/`error` state, or the `PATCH`/`DELETE` fetches.

- [x] **Step 4: Verify & hand off**
  - Files: (none — checks only)
  - Details: Run the automated gates (below). Confirm zero net-new lint problems vs. baseline (the added `Badge` import is used; the removed `, i` map args net out; the removed raw spans → Badge). Do NOT start a dev server. Then produce the manual browser checklist for the user.

## Acceptance Criteria
- [ ] `npx tsc --noEmit` passes (no type errors).
- [ ] `npm run lint` introduces zero net-new problems vs. the repo baseline (verify via `git stash` A/B if unsure — watch specifically for an unused `i` warning if the map arg wasn't dropped, and for the new `Badge` import being used).
- [ ] `npm run build` succeeds.
- [ ] `npm run test` shows no new failures vs. baseline (change is presentation-only; no Database component tests exist — confirm any pre-existing failures were present before the change too).
- [ ] Both tables render inside a `rounded-[20px] bg-card shadow-sm` container with uppercase `text-[11px] tracking-wider` micro-label headers and `divide-y` + `hover:bg-muted/40` rows — visually matching the Services table.
- [ ] Clients "Type" column uses `Badge` (Guest = `muted`, Registered = `success`/`secondary`); no raw `<span className="rounded-full …">` type pills remain.
- [ ] GDPR status column still uses the existing `StatusBadge` (`success`/`warning`/`muted`) unchanged.
- [ ] Section header shows the "Records" eyebrow (primary) + muted subtitle; the redundant `<h1>Database</h1>` is gone (topbar already shows "Database").
- [ ] `DatabaseSubNav.tsx` and all three server components (`page.tsx` ×3) are untouched.
- [ ] **GDPR/delete confirm UX preserved:** the `handleErase` multi-line "PERMANENTLY ERASE … CANNOT be undone" confirm, `handleWithdraw` confirm, and Clients `handleDelete` confirm are byte-for-byte unchanged.
- [ ] **Permission gating preserved:** every `permissions.clients.*` / `permissions.gdpr.*` conditional is unchanged; affordances still hide when a permission is absent.
- [ ] Follows project conventions: no emoji, no `--md-*` hand-written classes, semantic tokens + Badge variants only, `rounded-[20px]` cards, files < 500 lines (ClientsTable ≈228, GdprTable ≈158 — net-neutral after swaps).

## Verification

### Automated (run after implementation)
```bash
npx tsc --noEmit
npm run lint
npm run build
npm run test
```
No dev server may be started (standing rule — user tests manually).

### Manual (user must confirm in-browser — flag explicitly)
Log in as **SUPERADMIN** (full permissions) and as an **ADMIN with partial permissions**, visit `/admin/database`:
1. **Header/topbar:** topbar reads "Database"; page shows the uppercase "Records" eyebrow (brand/primary color) + subtitle; no duplicate large "Database" heading. The Clients/GDPR underline tabs still switch and the active tab is primary-underlined.
2. **Clients table:** `rounded-[20px]` card with a `bg-muted/50` header bar of uppercase micro-labels; rows separated by hairlines with a hover tint (no zebra stripes). "Type" column shows a muted "Guest" badge and a green "Registered" badge (or your chosen fallback). Search filters by name/phone/email.
3. **Clients edit/delete:** Edit opens the modal Dialog and saves; Delete still shows the "This cannot be undone" confirm before deleting. As an ADMIN **without** `clients.edit`/`clients.delete`, the Actions column and icons are hidden.
4. **GDPR table:** same `rounded-[20px]` card chrome and header/row treatment; Status column shows Active (green) / Withdrawn (amber) / Erased (muted) badges unchanged; masked phone shows `****NNNN`.
5. **GDPR actions:** Withdraw and Erase still show their confirm dialogs (Erase shows the multi-line PERMANENT warning) before firing. As an ADMIN without `gdpr.withdraw`/`gdpr.erase`, those buttons are hidden. Already-withdrawn/erased rows still hide the corresponding button.
6. **Dark theme:** toggle the admin dark theme and confirm both tables, header bars, badges, and buttons read correctly.

## Constraints & Risks
- **GDPR-sensitive, irreversible actions** (`src/app/admin/AGENTS.md` line 16): the Withdraw/Erase and Delete `confirm(...)` guards and their copy must stay byte-for-byte. Restyle chrome only — none of the action buttons are being restyled this stage.
- **Permission gating** (`src/app/admin/AGENTS.md` line 14): do NOT alter any `permissions.*` conditional; leave the three server components entirely untouched so the parsing/gating logic is provably intact.
- **No mockup exists** — apply only the already-shipped Services/Masters table language; do NOT invent colors, spacing, icons, or new sections.
- **Do NOT restyle `DatabaseSubNav.tsx`** (already M3-consistent) or convert the Clients `Dialog` to a `Sheet` (larger change, not required for visual consistency).
- **Do NOT edit** the API routes under `src/app/api/admin/database/**`, `adminNavItems.ts`, `AdminSidebar.tsx`, or the shared `Badge`/`Input`/`Button`/`Dialog` primitives.
- **Zero-warning lint:** dropping the now-unused `, i` map argument in both tables is required to avoid a net-new unused-variable warning.
- **Out of scope (do NOT touch — separate future stages):** `/admin/admins` (Admins section) and `/admin/db-browser` (DB Browser), and the client-facing booking flow.
- **Files changed (3 total):** `src/app/admin/database/layout.tsx`, `src/app/admin/database/gdpr/GdprTable.tsx`, `src/app/admin/database/clients/ClientsTable.tsx`.

## Critical Files
- `src/app/admin/database/layout.tsx` (15) — header eyebrow swap (Step 1); keep `DatabaseSubNav` + children.
- `src/app/admin/database/DatabaseSubNav.tsx` (33) — already consistent; **not edited**.
- `src/app/admin/database/clients/ClientsTable.tsx` (228) — table chrome + Type Badge swap (Step 3); all edit/delete/permission/confirm logic untouched.
- `src/app/admin/database/gdpr/GdprTable.tsx` (158) — table chrome (Step 2); `StatusBadge`, withdraw/erase confirm + permission logic untouched.
- `src/app/admin/database/{page,clients/page,gdpr/page}.tsx` — server components holding `auth()`/`getPermissionsForRole`/`redirect`; **not edited**.
- `src/app/admin/services/ServicesClient.tsx` (187) — canonical table chrome reference (container `rounded-[20px] bg-card shadow-sm`, uppercase `text-[11px]` headers, `divide-y` + `hover:bg-muted/40`).
- `src/app/admin/masters/MastersClient.tsx` (193) — `Badge variant="success"/"muted"` binary-state precedent + eyebrow header pattern.
- `src/components/ui/badge.tsx` (41) — `success`/`muted`/`warning` variants encapsulate the `--md-*-container` tokens; **import only**.
- `src/app/admin/settings/FormFields.tsx` (line 122-133) — `rounded-[20px] shadow-sm` card-chrome source of truth (reference).
- `src/components/admin/adminNavItems.ts` (line 66-70) — topbar resolves `/admin/database/*` → "Database" (why the `<h1>` is dropped); not modified.
- `src/app/admin/AGENTS.md` (lines 14, 16, 22) — permission-gating, irreversible-GDPR-confirm, and 500-line rules.
