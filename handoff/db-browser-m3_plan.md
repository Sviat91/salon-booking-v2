# Plan: DB Browser section (`/admin/db-browser`) — M3 (Somique) Restyle

**Date:** 2026-07-06
**Status:** Implemented, reviewed (APPROVED), gates verified by orchestrator — pending user manual browser verification

## Goal
Bring the SUPERADMIN-only raw-table inspector at `/admin/db-browser` in line with the already-shipped M3 chrome vocabulary (container radius, `divide-y` rows, micro-label table headers, `Badge` in place of the raw yellow pill) — changing only presentation className strings plus one `<span>`→`<Badge>` swap, while leaving 100% of the delete mutation, fetch/pagination logic, and the SUPERADMIN guard byte-for-byte untouched.

## Structural Assessment (read first — honest fit analysis)

**Verified against the live files (not re-derived).** `page.tsx` is 9 lines (SUPERADMIN guard + renders `<DbBrowserClient />`, no wrapping chrome). `DbBrowserClient.tsx` is 241 lines and matches the summary in the task. Line numbers below are the current ones from the live file.

**This is a small, bounded, chrome-only cleanup — the task author's expectation is correct.** There is no layout restructure, no eyebrow to add, no logic to touch. Five surgical className/JSX edits (plus one import line) fully close the gap. The two-pane dense-inspector shape (left `w-44` table selector + right dense `text-xs` scrollable table) is appropriate to the tool's purpose and is deliberately preserved. It must NOT be forced into the Masters single-column card stack, and no extra whitespace may be added that would hurt the information density this dev tool needs.

**No mockup exists** for this section — confirmed in prior stages: `Somique Beauty Design System/ui_kits/admin/` holds only `AdminSidebar.jsx`, `CalendarPage.jsx`, `DashboardPage.jsx`, `MastersPage.jsx`. This stage applies only the already-established Services/Masters/Database chrome; it invents nothing.

**Topbar already supplies the page title.** `superadminNavItems` (`adminNavItems.ts:80-84`) has `{ label: "DB Browser", href: "/admin/db-browser" }`, non-`exact`. Walking `getPageTitle` → `isNavItemActive` for `/admin/db-browser`, no earlier item is a prefix (crucially `/admin/database` does NOT prefix `/admin/db-browser`), so it resolves to **"DB Browser"**. Therefore **do NOT add an eyebrow header** — there is no page-level `<h1>` to replace here (unlike Admins/Settings/Database), and the existing in-component `<h2 className="text-base font-semibold">{selectedTable}</h2>` (line 122) + `{data.total} rows total` subtitle (line 124) is a *contextual table label*, not a duplicate of the "DB Browser" topbar title. Keep the `<h2>` and its subtitle exactly as-is.

**The true gaps (precise, with current live-file line refs):**

1. **Container radii lag the convention + outer frame missing `shadow-sm`.** Outer two-pane frame (`DbBrowserClient.tsx:92`) is `rounded-xl border border-border bg-card overflow-hidden` — established list-container chrome is `rounded-[20px] … shadow-sm` (canonical `ServicesClient.tsx:88`). Inner table wrapper (`DbBrowserClient.tsx:153`) is `rounded-lg border border-border overflow-auto` → should be `rounded-[20px]`.

2. **Raw hardcoded-yellow "SUPERADMIN only" pill.** `DbBrowserClient.tsx:127-129` — `<span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">`. Prior stages replaced binary/status `<span>`s with the shared `Badge`. A `warning` variant **exists** in `src/components/ui/badge.tsx:17` (`bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)]`) and is the correct semantic "caution" tone — reuse it (`<Badge variant="warning">`). **No new Badge variant is invented; `badge.tsx` is NOT edited.**

3. **Zebra striping instead of `divide-y` + hover.** `DbBrowserClient.tsx:172` — `<tr className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>` with a bare `<tbody>` (line 170). Established table body (`ServicesClient.tsx:99-101`) is `<tbody className="divide-y divide-border">` + `<tr className="hover:bg-muted/40 transition-colors">` — no zebra.

4. **Table `<th>`s not in micro-label style.** `DbBrowserClient.tsx:158-167` — `px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap`. Established micro-label (`ServicesClient.tsx:92`) is `text-[11px] font-medium uppercase tracking-wider text-muted-foreground`. Keep the compact `px-3 py-2` padding and `whitespace-nowrap` (density is intentional for this dense tool); only add `text-[11px] uppercase tracking-wider` typography. **See the `uppercase` tradeoff note in Architecture Decisions — column names here are raw camelCase Prisma field names, not curated labels.**

**Deliberate NON-changes (documented so the reviewer does not flag their absence):**
- **No eyebrow header added.** No page-level `<h1>` exists to replace; topbar already reads "DB Browser". The in-component `<h2>{selectedTable}</h2>` + row-count subtitle stays.
- **Two-pane layout, left `w-44` selector sidebar, and dense `text-xs` table are preserved.** This is a data-inspector, not a business-entity card list. Do not add whitespace or convert to card stacks.
- **Left sidebar chrome untouched** — `aside w-44 … bg-muted/30` (line 95), the "Tables" label `text-xs font-semibold uppercase … tracking-wide` (line 97), and the selector buttons `bg-primary/10 text-primary` active state (lines 104-108). These are token-clean; the sidebar label's `font-semibold`/`tracking-wide` differs trivially from the `font-medium`/`tracking-wider` micro-label spec, but touching it would be manufacturing scope beyond the four stated gaps — leave it.
- **Error alert box untouched** — `DbBrowserClient.tsx:135` `rounded-lg border border-destructive/30 bg-destructive/10 … text-destructive`. This is a small inline alert (not the big list container), already uses semantic `destructive` tokens with no raw colors; its `rounded-lg` is appropriate for a compact callout. Not a gap.
- **Loading / empty-state / pagination blocks untouched** — all token-clean (`text-muted-foreground`, `Button variant="outline"`, `ChevronLeft/Right`).
- **`<thead>` kept as `bg-muted/50 border-b border-border sticky top-0`** (line 155) — the `sticky top-0` + `border-b` are functional for this scrollable dense table (established thead is `bg-muted/50 text-muted-foreground`; the muted color is already carried on each `<th>`). Only the `<th>` typography changes.

## Security / mutation safety (CRITICAL — the restyle must not touch any of this)

This is the **most mutation-risky page restyled in this pass** — a raw `DELETE` by row id against any Prisma table, including `user`, `account`, and `tenantConfig`. Treat every interactive/data-flow line as radioactive.

- **SUPERADMIN-only guard** lives entirely in `page.tsx:7` (`session.user.role !== "SUPERADMIN" → redirect("/admin")`). `page.tsx` renders zero chrome — **do NOT touch it at all.**
- **`handleDelete` (lines 65-86)** — the `typeof id !== "string"` guard, the `confirm(\`Delete row with id="${id}" from "${selectedTable}"? This cannot be undone.\`)` copy (line 67), the `DELETE /api/admin/db-browser/${selectedTable}` fetch with `{ id }` body (lines 70-74), `setDeletingId`, and the `fetchData` re-fetch on success — **byte-for-byte unchanged.**
- **`fetchData` (lines 38-53)**, **`handleTableSelect` (lines 59-63)**, and the **`useEffect` (lines 55-57)** — unchanged.
- **`TABLES` array (lines 7-19)**, the `selectedTable`/`page`/`data`/`loading`/`error`/`deletingId` state (lines 31-36), and the pagination math (`totalPages` line 88, `columns` line 89, `setPage` handlers lines 217/229) — unchanged.
- The delete `<Button>` wiring (lines 192-201): its `disabled={deletingId === String(row["id"])}` and `onClick={() => handleDelete(row["id"])}` are **not touched** (only its parent `<tr>` className changes).
- The API route under `src/app/api/admin/db-browser/**` is the mutation contract only — **not edited.**

## Architecture Decisions

- **Only presentation changes.** No handler, `fetch`, `useState`/`useCallback`/`useEffect`, `confirm`, `TABLES`, pagination math, or `page.tsx` may change. Every changed line traces to a className-string swap, one `<span>`→`<Badge>` swap, or the single `Badge` import.
- **Reference convention is `ServicesClient.tsx`** (the canonical dense-table chrome cited in the task brief) and `src/app/admin/AGENTS.md` (the codified chrome contract). Reuse its exact class fragments (`rounded-[20px] … shadow-sm`, `divide-y divide-border`, `hover:bg-muted/40 transition-colors`, `text-[11px] font-medium uppercase tracking-wider text-muted-foreground`). Invent no new spacing/radius/color values.
- **Badge for the caution pill = `variant="warning"`.** It is the existing semantic "caution" variant; it maps to the theme's `--md-tertiary-container` tokens. **Note:** the rendered hue is theme-driven (it may not be literally amber like the old hardcoded `yellow-500`), but replacing a hardcoded raw color with the design-system's semantic warning token IS the point of this fix. Do NOT add a `className` to the Badge to force a yellow tone — that would defeat the tokenization.
- **`uppercase` on table headers — documented tradeoff, decision made:** the column headers here are **raw camelCase Prisma field names** (`id`, `masterProfileId`, `emailVerified`, `passwordHash`), not curated human labels like Services' "Name"/"Duration". CSS `uppercase` renders `masterProfileId` → `MASTERPROFILEID`, losing the camelCase word boundaries. **Decision:** apply the full micro-label style *including* `uppercase` to match the established convention exactly (this is literally stated gap #4, and visual cohesion of the table header is the goal). **Fallback (only if the user finds `MASTERPROFILEID`-style headers hard to read during manual verification):** drop `uppercase` alone, keeping `text-[11px] font-medium tracking-wider text-muted-foreground`. Do not preemptively apply the fallback — implement with `uppercase` and surface this tradeoff in the manual checklist.
- **Nested radius (inner table wrapper):** per gap #1 the inner wrapper goes `rounded-lg` → `rounded-[20px]`. It stays `border border-border overflow-auto` with **no** added `bg-card`/`shadow-sm` — it is nested inside the already-`bg-card`/`shadow-sm` outer frame, and adding a second shadow would double up. (Concentric-radius purists might prefer a slightly smaller inner radius, but matching `rounded-[20px]` satisfies the stated gap and keeps the coder's instruction unambiguous.)
- **`page.tsx` (9 lines) is not edited** — it holds the entire SUPERADMIN guard and renders no chrome.
- **File size:** `DbBrowserClient.tsx` is 241 lines; edits are net +1 line (the Badge import). Stays far under the 500-line limit. No split needed.

## Implementation Steps
All edits are in `src/app/admin/db-browser/DbBrowserClient.tsx`. Ordered lowest-risk first. Line numbers reference the current live file. No handler / `fetch` / state / `confirm` / `TABLES` / pagination / `page.tsx` may change.

- [x] **Step 1: Add `Badge` import + swap the "SUPERADMIN only" pill** (smallest, fully precedented)
  - Files: `src/app/admin/db-browser/DbBrowserClient.tsx`
  - Details:
    - After the `Button` import (line 4), add: `import { Badge } from "@/components/ui/badge"`.
    - Lines 127-129: replace the raw `<span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">SUPERADMIN only</span>` with `<Badge variant="warning">SUPERADMIN only</Badge>`. Do NOT add any `className` to the Badge — its base variant already supplies `rounded-full px-2 py-0.5 text-xs font-medium`.
    - **Do NOT touch** the surrounding header `<div>` (lines 120-126), the `<h2>{selectedTable}</h2>`, or the `{data.total} rows total` subtitle.

- [x] **Step 2: Container radii + outer-frame shadow**
  - Files: `src/app/admin/db-browser/DbBrowserClient.tsx`
  - Details:
    - Line 92 (outer two-pane frame): `className="rounded-xl border border-border bg-card overflow-hidden"` → `className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden"`. **Keep the `style={{ minHeight: "calc(100vh - 10rem)" }}` attribute exactly as-is** (functional).
    - Line 153 (inner table wrapper): `className="rounded-lg border border-border overflow-auto"` → `className="rounded-[20px] border border-border overflow-auto"`. Do not add `bg-card`/`shadow-sm`.

- [x] **Step 3: Table header `<th>` micro-label typography**
  - Files: `src/app/admin/db-browser/DbBrowserClient.tsx`
  - Details:
    - Lines 158-161 (column headers, inside the `columns.map`): `className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"` → `className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap"`.
    - Lines 165-167 (the "Actions" header): `className="px-3 py-2 text-left font-medium text-muted-foreground"` → `className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"`.
    - Keep `<thead className="bg-muted/50 border-b border-border sticky top-0">` (line 155) unchanged — `sticky top-0` is functional.

- [x] **Step 4: Zebra striping → `divide-y` + hover**
  - Files: `src/app/admin/db-browser/DbBrowserClient.tsx`
  - Details:
    - Line 170: `<tbody>` → `<tbody className="divide-y divide-border">`.
    - Line 172: `<tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>` → `<tr key={i} className="hover:bg-muted/40 transition-colors">`. **Keep `key={i}` exactly** — `i` is still consumed by the key, so no unused-variable lint issue is introduced.
    - **Do NOT touch** the `<td>` cells inside the row (the value-formatting logic lines 173-190, the truncation classes `px-3 py-1.5 max-w-[180px] truncate …`, or the delete `<Button>` lines 191-202).

- [x] **Step 5: DOX pass + verify + hand off**
  - Files: (checks only) — optionally `src/app/admin/AGENTS.md`
  - Details:
    - **DOX pass:** if `src/app/admin/AGENTS.md` enumerates the surfaces sharing the card/table chrome, a one-word addition of "DB Browser" keeps the index accurate — do this only if it reads cleanly and changes no behavior. No new child AGENTS.md is warranted (the db-browser folder is not a new durable boundary).
    - Run the automated gates (below). All edits are className-only + one import, so lint must stay net-neutral (the added `Badge` import is used; no vars removed). Do NOT start a dev server.
    - Produce the manual browser checklist for the user, explicitly surfacing the `uppercase` header tradeoff (Step 3) so the user can confirm the raw camelCase field names read acceptably.

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` introduces zero net-new problems vs. baseline (className-only + one used import; `key={i}` retained so `i` stays referenced). Confirmed: none of the 60 pre-existing lint problems touch `DbBrowserClient.tsx` or `AGENTS.md`.
- [x] `npm run build` succeeds.
- [x] `npm run test` shows no new failures vs. baseline (presentation-only; no db-browser component tests exist). Confirmed identical counts (107 failed / 50 passed, 19 failed / 7 passed files) with the change stashed vs. applied — all failures are pre-existing `tests/app/api/support/contact.test.ts` etc., unrelated to this change.
- [x] Outer two-pane frame is `rounded-[20px] … shadow-sm`; inner table wrapper is `rounded-[20px]`; no `rounded-xl`/`rounded-lg` remains on those two containers.
- [x] The "SUPERADMIN only" pill renders via `<Badge variant="warning">` — no raw `yellow-*` classes remain; `badge.tsx` is unmodified.
- [x] Table rows use `<tbody className="divide-y divide-border">` + `<tr className="hover:bg-muted/40 transition-colors">`; the `i % 2 === 0 ? …` zebra expression is gone; `key={i}` is retained.
- [x] Table `<th>`s use `text-[11px] font-medium uppercase tracking-wider text-muted-foreground` (compact `px-3 py-2` padding preserved).
- [x] The two-pane layout, `w-44` selector sidebar, dense `text-xs` table, `<h2>{selectedTable}</h2>` header, error box, loading/empty states, and pagination are visually unchanged.
- [x] `page.tsx`, `handleDelete` + its `confirm(...)`, the `DELETE` fetch, `fetchData`, `handleTableSelect`, all `useState/useCallback/useEffect`, `TABLES`, and pagination math are byte-for-byte unchanged.
- [x] No emoji; no new invented design elements; no eyebrow header added; file < 500 lines (241 lines).

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
Log in as **SUPERADMIN** and visit `/admin/db-browser`:
1. **Topbar:** reads "DB Browser". No eyebrow/extra heading was added; the right pane still shows the selected table name (`user` by default) with the "N rows total" subtitle.
2. **Frame:** the whole two-pane inspector sits in a `rounded-[20px]` card with a soft shadow; the inner data table wrapper is also `rounded-[20px]`. No sharp/small-radius corners on the two containers.
3. **"SUPERADMIN only" pill:** now renders as the design-system `warning` Badge (theme tertiary-container tone) instead of the old hardcoded yellow. **Confirm the tone reads as an intentional caution accent in both light and dark themes** (its exact hue is theme-driven, not necessarily amber).
4. **Table rows:** no more zebra striping — rows are separated by hairline dividers and highlight on hover. Cell values still truncate with a hover tooltip; the delete trash icon still sits in the last column.
5. **Table headers (tradeoff check):** column headers are now uppercase micro-labels. Because these are raw Prisma field names, some read as run-together caps (e.g. `MASTERPROFILEID`). **Confirm this is acceptable.** If it hurts readability, the fallback is to drop only the `uppercase` class (keeping the size/tracking) — report back and it can be adjusted.
6. **Dark theme:** toggle admin dark theme and confirm the frame, warning Badge, header micro-labels, and hover rows all read correctly.
7. **Delete flow (unchanged — verify still intact):** click the trash icon on a low-stakes row; confirm the exact `Delete row with id="…" from "…"? This cannot be undone.` prompt still appears, cancel it, and confirm nothing was deleted. (Do NOT actually delete a `user`/`account`/`tenantConfig` row during verification.)
8. **Pagination + table switching (unchanged):** switch between tables in the left sidebar and page Prev/Next; confirm counts and rows load as before.
9. **Access control (unchanged):** log in as a plain **ADMIN** and confirm `/admin/db-browser` redirects to `/admin` (SUPERADMIN-only guard intact).

## Constraints & Risks
- **Highest mutation-risk surface in this pass** (raw `DELETE` by id against any table incl. `user`/`account`/`tenantConfig`): do NOT alter `page.tsx`'s role guard, `handleDelete`, its `confirm(...)` copy, the `DELETE` fetch, `fetchData`/`handleTableSelect`, any `useState/useCallback/useEffect`, `TABLES`, or the pagination math. Restyle chrome only.
- **No mockup exists** — apply only the shipped Services/Masters/Database dense-table language; invent no colors, spacing, icons, or new elements. Do NOT add an eyebrow header (topbar already supplies "DB Browser"; there is no page-level `<h1>` to replace).
- **Do NOT restructure the two-pane / dense-table layout** or add whitespace that reduces information density — the compact `text-xs` inspector shape is intentional for this dev tool.
- **`src/components/ui/badge.tsx` is NOT edited** — reuse the existing `warning` variant; do not add or modify variants.
- **API route** under `src/app/api/admin/db-browser/**` is the mutation contract only — not edited.
- **Zero-warning lint:** all edits are className swaps + one used `Badge` import; `key={i}` is retained so `i` stays referenced. Lint stays net-neutral.
- **Files changed (1 total):** `src/app/admin/db-browser/DbBrowserClient.tsx` (+ optional one-line note in `src/app/admin/AGENTS.md`). `page.tsx` is not edited.

## Critical Files
- `src/app/admin/db-browser/page.tsx` (9) — SUPERADMIN guard (`role !== "SUPERADMIN" → redirect("/admin")`); renders `<DbBrowserClient />`, no chrome. **Not edited.**
- `src/app/admin/db-browser/DbBrowserClient.tsx` (241) — all five edits: Badge import + pill swap (Step 1), container radii/shadow (Step 2), th micro-labels (Step 3), zebra→divide-y (Step 4). All fetch/delete/pagination/state logic untouched.
- `src/app/admin/services/ServicesClient.tsx` (187) — canonical dense-table chrome reference (`rounded-[20px] … shadow-sm` line 88, `divide-y divide-border` line 99, `hover:bg-muted/40 transition-colors` line 101, `text-[11px] … uppercase tracking-wider` line 92).
- `src/components/ui/badge.tsx` (41) — the `warning` variant (line 17) reused for the caution pill; **not edited.**
- `src/components/admin/adminNavItems.ts` (lines 80-84, 112-122) — `superadminNavItems` "DB Browser" title resolution (why no eyebrow is added); not edited.
- `src/app/api/admin/db-browser/**` — the browse/delete API contract; not edited.
- `src/app/admin/AGENTS.md` — SUPERADMIN/chrome rules; optional one-line index note in Step 5.
