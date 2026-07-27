# Plan: Admin-managed content pages for a specific master

**Date:** 2026-07-27
**Status:** In Progress

## Goal

Let a SUPERADMIN/ADMIN create, edit, reorder, enable/disable and block-edit the content pages of **any** master, via new routes `/admin/masters/[masterId]/pages` and `/admin/masters/[masterId]/pages/[id]`, reusing the existing `PageListClient` / `PageFormSheet` / `PageBlocksEditor` components and the existing server actions (no forked components, no forked actions, no Prisma migration).

## Architecture Decisions

### AD-A — No schema change (verified)

`prisma/schema.prisma:319-338` — `Page` is keyed by `(ownerType, masterId, slug)` with `masterId String?` + `master User? @relation(... onDelete: Cascade)`. A master-owned page created by an admin is byte-identical to one created by the master. **No migration.** Do not touch `prisma/`.

### AD-B — Two authorization primitives replace `resolvePageOwner`

`resolvePageOwner(user)` (`src/lib/content/pages-server.ts:18-29`) is a hard binary branch on the session's own role/id and cannot express "admin acting on master X". It is used in exactly 6 places, all inside `src/app/admin/pages/actions.ts` and `src/app/admin/pages/block-actions.ts` (verified by grep — no other importers, no test importers). It gets **deleted** and replaced by two primitives:

1. **`canManagePage(user, page)` — sync, pure, no DB.** For every action that targets an *existing row* (update / delete / toggle / all four block actions / reorderBlocks). The row itself carries its owner, so nothing has to be supplied by the client at all — the session is authorized *against the row's real owner*. This is strictly safer than the current code (no client-supplied scope in the loop) and it removes the parameter-threading from 7 of the 9 actions.
2. **`authorizePageOwner(user, requested)` — async (one `prisma.user` role lookup).** Only for the two actions that have no row to derive a scope from: `createPage` (must be told where to create) and `reorderPages` (must be told which scope's id-set to compare against). The client sends a **requested** scope; the server returns the **authorized** scope or `null`. AD-5 is preserved in spirit: the requested scope is *authorized*, never *trusted*.

Authorization matrix (must be implemented exactly):

| session role | requested `{global,null}` | requested `{master, X}` |
| --- | --- | --- |
| none / CLIENT | ✗ | ✗ |
| MASTER | ✗ | ✓ **only** if `user.id === X` |
| ADMIN / SUPERADMIN | ✓ | ✓ only if user `X` exists **and** `X.role === 'MASTER'` |

`canManagePage(user, page)`:
- ADMIN/SUPERADMIN → `true` (this is the one deliberate widening: admins may now manage master-owned rows too — that IS the feature).
- MASTER → `true` only when `page.ownerType === 'master' && page.masterId === user.id` (**unchanged** from today).
- anything else → `false`.

**Why this is fail-closed** (the explicit requirement): the requested-scope parameter is a **required, typed** parameter on `createPage`/`reorderPages`, not an optional one with a session-derived default. A dropped/forgotten argument is a `tsc` error, not a silent `ownerType:'global'` write. There is no fallback branch anywhere: an unauthorized combination returns `null` → `errors.UNAUTHORIZED`. And `reorderPages` keeps its existing "submitted id set must exactly equal the scope's id set" guard, so even a *wrong* (but authorized) scope throws instead of reordering.

### AD-C — One `PageOwner` type, moved to the client-safe module

`PageOwner` (`{ownerType:'global'; masterId:null} | {ownerType:'master'; masterId:string}`) moves from `pages-server.ts` to `pages-shared.ts` (framework-free, already the client/server-shared module) so client components can import the type without reaching a module that imports Prisma. One type serves as both the query scope for `listPagesForOwner` (call sites already pass exactly this literal) and the requested scope for the two actions. The discriminated union makes `{ownerType:'master'}` without a `masterId` a compile error.

### AD-D — `scope` prop gets a third value; `owner` prop is the security payload

`PageListClient`/`PageFormSheet` get **two** new-ish props with strictly separated jobs:
- `owner: PageOwner` — forwarded verbatim to `createPage`/`reorderPages`. Security-relevant.
- `scope: "global" | "master" | "master-as-admin"` — **UI copy only** (header eyebrow/description). Never used for authorization.

A third `scope` value is genuinely needed: the existing `master` copy is first-person ("Moje strony" / "Create and manage **your own** content pages"), which is wrong when an admin is looking at someone else's pages. The `scope === "global"` conditionals (visibility column in the table, visibility card field, visibility fieldset in the form) stay **untouched** and remain correct — `master-as-admin` is not `global`, and master-owned pages have no `visibility` (`createPage` writes `visibility: null` for them).

### AD-E — MastersClient entry point is navigation, not a second editor (C-2)

C-2 ("exactly one entry point per row", `PageListClient.tsx:98-101`) governs *editing that row's record*. The Pencil→`Sheet` remains the sole editor of the `User`/`MasterProfile` record; the new `FileText` icon navigates to a **different resource** (that master's `Page` rows) on a different route. That is the same reasoning the existing comment uses to exempt Delete and the drag handle ("a separate destructive action … neither counts as a second entry point"). Verdict: **acceptable**, add it. Placement: between Pencil and Trash so the Pencil keeps its position and the destructive action stays last.

### AD-F — Explicitly out of scope

- **Footer block on the new route.** `MasterFooterBlockSection` writes via `saveMasterFooterBlock`, which is MASTER-session-only by design. Admins already edit the same `MasterProfile.footerBlock` through `MasterForm` → `MasterFooterBlockField` in the masters edit sheet. Do **not** render `MasterFooterBlockSection` on the new route and do **not** widen `saveMasterFooterBlock`.
- **Sidebar nav item.** The new route is reached from the masters list, not the sidebar. Do not touch `adminNavItems.ts`. (Side effect, verified & accepted: `isNavItemActive` uses `startsWith`, so `/admin/masters/<id>/pages` keeps the **Masters** nav item highlighted and the topbar title "Specjaliści"; `/admin/pages` does not match. Correct behaviour — it is a sub-route of Masters.)
- **`src/middleware.ts`.** It already blocks CLIENT/anonymous on `/admin/*` but does **not** block MASTER from `/admin/masters/*`; per `src/app/admin/AGENTS.md` line 13 the page-level `auth()` guard is mandatory and is what actually protects this route. Do not add a middleware rule.

## Implementation Steps

- [x] **Step 1: Move `PageOwner` into the client-safe shared module**
  - Files: `src/lib/content/pages-shared.ts`
  - Details: append the exported type (keep the file's "no React, no Prisma" contract):
    ```ts
    /**
     * The owner scope a set of pages belongs to: the query scope for
     * `listPagesForOwner`, and the scope a client surface *requests* from
     * `createPage`/`reorderPages`. A requested scope is authorized against the
     * session server-side by `authorizePageOwner` (AD-5) — never trusted as-is.
     */
    export type PageOwner =
      | { ownerType: 'global'; masterId: null }
      | { ownerType: 'master'; masterId: string }
    ```
  - Do not re-export it from `pages-server.ts` (grep-verified: nothing outside `pages-server.ts` imports it today).

- [x] **Step 2: Replace `resolvePageOwner` with the two authorization primitives**
  - Files: `src/lib/content/pages-server.ts`
  - Details:
    - Delete the local `PageOwner` declaration (lines 9-11) and the whole `resolvePageOwner` function + its doc comment (lines 13-29).
    - Extend the existing shared-module import to `import { parseVisibility, type NavPage, type PageOwner } from './pages-shared'`.
    - Add, with doc comments explaining the AD-5 reasoning above:
    ```ts
    export function canManagePage(
      user: { id?: string; role?: string } | null | undefined,
      page: { ownerType: string; masterId: string | null }
    ): boolean

    export async function authorizePageOwner(
      user: { id?: string; role?: string } | null | undefined,
      requested: PageOwner
    ): Promise<PageOwner | null>
    ```
    - `canManagePage`: `false` when `!user`; `true` for `ADMIN`/`SUPERADMIN`; for `MASTER` `true` only when `!!user.id && page.ownerType === 'master' && page.masterId === user.id`; `false` otherwise.
    - `authorizePageOwner`: `null` when `!user`. `requested.ownerType === 'global'` → return `{ ownerType: 'global', masterId: null }` for ADMIN/SUPERADMIN, else `null`. `requested.ownerType === 'master'` → for `MASTER`, return the master scope only when `user.id === requested.masterId`, else `null`; for ADMIN/SUPERADMIN, `await prisma.user.findUnique({ where: { id: requested.masterId }, select: { role: true } })` and return the master scope only when `target?.role === 'MASTER'`, else `null`; any other role → `null`.
    - Return **freshly constructed** objects (never the caller's `requested` object) so the return value is provably the authorized scope.
    - `generateUniqueSlug`, `getNavPages`, `getPageWithBlocks`, `listPagesForOwner`, `getMasterFooterSlot` are unchanged.

- [x] **Step 3: Rewire the page CRUD actions**
  - Files: `src/app/admin/pages/actions.ts`
  - Details:
    - Imports: `import { authorizePageOwner, canManagePage, generateUniqueSlug } from "@/lib/content/pages-server"`; add `type PageOwner` to the existing `@/lib/content/pages-shared` import.
    - `revalidateAll()` — add the two new dynamic route patterns (second arg `"page"` is required for `[param]` patterns):
      ```ts
      revalidatePath("/admin/masters/[masterId]/pages", "page")
      revalidatePath("/admin/masters/[masterId]/pages/[id]", "page")
      ```
    - `createPage` — new required leading parameter:
      ```ts
      export async function createPage(
        requestedOwner: PageOwner,
        _prev: PageFormState,
        formData: FormData
      ): Promise<PageFormState>
      ```
      Replace `const owner = resolvePageOwner(session?.user)` with `const owner = await authorizePageOwner(session?.user, requestedOwner)`; keep `if (!owner) return { error: t('errors.UNAUTHORIZED') }`. **The rest of the body is untouched** (the local is still named `owner`, so lines 78-90 and 93-104 need no edit).
    - `updatePage` — signature unchanged `(id, _prev, formData)`. Delete the `resolvePageOwner` line and the `!owner` early return; change the existing-row guard to:
      ```ts
      const existing = await prisma.page.findUnique({ where: { id } })
      if (!existing || !canManagePage(session?.user, existing)) return { error: t('errors.UNAUTHORIZED') }
      ```
      Change the visibility line (144-146) to key off the row: `existing.ownerType === "global" ? serializeVisibility(...) : existing.visibility`. Everything else unchanged (slug still never touched — AD-3).
    - `verifyPageOwnership(id)` — rewrite body to the row-based check and return just the page (its `owner` field is unused by both callers; removing it is an orphan our change creates, so remove it):
      ```ts
      const page = await prisma.page.findUnique({ where: { id } })
      if (!page || !canManagePage(session?.user, page)) throw new Error(t('errors.UNAUTHORIZED'))
      return page
      ```
    - `deletePage(id)` / `togglePageEnabled(id, enabled)` — **signatures and bodies unchanged** (they inherit the new check through `verifyPageOwnership`).
    - `reorderPages` — new required trailing parameter:
      ```ts
      export async function reorderPages(orderedIds: string[], requestedOwner: PageOwner): Promise<void>
      ```
      Replace `const owner = resolvePageOwner(session?.user)` with `const owner = await authorizePageOwner(session?.user, requestedOwner)`; keep the `if (!owner) throw` and the entire exact-id-set equality guard and transaction verbatim.
    - Keep every existing comment block (C-1/C-3/AD-3 rationale) intact; update only the AD-5 wording where it now describes authorization instead of derivation.

- [x] **Step 4: Rewire the block actions**
  - Files: `src/app/admin/pages/block-actions.ts`
  - Details:
    - Import `canManagePage` instead of `resolvePageOwner`.
    - `verifyPageOwnership(pageId)`: `const page = await prisma.page.findUnique({ where: { id: pageId } }); if (!page || !canManagePage(session?.user, page)) throw new Error(t('errors.UNAUTHORIZED')); return page`.
    - `verifyBlockOwnership(blockId)`: keep `include: { page: true }`; `if (!block || !canManagePage(session?.user, block.page)) throw new Error(t('errors.UNAUTHORIZED'))`.
    - `revalidateAll()` — add the same two `revalidatePath(..., "page")` lines as Step 3.
    - `createBlock`, `updateBlockConfig`, `deleteBlock`, `reorderBlocks` — **signatures unchanged**, no call-site changes anywhere. This is what keeps `PageBlocksEditor` reusable as-is on the new detail route.

- [x] **Step 5: Thread `owner` (+ third scope) through `PageListClient`**
  - Files: `src/components/admin/content/PageListClient.tsx`
  - Details:
    - Import `type PageOwner` from `@/lib/content/pages-shared`.
    - Props:
      ```ts
      interface PageListClientProps {
        pages: PageWithBlocks[]
        /** Authorization payload forwarded verbatim to createPage/reorderPages. */
        owner: PageOwner
        /** UI copy variant only — never used for authorization. */
        scope: "global" | "master" | "master-as-admin"
        /** Only read by the "master-as-admin" header copy. */
        masterName?: string
        enabledLocales: Language[]
        detailHrefBase: string
      }
      ```
    - `handleReorder`: `reorderPages(orderedIds, owner)`; add `owner` to the `useCallback` dependency array.
    - `handleDelete` / `handleToggle`: unchanged.
    - Header copy — replace the two `scope === "global" ? ... : ...` ternaries (lines 124-129) with a module-scope lookup so all three variants are explicit:
      ```ts
      const SCOPE_COPY = {
        global:            { eyebrow: 'admin.pages.globalEyebrow',      desc: 'admin.pages.globalDesc' },
        master:            { eyebrow: 'admin.pages.masterEyebrow',      desc: 'admin.pages.masterDesc' },
        "master-as-admin": { eyebrow: 'admin.pages.masterAdminEyebrow', desc: 'admin.pages.masterAdminDesc' },
      } as const
      ```
      rendered as `{t(SCOPE_COPY[scope].eyebrow)}` and `{t(SCOPE_COPY[scope].desc, { name: masterName ?? '' })}` (i18next ignores the unused `name` param for the two keys without a placeholder).
    - Pass `owner={owner}` to **both** `<PageFormSheet>` instances (add sheet ~line 146, edit sheet ~line 277).
    - Leave every `scope === "global"` conditional (table `<th>`/`<td>` at 174/207, `DataCard` field at 251) exactly as-is.
    - Update the file's header doc comment to name all three surfaces.

- [x] **Step 6: Thread `owner` through `PageFormSheet`**
  - Files: `src/components/admin/content/PageFormSheet.tsx`
  - Details:
    - Import `type PageOwner` from `@/lib/content/pages-shared`; add `owner: PageOwner` to `PageFormSheetProps` and widen `scope` to the same three-value union.
    - Line 40 becomes: `const action = page ? updatePage.bind(null, page.id) : createPage.bind(null, owner)`.
    - Nothing else changes — the `scope === "global"` visibility fieldset, the create→block-editor redirect via `detailHrefBase`, and the "Manage blocks →" link all already work for the new surface.

- [x] **Step 7: New route — master pages list (admin)**
  - Files: `src/app/admin/masters/[masterId]/pages/page.tsx` (new), `src/app/admin/masters/[masterId]/pages/loading.tsx` (new)
  - Details (`page.tsx`, Server Component, model it on `src/app/admin/pages/page.tsx` + the back-link header from `src/app/admin/pages/[id]/page.tsx`):
    ```tsx
    interface AdminMasterPagesProps { params: { masterId: string } }
    ```
    - `const session = await auth()`; `if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) redirect("/auth/login")`.
    - `const master = await prisma.user.findUnique({ where: { id: params.masterId }, select: { id: true, name: true, email: true, role: true } })`; `if (!master || master.role !== "MASTER") notFound()`.
    - `enabledLocales` via `getTenantConfig()` + `parseEnabledLocales` (same two lines as the existing pages).
    - `const pages = await listPagesForOwner({ ownerType: "master", masterId: master.id })`.
    - Render a `flex flex-col gap-6` wrapper: a back `<Link href="/admin/masters">` with `<ArrowLeft className="h-3.5 w-3.5" />` + `t('admin.pages.backToMasters')` (copy the exact classes from `src/app/admin/pages/[id]/page.tsx:34-40`, `getServerT()` for `t`), then
      ```tsx
      <PageListClient
        pages={pages}
        owner={{ ownerType: "master", masterId: master.id }}
        scope="master-as-admin"
        masterName={master.name?.trim() || master.email || master.id}
        enabledLocales={enabledLocales}
        detailHrefBase={`/admin/masters/${master.id}/pages`}
      />
      ```
  - Details (`loading.tsx`): `import TableSkeleton from "@/components/admin/skeletons/TableSkeleton"` and return `<TableSkeleton />` (mirrors `src/app/admin/pages/loading.tsx`).

- [x] **Step 8: New route — master page block editor (admin)**
  - Files: `src/app/admin/masters/[masterId]/pages/[id]/page.tsx` (new), `src/app/admin/masters/[masterId]/pages/[id]/loading.tsx` (new)
  - Details (`page.tsx`, a near-copy of `src/app/admin/master/pages/[id]/page.tsx` with the admin guard):
    ```tsx
    interface AdminMasterPageDetailProps { params: { masterId: string; id: string } }
    ```
    - ADMIN/SUPERADMIN guard → `redirect("/auth/login")` (identical to Step 7).
    - `const page = await prisma.page.findUnique({ where: { id: params.id }, include: { blocks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } })`.
    - `if (!page || page.ownerType !== "master" || page.masterId !== params.masterId) notFound()` — the `masterId` cross-check is load-bearing: it prevents reaching a page under a mismatched master's URL.
    - Back `<Link href={`/admin/masters/${params.masterId}/pages`}>` + `t('admin.pages.backToPages')` (reuse the existing key), `t('admin.pages.blocksEyebrow')` eyebrow, and the public URL line `` `/{params.masterId}/pages/{page.slug}` `` — verified against the real public route `src/app/[masterId]/pages/[slug]/page.tsx`.
    - `<PageBlocksEditor pageId={page.id} blocks={page.blocks} enabledLocales={enabledLocales} />` — no new props.
  - Details (`loading.tsx`): copy `src/app/admin/master/pages/[id]/loading.tsx` verbatim (FormSkeleton in a `flex flex-col gap-6` wrapper), renaming the component.

- [x] **Step 9: Entry point in the masters list**
  - Files: `src/app/admin/masters/MastersClient.tsx`
  - Details:
    - Add `import Link from "next/link"` and `FileText` to the existing `lucide-react` import (same icon the Pages nav item uses).
    - In the row actions `<div className="flex items-center gap-1 shrink-0">` (line 157), insert **between** the edit `<Sheet>` (ends line 196) and the delete `<Button>` (line 198):
      ```tsx
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('admin.masters.managePages')}
        title={t('admin.masters.managePages')}
        render={<Link href={`/admin/masters/${master.id}/pages`} />}
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>
      ```
      (The `<Button render={<Link/>}>` base-ui pattern is the one already used in `PageFormSheet.tsx:112`; do **not** use `buttonVariants()`.)
    - Add a short comment referencing AD-E so the C-2 exemption is self-documenting.
    - Do not add `aria-label`s to the pre-existing Pencil/Trash buttons (unrelated pre-existing gap — mention, don't fix).

- [x] **Step 10: i18n keys (all three locale files, same insertion points)**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details — the three files are structurally identical (`admin.pages` block at lines 402-467, `admin.masters` at 344-401), so use the same anchors in each:
    - In `admin.pages`, immediately after `"masterDesc"` (line 434):
      - `masterAdminEyebrow` — pl `"Strony specjalisty"`, en `"Master pages"`, uk `"Сторінки спеціаліста"`
      - `masterAdminDesc` — pl `"Twórz i zarządzaj stronami treści specjalisty {{name}}"`, en `"Create and manage content pages for {{name}}"`, uk `"Створюйте та керуйте сторінками контенту спеціаліста {{name}}"`
    - In `admin.pages`, immediately after `"backToPages"` (line 460):
      - `backToMasters` — pl `"Powrót do specjalistów"`, en `"Back to masters"`, uk `"Повернутися до спеціалістів"`
    - In `admin.masters`, immediately after `"thisMaster"` (line 355):
      - `managePages` — pl `"Zarządzaj stronami"`, en `"Manage pages"`, uk `"Керувати сторінками"`
    - No existing key is renamed or removed (`masterEyebrow`/`masterDesc` stay in use by the master's own surface).

- [x] **Step 11: Tests**
  - Files: `tests/lib/content/pages-owner.test.ts` (new)
  - Details: follow the hoisted-mock pattern of `tests/app/api/master/appointments/route.test.ts`:
    ```ts
    const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: { user: { findUnique: vi.fn() } } }))
    vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
    import { canManagePage, authorizePageOwner } from '@/lib/content/pages-server'
    ```
    - `canManagePage` (no DB): ADMIN and SUPERADMIN → `true` for a global row AND for another master's row; MASTER → `true` for own row, `false` for another master's row, `false` for a global row; CLIENT → `false`; `null`/`undefined` user → `false`; MASTER with no `id` → `false`.
    - `authorizePageOwner`: MASTER requesting global → `null`; MASTER requesting **another** master's id → `null` (the headline regression guard) and `mockPrisma.user.findUnique` not called; MASTER requesting own id → `{ownerType:'master',masterId:own}`; ADMIN requesting global → `{ownerType:'global',masterId:null}`; ADMIN requesting a `role:'MASTER'` target → master scope; ADMIN requesting a target that resolves to `null` or to `role:'CLIENT'`/`'ADMIN'` → `null`; CLIENT/anonymous → `null` for both request shapes.
    - `beforeEach(() => vi.clearAllMocks())`.
  - Do not add tests that import server actions (`"use server"` + `next/cache` + `@/auth` are not worth mocking here — the primitives above are where the logic lives).

- [x] **Step 12: DOX pass**
  - Files: `src/app/admin/AGENTS.md`, `src/lib/AGENTS.md`, `src/components/AGENTS.md`
  - Details (concise, no diary entries, no duplication across the three):
    - `src/app/admin/AGENTS.md` → one new Local Contract bullet: content pages have **three** admin surfaces (`pages/` global, `master/pages/` self-service, `masters/[masterId]/pages/` admin-on-behalf) sharing one component set and one action set; row-targeted actions authorize the session against the row's own owner via `canManagePage`, while `createPage`/`reorderPages` take an explicit `PageOwner` authorized by `authorizePageOwner`; ADMIN/SUPERADMIN may manage global **and** any master's pages, MASTER only their own; the "Manage pages" icon on a masters row is navigation to a different resource, not a second edit entry point (C-2).
    - `src/lib/AGENTS.md` → one new Local Contract bullet for `content/pages-server.ts`: the two authorization primitives and the rule that `PageOwner` lives in `content/pages-shared.ts` because client components carry it as a prop.
    - `src/components/AGENTS.md` → one new bullet: `admin/content/PageListClient.tsx`/`PageFormSheet.tsx` are shared by all three surfaces; `owner: PageOwner` is the security payload forwarded to the actions and `scope` is copy-only (`master-as-admin` + `masterName` render the admin-on-behalf header).
    - No AGENTS.md is created; `prisma/AGENTS.md`, `tests/AGENTS.md` need no change (no schema change; the new test follows the documented mirror path and mocking pattern).

- [x] **Step 13: Verification & handover notes**
  - Run `npm run lint` (zero warnings) and `npm run test`.
  - **Do NOT run `npm run dev` or `npm run build`** (standing user constraint — a one-shot build can corrupt `.next/` under the user's running dev server).
  - Produce the manual-check list for the user (step-by-step, in Russian, short) covering at minimum: admin sees the new icon on each master row → new list route opens with the master's name in the header and no Visibility column; create/rename/toggle/drag-reorder/delete a page there; the block editor opens, adds/edits/reorders/deletes a block; the page appears on the master's public booking-page nav at `/<masterId>/pages/<slug>`; the master's own `/admin/master/pages` still shows and can edit those same pages; `/admin/pages` global list is unaffected; a MASTER account hitting `/admin/masters/<otherId>/pages` is redirected to `/auth/login`.

## Acceptance Criteria

- [x] `npm run test` passes (existing suite green + the new `pages-owner` file)
- [x] `npm run lint` passes with zero warnings (pre-existing 40 errors/5 warnings unchanged, none in touched files — verified via git stash)
- [x] Follows project conventions: page-level `auth()` guard + `redirect("/auth/login")` (`src/app/admin/AGENTS.md` line 13), sibling `loading.tsx` per async page, `getServerT()` in Server Components, no hardcoded user-facing strings, `Button render={<Link/>}` for button-styled links
- [x] ADMIN/SUPERADMIN can full-CRUD (create, edit title/enabled, reorder, delete) any master's pages and their blocks from `/admin/masters/[masterId]/pages`
- [x] A MASTER session cannot reach another master's pages: `/admin/masters/<otherId>/pages` redirects, and `createPage`/`reorderPages` called with another master's `PageOwner` return/throw `errors.UNAUTHORIZED` without touching the DB
- [x] An ADMIN action targeting a master **never** falls through to a global write: `createPage`'s scope is a required typed parameter, and `authorizePageOwner` returns a freshly built scope or `null`
- [x] A MASTER's own `/admin/master/pages` behaviour is byte-for-byte unchanged (same list, same CRUD, footer-block section still there); `/admin/pages` global behaviour unchanged, including the Visibility column and `visibility` persistence
- [x] `/admin/masters/[masterId]/pages` shows no Visibility column/field (master-owned pages have `visibility = null`)
- [x] Pages created by an admin for a master appear in that master's public booking-page nav (`getNavPages(masterId)`) exactly like self-created ones
- [x] `resolvePageOwner` is fully removed with no dangling imports; no component or action is forked/duplicated
- [x] `pl`/`en`/`uk` all have the 4 new keys; no UI string is hardcoded
- [x] No file exceeds 500 lines (largest touched: `PageListClient.tsx` ≈ 310, `pages/actions.ts` ≈ 230)
- [x] AGENTS.md DOX pass done per Step 12

## Constraints & Risks

- **Do not touch** `prisma/schema.prisma` or create a migration — the `Page` model already supports this (verified).
- **Do not touch** `src/middleware.ts`, `src/components/admin/adminNavItems.ts`, `saveMasterFooterBlock`, `MasterFooterBlockSection`, or `src/app/admin/master/pages/**` (self-service surface) beyond what Steps 1-6 force.
- **Do not fork** `PageListClient`, `PageFormSheet`, `PageBlocksEditor`, or any action into a parallel admin-only copy (AD-5).
- **Do not weaken** the two existing paths: the MASTER branch of `canManagePage`/`authorizePageOwner` must remain identity-pinned to `session.user.id`, and `reorderPages`' exact-id-set equality guard must stay.
- **Deliberate widening, call it out in the PR/summary:** ADMIN/SUPERADMIN now pass `canManagePage` for *any* page row, including master-owned ones. That is the feature. It also means an admin could edit a master page through the global surface's actions if handed its id — acceptable and intended (admins already have full `updateMaster`/`deleteMaster` power over the same records).
- **Client-supplied scope is a doctrine nuance**, not a violation: `createPage`/`reorderPages` receive a *requested* scope from the client and authorize it server-side, mirroring the established `getMasterPassword(masterId)` / `updateMaster(id, …)` / `deleteMaster(id)` pattern (explicit target id + server-side role check). Keep the AD-5 comments accurate about this distinction.
- **Risk — silent scope mix-up:** the only place a wrong-but-authorized scope could misfire is `createPage`. Mitigated by (a) the required typed parameter, (b) a single `owner` prop shared by both `PageFormSheet` instances, (c) the server rebuilding the scope object. Reviewer should verify all three `PageListClient` call sites pass an `owner` consistent with their `detailHrefBase`.
- **Risk — `revalidatePath` with dynamic segments** silently no-ops if the `"page"` type argument is omitted. Both new lines in both `revalidateAll()` functions must pass it. (`revalidatePath("/", "layout")` already covers the client router cache broadly; these lines are explicitness in line with the existing convention.)
- **Never** start the dev server or run `npm run build`; leave browser verification to the user.
