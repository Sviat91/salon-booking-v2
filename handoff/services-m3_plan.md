# Plan: Admin Services Page — M3 (Somique) Restyle (Stage 4)

**Date:** 2026-07-05
**Status:** Implemented (Steps 1-7 done); awaiting manual browser verification (Step 8)

## Goal
Restyle the admin Services page (`/admin/services`) to match the Somique Beauty admin mockup's visual language — while preserving 100% of the existing CRUD functionality (create / edit / delete service, per-master price overrides).

## Structural Assessment (read first — honest fit analysis)

The current page and the mockup are **structurally the same shape**: a header row (title/subtitle + "Add" pill button) above a single bordered card containing a table of services. This is a **styling-only stage**; no layout paradigm shift (e.g. table→card-grid) is needed or implied by the mockup.

Two genuine mismatches, and the decided handling for each:

1. **Mockup has a "Status" (Active/Inactive) column; the data model has no such field.**
   `prisma/schema.prisma` `model Service` (lines 63-77) has only `name`, `duration`, `price`, `masterId`, timestamps — **no `active`/`isActive` field**. Rendering a Status pill would either be a fake static "Active" (misleading) or require a **schema migration + form control + actions logic + availability filtering** — that is an architectural feature, not styling. **DECISION: the Status column is OUT OF SCOPE / deferred.** The table keeps 5 columns (same count as the mockup) by retaining the existing **"Special Prices"** column in the Status slot — this column surfaces real per-master `priceOverride` data this app actually has.

2. **Mockup row-actions = one "more" (three-dot) overflow button; current = two inline icon buttons (Edit pencil → Sheet, Delete trash → `confirm()`).**
   A `dropdown-menu.tsx` primitive exists, so an overflow menu is *possible*, but converting would touch the controlled edit-Sheet open flow and delete confirmation — an **interaction change with real regression surface** on a CRUD page. **DECISION: keep the two inline icon buttons**, restyled only. The single-button overflow affordance is explicitly deferred (see Out of Scope). This follows Stage 3's "styling substitutions preferred over structural rewrites" scoping.

Everything else (header eyebrow, pill button, card/table chrome, uppercase column labels, row typography, hover) is a **pure class substitution** achievable without touching handlers, state, or `actions.ts`.

## Architecture Decisions

- **`actions.ts` is NOT touched.** All server logic (Zod validation, `parseMasterAssignments`, create/update/delete, `revalidatePath`) stays byte-for-byte identical. Every changed line must trace to visual styling only.
- **`page.tsx` stays unchanged.** It's a Server Component that only renders `<ServicesClient>`; it uses no `<Button>`, so the Stage-2 `buttonVariants()` server-boundary regression cannot occur here. Do **not** introduce any button/`buttonVariants()` call into `page.tsx`.
- **All restyle work lives in `ServicesClient.tsx`** (a `"use client"` component — the `buttonVariants()` hazard does not apply to client components), plus optional light polish in `ServiceForm.tsx`.
- **Header pattern matches Stage 2 (dashboard).** Drop the redundant `<h1>Services</h1>` (the page title already comes from `AdminTopBar` via `getPageTitle`, confirmed for `/admin/services`) and use the mockup's eyebrow + subtitle: an uppercase primary "Manage" label over a muted "Procedures, prices and durations" subtitle — mirroring `admin/page.tsx`'s "Overview" eyebrow (lines 65-70).
- **Card/table chrome:** wrap the table in the established card treatment — `rounded-[20px]` (per convention; cards favor 20px, ~mockup's 16), `bg-card`, `border border-border`, `shadow-sm`, `overflow-hidden`. Pills/buttons stay `rounded-full` (Button default already is).
- **Tenant-safety:** this page has **no** tenant-color-dependent per-row rendering (no category colors, no master-color badges — masters appear by name only), so the calendar stage's "don't collapse distinct tones" rule has nothing to guard here. Restyled elements use the tenant-customizable semantic layer (`bg-card`, `bg-muted`, `text-muted-foreground`, `text-foreground`, Button `default`/`ghost`, `Badge variant="muted"`) — all correct and tenant-safe. Do **not** introduce a raw `--md-*-container` fixed tone here; none is needed (the only fixed-tone element, the status pill, is deferred).
- **No new shared component.** `StatCard`/`AppointmentStatusBadge` are not a fit (no stats, no appointment status). A `ServiceCard` is not warranted — the mockup uses a table, not a card grid. Reuse the existing `Badge` (`variant="muted"`) for the Special-Prices chips if that option is taken.
- **No emoji; icons via `lucide-react`.** Mockup column headers are icon-free — the current `Clock`/`DollarSign` header icons will be removed to match, which frees those imports (must be dropped from the import to satisfy zero-warning lint).

## Implementation Steps

Ordered lowest-risk / most-isolated first. All line numbers reference the current `src/app/admin/services/ServicesClient.tsx` unless noted.

- [x] **Step 1: Header block — eyebrow + subtitle + pill button** (`ServicesClient.tsx` lines 52-78)
  - Files: `src/app/admin/services/ServicesClient.tsx`
  - Details: Replace the `<div>` at lines 53-58 (the `<h1>Services</h1>` + `{services.length} service…` `<p>`) with the mockup header pattern:
    - Eyebrow: `<p className="text-xs font-medium uppercase tracking-wider text-primary">Manage</p>` (mockup uses `t.primary`, uppercase, `.05em` tracking).
    - Subtitle below it: `<p className="mt-1 text-sm text-muted-foreground">Procedures, prices and durations</p>` (verbatim mockup copy).
    - The standalone service-count line is dropped (not in mockup; redundant). If retention is desired it may be appended to the subtitle, but default is to match the mockup.
  - For the Add button (lines 61-68): keep the `Sheet`/`SheetTrigger` wiring untouched; change the label text `Add Service` → `Add service` (mockup casing) and grow the pill to the mockup's proportions via `className="h-10 gap-2 px-5"` on the `<Button size="sm">` (drop `size="sm"`, let it default). Button `default` variant is already `rounded-full bg-primary text-primary-foreground` — no variant change needed. Keep the `<Plus className="h-4 w-4" />` icon.

- [x] **Step 2: Table container + header row chrome** (lines 89-107)
  - Files: `src/app/admin/services/ServicesClient.tsx`
  - Details:
    - Container `<div>` (line 89): `rounded-xl border border-border overflow-hidden` → `rounded-[20px] border border-border bg-card shadow-sm overflow-hidden` (mockup: card bg + border + radius + shadow).
    - `<thead>` (line 91): keep `bg-muted/50 text-muted-foreground` (tenant-safe; ~mockup `t.surface`).
    - Each `<th>` (lines 93-105): make labels uppercase micro-caps to match mockup — `className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"`. Right-align the last (actions) header as now.
    - Remove the `Clock` icon span from the Duration header (lines 94-98) and the `DollarSign` icon span from the Price header (lines 99-103) — mockup headers are plain text. Headers become plain `Duration` / `Price`.
    - Keep the 5 headers as: `Name`, `Duration`, `Price`, `Special Prices`, and an empty actions header (mockup order is Service/Duration/Price/Status/blank — "Special Prices" occupies the Status slot).
    - **Lint follow-through:** `Clock` and `DollarSign` (imported line 4) are now unused → remove them from the `lucide-react` import to keep `npm run lint` (zero-warning) green.

- [x] **Step 3: Row cell typography + hover** (lines 109-117)
  - Files: `src/app/admin/services/ServicesClient.tsx`
  - Details, per `<tr>`/`<td>` (no handler/data changes):
    - `<tr>` (line 110): `bg-background hover:bg-muted/30` → `hover:bg-muted/40` (mockup hover = surface tint; drop the explicit `bg-background` so rows sit on `bg-card`).
    - Name cell (line 111): keep `px-4 py-3 font-medium` (foreground); fine as-is.
    - Duration cell (lines 112-114): keep `text-muted-foreground`, ensure `text-[13px]`/`text-sm`; keep `{svc.duration} min`.
    - Price cell (lines 115-117): change `text-muted-foreground` → `font-medium text-foreground` (mockup emphasizes price in `t.text` medium); keep `{svc.price.toFixed(2)} zł`.

- [x] **Step 4: Special Prices cell restyle** (lines 118-132)
  - Files: `src/app/admin/services/ServicesClient.tsx`
  - Details: Keep the exact same data logic (`masterServices.filter(priceOverride !== null)…`, `masterNameByProfileId`). Restyle presentation only. Preferred: render each override as a small muted chip using the existing `Badge` — `<Badge variant="muted" className="text-[11px]">{name}: {price} zł</Badge>` inside a `flex flex-wrap gap-1` container (import `Badge` from `@/components/ui/badge`). Acceptable fallback: keep the current muted text list, just ensuring `text-xs text-muted-foreground`. Keep the `—` em-dash for the empty case.

- [x] **Step 5: Row action buttons restyle** (lines 133-185)
  - Files: `src/app/admin/services/ServicesClient.tsx`
  - Details: **Do not change any handler, the edit-`Sheet` control state (`editOpen`/`editTarget`), or the delete `confirm()` flow.** Restyle only:
    - Keep the Edit button as `variant="ghost" size="icon-sm"` with `<Pencil className="h-3.5 w-3.5" />` (lines 145-154).
    - Keep the Delete button as `variant="ghost" size="icon-sm" className="hover:text-destructive"` with `<Trash2 className="h-3.5 w-3.5" />` (lines 177-184). `text-destructive` is the correct tenant-customizable destructive key — keep it.
    - Keep the `flex items-center justify-end gap-1` wrapper (line 134). Optional: bump `gap-1` → `gap-0.5` for a tighter pair. This preserves both affordances and all wiring; the mockup's single overflow button is intentionally not reproduced (see Out of Scope).

- [x] **Step 6: Empty-state restyle** (lines 81-87) — radius bump applied; optional `Scissors` icon skipped (low-priority polish, kept minimal per plan)
  - Files: `src/app/admin/services/ServicesClient.tsx`
  - Details: Keep the conditional and copy. Update the container radius `rounded-xl` → `rounded-[20px]` to match the card treatment. Optional (low priority) polish: add a tonal `Scissors` icon (the Services nav icon) above the text — `<Scissors className="mb-3 h-8 w-8 text-muted-foreground/60" />` (import `Scissors` from `lucide-react`). Keep the two `<p>` lines. If the icon is added, ensure the import is actually used (no unused-import warning).

- [x] **Step 7 (optional, light): ServiceForm polish** (`ServiceForm.tsx`) — applied: `rounded-md` → `rounded-xl` on master-assignment wrapper (line 136); no other changes, logic untouched
  - Files: `src/app/admin/services/ServiceForm.tsx`
  - Details: The form lives inside a `Sheet` and is not depicted in the mockup, so keep changes minimal and **do not alter form logic** (checkbox toggle state, `existingAssignments`, `useFormState`, per-master price inputs). Inputs/labels already use the globally-restyled shadcn `Input`/`Label`. Only optional touch: bump the master-assignment list wrapper `rounded-md` (line 136) → `rounded-xl` for card-consistency. If nothing needs changing to match global styling, leave this file untouched and note so.

- [ ] **Step 8: Verify & hand off**
  - Files: (none — verification only)
  - Details: Run the automated gates below; then produce the manual browser checklist for the user (CRUD must work end-to-end).

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` passes with the same baseline (55 errors/5 warnings, 60 problems, identical before and after these changes — no new issues; no unused `Clock`/`DollarSign` imports left behind; `Badge` is used). Note: the project-wide "zero warnings" lint target is not currently met by the repo baseline (pre-existing, unrelated files); this stage introduced zero net-new problems.
- [x] `npm run build` succeeds.
- [x] Existing test suite unaffected — no service-page component tests exist; the only related test is `tests/app/api/procedures/route.test.ts` (public `/api/procedures` API), untouched by these presentation-only changes.
- [x] `ServicesClient.tsx` (188 lines) and `ServiceForm.tsx` (181 lines) each stay under 500 lines.
- [x] Header shows the "Manage" eyebrow + "Procedures, prices and durations" subtitle; the redundant `<h1>Services</h1>` is gone (title comes from the topbar).
- [x] Table sits in a `rounded-[20px] bg-card` bordered/shadowed card with uppercase micro-cap column headers; rows have card-consistent hover.
- [ ] Create, edit, delete, and per-master price override all still function unchanged. — requires manual in-browser verification (not run, per no-dev-server rule).
- [x] Follows project conventions (no emoji, lucide icons, tenant-safe semantic tokens, `text-destructive` for destructive, `rounded-full` pills / `rounded-[20px]` cards).

## Verification

### Automated (run after implementation)
```bash
npx tsc --noEmit
npm run lint
npm run build
```
No dev server may be started for verification (standing rule). Anything visual is deferred to the manual checklist below.

### Manual (user must confirm in-browser — flag explicitly)
Navigate to `/admin/services` (logged in as ADMIN/SUPERADMIN) and verify:
1. **Header** shows the uppercase "Manage" eyebrow (in the brand/primary color) over "Procedures, prices and durations"; no big "Services" heading duplicated below the topbar title.
2. **Table card** renders with rounded corners, card background, subtle border/shadow; column headers are small uppercase labels (Name / Duration / Price / Special Prices / actions).
3. **Add service:** the pill button opens the right-side Sheet; submitting a valid service creates it and the row appears without a full reload.
4. **Edit:** the pencil opens the Sheet pre-filled; changing values and submitting persists and the row updates.
5. **Delete:** the trash icon triggers the confirm dialog; confirming removes the row.
6. **Per-master price override:** assigning a master with a custom price in the form shows that override in the "Special Prices" cell afterwards; unchecking removes it.
7. **Empty state:** with no services, the dashed empty card renders correctly.
8. **Dark mode:** toggle the admin theme — the page, card, and pills read correctly in both light and dark.
9. **Tenant branding:** if a non-default brand color is configured in Settings, the "Add service" pill, the eyebrow, and hovers pick it up and nothing renders illegibly.

## Constraints & Risks
- **Do NOT modify `src/app/admin/services/actions.ts`** — all CRUD/validation logic stays intact. Changes to this stage are presentation-only.
- **Do NOT modify `src/app/admin/services/page.tsx`** and do NOT add any `<Button>`/`buttonVariants()` usage to it (Server Component — the Stage-2 request-time `TypeError` regression). All buttons live in the client `ServicesClient.tsx`.
- **Do NOT alter the edit-Sheet control state, the checkbox/price-override form logic, or the delete `confirm()`** — restyle classes only. Every changed line must trace to a visual requirement.
- **Deferred / out of scope (do not attempt in this stage):**
  - **Status (Active/Inactive) column** — needs a new `Service.active` DB field + migration + form control + actions + availability filtering. Architectural; separate FULL-mode task.
  - **"More" overflow dropdown menu** for row actions — an interaction change; keep the two inline icon buttons.
  - **Replacing native `confirm()` delete** with a custom dialog.
  - **Deep `ServiceForm` redesign** — the Sheet form isn't in the mockup; keep it functional with at most trivial radius polish.
  - **Client-facing booking flow** — later stage per the admin-first sequencing.
- **Lint tripwire:** removing the header icons orphans the `Clock`/`DollarSign` imports — they MUST be removed, or `npm run lint` (zero-warning) fails. Conversely, only import `Badge`/`Scissors` if actually rendered.
- **File-size limit:** keep both edited files under 500 lines (ample headroom today).

## Critical Files
- `src/app/admin/services/ServicesClient.tsx` — primary restyle target (client component).
- `src/app/admin/services/ServiceForm.tsx` — optional light polish only; logic untouched.
- `src/app/admin/services/page.tsx` — leave unchanged; no `buttonVariants()`.
- `src/app/admin/services/actions.ts` — leave unchanged; server logic.
- `Somique Beauty Design System/ui_kits/admin/index.html` — mockup reference, `ServicesPage` at lines 350-394 (theme object `AT` at 30-55, `SERVICES` data 343-348, `IC` icons 66-81).
- `src/components/ui/badge.tsx` — reuse `variant="muted"` for Special-Prices chips (and `success`/`--md-success-container` if Status is ever built later).
- `prisma/schema.prisma` — `model Service` (63-77) confirms no `active` field (basis for deferring Status).
- `src/components/admin/AGENTS.md`, `src/components/AGENTS.md` — conventions (raw `--md-*` vs semantic tokens, `buttonVariants` hazard, radius/pill rules, 500-line limit).
