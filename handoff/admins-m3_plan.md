# Plan: Admins section (`/admin/admins`) — M3 (Somique) Restyle

**Date:** 2026-07-06
**Status:** Implemented, reviewed (APPROVED), gates verified by orchestrator — pending user manual browser verification

## Goal
Migrate the SUPERADMIN-only `/admin/admins` surface to the already-shipped M3 card-list visual language (eyebrow header, single-column `rounded-[20px]` row-card stack, M3 success tokens), changing only presentation chrome while preserving 100% of the auth guard, permission-parsing, create/edit/delete mutations, and password handling.

## Structural Assessment (read first — honest fit analysis)

**No mockup exists for this section.** Confirmed in the prior Database stage: `Somique Beauty Design System/ui_kits/admin/` holds only `AdminSidebar.jsx`, `CalendarPage.jsx`, `DashboardPage.jsx`, `MastersPage.jsx` — nothing for Admins. This stage **applies the already-established Services/Masters language; it does NOT match a new mockup and must invent no new elements.**

**AdminsClient is already ~60% consistent — the gap is real but bounded.** What is ALREADY correct and must NOT be "improved":
- Permission pills already use the established binary vocabulary: `PermBadge` (lines 30-36) renders `<Badge variant={granted ? "success" : "muted"}>`. This is exactly the Masters-visibility / Database-status pattern. **Leave the mapping and the `PermBadge` helper untouched.**
- Icons are all Lucide (`Plus`, `Pencil`, `Trash2`, `Mail`) — no emoji anywhere in the tree (verified).
- No raw Tailwind color scales in `AdminsClient.tsx` — chrome uses semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`).
- The Add/Edit forms already use a right-side `Sheet` (lines 60-77, 105-136) — same primitive as Masters/Services. Do NOT change the Sheet wiring.

**The true gaps (precise, with current line refs):**

1. **Header still uses the OLD `<h1>` pattern.** `AdminsClient.tsx:54` — `<h1 className="text-2xl font-bold tracking-tight">Admins</h1>` + a count subtitle (lines 55-57). The established header (Masters `MastersClient.tsx:45-50`, and `src/app/admin/AGENTS.md:27`) is an eyebrow `text-xs font-medium uppercase tracking-wider text-primary` + muted subtitle, **no `<h1>`**. The topbar already supplies "Admins": `superadminNavItems` (`adminNavItems.ts:75-79`) has `{ label: "Admins", href: "/admin/admins" }`, non-`exact`, so `getPageTitle` → `isNavItemActive` matches `/admin/admins` via `pathname.startsWith` and returns "Admins" (no earlier item is a prefix of that path). The `<h1>` is provably redundant — same removal done on Settings/Email/Social/Notifications/Database. `AGENTS.md:20` also states "don't hardcode a title in the page itself."

2. **The card list is on the OLD pre-Masters grid-of-vertical-cards paradigm.** `AdminsClient.tsx:88` — `<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">` of `flex flex-col` cards with `rounded-xl border border-border bg-card p-4` and **no `shadow-sm`** (line 94). This is precisely the pre-Stage-5 grid idiom that Masters abandoned. The established convention (Masters `MastersClient.tsx:81-85`, `AGENTS.md:26`) is a **single-column stack** (`flex flex-col gap-3`) of full-width row-cards with `rounded-[20px] … bg-card … shadow-sm`. This is the single biggest visual-language mismatch. **Bonus:** going full-width single-column gives the 6-badge permission row room to sit on one/two clean lines instead of wrapping cramped inside a narrow `lg:grid-cols-3` cell — the paradigm shift is justified, not arbitrary.

3. **Card + empty-state radius/shadow lag the convention.** `rounded-xl` (lines 81, 94) → `rounded-[20px]`; cards need `shadow-sm` added (matches Masters line 74 empty-state and line 85 card).

4. **Add button sizing lags the header pattern.** `AdminsClient.tsx:63` — `<Button size="sm" className="gap-2">`. Masters/Services both use `<Button className="h-10 gap-2 px-5">` (no `size="sm"`).

5. **`AdminForm.tsx` is token-clean EXCEPT one raw-green success callout.** Its `<form>` (Input/Label/Button primitives), password field, permission checkboxes, `fetch` calls, and state are all clean and **security-sensitive → out of scope**. The lone violation is the "created" success box (`AdminForm.tsx:84-85`): `rounded-lg border border-green-500/30 bg-green-500/10 p-4` + `text-green-700 dark:text-green-400` — raw Tailwind greens. Its **direct sibling `MasterForm.tsx:106-113` already shows the correct fix**: `rounded-lg bg-[var(--md-success-container)] p-4` + `text-[var(--md-on-success-container)]`. This is a precedented one-swap chrome cleanup, no logic touched.

**Deliberate NON-changes (documented so the reviewer does not flag their absence):**
- **No avatar/icon circle added to admin cards.** Masters row-cards lead with a real (data-backed) avatar; admins have no avatar data. Adding a decorative icon circle would be inventing a new element (forbidden). Keep the existing name + `Mail`-icon-email identity block.
- **`PermBadge` `text-[10px]` kept** (line 32). Services inline badges use `text-[11px]`, but 6 permission pills per row need the compact size; `text-[10px]` is already there and reads fine. Not a violation.
- **The `border-t border-border pt-2` separator** above the badge row (line 149) is token-clean and delineates identity from permissions — keep it.
- **The dynamic count subtitle** (`{admins.length} admin{s} registered`) is kept as the eyebrow's subtitle — it is useful, already `text-sm text-muted-foreground`, and removing it would be reverse scope-creep.

## Security / permission safety (CRITICAL — the restyle must not touch any of this)

- **SUPERADMIN-only guard** lives entirely in `page.tsx:8` (`session.user.role !== "SUPERADMIN" → redirect`). `page.tsx` renders zero chrome — **do NOT touch it at all**, which keeps the guard provably intact.
- **Permission parsing** (`parseAdminPermissions`, `AdminsClient.tsx:16,90`) and the `PermBadge` granted/not-granted mapping — unchanged.
- **Mutations** — `handleDelete` + its `confirm(...)` (`AdminsClient.tsx:44-48`), and every `fetch` in `AdminForm.tsx` (`POST /api/admin/admins`, `PATCH /api/admin/admins/[id]`, `DELETE`) — unchanged.
- **Password handling** (`AdminForm.tsx`: the `password` state line 31, the `<Input type="password">` create field lines 141-151, the generated-password reveal + copy-to-clipboard block lines 92-110) — **treat like an encrypted secret: do NOT touch its logic.** Only the success *callout box color* (lines 84-85) changes; the password `<Input>`, the copy `Button`, and the `<Check className="text-green-500">` icon (line 106) are **not** touched. (Note: `MasterForm.tsx:128,315` keeps `text-green-500` for the identical copy-confirm check icon — so leaving AdminForm's check icon green *matches* the sibling; changing it would diverge.)
- The API routes under `src/app/api/admin/admins/**` are the mutation contract only — **not edited**.

## Architecture Decisions

- **Only presentation changes.** No handler, `fetch`, `useState`, `confirm`, permission read, or the server `page.tsx` may change. Every changed line traces to a class-string / JSX-wrapper swap.
- **Reference conventions are `MastersClient.tsx` (canonical card list + eyebrow header) and `src/app/admin/AGENTS.md:26-27` (the codified chrome contract).** Reuse their exact class strings so Admins reads identically to Masters. Do NOT invent spacing/radius/color values.
- **Eyebrow copy = "Access"** (single noun, like Masters="Staff" / Services="Manage" / Database="Records"). It must NOT be "Admins" (duplicates the topbar title). Acceptable alternatives if a reviewer objects: "Team" or "Accounts". Pick one and keep it.
- **Layout wrapper `mx-auto max-w-3xl`** on the root `<div>` (matches Masters `MastersClient.tsx:41`), since Admins is now the same single-column card-stack idiom. 768px comfortably fits the identity row and the wrapping 6-badge row.
- **Semantic tenant-customizable tokens only** for the chrome (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `shadow-sm`). The only fixed `--md-*` tones enter via (a) the existing `Badge success/muted` variants (unchanged) and (b) the `AdminForm` success-callout swap, which uses `--md-success-container` / `--md-on-success-container` — this is the **established callout pattern already used verbatim by `MasterForm.tsx:106-107`**, so hand-writing those two `--md-*` classes here is correct and precedented (there is no Badge primitive for a callout box).
- **File sizes stay far under 500 lines** — `AdminsClient.tsx` ≈164, `AdminForm.tsx` ≈192; all swaps are net-neutral. No split needed.

## Implementation Steps
Ordered lowest-risk first. Line numbers reference the current files. No handler / `fetch` / permission read / `confirm` / `page.tsx` may change.

- [x] **Step 1: `AdminForm.tsx` — success callout raw green → M3 success tokens** (smallest, fully precedented)
  - Files: `src/app/admin/admins/AdminForm.tsx`
  - Details: In the `if (created)` block, mirror `MasterForm.tsx:106-113` exactly:
    - Line 84: `className="rounded-lg border border-green-500/30 bg-green-500/10 p-4"` → `className="rounded-lg bg-[var(--md-success-container)] p-4"` (drop the border, matching MasterForm).
    - Line 85: `className="text-sm font-medium text-green-700 dark:text-green-400"` → `className="text-sm font-medium text-[var(--md-on-success-container)]"`.
    - Keep the "Admin created successfully!" text, the muted sub-line (lines 88-90, already identical to MasterForm), the password `<Input>`, the copy `<Button>`, and `<Check className="h-4 w-4 text-green-500" />` (line 106) **unchanged**.
    - **Do NOT touch** any `useState`, `fetch`, `toggle`, `handleSubmit`, the password field, the permission checkboxes, or the `<form>` primitives — this step edits two className strings only.

- [x] **Step 2: `AdminsClient.tsx` — header eyebrow + layout wrapper + Add button**
  - Files: `src/app/admin/admins/AdminsClient.tsx`
  - Details:
    - Line 51: `<div>` → `<div className="mx-auto max-w-3xl">` (matches Masters line 41).
    - Lines 54-57: replace the `<h1 className="text-2xl font-bold tracking-tight">Admins</h1>` with `<p className="text-xs font-medium uppercase tracking-wider text-primary">Access</p>`. **Keep the count subtitle verbatim:** `<p className="mt-1 text-sm text-muted-foreground">{admins.length} admin{admins.length !== 1 ? "s" : ""} registered</p>`.
    - Line 63: `<Button size="sm" className="gap-2">` → `<Button className="h-10 gap-2 px-5">` (matches Masters/Services header button). Keep the `<Plus className="h-4 w-4" />` + "Add Admin" label inside. (Optional consistency tweak, not required: lowercase the label to "Add admin" to match Masters "Add master" / Services "Add service"; the Sheet title stays "Add Admin".)
    - **Do NOT touch** the `Sheet`/`SheetTrigger`/`SheetContent`/`AdminForm` wiring, `addOpen`/`setAddOpen`, or `router.refresh()`.

- [x] **Step 3: `AdminsClient.tsx` — list grid → single-column stack + card chrome + empty-state radius**
  - Files: `src/app/admin/admins/AdminsClient.tsx`
  - Details:
    - Empty-state div (line 81): `rounded-xl` → `rounded-[20px]` (keep `border border-dashed border-border py-16 text-center` and its inner text unchanged; matches Masters line 74).
    - List container (line 88): `<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">` → `<div className="flex flex-col gap-3">` (matches Masters line 81).
    - Card container (line 94): `className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"` → `className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm"`.
    - **Keep everything inside each card unchanged:** the identity block (name line 98, `Mail`-icon email lines 99-102), the actions block (edit `Sheet` lines 105-136, delete `Button` lines 138-145), the `border-t border-border pt-2 flex flex-wrap gap-1` separator + the 6 `PermBadge`s (lines 149-156). No avatar/icon circle is added (see Deliberate Non-Changes).
    - **Do NOT touch** `parseAdminPermissions`, `PermBadge`, `handleDelete`, the delete `confirm(...)`, the edit `Sheet` state (`editOpen`/`editTarget`), or any `fetch`.

- [x] **Step 4: DOX pass + verify & hand off**
  - Files: (checks only) — optionally `src/app/admin/AGENTS.md`
  - Details:
    - **DOX pass:** `AGENTS.md:26` already lists the surfaces sharing this chrome ("Services, Masters, Database's Clients/GDPR tables"). Admins now joins as a Masters-style card list — a one-word addition of "Admins" to that parenthetical keeps the index accurate; do this only if it reads cleanly, no behavior change. No new child AGENTS.md is warranted (the admins folder is not a new durable boundary).
    - Run the automated gates (below). Confirm zero net-new lint problems vs. baseline (no imports added/removed; no map-index args changed; all swaps are className-only, so lint should be net-neutral). Do NOT start a dev server.
    - Produce the manual browser checklist for the user.

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` introduces zero net-new problems vs. baseline (change is className-only; no unused vars introduced).
- [x] `npm run build` succeeds.
- [x] `npm run test` shows no new failures vs. baseline (presentation-only; no Admins component tests exist — confirm any pre-existing failures predate the change).
- [x] Header shows the "Access" eyebrow (primary, uppercase) + the "N admins registered" muted subtitle; the redundant `<h1>Admins</h1>` is gone (topbar already shows "Admins").
- [x] Admin cards render as a **single-column stack** of full-width `rounded-[20px] border border-border bg-card p-4 shadow-sm` cards — no `sm:grid-cols-2 lg:grid-cols-3` grid, no `rounded-xl`.
- [x] Empty-state uses `rounded-[20px]`; Add button uses `h-10 gap-2 px-5`.
- [x] Permission pills still use the existing `PermBadge` (`success` = granted / `muted` = not) — unchanged.
- [x] `AdminForm` "created" success box uses `bg-[var(--md-success-container)]` + `text-[var(--md-on-success-container)]`; no raw `green-*` classes remain in the callout. (The copy-confirm `<Check>` icon may stay `text-green-500`, matching `MasterForm.tsx`.)
- [x] `page.tsx` is untouched; the SUPERADMIN guard, permission parsing, all mutations, `confirm(...)`, and password handling are byte-for-byte unchanged.
- [x] No emoji; no new invented design elements (no avatar circle); files < 500 lines.

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
Log in as **SUPERADMIN** and visit `/admin/admins`:
1. **Header/topbar:** topbar reads "Admins"; the page shows the uppercase "Access" eyebrow (brand/primary color) + "N admins registered" subtitle; no duplicate large "Admins" heading.
2. **Card list:** admins render as a centered single-column stack of full-width rounded (20px) cards with a soft shadow — not a multi-column grid. Each card shows name, the mail-icon email, the edit/delete icons top-right, and the row of 6 permission badges (green = granted, grey = not) below a hairline separator.
3. **Add Admin:** the "Add Admin" pill opens the right-side Sheet; creating an admin shows the **green (M3 success-container) success box** with the generated password + working copy-to-clipboard button, then "Done" refreshes the list with the new admin.
4. **Edit / Delete:** the pencil opens the edit Sheet (permission checkboxes) and saves; the trash icon shows the "Delete admin … This cannot be undone." confirm before deleting.
5. **Empty state:** (if all admins removed) the dashed `rounded-[20px]` empty card reads correctly.
6. **Dark theme:** toggle admin dark theme and confirm cards, badges, the success box, and the Sheet form all read correctly.
7. **Access control (unchanged):** log in as a plain **ADMIN** and confirm `/admin/admins` redirects to `/admin` (SUPERADMIN-only guard intact).

## Constraints & Risks
- **SUPERADMIN-only, security-sensitive surface** (`src/app/admin/AGENTS.md:13-14`): do NOT alter `page.tsx`'s role guard, `parseAdminPermissions`, the `PermBadge` mapping, any mutation `fetch`, the delete `confirm(...)`, or the password field/reveal/copy logic in `AdminForm.tsx`. Restyle chrome only.
- **No mockup exists** — apply only the shipped Masters/Services card-list language; invent no colors, spacing, icons, or new elements (explicitly: no avatar circle on admin cards).
- **`page.tsx` (17 lines) is not edited** — it holds the entire auth guard + query and renders no chrome.
- **API routes** under `src/app/api/admin/admins/**` are the mutation contract only — not edited.
- **DB Browser (`/admin/db-browser`) is a separate next stage — do NOT touch it** (note its `yellow-500` pill at `DbBrowserClient.tsx:127` is out of scope here).
- **Zero-warning lint:** all edits are className-string swaps; no imports, variables, or map-index args are added or removed, so lint stays net-neutral.
- **Files changed (2 total):** `src/app/admin/admins/AdminsClient.tsx`, `src/app/admin/admins/AdminForm.tsx` (+ optional one-line note in `src/app/admin/AGENTS.md:26`).

## Critical Files
- `src/app/admin/admins/page.tsx` (17) — SUPERADMIN guard + `User where role:"ADMIN"` query; renders `<AdminsClient>`. **Not edited.**
- `src/app/admin/admins/AdminsClient.tsx` (164) — header eyebrow (Step 2), grid→stack + card chrome (Step 3); all Sheet/delete/permission logic untouched.
- `src/app/admin/admins/AdminForm.tsx` (192) — success-callout color swap (Step 1); password/fetch/checkbox logic untouched.
- `src/app/admin/masters/MastersClient.tsx` (193) — canonical card-list chrome + eyebrow header reference (`mx-auto max-w-3xl`, `flex flex-col gap-3`, `rounded-[20px] … shadow-sm`, `Badge success/muted`).
- `src/app/admin/masters/MasterForm.tsx` (lines 106-113, 128) — success-callout M3-token precedent and the accepted `text-green-500` copy-check icon.
- `src/app/admin/services/ServicesClient.tsx` (187) — header button sizing (`h-10 gap-2 px-5`) reference.
- `src/components/ui/badge.tsx` (41) — `success`/`muted` variants encapsulating `--md-success-container` etc.; not edited.
- `src/lib/admin-permissions.ts` (49) — `parseAdminPermissions`/`AdminPermissions`; not edited.
- `src/components/admin/adminNavItems.ts` (lines 75-79, 117-122) — `superadminNavItems` "Admins" title resolution (why the `<h1>` is dropped); not edited.
- `src/app/admin/AGENTS.md` (lines 13-14, 20, 26-27) — SUPERADMIN/permission rules, "no hardcoded page title", and the codified card-chrome + eyebrow-header contract.
