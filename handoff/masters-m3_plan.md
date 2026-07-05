# Plan: Admin Masters Page — M3 (Somique) Restyle (Stage 5)

**Date:** 2026-07-05
**Status:** In Progress

## Goal
Restyle the admin Masters page (`/admin/masters`) to match the Somique Beauty admin mockup's `MastersPage` visual language — while preserving 100% of the existing master CRUD (create / edit / delete master, avatar upload, per-master color, bio, homepage visibility, password reset).

## Structural Assessment (read first — honest fit analysis)

**The mockup is a card LIST, not a table and not a responsive grid.** Verified against the actual markup (`Somique Beauty Design System/ui_kits/admin/index.html`, `MastersPage` at lines 396–429):

- Mockup layout = a **single-column vertical stack of full-width HORIZONTAL row-cards** (`display:flex; flexDirection:column; gap:12`, constrained to `maxWidth:700`). Each card is one master rendered as a horizontal row: `[round avatar w/ ring] · [name + email, flex:1] · [right-aligned meta] · [action button]`.
- Current layout (`MastersClient.tsx` lines 78–189) = a **responsive GRID of compact VERTICAL cards** (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`), avatar 40px, name + visibility badge + color swatch + email stacked, bio underneath.

So — unlike Stage 4 (Services, which was table→table, same shape) — **this stage IS a layout paradigm shift**: grid-of-vertical-cards → stacked-horizontal-rows. Being honest about that (per the Stage 4 precedent of naming mismatches rather than forcing them): the shift is a **JSX re-layout confined entirely to `MastersClient.tsx` (a `"use client"` component)**. Every handler, `Sheet` control-state, delete `confirm()`, data binding, and `actions.ts` call stays byte-for-byte identical. It rearranges the same data with the same wiring — it is layout/styling work, not a logic/data-flow change. That makes the mockup-faithful path also the least-risky path (no interaction regression surface), so we adopt it.

### Three genuine mockup↔data mismatches, and the decided handling for each

1. **Mockup avatar has a uniform `priCont` (primary-container) ring; masters carry their OWN per-master `color`.**
   `prisma/schema.prisma` `MasterProfile.color` (line 54, default `#166534`) is real per-master data used throughout the calendar to tint that master's events/slots. **DECISION: bind the avatar ring to the master's own `color` (inline style), not the tenant `priCont` tone.** This surfaces real per-master data, visually ties the Masters page to how each master reads in the calendar, and folds the current standalone color-swatch chip into a cleaner affordance. **This is per-master data, NOT the tenant brand color** — it must stay an inline `style={{ ... }}` bound to `masterProfile.color` and must NEVER be swapped for `bg-primary`/`bg-accent`/etc. (those collapse to one hue under tenant customization; the whole point here is per-master differentiation). Keep the existing `?? "#166534"` fallback (matches the schema default; a legitimate fixed default, not a tenant hardcoding concern).

2. **Mockup right-meta = a per-master "N bookings" stat + a green "Active" status pill. Masters have neither an `active` field nor a bookings count in the current data flow.**
   - The **"Active" pill** → substitute the REAL homepage-visibility status the page already has (`showOnHomepage`). Render **Visible/Hidden** via the shared `Badge`: `variant="success"` for Visible, `variant="muted"` for Hidden. Note the mockup's green pill colors (`#B7F2DC` / `#002117`) are exactly the success-container / on-success-container tones — so `Badge variant="success"` (`bg-[var(--md-success-container)] text-[var(--md-on-success-container)]`) reproduces the mockup pill on-token while showing honest data. This also replaces the current raw-Tailwind-green badge (`bg-green-500/10 text-green-600`, lines 106–114), which violates the "use `--md-success` not the `green-*` scale" convention.
   - The **"N bookings" stat** → **DEFER (out of scope this stage).** The `User.appointmentsAsMaster` relation exists (`schema.prisma` line 35), so a `_count` could be added — but that is a **data-flow change** (page.tsx query + type + prop), and per the stagewise/pure-styling framing (identical risk profile to Stage 4) we keep this stage styling-only. Documented as a low-effort optional follow-up in Out of Scope. The right-meta slot holds the visibility pill instead.

3. **Mockup row-actions = one "more" (three-dot) overflow button; current = two inline icon buttons (Edit pencil → `Sheet`; Delete trash → `confirm()`).**
   Same call as Stage 4: converting to an overflow menu would touch the controlled edit-`Sheet` open flow and delete confirmation — an interaction change with real regression surface on a CRUD page. **DECISION: keep the two inline icon buttons, restyled only.** The single-button overflow affordance is explicitly deferred (see Out of Scope).

**Bio:** the mockup's horizontal row shows name + email only (no bio). The current card shows bio (line-clamp-2). To avoid losing existing info while honoring the horizontal layout, **keep bio as an optional single-line truncated (`line-clamp-1`) muted line beneath the email** inside the flex:1 middle column. Minor, information-preserving deviation from the mockup — noted.

## Architecture Decisions

- **`actions.ts` is NOT touched.** All server logic (Zod schemas, create/update/delete, `resetMasterPassword`, `revalidatePath`) stays byte-for-byte identical. Every changed line traces to visual/layout styling only.
- **`page.tsx` stays unchanged.** It is a Server Component that only awaits the Prisma query and renders `<MastersClient>`; it uses no `<Button>` and no `buttonVariants()`, so the Stage-2 server-boundary `buttonVariants()` `TypeError` regression cannot occur here. **Do NOT introduce any `<Button>`/`buttonVariants()` call into `page.tsx`.**
- **All restyle work lives in `MastersClient.tsx`** (a `"use client"` component — the `buttonVariants()` hazard does not apply to client components), plus optional low-priority token polish in `MasterForm.tsx`.
- **Header pattern matches Stage 2 (dashboard) / Stage 4 (services).** Drop the redundant `<h1>Masters</h1>` — the page title already comes from `AdminTopBar` via `getPageTitle` (confirmed: `adminNavItems.ts` line 40–44 registers `/admin/masters` → label "Masters"; `isNavItemActive` matches it, so the topbar renders "Masters"). Use the mockup's eyebrow + subtitle: uppercase primary eyebrow **"Staff"** over muted subtitle **"Manage accounts and permissions"** (verbatim mockup copy, lines 406–407).
- **Card chrome:** each master row-card uses the established card treatment — `rounded-[20px]` (project convention favors 20px; mockup uses 16), `bg-card`, `border border-border`, `shadow-sm`, horizontal flex (`flex items-center gap-4`, `p-4`/`px-5 py-4`). Pills/buttons stay `rounded-full` (Badge and Button `default` already are).
- **List container width:** the mockup constrains the whole page (header + list) to `maxWidth:700` because full-width horizontal rows look stretched. Wrap the page content in a `max-w-3xl` (≈768px) or `max-w-[720px]` container to approximate this. Use a single-column `flex flex-col gap-3` list (mockup `gap:12`), NOT a grid.
- **Tenant-safety / two color systems (critical for THIS page):** there are two separate, both-legitimate color systems here — (a) the **tenant brand color** (`TenantConfig` → `bg-primary`/`bg-accent`/semantic tokens), used for the eyebrow, the "Add master" pill, and hovers; and (b) each **master's own `color`** (`MasterProfile.color`), used for the avatar ring via inline style. Do not confuse or cross-wire them. The success/muted visibility Badge uses the fixed `--md-success-container` tone (deliberately tenant-invariant, correct per the `badge.tsx` convention). Everything else (`bg-card`, `bg-muted`, `text-muted-foreground`, `text-foreground`, Button `default`/`ghost`) is the tenant-customizable semantic layer — all correct.
- **No new shared component.** A `MasterCard` is single-use (only this page lists masters; the MASTER self-service dashboard does not list peers) — per "no abstractions for single-use code," keep the card inline in `MastersClient.tsx`. `StatCard`/`AppointmentStatusBadge` are not a fit (no stat tone, no appointment status). Reuse the existing `Badge` (`variant="success"`/`"muted"`) for the visibility pill.
- **No emoji; icons via `lucide-react` only.** Reuse existing imports (`Plus`, `Pencil`, `Trash2`, `Eye`, `EyeOff`, `User`). Drop the inline `Mail` icon from the email line to match the mockup's plain email text (→ remove `Mail` from the import, lint tripwire). Add `Badge` import. Optional empty-state `Users` icon (the Masters nav icon) may be added only if actually rendered.

## Implementation Steps

Ordered lowest-risk / most-isolated first. Line numbers reference current `src/app/admin/masters/MastersClient.tsx` unless noted. **No handler, state, `Sheet` control flow, `confirm()`, or `actions.ts` call may change — restyle/relayout classes and JSX structure only.**

- [x] **Step 1: Header block — eyebrow + subtitle + pill button** (lines 41–68)
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details: Replace the title `<div>` (lines 43–48, the `<h1>Masters</h1>` + `{masters.length} master…` count `<p>`) with the mockup header pattern:
    - Eyebrow: `<p className="text-xs font-medium uppercase tracking-wider text-primary">Staff</p>`.
    - Subtitle: `<p className="mt-1 text-sm text-muted-foreground">Manage accounts and permissions</p>` (verbatim mockup copy). The standalone master-count line is dropped (not in mockup; redundant).
  - Add button (lines 50–58): keep the `Sheet`/`SheetTrigger`/`SheetContent`/`MasterForm` wiring untouched. Change label `Add Master` → `Add master` (mockup casing); grow the pill to mockup proportions — drop `size="sm"` (let default) and use `className="h-10 gap-2 px-5"`. Button `default` variant is already `rounded-full bg-primary text-primary-foreground` — no variant change. Keep `<Plus className="h-4 w-4" />`.
  - Wrap the whole returned page content (header + list/empty-state) in a width-constrained container: outer `<div className="mx-auto max-w-3xl">` (or `max-w-[720px]`) to approximate the mockup's `maxWidth:700`.

- [x] **Step 2: List container — grid → single-column stack** (line 78)
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details: Replace the grid `<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">` with a single-column stack `<div className="flex flex-col gap-3">` (mockup `flexDirection:column; gap:12`). The `.map` over `masters` stays; only the wrapper and each card's internal layout change (Steps 3–5).

- [x] **Step 3: Master card shell → horizontal row-card** (lines 80–83, and the whole card body 84–187)
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details: Restructure each card `<div key={master.id}>` from the current vertical `flex flex-col gap-3 rounded-xl border border-border bg-card p-4` to a horizontal row:
    - Card shell: `className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-4 shadow-sm"` (mockup: card bg + border + 16→20 radius + subtle shadow + horizontal flex). Keep `key={master.id}`.
    - Internal order (left→right): **[avatar]** (Step 4) · **[name/email/bio middle, `flex-1 min-w-0`]** (Step 4) · **[visibility pill, `shrink-0`]** (Step 5) · **[Edit + Delete action buttons, `shrink-0`]** (Step 5).

- [x] **Step 4: Avatar (ring in master's own color) + middle name/email/bio column** (lines 84–127, 181–186)
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details:
    - **Avatar** (from lines 87–99): grow to mockup 52px and add a 3px ring in the master's OWN color via inline style. Recommended: `<div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center" style={{ boxShadow: '0 0 0 3px ' + (master.masterProfile?.color ?? '#166534') }}>` containing the existing `next/image` `<Image fill>` when `avatarUrl` is present, else `<User className="h-6 w-6 text-muted-foreground" />`. (`overflow-hidden` clips the photo to the circle; the `boxShadow` ring sits outside the border-box and is not clipped.) **The ring color is per-master data — keep it an inline style bound to `masterProfile.color`; do not tokenize it.**
    - **Middle column** (`flex-1 min-w-0`): name `<p className="truncate text-[15px] font-medium text-foreground">{master.name ?? "—"}</p>`; email `<p className="truncate text-xs text-muted-foreground mt-0.5">{master.email}</p>` — **drop the inline `<Mail>` icon** (mockup email is plain text). Optionally append bio as a third line `{master.masterProfile?.bio && <p className="truncate text-xs text-muted-foreground/80 mt-0.5">{master.masterProfile.bio}</p>}` (`line-clamp-1`/`truncate` to keep the row single-height).
    - **Remove** the old standalone color-swatch chip (lines 116–120) — its info is now the avatar ring.
    - **Lint follow-through:** `Mail` (imported line 5) becomes unused → remove it from the `lucide-react` import to keep lint green.

- [x] **Step 5: Visibility pill (Badge) + action buttons** (lines 105–114 for the pill; 129–178 for actions)
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details:
    - **Visibility pill** (replace the raw-green `<span>` at lines 106–114): use the shared `Badge` — `master.masterProfile?.showOnHomepage ? <Badge variant="success" className="gap-1"><Eye className="h-3 w-3" />Visible</Badge> : <Badge variant="muted" className="gap-1"><EyeOff className="h-3 w-3" />Hidden</Badge>`. Import `Badge` from `@/components/ui/badge`. Wrap in a `shrink-0` cell. Keep `Eye`/`EyeOff` imports (now used inside the Badge).
    - **Action buttons** (from lines 129–178): keep the entire Edit `Sheet` wiring (`editOpen`/`editTarget` control state, `SheetTrigger render={<Button variant="ghost" size="icon-sm" onClick={...}>}`, `SheetContent`, `MasterForm`) and the Delete `<Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => handleDelete(...)}>` **unchanged in behavior** — only ensure they sit in a `flex items-center gap-1 shrink-0` cell at the row's right edge. Keep `<Pencil className="h-3.5 w-3.5" />` and `<Trash2 className="h-3.5 w-3.5" />`. `text-destructive` is the correct tenant-customizable destructive key — keep it. The mockup's single "more" overflow is intentionally NOT reproduced (see Out of Scope).

- [x] **Step 6: Empty-state restyle** (lines 70–76) — radius bumped to `rounded-[20px]`; optional `Users` icon skipped (not rendered, avoids unused import)
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details: Keep the conditional and copy. Bump the dashed container radius `rounded-xl` → `rounded-[20px]` for card consistency. Optional low-priority polish: add a tonal `Users` icon above the text — `<Users className="mb-3 h-8 w-8 text-muted-foreground/60" />` (import `Users` from `lucide-react`). Only add the import if the icon is actually rendered (unused-import lint).

- [x] **Step 7 (optional, low-priority): MasterForm token polish** (`MasterForm.tsx`) — applied: swapped raw `green-*` success boxes/text at lines ~106–113, 262, 298–307 to `--md-success-container`/`--md-on-success-container` tokens; no form logic touched
  - Files: `src/app/admin/masters/MasterForm.tsx`
  - Details: The form lives inside a `Sheet` and is NOT depicted in the mockup — **do not alter any form logic** (avatar upload, `useFormState`, `color` `<input type="color">`, `showOnHomepage` checkbox, password-reset flow). Optional convention-alignment only: swap the raw-Tailwind-green success boxes/text (lines 106–113, 262, 298–307) to the success token (`bg-[var(--md-success-container)]`/`text-[var(--md-on-success-container)]`, mirroring `Badge variant="success"`) for consistency with the restyled card. The per-master `color` picker (lines 227–240) is legitimate per-master data — leave it functionally intact (radius/label polish only, if anything). If nothing here needs touching, leave the file unchanged and note so.

- [ ] **Step 8: Verify & hand off** (skipped per orchestrator instruction — automated gates run separately, see Acceptance Criteria above; manual browser checklist still pending user)
  - Files: (none — verification only)
  - Details: Run the automated gates below; then produce the manual browser checklist for the user (CRUD must work end-to-end). No dev server.

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` introduces **zero net-new** problems vs. the repo baseline (no orphaned `Mail` import; `Badge` — and `Users` if used — actually rendered).
- [x] `npm run build` succeeds.
- [x] Existing test suite unaffected — no masters-page component tests exist; changes are presentation/layout-only.
- [x] `MastersClient.tsx` and `MasterForm.tsx` each stay under 500 lines. (192 and 326 lines respectively)
- [x] Header shows the "Staff" eyebrow (brand/primary color) + "Manage accounts and permissions" subtitle; the redundant `<h1>Masters</h1>` is gone (title comes from the topbar).
- [x] Masters render as a single-column stack of `rounded-[20px] bg-card` horizontal row-cards: avatar (52px) ringed in the master's own color, name + email (+ optional bio) middle, Visible/Hidden success/muted Badge, and Edit + Delete icon buttons.
- [ ] Create, edit, delete, avatar upload, color, bio, homepage-visibility toggle, and password reset all still function unchanged. — requires manual in-browser verification (not run, per no-dev-server rule).
- [x] Follows project conventions (no emoji, lucide icons, `Badge variant="success"`/`"muted"` for the visibility pill instead of raw `green-*`, per-master color kept as inline style bound to `masterProfile.color`, `text-destructive` for destructive, `rounded-full` pills / `rounded-[20px]` cards).

## Verification

### Automated (run after implementation)
```bash
npx tsc --noEmit
npm run lint
npm run build
```
No dev server may be started for verification (standing rule). Anything visual is deferred to the manual checklist below.

### Manual (user must confirm in-browser — flag explicitly)
Navigate to `/admin/masters` (logged in as ADMIN/SUPERADMIN) and verify:
1. **Header** shows the uppercase "Staff" eyebrow (in the brand/primary color) over "Manage accounts and permissions"; no big "Masters" heading duplicated below the topbar title.
2. **Cards** render as a single-column stack of horizontal rows: round avatar with a colored ring, name + email (+ bio if set), a Visible/Hidden pill, and edit/delete icons on the right.
3. **Avatar ring color** matches each master's Appointment Color (same hue that master shows in the calendar); changing the color in the edit form and saving updates the ring.
4. **Add master:** the "Add master" pill opens the right-side Sheet; creating a master shows the generated password, and the new row appears without a full reload.
5. **Edit:** the pencil opens the Sheet pre-filled; changing name/bio/color/avatar/visibility persists and the row updates.
6. **Delete:** the trash icon triggers the confirm dialog; confirming removes the row.
7. **Avatar upload** in the form still works (uploads, preview, and shows on the card).
8. **Homepage visibility** toggle in the form flips the card's Visible/Hidden pill.
9. **Password reset** (edit sheet, "Access Recovery") still generates/saves and reveals a copyable password.
10. **Empty state:** with no masters, the dashed empty card renders correctly.
11. **Dark mode:** toggle the admin theme — cards, ring, pills, and buttons read correctly in both light and dark.
12. **Tenant branding:** with a non-default brand color set in Settings, the eyebrow and "Add master" pill pick it up; the per-master avatar rings stay each master's own color (NOT collapsed to the brand color); nothing renders illegibly.

## Constraints & Risks
- **Do NOT modify `src/app/admin/masters/actions.ts`** — all CRUD/validation/password-reset logic stays intact. This stage is presentation/layout-only.
- **Do NOT modify `src/app/admin/masters/page.tsx`** and do NOT add any `<Button>`/`buttonVariants()` usage to it (Server Component — the Stage-2 request-time `TypeError` regression). All buttons live in the client `MastersClient.tsx`.
- **Do NOT alter** the edit-`Sheet` control state (`editOpen`/`editTarget`), the delete `confirm()` flow (`handleDelete`), the `useTransition`/`deleteMaster` call, or any `MasterForm` logic (avatar upload, `useFormState`, color picker, password reset) — relayout/restyle classes and JSX structure only. Every changed line must trace to a visual requirement.
- **Two color systems — do not cross-wire:** the tenant brand color (`bg-primary`/semantic tokens → eyebrow, Add pill, hovers) vs. each master's own `MasterProfile.color` (avatar ring, inline `style` only). Never render the per-master ring via `bg-primary`/`bg-accent` (would collapse all rings to one hue under tenant customization). Never render the tenant brand surfaces via a per-master hex.
- **Deferred / out of scope (do not attempt in this stage):**
  - **Per-master "N bookings" stat** — needs a `_count: { select: { appointmentsAsMaster: true } }` addition to the `page.tsx` query + type + prop (a data-flow change). Low-effort optional follow-up; kept out to preserve this stage's pure-styling risk profile.
  - **"More" (three-dot) overflow dropdown** for row actions — an interaction change; keep the two inline Edit/Delete icon buttons.
  - **Replacing native `confirm()` delete** with a custom dialog.
  - **Deep `MasterForm` redesign** — the Sheet form isn't in the mockup; keep it functional with at most trivial token/radius polish (Step 7, optional).
  - **A shared `MasterCard` component** — single-use; keep the card inline.
  - **Client-facing / homepage master cards** — later stage per the admin-first sequencing.
- **Lint tripwires:** dropping the email `Mail` icon orphans the `Mail` import — it MUST be removed. Conversely, only import `Badge`/`Users` if actually rendered.
- **File-size limit:** keep `MastersClient.tsx` and `MasterForm.tsx` under 500 lines (ample headroom; the re-layout does not materially grow line count).

## Critical Files
- `src/app/admin/masters/MastersClient.tsx` — primary restyle/relayout target (client component); all Steps 1–6.
- `src/app/admin/masters/MasterForm.tsx` — optional token polish only (Step 7); logic untouched.
- `src/app/admin/masters/page.tsx` — leave unchanged; Server Component, no `<Button>`/`buttonVariants()`.
- `src/app/admin/masters/actions.ts` — leave unchanged; server logic.
- `Somique Beauty Design System/ui_kits/admin/index.html` — mockup reference: `MastersPage` at lines 396–429 (theme object `AT` 30–55, icons `IC` 66–81; note the "Active" pill colors `#B7F2DC`/`#002117` == success-container tones).
- `src/components/ui/badge.tsx` — reuse `variant="success"` (Visible) / `variant="muted"` (Hidden) for the visibility pill.
- `src/components/admin/adminNavItems.ts` — confirms `/admin/masters` → topbar title "Masters" (basis for dropping the `<h1>`).
- `prisma/schema.prisma` — `MasterProfile` (47–55) confirms fields `bio`/`avatarUrl`/`showOnHomepage`/`color` and no `active` field (basis for the visibility-vs-"Active" substitution); `User.appointmentsAsMaster` (35) is the relation a future bookings-count would use.
- `src/app/admin/AGENTS.md`, `src/components/AGENTS.md` — conventions (raw `--md-*` vs semantic tokens, `buttonVariants` server-boundary hazard, radius/pill rules, per-master calendar-color tinting, 500-line limit).
