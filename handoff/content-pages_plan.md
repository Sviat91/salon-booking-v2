# Plan: Content Pages & Photo Galleries

**Date:** 2026-07-25
**Status:** In Progress
**Design spec (authoritative):** `docs/superpowers/specs/2026-07-25-content-pages-design.md`

## Goal

Let admins build global content pages and masters build their own — composed of ordered `photoWidget` / `photoGallery` / `text` blocks — surfaced through a new top nav line on the homepage and master booking pages, plus two singleton block slots (homepage widget, master booking-page footer), without touching any existing booking logic.

---

## Architecture Decisions

These are settled. The Coder must not re-litigate them; if one turns out to be impossible, stop and report rather than improvising.

### AD-1 — Two new models + two singleton JSON columns
Exactly as the spec's Data Model section: `Page`, `Block`, `TenantConfig.homepageWidgetBlock`, `MasterProfile.footerBlock`. SQLite `String` columns for all JSON (no Prisma `enum`, no JSON type) — per `prisma/AGENTS.md`.

### AD-2 — Both singleton slots store the **wrapper** shape `{"type":"...","config":{...}}`
The spec describes `TenantConfig.homepageWidgetBlock` as "JSON config for one photoWidget block" and `MasterProfile.footerBlock` as needing a type (photoWidget **or** text). Storing the same wrapper shape for both lets one parser (`parseBlockSlot`) and one editor (`SingleBlockSlotEditor`) serve both slots. The homepage slot's type picker is locked to `none | photoWidget`; the master footer slot offers `none | photoWidget | text`. This is a deliberate, documented superset of the spec.

### AD-3 — App-level slug uniqueness is the real guard
`@@unique([ownerType, masterId, slug])` is declared as specified, **but SQLite treats NULLs as distinct**, so it does not prevent two `ownerType='global'` rows (where `masterId IS NULL`) sharing a slug. `generateUniqueSlug()` in `src/lib/content/pages-server.ts` is the actual enforcement (query existing slugs in scope, append `-2`, `-3`, …). Slugs are generated **on create only** — renaming a page's title never changes its URL.

### AD-4 — ~~Reorder via up/down buttons, not drag-and-drop~~ — **REVISED 2026-07-25 → see Correction C-1**
> **Original text (superseded, kept for traceability):** The spec says "drag-reorder"; no DnD library is installed (`package.json` has no `dnd-kit`/`react-beautiful-dnd`), and adding a dependency is out of scope. Page order and block order are changed with `ChevronUp`/`ChevronDown` icon buttons calling a `move…(id, 'up'|'down')` server action that swaps `order` with the adjacent row. Same UX in the global and master screens. Flag this to the user in the completion report.

**Why revised:** the user originally agreed to defer DnD and ship buttons first ("see how it goes, add DnD later if needed"), then saw the buttons in live Stage-3 testing and reversed the call: real drag-and-drop now, buttons removed. Reordering becomes true DnD via `@dnd-kit/*`, and the single-step `movePage`/`moveBlock` swaps are replaced by whole-list `reorderPages`/`reorderBlocks` actions. **Correction C-1 is the binding version.**

### AD-5 — One shared set of server actions, owner scope derived from the session
Admin CRUD in this repo uses `app/**/actions.ts` server actions (see `admin/services/actions.ts`, `admin/masters/actions.ts`), not API routes — follow that. To avoid duplicating page/block CRUD twice, **one** implementation lives in `src/app/admin/pages/actions.ts` + `block-actions.ts` and is imported by both `/admin/pages` and `/admin/master/pages` client components. Owner scope is never passed from the client — it is resolved inside every action from `auth()`:

- `ADMIN` / `SUPERADMIN` → `{ ownerType: 'global', masterId: null }`
- `MASTER` → `{ ownerType: 'master', masterId: session.user.id }`
- anything else → reject

Every mutation targeting an existing `Page`/`Block` re-loads the row and verifies it matches the resolved owner before writing. MVP scope: an admin manages global pages only, a master manages their own only (matches the spec's "Admin & Master UI" section). Admin-creating-a-page-on-a-master's-behalf is **not** built.

*(Unchanged by the 2026-07-25 corrections — the new `reorderPages`/`reorderBlocks` actions must apply the same per-row ownership discipline.)*

### AD-6 — Public reads: Server Components read Prisma directly; the nav line uses one public API route
`/pages/[slug]` and `/[masterId]/pages/[slug]` are Server Components reading `src/lib/content/pages-server.ts`. The nav line and master footer slot must also render on `src/app/[masterId]/page.tsx`, which is a `"use client"` component — so they get their data from one new public route, `GET /api/content?masterId=<optional>` → `{ pages, footerBlock }`, consumed via React Query with the shared key `['content-nav', masterId ?? 'home']` so `TopNavLine` and `MasterFooterBlock` share a single request. No Redis caching for content pages (cheap indexed reads; adding a cache layer means new invalidation obligations in `src/lib/cache.ts` for no measurable win).

### AD-7 — ~~The nav line renders nothing when there are no eligible tabs~~ — **PARTIALLY REVISED 2026-07-25 → see Correction C-6**
> **Original text (superseded for `TopNavLine` only, kept for traceability):** `TopNavLine` returns `null` when its page list is empty. Until an admin creates the first page, the homepage and master booking page are pixel-identical to today. Same rule for both singleton slots (`null`/unset ⇒ render nothing).

**Why revised:** live testing showed `TopNavLine` and the icon clusters as two independently-positioned elements that only *looked* related by accident, plus filled-pill tabs that read as buttons rather than a nav bar. The user's confirmed fix: one permanent bar (hairline + tabs + icons together) that never disappears, so toggling a page never shifts the layout — the "pixel-identical until first page" guarantee is dropped for `TopNavLine` specifically. **`TopNavLine` is now a permanent fixture; the singleton-slot half of AD-7 (`homepageWidgetBlock`/`footerBlock` render nothing when unset) is unchanged and still binding — this correction is scoped to the nav line only.** See Correction C-6 below for the implementation.

### AD-8 — The homepage widget slot replaces the (already-empty) `ReviewsMarquee` mount
`src/lib/reviews.ts`'s `getCachedReviews()` returns `[]` unconditionally today, so `ReviewsMarquee` already renders `null` on every load — swapping it is zero-risk. Remove the `ReviewsMarquee` usage and the now-orphaned `initialReviews` prop plumbing (`src/app/page.tsx` → `HomeClient`). **Delete** `src/components/reviews/ReviewsMarquee.tsx` and `src/lib/reviews.ts` outright as part of Step 23 — confirmed by the user (2026-07-25): no point keeping known-dead code around. Grep for any other importer of either file before deleting; if one exists, stop and report instead of deleting.

### AD-9 — Master footer slot editing surface
The spec says "the master's own profile/settings" — no such page exists (`masterNavItems` = dashboard / services / schedule). The footer-slot editor therefore lives as a section at the top of the new `/admin/master/pages` screen (the master's content surface), plus the admin-side field inside `masters/MasterForm.tsx` as specified. No new master settings page is created.

### AD-10 — File-splitting rules (500-line cap)
No file in this feature may approach 500 lines. The split is fixed up-front:

- one renderer file per block type, plus one per `photoWidget` style variant;
- one config-editor file per block type, plus a shared photo-list editor;
- page CRUD actions and block CRUD actions in separate files;
- list UI, form sheet, and block editor as three separate admin components;
- (added by C-1) one shared, generic `SortableList` wrapper rather than duplicating dnd-kit wiring in each list.

`src/app/admin/settings/SettingsForm.tsx` is already **477 lines** — the homepage widget section may add **at most ~8 lines** there (one import + one JSX element, mirroring `LanguagesSection`). Verify with `wc -l` after editing; if it would exceed 500, stop and report instead of inventing a refactor.

### AD-11 — ~~No new UI primitives or dropdown portals~~ — **PARTIALLY REVISED 2026-07-25 → see Correction C-1**
Still binding: block-type pickers use the existing `src/components/ui/select.tsx`; checkboxes use `ui/checkbox.tsx`; sheets/dialogs use `ui/sheet.tsx`/`ui/dialog.tsx`. The lightbox is a plain `fixed inset-0` overlay with `framer-motion` (already a dependency) — no portal-positioning helper needed, so `TimePickerDropdown.tsx`'s pattern is **not** required here.

> **Superseded clause:** ~~"Do not add any npm dependency."~~ **Why revised:** the user's reversal on AD-4 requires a drag-and-drop library. Exactly three new dependencies are authorised — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — and **nothing else**. Every other "do not add a dependency" instruction in this plan stands: no lightbox library, no rich-text editor, no `@dnd-kit/modifiers`, no carousel/marquee package.

---

## Implementation Steps

Work in stages. **Stop at each `⏸ STOP` marker, report, and wait for the user's manual verification before continuing** (standing user preference).

### Stage 1 — Data model & shared library

- [x] **Step 1: Extend the Prisma schema**
  - Files: `prisma/schema.prisma`
  - Details:
    - Add the `Page` and `Block` models **verbatim from the spec's Data Model block** (`docs/superpowers/specs/2026-07-25-content-pages-design.md`, lines 22–56), including `@@unique([ownerType, masterId, slug])`.
    - Add the required back-relation `pages Page[]` to `model User` (Prisma will not compile without it).
    - Add `homepageWidgetBlock String?` to `model TenantConfig` (place it next to `enabledLocales`).
    - Add `footerBlock String?` to `model MasterProfile` (place it after `color`).
    - No enums, no defaults beyond those in the spec.

- [x] **Step 2: Create and apply the migration (non-interactive)**
  - Files: `prisma/migrations/<timestamp>_add_content_pages/migration.sql`
  - Details: `prisma migrate dev` cannot run non-interactively here (see Constraints & Risks). Use:
    1. `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/content-pages.sql`
    2. Inspect the SQL. It must be purely additive: two `CREATE TABLE`s, one `CREATE UNIQUE INDEX`, and two `ALTER TABLE … ADD COLUMN` (both nullable). If it contains any `DROP`/table-rebuild for `TenantConfig` or `MasterProfile`, **stop and report** — that would risk data loss.
    3. Create `prisma/migrations/20260725<HHMMSS>_add_content_pages/migration.sql` by hand (follow the existing timestamp folder naming) and put the SQL there.
    4. `npx prisma migrate deploy`
    5. `npx prisma generate`
  - Verify: `npx prisma studio` shows the two new tables; `prisma.page` is typed in the generated client.

- [x] **Step 3: Pure block types, schemas, and parsers**
  - Files: `src/lib/content/blocks.ts` (new)
  - Details: framework-free (no React, no Prisma, no `next/*`) so both client and server can import it — same rationale as `src/lib/localized-content.ts`. Export:
    - `BLOCK_TYPES = ['photoWidget', 'photoGallery', 'text'] as const`, `type BlockType`
    - `PHOTO_WIDGET_STYLES = ['strip', 'fade', 'stack'] as const`, `type PhotoWidgetStyle`
    - Zod schemas: `photoWidgetConfigSchema` (`{ style: enum, photos: string[] }`), `photoGalleryConfigSchema` (`{ photos: string[] }`), `textBlockConfigSchema` (`{ text_pl: string, text_en?: string, text_uk?: string }`)
    - `type BlockConfig` (discriminated by owner type), `defaultConfigFor(type): BlockConfig`
    - `parseBlockConfig(type, json): BlockConfig` — never throws; returns `defaultConfigFor(type)` on any parse/validation failure
    - `type BlockSlot = { type: BlockType; config: BlockConfig }`, `parseBlockSlot(json): BlockSlot | null` (for the two singleton columns, AD-2), `serializeBlockSlot(slot): string`
  - Keep under 150 lines.
  - ⚠️ **Amended by Correction C-3** — `text_pl` must become optional (no privileged language).

- [x] **Step 4: Pure page helpers**
  - Files: `src/lib/content/pages-shared.ts` (new)
  - Details: framework-free. Export:
    - `PAGE_VISIBILITY_TARGETS = [{ id: 'home', labelKey: 'admin.settings.general.homePageLabel' }, { id: 'booking', labelKey: 'admin.settings.general.bookingPageLabel' }]` — reuses the existing i18n keys and mirrors the `AVAILABLE_PAGES` shape in `src/app/admin/settings/LogoEditor.tsx` (only the two targets the spec names: Home / Master booking pages)
    - `parseVisibility(json: string | null): string[]` (safe, `[]` on failure), `serializeVisibility(ids: string[]): string`
    - `slugify(title: string): string` — lowercase, map `ł→l`/`Ł→l`, `String.normalize('NFD')` + strip combining marks, non-`[a-z0-9]` → `-`, collapse/trim dashes, cap at 60 chars, fall back to `'page'` when the result is empty
    - `type NavPage = { id: string; slug: string; href: string; title_pl: string; title_en: string | null; title_uk: string | null }`
  - ⚠️ **Amended by Correction C-3** — `NavPage.title_pl` becomes `string | null`.

- [x] **Step 5: Server-side page data access**
  - Files: `src/lib/content/pages-server.ts` (new)
  - Details: imports `@/lib/prisma`; no `"use client"`, no `NextRequest`/`NextResponse` (per `src/lib/AGENTS.md`). Export:
    - `resolvePageOwner(user: { id?: string; role?: string }): { ownerType: 'global'; masterId: null } | { ownerType: 'master'; masterId: string } | null` (AD-5)
    - `generateUniqueSlug(base: string, ownerType: string, masterId: string | null): Promise<string>` (AD-3)
    - `getNavPages(masterId?: string): Promise<NavPage[]>` — global pages with `enabled: true` whose `visibility` includes `home` (when no `masterId`) or `booking` (when a `masterId` is given), ordered by `order` then `createdAt`; when `masterId` is given, append that master's `enabled` pages (`ownerType: 'master'`) after the globals, same ordering. Global page `href` = `/pages/<slug>`, master page `href` = `/<masterId>/pages/<slug>`.
    - `getPageWithBlocks(args: { ownerType: 'global' | 'master'; masterId?: string | null; slug: string }): Promise<{ page, blocks } | null>` — returns `null` when missing **or** `enabled: false`; blocks ordered by `order` then `createdAt`.
    - `listPagesForOwner(owner)`: pages + blocks for the admin/master screens.
    - `getMasterFooterSlot(masterId): Promise<BlockSlot | null>`
  - Use the `(prisma.x.findMany as any)` escape hatch **only** if the generated client types lag; prefer typed calls.

- [x] **Step 6: Unit tests for the pure helpers**
  - Files: `tests/lib/content/blocks.test.ts` (new), `tests/lib/content/pages-shared.test.ts` (new)
  - Details: no Prisma mocking needed (both modules are pure). Cover: `parseBlockConfig` returns the default on malformed/empty/wrong-shape JSON and round-trips a valid config; `parseBlockSlot` returns `null` for `null`/garbage; `slugify` handles Polish diacritics (`"Nasze Zdjęcia — Wnętrze"` → `nasze-zdjecia-wnetrze`), `ł`, punctuation-only input (→ `page`), and length capping; `parseVisibility` is safe on garbage.
  - Verify: `npx vitest run tests/lib/content/`
  - ⚠️ **Extended by Correction C-3** — add coverage for the new `hasAnyEnabledLocaleValue` helper.

⏸ **STOP — report Stage 1. User verifies the migration applied cleanly (`npx prisma studio`) before Stage 2.**

### Stage 2 — Shared block-config editors (admin side)

All files below are `"use client"`, live in `src/components/admin/content/`, use `useTranslation()` directly, and map upload failures through `t(apiErrorKey(json.code))` (per `src/app/admin/AGENTS.md`).

- [x] **Step 7: Shared photo list editor**
  - Files: `src/components/admin/content/PhotoListEditor.tsx` (new)
  - Details: props `{ photos: string[]; onChange: (photos: string[]) => void }`. Renders a responsive thumbnail grid (`next/image`, local `/uploads/...` paths), each thumb with move-left / move-right / remove icon buttons, plus an "Upload photo" `<label><input type="file" hidden>` that POSTs `FormData` to **`/api/upload` unmodified** (same call shape as `MasterForm.tsx`'s `handleAvatarUpload`) and appends `json.url`. `accept="image/png,image/jpeg,image/webp,image/gif"` to match the endpoint's `ALLOWED_TYPES`. Show a per-upload pending state and an inline `text-destructive` error. No client-side size/type re-validation — the endpoint owns that.
  - Note: the photo-level move-left/move-right buttons are **out of scope for C-1** — C-1 covers page and block reordering only. Leave `PhotoListEditor`'s buttons as they are unless the user asks otherwise.

- [x] **Step 8: Per-type config editors**
  - Files:
    - `src/components/admin/content/PhotoWidgetConfigEditor.tsx` (new) — style `<Select>` (`strip`/`fade`/`stack`, localized labels) + `<PhotoListEditor>`
    - `src/components/admin/content/PhotoGalleryConfigEditor.tsx` (new) — `<PhotoListEditor>` only
    - `src/components/admin/content/TextBlockConfigEditor.tsx` (new) — one `<Textarea>` per enabled locale, driven by an `enabledLocales: Language[]` prop; mirror `LocalizedFieldInput.tsx`'s tab UI conceptually but keep it controlled (`value`/`onChange`), since this editor writes into a JSON config object rather than emitting form fields. ~~`text_pl` is required (non-empty) before the block can be saved.~~
  - Details: each takes `{ config, onChange(config) }` and is purely controlled. Keep each under 120 lines.
  - ⚠️ **Amended by Correction C-3** — the struck clause was wrong: the requirement is "at least one *enabled* locale non-empty", never a hardcoded language.

- [x] **Step 9: Type picker + config-editor switch + singleton slot editor**
  - Files:
    - `src/components/admin/content/BlockTypePicker.tsx` (new) — `<Select>` over an `allowed: BlockType[]` prop with localized labels
    - `src/components/admin/content/BlockConfigEditor.tsx` (new) — thin switch on `type` → one of the three editors above. No layout, no save button (owners supply those).
    - `src/components/admin/content/SingleBlockSlotEditor.tsx` (new) — the shared "none / pick a type / edit its config" control for both singleton slots (AD-2). Props: `{ name: string; value: string | null; allowed: BlockType[]; enabledLocales: Language[] }`. Holds the slot in local state, renders `BlockTypePicker` (with a "none" option) + `BlockConfigEditor`, and emits a **hidden input** `name={name}` whose value is `serializeBlockSlot(slot)` (or `""` for none) — exactly the `LanguagesSection.tsx` pattern, so it plugs into an existing `<form action={serverAction}>` without new save wiring. Optional `onChange?: () => void` to signal dirty state.

- [x] **Step 10: i18n keys for the editors**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: add an `admin.pages.*` group (block type names, style names, upload/remove/move labels, validation messages). Polish is the source of truth; en/uk must have identical key sets.
  - Verify: `npm run i18n:check` passes.

⏸ **STOP — report Stage 2 (no user-visible change yet; verification is `npm run lint` + `npm run build`).**

### Stage 3 — Admin global pages CRUD (`/admin/pages`)

- [x] **Step 11: Page CRUD server actions**
  - Files: `src/app/admin/pages/actions.ts` (new)
  - Details: `"use server"`. Follow `src/app/admin/services/actions.ts` exactly: `getServerT()` for messages, a `build…Schema(t)` factory (never a module-scope schema), `safeParse`, `{ error?, fieldErrors?, success? }` state, `revalidatePath` at the end. Every action starts by calling `auth()` → `resolvePageOwner()`; `null` owner ⇒ return `{ error: t('errors.UNAUTHORIZED') }`.
    - `createPage(prev, formData)` — reads `title_pl` (required) / `title_en` / `title_uk` (only when present in the FormData — reuse the `readOptionalLocaleField` pattern so a disabled locale never nulls a saved translation), `enabled` checkbox, `visibility` (hidden JSON input, ignored for master owners). Slug via `slugify(title_pl)` → `generateUniqueSlug`. `order` = current max + 1 within the owner scope.
    - `updatePage(id, prev, formData)` — same fields; **does not** touch `slug` (AD-3).
    - `deletePage(id)` — blocks cascade via the FK.
    - `movePage(id, direction)` — swap `order` with the adjacent row in the same owner scope.
    - `togglePageEnabled(id, enabled)`.
    - All of them: load the row first and reject if `ownerType`/`masterId` don't match the resolved owner.
    - `revalidatePath("/admin/pages")`, `revalidatePath("/admin/master/pages")`, `revalidatePath("/", "layout")`.
  - ⚠️ **Amended by Corrections C-1** (`movePage` → `reorderPages`) **and C-3** (title validation).

- [x] **Step 12: Block CRUD server actions**
  - Files: `src/app/admin/pages/block-actions.ts` (new)
  - Details: `"use server"`, same auth/ownership gate, resolved through the block's parent page.
    - `createBlock(pageId, type)` — validates `type` against `BLOCK_TYPES`, stores `defaultConfigFor(type)`, `order` = max + 1.
    - `updateBlockConfig(blockId, configJson)` — re-validate with the type's Zod schema server-side before persisting; reject invalid JSON.
    - `deleteBlock(blockId)`, `moveBlock(blockId, direction)`.
  - ⚠️ **Amended by Corrections C-1** (`moveBlock` → `reorderBlocks`) **and C-3** (text validation).

- [x] **Step 13: Shared admin page-management components**
  - Files:
    - `src/components/admin/content/PageListClient.tsx` (new) — the list surface, shared by `/admin/pages` and `/admin/master/pages`. Props `{ pages, scope: 'global' | 'master', enabledLocales, detailHrefBase: string }`. Follow the list chrome convention in `src/app/admin/AGENTS.md`: desktop `<table>` in `hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden` with `bg-muted/50` uppercase micro-label `<th>`s, plus a `lg:hidden` `DataCard` list. Columns: title (resolved with `useCurrentLanguage()` + `resolveLocalized`), slug, blocks count, visibility badges (`scope === 'global'` only), enabled `Badge variant="success"/"muted"`, actions (manage blocks link → `${detailHrefBase}/${page.id}`, edit, move up/down, delete with `confirm()`). ONE shared edit `Sheet` controlled by `editTarget`/`editOpen` — never a per-row Sheet (that convention is explicit in the admin AGENTS.md).
    - `src/components/admin/content/PageFormSheet.tsx` (new) — the create/edit form body. `LocalizedFieldInput baseName="title"` for the title, an `enabled` checkbox, and — for `scope === 'global'` only — the visibility checkbox group built from `PAGE_VISIBILITY_TARGETS` with a hidden `visibility` JSON input, styled like `LogoEditor.tsx`'s `AVAILABLE_PAGES` block (`Checkbox` + `onCheckedChange`).
    - `src/components/admin/content/PageBlocksEditor.tsx` (new) — the per-page block list: ordered block cards, each showing its type label, move up/down, delete, and an inline `BlockConfigEditor` with an explicit per-block "Save block" button calling `updateBlockConfig`; plus an "Add block" row (`BlockTypePicker` + add button) calling `createBlock`. Local optimistic state is fine, but truth comes from the server action + `router.refresh()`.
  - ⚠️ **Amended by Corrections C-1** (drag handles replace move buttons) **and C-2** (single row entry point; `PageFormSheet` gains the "Manage blocks →" link).

- [x] **Step 14: `/admin/pages` routes**
  - Files:
    - `src/app/admin/pages/page.tsx` (new) — `async` Server Component; `auth()` guard redirecting to `/auth/login` unless role is `ADMIN`/`SUPERADMIN` (the page must guard itself — middleware is only a first pass); loads `listPagesForOwner({ ownerType: 'global', masterId: null })` + `parseEnabledLocales(config.enabledLocales)`; renders the eyebrow + muted subtitle header (no `<h1>`; the topbar supplies the title) and `<PageListClient scope="global" detailHrefBase="/admin/pages">`.
    - `src/app/admin/pages/loading.tsx` (new) — `TableSkeleton` from `src/components/admin/skeletons/`, wrapped in the same outer container classes as the real page.
    - `src/app/admin/pages/[id]/page.tsx` (new) — Server Component, same guard; loads the page + ordered blocks, 404s (`notFound()`) when the row isn't global-owned; renders `<PageBlocksEditor>` plus a "back to pages" link and the page's public URL.
    - `src/app/admin/pages/[id]/loading.tsx` (new) — `FormSkeleton`.

- [x] **Step 15: Sidebar nav entry**
  - Files: `src/components/admin/adminNavItems.ts`, `src/locales/{pl,en,uk}.json`
  - Details: add `{ labelKey: "admin.nav.pages", href: "/admin/pages", icon: FileText }` to `adminNavItems` (own top-level entry, **not** nested under Settings — explicit user requirement), importing `FileText` from `lucide-react`. Add the `admin.nav.pages` key to all three locale files. `superadminNavItems` inherits it via the spread; `AdminTopBar`'s title resolves automatically through `getPageTitleKey`.
  - Verify: no `startsWith` collision with `/admin/masters` or any other existing href.

⏸ **STOP — user manually creates a global page with a text block and a gallery block in `/admin/pages`.**

**Known issues found during this manual verification (2026-07-25), to resolve before Stage 4:**

1. ~~Every `admin.pages.*` string rendered as the raw dotted key (e.g. `admin.pages.editPageTitle`, and visually all-caps in table headers like `ADMIN.PAGES.COLTITLE` due to the header's `uppercase` CSS class — cosmetic case difference only, same underlying bug).~~ **Resolved by a hard page refresh** — confirmed root cause: `src/lib/i18n.ts` statically `import`s the locale JSON files at build time into the `resources` object; the dev server's already-running browser bundle had the pre-Stage-2/3 JSON baked in, and a soft/client navigation doesn't re-execute that top-level import. Not a code bug — no fix needed, just a stale-bundle artifact of live-editing during a running dev session. Worth a one-line note to the user in future stages: **a hard refresh (or dev server restart) is needed after any locale-file change before judging the UI.**
2. **Investigated (2026-07-25) — no code bug found; root cause is almost certainly a dev-server artifact, not Step 13/14 logic.** Traced every candidate the coordinator listed, all clean:
   - `PageListClient.tsx`'s Actions column does render a real link: `<Button variant="ghost" size="icon-sm" render={<Link href={`${detailHrefBase}/${p.id}`} />}>` — `detailHrefBase="/admin/pages"` is passed correctly from `page.tsx`. Traced base-ui's `useRenderElement`/`evaluateRenderProp` merge logic line-by-line: the Button's own child (`<FolderOpen/>`) is correctly merged into the cloned `<Link>` element's `children`, and `href` passes straight through — same mechanism already used and working everywhere else in the app (`admin/page.tsx`'s dashboard quick-action buttons, every `SheetContent`'s close button). No z-index/overlay issue — both `Sheet`s default to closed and don't portal anything until opened.
   - `[id]/page.tsx`'s guard/`notFound()` logic is correct: queried the live dev DB directly (`prisma.page.findMany`) and confirmed the "Test Page" row the user created has exactly `ownerType: "global"`, `masterId: null` — the shape the route's `if (!page || page.ownerType !== "global" || page.masterId !== null) notFound()` check expects. It would **not** 404 for this row.
   - `params: { id: string }` is the correct Next 14 (non-Promise) shape — matches every other dynamic page in this repo; no `await` needed at this Next version.
   - No route collision/casing issue: `find src/app/admin -maxdepth 1 -type d` shows no conflicting segment, `[id]` folder is lowercase and matches `params.id`. No stray duplicate `PageFormSheet.tsx`/case-duplicated folder left over from an earlier misplacement (checked and confirmed clean).
   - `npm run build` (production) compiles `/admin/pages` and `/admin/pages/[id]` as working dynamic routes with **no errors**, both before and after this investigation — a real typo/broken-import/logic bug of the kind being searched for here would fail `next build`, and it doesn't.
   - **Most likely actual explanation:** this Coder session ran `npm run build` (production) multiple times during Stage 1/2/3 verification, each of which fully regenerates the repo's single `.next/` directory (confirmed via `.next`'s mtime matching the last build run). If the user's `next dev` process was running concurrently against that same `.next/` folder, a `next build` run underneath it is a known way to leave the dev server's on-demand route registration in a broken state — especially for a **brand-new nested dynamic segment** (`[id]`) added after the dev server started — where a browser hard refresh (which fixed issue 1) doesn't help because the problem is server-side, not just a stale client bundle.
   - **Recommended remediation:** stop `next dev` if it's running, delete `.next/`, then restart `npm run dev` fresh, then retry: Pages list → click the folder icon in the Actions column of "Test Page" → should land on `/admin/pages/<id>` showing "Page blocks" + the empty-state message + an "Add block" row.
   - **Process note for later stages:** avoid running `npm run build` for verification while the user has a `next dev` session open against the same working copy; if it's run, the dev server should be restarted afterward before the next round of manual testing.
   - No code changes were made for this item — verification re-run clean: `npm run lint`/`npx tsc --noEmit` (targeted to Stage 3 files)/`npm run test` (25 files, 155 tests)/`npm run build` all pass.
   - *(Superseded by Correction C-2: the folder icon this item refers to is being removed entirely — the manage-blocks screen is now reached from inside the edit Sheet.)*

---

## Corrections (2026-07-25, post-Stage-3 live testing)

Four real problems surfaced when the user exercised the Stage 1–3 build. **Do these before starting Stage 4** — they retrofit already-shipped files, and Stage 4–7 steps below have been annotated where they assumed the old behavior.

These corrections supersede parts of AD-4 and AD-11 (both marked REVISED above). AD-5's ownership discipline, AD-10's file-size cap, and every "must not be touched" constraint are unchanged and still binding.

### C-1 — Real drag-and-drop reordering (replaces the up/down buttons)

**Problem:** the user asked for drag-and-drop after seeing the `ChevronUp`/`ChevronDown` buttons in `PageListClient.tsx`. Buttons out, DnD in — for both the page list and the block list.

- [x] **C-1.1: Add the three authorised dependencies**
  - Files: `package.json`, `package-lock.json`
  - Details: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`. Verify all three land in `dependencies` before importing them anywhere (Core Mandate: never import a library that isn't in `package.json`). Do **not** add `@dnd-kit/modifiers` or any other package. Confirm the install doesn't bump React or any existing dependency — if `npm install` wants to change an unrelated version, stop and report.

- [x] **C-1.2: Replace the swap actions with whole-list reorder actions**
  - Files: `src/app/admin/pages/actions.ts` (edit), `src/app/admin/pages/block-actions.ts` (edit)
  - Details: a drag-end event hands you the complete new ordering, so a single-step swap is the wrong shape. Delete `movePage(id, direction)` and `moveBlock(blockId, direction)` outright (they become orphaned by this change — removing them is correct per the surgical-changes rule) and add:
    - `reorderPages(orderedIds: string[]): Promise<void>` — `auth()` → `resolvePageOwner()`; load every page in the owner scope; **assert the submitted id set is exactly equal to the scope's id set** (same length, no foreign ids, no missing ids) and reject otherwise — this is how per-row ownership is enforced for a bulk write (AD-5 discipline unchanged); then write `order = index` for each id inside one `prisma.$transaction([...])`; then `revalidateAll()`.
    - `reorderBlocks(pageId: string, orderedIds: string[]): Promise<void>` — `verifyPageOwnership(pageId)` first, then the same exact-set assertion against that page's block ids, then one `$transaction` writing `order = index`, then `revalidateAll()`.
    - Keep the existing `verifyPageOwnership`/`verifyBlockOwnership` helpers; do not weaken them.
  - Rationale to record in the code comment: bulk reorder is atomic, matches the drag-end payload, and removes the repeated-round-trip behavior of the old swap.

- [x] **C-1.3: Shared sortable list wrapper**
  - Files: `src/components/admin/content/SortableList.tsx` (new)
  - Details: `"use client"`, generic, one place where dnd-kit is wired (AD-10). Renders its own `DndContext` (`PointerSensor` with a small `activationConstraint: { distance: 4 }` so a click on a nested button isn't swallowed, plus `KeyboardSensor` for a11y, `closestCenter` collision detection) wrapping a `SortableContext` with `verticalListSortingStrategy`. Props roughly `{ ids: string[]; onReorder: (orderedIds: string[]) => void; children: (id: string, handle: DragHandleProps) => ReactNode }` where the render-prop `handle` exposes `setNodeRef`, `style` (`{ transform: CSS.Transform.toString(transform), transition }`), `attributes`, `listeners`, and `isDragging`. On `onDragEnd`, compute the new order with `arrayMove` from `@dnd-kit/sortable` and call `onReorder`.
  - **Do not use `DragOverlay`** — a table row rendered into an overlay loses its `<td>` widths. In-place transform only.
  - **Duplicate-id caveat:** the page list renders two simultaneous DOM trees (desktop `<table>` + `lg:hidden` `DataCard` list) with the same row ids. dnd-kit requires ids to be unique *within a `DndContext`*, so each list must get its **own** `SortableList` instance (its own `DndContext`), never one context spanning both. The CSS-hidden list registers zero-size droppables and is harmless.

- [x] **C-1.4: Wire DnD into the page list**
  - Files: `src/components/admin/content/PageListClient.tsx` (edit)
  - Details: remove the `ChevronUp`/`ChevronDown` buttons, the `handleMove` callback, the `movePage` import, and the now-unused `index` parameter threading. Wrap the `<tbody>` rows in one `SortableList` and the mobile `DataCard` list in a second one, both calling `reorderPages(orderedIds)` inside the existing `startTransition`. Drag handle: a `GripVertical` icon button (`cursor-grab active:cursor-grabbing`, `touch-none` so touch drags aren't stolen by scrolling) as the **first cell** of each desktop row and the leading element of each mobile card. Optimistically render the dragged order locally so the list doesn't snap back before the server round-trip completes.

- [x] **C-1.5: Wire DnD into the block list**
  - Files: `src/components/admin/content/PageBlocksEditor.tsx` (edit)
  - Details: same treatment — remove the two chevron buttons, `handleMove`, and the `moveBlock` import; wrap the block cards in a single `SortableList` calling `reorderBlocks(pageId, orderedIds)`; `GripVertical` handle in each card's header row next to the block-type label. The per-block "Save block" button, delete button, and inline `BlockConfigEditor` are unchanged — verify a drag started on the card header never triggers the save/delete buttons (that's what the `distance: 4` activation constraint is for).

- [x] **C-1.6: i18n + a11y strings for the handle**
  - Files: `src/locales/{pl,en,uk}.json`
  - Details: add one `admin.pages.dragHandleLabel` key (used as the handle's `aria-label`/`title`), remove any now-unused `admin.pages.move*` keys the buttons used. `npm run i18n:check` must stay green (it fails on both missing and orphaned-across-locales keys).

### C-2 — One entry point per row (pencil = edit; blocks reached from inside the sheet)

**Problem:** two icons per row (pencil = edit metadata, folder = manage blocks) confused the user badly. Confirmed UX: **one** affordance per row.

- [x] **C-2.1: Remove the second entry point from the row**
  - Files: `src/components/admin/content/PageListClient.tsx` (edit)
  - Details: delete the `FolderOpen` link button and its `lucide-react` import from `renderActions`. The row keeps exactly one entry point — the existing `Pencil` button opening the shared edit `Sheet` (matching `ServicesClient.tsx`'s convention). Delete stays as a separate destructive action and the new `GripVertical` handle stays as a drag affordance — those are not "entry points". Do **not** also make the row itself clickable: a click-to-open row would fight the drag handle added in C-1.4.
  - `detailHrefBase` is still needed — pass it down to `PageFormSheet` (see C-2.2) instead of using it in the row.

- [x] **C-2.2: Add "Manage blocks →" inside the edit sheet**
  - Files: `src/components/admin/content/PageFormSheet.tsx` (edit)
  - Details: add a `detailHrefBase: string` prop. When `page` is defined (edit mode only — a brand-new page has no id yet, and blocks require one), render below the submit button, separated by a `border-t border-border pt-4` divider: a `<Button variant="outline" render={<Link href={`${detailHrefBase}/${page.id}`} />}>` labelled from a new `admin.pages.manageBlocksBtn` key, with a small muted hint that unsaved title/visibility edits are not carried over when navigating. Use the `render={<Link/>}` base-ui pattern already used across this repo — never `buttonVariants()`. Do **not** rebuild the block-management screen; `/admin/pages/[id]` from Step 14 already works and is the navigation target.
  - Add `admin.pages.manageBlocksBtn` + its hint key to all three locale files.
  - **Follow-up (2026-07-25, landed directly by the coordinator, not a full round-trip):** create-mode now skips the sheet-close step entirely — `createPage` returns `pageId` on success, and `PageFormSheet`'s success effect calls `router.push(`${detailHrefBase}/${pageId}`)` when `!page && state.pageId` (i.e. create only), going straight to the block editor instead of "create → close → reopen → click Manage blocks". Edit-mode is unaffected — it still uses the explicit "Manage blocks →" button described above, since an edit has other unsaved-edit-loss considerations a fresh create doesn't. Lint + `tsc --noEmit` re-confirmed clean on both touched files (`src/app/admin/pages/actions.ts`, `src/components/admin/content/PageFormSheet.tsx`).

- [x] **C-2.3: Confirm the master screens inherit this automatically**
  - Files: none (verification only)
  - Details: `PageListClient`/`PageFormSheet` are the single shared implementation (AD-5), so `/admin/master/pages` in Stage 6 gets the corrected one-entry-point UX for free. **Stage 6 must not reintroduce a second icon** — this is called out again in Step 24 below.

### C-3 — No privileged default language in *input validation*

**Problem (confirmed):** `Page.title_pl` is `String` (NOT NULL) in `prisma/schema.prisma`, and `TextBlockConfigEditor.tsx` marks Polish with a required asterisk and blocks save on empty `text_pl`. The user's explicit correction: the rule is "**at least one of the tenant's currently enabled locales has a non-empty value**", never a specific hardcoded language.

**Scope note:** this is about *input/save validation only*. `resolveLocalized()`'s **display** fallback chain (`lang` → `pl` → any non-empty) is correct as-is and must not change. `Service.name_pl` / `MasterProfile.bio_pl` genuinely are required-non-null at the DB level by an earlier deliberate decision — **do not change their behavior.**

- [x] **C-3.1: Make `Page.title_pl` nullable**
  - Files: `prisma/schema.prisma` (edit), `prisma/migrations/<timestamp>_page_title_pl_nullable/migration.sql` (new)
  - Details: change `title_pl String` → `title_pl String?`. Generate the migration with the same non-interactive workflow as Step 2 (`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`, hand-place the timestamped folder, `npx prisma migrate deploy`, `npx prisma generate`).
  - ⚠️ **SQLite cannot `ALTER COLUMN`**, so the generated SQL will be a **table rebuild** for `Page` (create `new_Page`, `INSERT INTO new_Page SELECT … FROM Page`, drop, rename, recreate the unique index). That is expected here. Before applying, verify: (a) the `INSERT … SELECT` data-preserving statement is present, (b) the `@@unique([ownerType, masterId, slug])` index is recreated, (c) **only `Page` is rebuilt** — if the diff also wants to rebuild `TenantConfig`, `MasterProfile`, `User`, or `Block`, stop and report.

- [x] **C-3.2: Shared "at least one enabled locale" helper**
  - Files: `src/lib/localized-content.ts` (edit)
  - Details: add one pure function next to the existing `resolveLocalized`/`parseEnabledLocales`:
    `export function hasAnyEnabledLocaleValue(field: LocalizedField, enabledLocales: Language[]): boolean` — returns `true` when at least one `enabledLocales` entry has a non-empty trimmed value. This file is the right home: it is already the framework-free, client-and-server-safe module for per-locale DB columns, already imported by both sides, and already documented as such in `src/lib/AGENTS.md`. Purely additive — no change to `resolveLocalized` or `parseEnabledLocales`.

- [x] **C-3.3: Drop the hardcoded `text_pl` requirement from the block config schema**
  - Files: `src/lib/content/blocks.ts` (edit)
  - Details: `textBlockConfigSchema` becomes `{ text_pl: z.string().optional(), text_en: z.string().optional(), text_uk: z.string().optional() }`, and `defaultConfigFor('text')` returns `{}` instead of `{ text_pl: '' }`. **Then audit every reader for a bare `config.text_pl.trim()`/`config.text_pl` access** — with the field optional, those now throw on `undefined`. Known call sites to fix: `PageBlocksEditor.tsx`'s `isTextInvalid`, `TextBlockConfigEditor.tsx`'s required-hint, and (not yet written) Stage 4's `TextBlockRenderer.tsx`. Use `?? ''` or the shared helper everywhere.
  - The existing `tests/lib/content/blocks.test.ts` compares against `defaultConfigFor('text')` rather than a literal, so it should keep passing — re-run it to confirm.

- [x] **C-3.4: Server-side validation via the shared helper**
  - Files: `src/app/admin/pages/actions.ts` (edit), `src/app/admin/pages/block-actions.ts` (edit)
  - Details:
    - `createPage`/`updatePage`: `title_pl` is no longer `.min(1)` in the Zod object — all three title fields become optional strings. After parsing, load the tenant's locales (`getTenantConfig()` from `src/lib/tenant.ts` + `parseEnabledLocales()`) and reject with a **form-level** `{ error: t('admin.pages.titleRequiredAnyLocale') }` when `hasAnyEnabledLocaleValue({ pl: title_pl, en: title_en, uk: title_uk }, enabledLocales)` is false. Use the form-level `error` (not `fieldErrors`), since pinning the message to one locale's field is exactly the bias being removed.
    - `createPage`'s slug source can no longer be `title_pl`: derive it from `slugify(resolveLocalized({ pl: title_pl, en: title_en, uk: title_uk }, DEFAULT_LANGUAGE))` — `resolveLocalized` already falls back to `pl` then any non-empty locale, which is precisely the right "pick whatever the admin actually filled in" behavior, and `slugify` already falls back to `'page'` for an empty/unslugifiable result.
    - `updateBlockConfig`: after the existing shape validation, when `block.type === 'text'`, apply the same `hasAnyEnabledLocaleValue` check and return `{ error: t('admin.pages.textRequiredAnyLocale') }` when it fails.
    - Write `title_pl: parsed.data.title_pl || null` (the column is nullable now).

- [x] **C-3.5: Client-side — remove the "Polski *" treatment**
  - Files: `src/components/admin/content/TextBlockConfigEditor.tsx` (edit), `src/components/admin/content/PageBlocksEditor.tsx` (edit), `src/components/admin/content/PageFormSheet.tsx` (edit)
  - Details:
    - `TextBlockConfigEditor`: delete the `required = lang === DEFAULT_LANGUAGE` logic, the per-locale `*` asterisk, and the `!config.text_pl.trim()` error. Replace with one generic hint below the whole field group — a new `admin.pages.anyLocaleRequiredHint` key — shown only while `hasAnyEnabledLocaleValue(...)` is false, computed from `enabledLocales` and never pinned to a tab. Keep the `locales` list exactly as the tenant's enabled locales (drop the `DEFAULT_LANGUAGE` force-prepend, which is another form of the same bias).
    - `PageBlocksEditor`: `isTextInvalid` becomes `block.type === 'text' && !hasAnyEnabledLocaleValue({ pl: config.text_pl, en: config.text_en, uk: config.text_uk }, enabledLocales)` — same disabled-save-button behavior, non-language-specific rule.
    - `PageFormSheet`: stop passing `required` to `LocalizedFieldInput` for the title, and add the same generic hint under it.
  - **`LocalizedFieldInput.tsx` needs no change.** Investigated: its pl-is-required behavior is entirely driven by its own `required` prop (`required={required && lang === DEFAULT_LANGUAGE}`) — passing `required={false}` (the default) switches it off completely. That is the least invasive option and leaves `ServiceForm`/`MasterServiceForm`/`MasterForm` behavior untouched. **Do not** modify `LocalizedFieldInput` or its other callers.

- [x] **C-3.6: Type fallout + i18n + tests**
  - Files: `src/lib/content/pages-shared.ts`, `src/lib/content/pages-server.ts`, `src/components/admin/content/PageListClient.tsx`, `src/locales/{pl,en,uk}.json`, `tests/lib/content/` (all edits)
  - Details: `NavPage.title_pl` and `PageListClient`'s `PageWithBlocks.title_pl` become `string | null`; `resolveLocalized` already accepts null so the display call sites need no logic change, only the type widening. Add `admin.pages.titleRequiredAnyLocale`, `admin.pages.textRequiredAnyLocale`, `admin.pages.anyLocaleRequiredHint` to all three locale files and remove any now-unused `admin.pages.titleRequired`/`admin.pages.textRequired` keys. Extend `tests/lib/content/` with `hasAnyEnabledLocaleValue` coverage: true when only `en` is filled and `en` is enabled; false when only `pl` is filled but `pl` is **not** in `enabledLocales`; false for whitespace-only values; false for an empty field object.

### C-4 — Sheet slide-in animation is too subtle (shared UI primitive)

**Problem:** `SheetContent` offsets by only `2.5rem` during enter/exit. On a `sm:max-w-sm` (~384px) panel that is a ~10% shift over 200ms, which reads as a flash/pop rather than a slide.

- [x] **C-4.1: Increase the travel distance for all four sides**
  - Files: `src/components/ui/sheet.tsx` (edit)
  - Details: in `SheetContent`'s className, replace the four `2.5rem` offsets with full off-screen travel, keeping the existing arbitrary-value authoring style (this file targets **Tailwind v3** — see the note in `src/components/AGENTS.md` about v4-only syntax):
    - `data-[side=right]:data-ending-style:translate-x-[100%]` and the matching `data-starting-style` variant
    - `data-[side=left]:…:translate-x-[-100%]`
    - `data-[side=bottom]:…:translate-y-[100%]`
    - `data-[side=top]:…:translate-y-[-100%]`
    Percentages are relative to the element's own size, so this lands each panel fully off-screen regardless of its `w-3/4`/`sm:max-w-sm`/`h-auto` sizing. Also bump the popup's `duration-200` → `duration-300` so full travel reads as a deliberate slide; leave `ease-in-out` and the backdrop's `duration-150` alone. No other change to this file — do not touch the close button, the portal, or `SheetOverlay`'s opacity transition.

- [x] **C-4.2: Sanity-check the other Sheet consumers**
  - Files: none (read-only verification)
  - Details: this is a shared primitive used at 7 sites. Read through and confirm nothing assumes a small travel distance or a specific transform: `src/components/admin/AdminSidebar.tsx` (`side="left"`, `w-72 max-w-[85vw]` mobile drawer), `src/app/admin/master/calendar/CalendarToolbar.tsx` (`side="bottom"`, `max-h-[80vh] overflow-y-auto`), `src/app/admin/services/ServicesClient.tsx`, `src/app/admin/masters/MastersClient.tsx`, `src/app/admin/master/services/MasterServicesClient.tsx`, `src/app/admin/admins/AdminsClient.tsx`, and the corrected `PageListClient.tsx`. The bottom sheet is the one to look at hardest (`h-auto` + 100% Y travel must still start fully below the fold). Report the result; make no code changes in these files.

- [ ] **C-4.3: Record the shared-component change**
  - Files: covered by Step 29's DOX pass
  - Details: `src/components/AGENTS.md` gets one line noting `SheetContent`'s full-travel slide (all four sides, `duration-300`) so nobody "optimises" it back to a small offset later.
  - **Intentionally left unchecked here** — this item is explicitly deferred to Step 29's DOX pass (its own "Files" line says so); nothing to do during the correction round itself.

### C-5 — Verification for the correction round

- [x] **C-5.1: Re-verify before resuming Stage 4**
  - Commands: `npm run lint` → `npm run i18n:check` → `npm run test` → `npm run build`, then `wc -l` on every touched file.
  - Also: after the C-3.1 migration, confirm in `npx prisma studio` that the existing "Test Page" row survived the table rebuild with its `title_pl`, `slug`, `order`, and `visibility` intact, and that its blocks are still attached.
  - Per the Stage-3 process note: do **not** run `npm run build` while the user has a `next dev` session open on this working copy; if it is run, tell the user to restart the dev server before manual testing.

**C-5.1 results (2026-07-25):**
- `npm run lint` → same 45 pre-existing problems (40 errors/5 warnings) as the Stage-1 baseline, in files this feature never touches — zero new lint issues from the correction round. Still deferred to Step 30 per standing instruction.
- `npm run i18n:check` → PASS (1195 keys in sync across pl/en/uk, all referenced keys resolve).
- `npm run test` → 26 files / 161 tests, all passing (was 25/155 before this round; +1 file/+6 tests from `tests/lib/content/localized-content.test.ts`).
- `npm run build` → succeeds, `/admin/pages` and `/admin/pages/[id]` still compile cleanly. **This was run** — per the process note, the user should restart `next dev` before manual testing.
- `wc -l` on every touched file → max 293 lines (`PageListClient.tsx`), all well under 500.
- "Test Page" row confirmed via direct `prisma.page.findMany` query (not the Studio GUI, which isn't launchable from this agent) to have survived the C-3.1 table rebuild with `title_pl`, `slug`, `order`, `visibility`, and both attached blocks all intact — see the migration section above for the before/after JSON dump. The user can additionally eyeball it in `npx prisma studio` if they want the GUI confirmation.

⏸ **STOP — user re-tests `/admin/pages`: drag a page and a block to reorder, single pencil click → sheet → "Manage blocks →", create a page with an English-only title, create a text block with only Ukrainian filled, and watch a Sheet actually slide in.**

---

### Stage 4 — Public block rendering

All files `"use client"` unless noted, in `src/components/content/`.

- [x] **Step 16: Photo widget renderers (one file per style)**
  - Files:
    - `src/components/content/photo-widget/StripWidget.tsx` (new) — the scrolling marquee. Port the animation approach from `src/components/reviews/ReviewsMarquee.tsx` (framer-motion `animate={{ x: ['0%','-33.33%'] }}`, content tripled for a seamless loop); source photos from `config.photos` instead of `ReviewImage[]`. Respect `useReducedMotion()` (`src/hooks/useReducedMotion.ts`) — no animation when the user prefers reduced motion.
    - `src/components/content/photo-widget/FadeWidget.tsx` (new) — photos cross-fading in/out at different positions; framer-motion `AnimatePresence`, fixed-height container, also reduced-motion aware (falls back to a static row).
    - `src/components/content/photo-widget/StackWidget.tsx` (new) — Mac-Photos-style stacked thumbnails (slight rotation/offset), click expands via the shared `Lightbox`.
    - `src/components/content/PhotoWidgetRenderer.tsx` (new) — switch on `config.style`; renders `null` for an empty `photos` array.

- [x] **Step 17: Gallery, lightbox, text**
  - Files:
    - `src/components/content/Lightbox.tsx` (new) — shared `fixed inset-0 z-50` overlay: backdrop, zoom/fade transition (framer-motion), prev/next arrows, `ArrowLeft`/`ArrowRight`/`Escape` key handling, touch-swipe navigation, click-outside to close, `document.body` scroll lock while open. Props `{ photos: string[]; index: number; onClose(); onIndexChange(i) }`.
    - `src/components/content/PhotoGalleryRenderer.tsx` (new) — full-bleed responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, rounded thumbs), click → `Lightbox`. Distinct from `PhotoWidgetRenderer`: no style variants.
    - `src/components/content/TextBlockRenderer.tsx` (new) — resolves the active locale via `useCurrentLanguage()` + `resolveLocalized({ pl: text_pl, en: text_en, uk: text_uk }, lang)`; renders with `whitespace-pre-line` so line breaks survive. Plain text only — no HTML, no `dangerouslySetInnerHTML`.
    - ⚠️ **Per C-3:** `text_pl` is optional — never dereference it directly. `resolveLocalized` handles `undefined` fields already; render `null` when it returns an empty string.

- [x] **Step 18: Block/page composition**
  - Files:
    - `src/components/content/BlockRenderer.tsx` (new) — `parseBlockConfig(block.type, block.config)` then switch to the matching renderer; unknown type ⇒ `null`.
    - `src/components/content/PageRenderer.tsx` (new) — props `{ page, blocks, masterId?: string }`. Renders: the `TopNavLine` (Step 20), the localized page title (`resolveLocalized` on `title_*`), then the ordered blocks. Layout container matching the rest of the site (`mx-auto w-full max-w-5xl px-4`).
    - ⚠️ **Per C-3:** `page.title_pl` is `string | null`; resolve through `resolveLocalized` and skip the heading entirely if the result is empty.
    - **Sequencing note:** `TopNavLine` doesn't exist yet at this point (it's Step 20, Stage 5) — `PageRenderer.tsx` accepts `masterId` in its props type now (satisfying Step 19's call shape) but does not render `<TopNavLine>` yet, since importing a not-yet-existing component would break Stage 4's build. `<TopNavLine masterId={masterId} />` will be added as the first child of `PageRenderer` when Step 20/21 actually build `TopNavLine` — a small necessary addition to `PageRenderer.tsx` not explicitly listed in Step 20's file list, but directly implied by this step's own "Renders: the TopNavLine (Step 20)" text.

- [x] **Step 19: Public page routes**
  - Files:
    - `src/app/pages/[slug]/page.tsx` (new) — Server Component, `export const dynamic = 'force-dynamic'`; `getPageWithBlocks({ ownerType: 'global', masterId: null, slug })`; `notFound()` when missing/disabled; renders `<BackButton />`, the top-right `LanguageToggle` + `ThemeToggle` cluster (same markup as `src/app/[masterId]/page.tsx` lines 255–258), and `<PageRenderer>`.
    - `src/app/[masterId]/pages/[slug]/page.tsx` (new) — same, with `ownerType: 'master'`, `masterId: params.masterId`; `notFound()` if the master doesn't exist or the page isn't theirs; passes `masterId` to `PageRenderer`; `<BackButton href={`/${params.masterId}`} />`.
    - `src/components/BackButton.tsx` (edit) — add an optional `href` prop defaulting to `'/'`. Additive only; do not change its styling or any existing call site.
  - Note: `app/pages/[slug]` (two segments) never collides with the one-segment `app/[masterId]` route.

**Stage 4 verification results (2026-07-25):**
- `npx tsc --noEmit` → clean.
- `npx eslint` on all new/edited files → clean.
- `npm run i18n:check` → PASS, no new keys needed (no user-facing copy strings added in this stage — image `alt=""` and icon-only Lightbox/gallery controls, consistent with the codebase's existing icon-only-button convention).
- `npm run test` → 26 files / 161 tests, all passing, no regressions.
- `npm run build` → succeeds; confirmed `/pages/[slug]` and `/[masterId]/pages/[slug]` both compile as separate dynamic routes with no collision against `/[masterId]`.
- `wc -l` on all new/edited files → max 108 lines (`Lightbox.tsx`), all well under 500.

⏸ **STOP — user opens the page created in Stage 3 at its public URL.**

### Stage 5 — Top nav line + homepage widget slot

- [x] **Step 20: Public content API + nav line**
  - Files:
    - `src/app/api/content/route.ts` (new) — public `GET /api/content?masterId=<optional>`. No auth (public content). Returns `{ pages: NavPage[], footerBlock: BlockSlot | null }` (`footerBlock` is `null` when no `masterId`). `export const runtime = "nodejs"`; wrap in `try/catch` returning `{ pages: [], footerBlock: null }` on failure (match `/api/masters`'s soft-fail style — a content error must never break the booking page).
    - `src/components/content/TopNavLine.tsx` (new) — `"use client"`. Props `{ masterId?: string }`. React Query `useQuery({ queryKey: ['content-nav', masterId ?? 'home'], queryFn: () => fetch(`/api/content${masterId ? `?masterId=${masterId}` : ''}`).then(r => r.json()), staleTime: 60_000 })`. Returns `null` when the list is empty (AD-7). Renders: a 1px `bg-border` rule spanning the width, faded on the left with `[mask-image:linear-gradient(to_right,transparent,black_18%,black_100%)]` so the logo/back-button corner stays clean; tabs (`next/link`, active state via `usePathname()`) laid along it, titles resolved with `useCurrentLanguage()` + `resolveLocalized`. Mobile: the tab row is `overflow-x-auto custom-scrollbar` (the shared utility in `src/styles/globals.css`) — never wraps into the icon clusters.
    - `src/components/content/MasterFooterBlock.tsx` (new) — `"use client"`, reads the **same** query key so it costs no extra request; renders `<BlockRenderer>` for `footerBlock` or `null`.
    - ⚠️ **Per C-3:** a tab whose title resolves to an empty string should be skipped rather than rendered blank.

- [x] **Step 21: Mount the nav line**
  - Files: `src/components/home/HomeClient.tsx` (edit), `src/app/[masterId]/page.tsx` (edit)
  - Details:
    - `HomeClient.tsx`: render `<TopNavLine />` as the first child of `<main>`, absolutely positioned `top-4 left-0 right-0 z-10` with right padding reserved for the existing icon cluster. **Do not move, restyle, or re-parent** the existing `UserDropdown`/`LanguageToggle`/`ThemeToggle` blocks or the logo blocks.
    - `src/app/[masterId]/page.tsx`: render `<TopNavLine masterId={masterId} />` immediately after `<BackButton />`, with left padding reserved for the back button and right padding for the toggles. **Do not touch** anything else in this file in this step — no changes to the calendar/service/booking UI, its state, its refs, or its framer-motion config.

- [x] **Step 22: Homepage widget slot — admin side**
  - Files: `src/app/admin/settings/HomepageWidgetSection.tsx` (new), `src/app/admin/settings/SettingsForm.tsx` (edit, ≤8 lines), `src/app/admin/settings/actions.ts` (edit), `src/app/admin/settings/page.tsx` (edit)
  - Details:
    - `HomepageWidgetSection.tsx`: wraps `SingleBlockSlotEditor` (`allowed={['photoWidget']}`, `name="homepageWidgetBlock"`) in the shared `SettingsSection` from `./FormFields`, and calls the `onChange` prop to mark the form dirty — exactly like `LanguagesSection.tsx`.
    - `SettingsForm.tsx`: add the import and render `<HomepageWidgetSection value={config.homepageWidgetBlock} onChange={() => setIsDirty(true)} />` next to `<LanguagesSection>`; add `homepageWidgetBlock: string | null` to the local `TenantConfig` type. Nothing else. Confirm `wc -l` stays under 500.
    - `actions.ts`: add `homepageWidgetBlock: z.string().optional().default("")` to the schema, `formData.get("homepageWidgetBlock") || ""` to `raw`, and `homepageWidgetBlock: parsed.data.homepageWidgetBlock || null` to `data`.
    - `settings/page.tsx`: thread `homepageWidgetBlock` through `fullConfig`.

- [x] **Step 23: Homepage widget slot — public side**
  - Files: `src/app/page.tsx` (edit), `src/components/home/HomeClient.tsx` (edit)
  - Details: pass `config.homepageWidgetBlock` into `HomeClient`; where `<ReviewsMarquee>` is mounted today, render `<BlockRenderer>` for the parsed slot (or `null`). Keep the wrapper `<div className="mt-auto pt-12 w-full">` but **drop `hidden lg:block`** so an admin-configured widget is visible on mobile too — when the slot is unset the wrapper's content is `null`, so today's layout is unchanged. Remove the `ReviewsMarquee` import, the `initialReviews` prop, and the `getCachedReviews()` call orphaned by this change. Then **delete** `src/components/reviews/ReviewsMarquee.tsx` and `src/lib/reviews.ts` (AD-8) — verify with a grep first that nothing else imports them.
  - Confirmed via grep before deleting: only `HomeClient.tsx` (removed in this same step) and the files themselves imported them; a hit in `StripWidget.tsx` was just a doc-comment mention, not an import. Both files deleted; `src/components/reviews/` is now empty and was removed with it.
  - `PageRenderer.tsx` also updated here (not a separate file in this step's list, but the natural fulfillment of Step 18's deferred "Renders: the TopNavLine" note) to actually mount `<TopNavLine masterId={masterId} />` now that it exists.

**Stage 5 verification results (2026-07-25):**
- `npx tsc --noEmit` → clean.
- `npm run i18n:check` → PASS (1197 keys in sync across pl/en/uk).
- `npm run lint` (full repo) → still exactly 45 pre-existing problems (40 errors/5 warnings), same count as every prior check. Scoped `eslint` on Stage 5's own new files was clean; a scoped check that happened to include `[masterId]/page.tsx`, `SettingsForm.tsx`, and `HomeClient.tsx` surfaced 3 unused-import errors in those files — confirmed via `git stash` (reverting to the pre-Stage-5 commit) that all three already exist at that commit, so they're part of the existing deferred baseline, not something Stage 4/5 introduced. Left for Step 30 as before.
- `npm run test` → 26 files / 161 tests, all passing, no regressions.
- `npm run build` → succeeds; confirmed `/api/content` and `/pages/[slug]` compile. **This was run** — restart `next dev` before manual testing.
- `wc -l` on every touched file → max 480 lines (`SettingsForm.tsx`, +3 lines from its ≤8-line budget), all under 500.

⏸ **STOP — user verifies the nav line on the homepage + booking page and the homepage widget.**

## Correction C-6 (2026-07-25, post-Stage-5 live testing)

**Problem (confirmed structural, not a styling nitpick):** `TopNavLine` and the icon clusters (`UserDropdown`/`LanguageToggle`/`ThemeToggle`) were two independently absolutely-positioned elements that only shared a vertical band by coincidence — not visually one bar. Tabs rendered as filled `bg-card` pill chips over the hairline, reading as separate buttons rather than an integrated nav bar. And `TopNavLine` returned `null` entirely with zero tabs (AD-7), which is exactly why toggling a page shifted the layout.

**Confirmed fix (user-provided a reference screenshot for structure only, not color treatment):** one persistent top bar containing the hairline, the page tabs, and the control icons together — icons live inside the bar, not outside it. The bar never disappears (no layout shift when pages toggle) and never renders as a solid-colored rectangle — the fade-to-nothing hairline is the only visual separation.

- [x] **C-6.1: `TopNavLine.tsx` — permanent bar, plain-text tabs**
  - Removed `if (tabs.length === 0) return null` entirely — the `<nav>` (hairline + layout shell) always renders now; only the tabs *within* it are conditional. This is the AD-7 reversal recorded above.
  - Restyled tabs: dropped the `bg-card`/`shadow-sm` filled-pill treatment; tabs are now plain text links (`text-sm font-medium text-muted-foreground hover:text-foreground`), active state via `border-b-2 border-primary text-foreground` (default `border-b-2 border-transparent` reserves the same space so the underline never shifts layout on hover/active) — no background fill anywhere. The hairline's fade-mask gradient is unchanged.
  - Dropped the component's own `w-full` default (now just `relative`) since both call sites now embed it as a `flex-1 min-w-0` child of a shared flex row rather than a standalone full-width block.

- [x] **C-6.2: `HomeClient.tsx` — merge nav line + desktop icon cluster**
  - The old separate "nav line absolute div" + "desktop icon cluster absolute div" are now one `hidden lg:flex absolute top-4 left-4 right-4 z-20 items-center justify-between gap-3` wrapper: `<TopNavLine className="min-w-0 flex-1" />` followed by a `<div className="flex shrink-0 items-center gap-2">` holding `UserDropdown`/`LanguageToggle`/`ThemeToggle`. Scoped to `lg:` only, per the confirmed brief.
  - The two mobile-specific icon divs (`flex lg:hidden absolute top-4 right-4` with `ThemeToggle`; `flex lg:hidden absolute top-4 left-4` with `UserDropdown`+`LanguageToggle`) are untouched, still independently positioned exactly as before.
  - `TopNavLine` still renders on mobile too (own `lg:hidden` wrapper, same padding it had before this correction) — the brief only asked to scope the *icon merge* to desktop, not to hide the nav line on mobile.
  - Logo blocks, `MasterSelector`, and the homepage widget block below were not touched.

- [x] **C-6.3: `[masterId]/page.tsx` — merge nav line + icon cluster**
  - Same merge, applied at all breakpoints (this file never had a separate mobile/desktop icon split to preserve): one `absolute top-4 left-0 right-0 z-20 flex items-center justify-between gap-3 pl-28 sm:pl-32` wrapper holding `<TopNavLine masterId={masterId} className="min-w-0 flex-1" />` then `<div className="flex shrink-0 items-center gap-2 pr-4">` with `LanguageToggle`/`ThemeToggle`.
  - `BackButton`'s own position is untouched. The `pl-28 sm:pl-32` left padding (clearance for the fixed `BackButton`) is kept exactly as it was; the old `pr-24 sm:pr-28` right padding is dropped since the icons are now real flex-row content positioned by `justify-between`, not independently-absolutely-positioned content the nav line had to reserve dead space for.
  - Confirmed via `git diff` that nothing else in this file changed — the calendar/service/booking `motion.div`, its state, refs, and autoscroll effects are untouched.

- [x] **C-6.4: Verification**
  - `npx tsc --noEmit` → clean. `npx eslint` on the three touched files → the same 2 pre-existing unused-import errors already tracked in Stage 5's verification note (`[masterId]/page.tsx`'s `Image`, `HomeClient.tsx`'s `Link`) — confirmed unrelated to this fix, deferred to Step 30. `npm run lint` (full repo) → still exactly 45 pre-existing problems, zero new. `npm run test` → 26 files / 161 tests, all passing. `npm run build` → succeeds, `/[masterId]` and `/[masterId]/pages/[slug]` still compile. `wc -l`: `TopNavLine.tsx` 73, `HomeClient.tsx` 147, `[masterId]/page.tsx` 417 — all well under 500.

- [x] **C-6.5: Follow-up fix — two remaining structural bugs found by the user live-testing C-6.1–C-6.4 (fixed directly by the orchestrator, not the Coder)**
  - **Bug 1:** the hairline was `top-1/2 -translate-y-1/2` — vertically centered *through* the tab/icon row, so text and icons visually looked pierced by the line ("elements stuck into the line") instead of sitting above it.
  - **Bug 2:** `TopNavLine`'s own box only spanned the tabs' width (icons were a separate flex sibling outside it per C-6.2/C-6.3), so the fade-mask gradient's 18%-transparent-then-solid transition landed right at the start of the first tab's text instead of in the empty space reserved for a corner logo — and the line then stopped abruptly right before the icon cluster instead of continuing solid underneath it.
  - **Fix:** `TopNavLine` now takes an `actions?: ReactNode` prop and owns the *entire* bar — tabs and the caller's icon cluster render together inside it, in a `pb-2.5` row, with the hairline moved to `absolute inset-x-0 bottom-0` (a bottom-border-style divider below the content, not through its middle) and its fade-mask now spanning the bar's true full width (`black_15%`) so it fades only at the true left edge and stays solid underneath tabs and icons alike. `HomeClient.tsx` (desktop only, mobile untouched) and `[masterId]/page.tsx` updated to pass their icon clusters via the new `actions` prop instead of rendering them as an independent flex sibling.
  - Verified: `npx eslint` on the three files → same 2 pre-existing unused-import errors as C-6.4, nothing new; `npx tsc --noEmit` → clean. No test suite covers these UI components. Did **not** run `npm run build` (user's dev server may be running) — no restart needed for this round.

- [x] **C-6.6: Follow-up polish — spacing, right-edge reach, tab styling (fixed directly by the orchestrator, per user request to use the `frontend-design` skill for the tab visuals)**
  - Bar felt too tall (`pb-2.5` gap before the hairline, `top-4` offset) and the line stopped visibly short of the true right edge (`right-4` inset). Tightened: `pb-2.5 → pb-1.5`, wrapper `top-4 → top-3`, wrapper `right-4 → right-2` (both `HomeClient.tsx` and `[masterId]/page.tsx`), tab `gap-4 → gap-1.5`.
  - Fade zone shrunk (`black_15% → black_8%`) so the reserved-for-logo space at the far left is smaller and tabs/solid line start closer to the true left edge.
  - Tabs restyled per the user's ask ("not just text, but not the flat colored buttons either"): `rounded-full` chip shape, no fill at rest (`text-muted-foreground`, `hover:bg-muted/50`), active tab gets a soft `bg-primary/12` tint + `ring-1 ring-inset ring-primary/25` outline instead of a hard solid fill — reads as an intentional, designed control without repeating the flat `bg-card` pill look that was rejected in C-6.
  - Verified: `npx eslint`/`npx tsc --noEmit` clean (same 2 pre-existing unused-import errors as before, unrelated). `npm run build` not run (user's dev server may be running).

- [x] **C-6.7: Follow-up — C-6.6's changes were real but imperceptible; root cause found and fixed**
  - Two problems, not one: (1) the tab restyling in C-6.6 only gave the *active* tab a visible treatment — but no tab is ever active while standing on the homepage itself (none of their `href`s match `/`), so the user was only ever looking at the resting state, which barely differed from plain text. (2) the spacing/edge tweaks (`right-4→right-2`, `top-4→top-3`) were only 4-8px changes — not perceptible on a ~2000px-wide screen.
  - Fixed: tabs now get a visible `rounded-full border` chip at rest too (`border-border/70 bg-card/50 text-foreground/75`), not just when active (active: `border-primary/40 bg-primary/15 text-primary`) — so the "is this a button" question is answered immediately regardless of route. Cut spacing much harder: `pb-1.5 → pb-0.5`, wrapper `top-3 → top-2`, wrapper `right-2 → right-0` (both files) with a small internal `pr-2` on the content row so the hairline itself still reaches the true edge while the icon cluster keeps a hair of breathing room. Fade zone shrunk again, `black_8% → black_4%`.
  - Verified: `npx eslint`/`npx tsc --noEmit` clean, same 2 pre-existing unrelated errors. `npm run build` not run.

- [x] **C-6.8: Follow-up — fade zone was too aggressively shrunk in C-6.6/C-6.7; user marked the correct fade-conclude point on a screenshot**
  - Tab shape/placement confirmed correct this round (circled as good). The fade zone had been progressively shrunk (`15%→8%→4%`) in earlier rounds while chasing a different bug (the vertical-centering/narrow-box issues, fixed in C-6.5) — never actually the right lever. The user annotated a screenshot marking where the fade should visually conclude, roughly 26-28% into the bar's width. Set `black_4% → black_28%`.
  - Tab chip vertical padding trimmed once more (`py-1 → py-0.5`) per "make it thinner still".
  - Verified: `npx eslint`/`npx tsc --noEmit` on `TopNavLine.tsx` clean.

- [x] **C-6.9: Root cause found — fade-mask % and tab position were never linked; added a real reserved leading space**
  - The user restarted their dev server (confirmed via `ps`/`lsof` it was a genuine fresh process on port 3001) and still saw no visible change, which correctly ruled out the stale-bundle theory from C-6.8. Verified directly with `curl` against the live server: the `black_28%` fade change from C-6.8 WAS being served (present in the static SSR HTML), but the tab pills themselves are only rendered client-side after `TopNavLine`'s React Query fetch resolves — so a plain `curl` can't see them, and more importantly, **the tabs' horizontal starting position was never actually tied to the hairline's fade percentage at all** — they're two unrelated style properties. Every round of adjusting `black_N%` changed only the invisible 1px underline's own gradient; the tab content itself always started at the same fixed position (right after the wrapper's `left-4`). That's the real reason nothing looked different: the fade edits were correct but affected the wrong, barely-visible element.
  - Added a new `leadingSpaceClassName` prop to `TopNavLine` — real Tailwind padding applied to the tabs `<nav>` specifically (not the outer wrapper, so the hairline still spans and fades across the *full* bar width underneath). `HomeClient.tsx` passes `pl-24` (homepage only — reserves real empty space for a future logo before "Test3" starts). `[masterId]/page.tsx` does not pass it (no logo on that page, already gets its own clearance from `pl-28`/`pl-32` for `BackButton`).
  - Verified with `curl` directly against the live dev server (not a screenshot) that `pl-24` is now actually present in the served HTML, so this one is confirmed landing before asking the user to re-check. `npx eslint`/`npx tsc --noEmit` clean (same 1 pre-existing unrelated error in `HomeClient.tsx`).

- [x] **C-6.10: Bigger leading space, applied to master pages too, plus master-page avatar/line overlap fixed**
  - `leadingSpaceClassName` doubled (`pl-24 → pl-48`) on the homepage, and now also passed on `[masterId]/page.tsx` — user wants consistent tab starting position across homepage and every master page, not conditioned on whether a logo exists there yet ("no logo there, you're right, but we'll think about that more later").
  - Found and fixed a real bug the user caught live: on a master's booking page, the permanent nav bar (absolutely positioned, sits above the flow) had nothing reserving space below it, so `BrandHeader`'s circular avatar rendered directly underneath and visually collided with the hairline. Added `pt-12` to the content wrapper in `[masterId]/page.tsx` so the avatar clears the bar.
  - Bar trimmed once more (`pb-0.5 → pb-0`) per the repeated "make the bar thinner" request.
  - Verified live, not by screenshot: `curl`'d both the homepage and the actual master route from the user's screenshot (`/cmqr00i5c0003ox6yxwrqpct0`) against the running dev server and confirmed `pl-48` and `pt-12` are both present in the served HTML before asking for another visual check. `npx eslint`/`npx tsc --noEmit` clean (same 2 pre-existing unrelated errors).

- [x] **C-6.11: Leading space increased again by the same increment (`pl-48 → pl-72`, +96px, matching the size of the previous bump), both pages. Verified live via `curl` on both routes before reporting.**

- [x] **C-6.12: Leading space increased by half the previous increment (`pl-72 → pl-[21rem]`, +48px = half of the prior +96px bump), both pages. Verified live via `curl`.**

- [x] **C-6.13: Leading space increased again by the same increment (`pl-[21rem] → pl-96`, +48px), both pages. Verified live via `curl`. Now at 384px reserved before the tabs start.**

- [x] **C-6.14: Hairline fade-mask reduced ~40% (`black_28% → black_17%`), so the underline itself reaches solid sooner. Verified live via `curl` on both routes.**

⏸ **STOP — user re-verifies.**

## Paused 2026-07-25 — do this before Stage 6, not after

C-6 is **not** considered resolved. The user stopped mid-iteration (out of time/patience, not because it's right) after C-6.14 still showed no visible fade change despite `curl`-confirmed live CSS. Do not resume Stage 6 until this section is worked through with the user first, live, screenshot-in-hand — the last several rounds of blind percentage/spacing tweaks (C-6.6 through C-6.14) were not an effective way to converge on this; treat it as a fresh design pass, not another numeric nudge.

1. **Tab styling is explicitly rejected as-is** ("уебищные кнопки" — user's own words). The `rounded-full border` chip treatment from C-6.6/C-6.7 needs a real redesign, not another parameter tweak. The user has no fixed vision for this yet and said so directly — needs a proper design conversation (possibly the visual companion, or a few concrete mockup options to react to) rather than more one-shot CSS edits.
2. **New idea raised, unexplored:** tabs should feel visually related/"attracted" to the logo when one is configured — logo as an anchor the tabs cluster toward, rather than tabs sitting in an independent flat row. Vague on purpose (user's own words: "не знаю, короче") — needs to be workshopped, not assumed.
3. **Master booking page has no logo**, so whatever "tabs relate to the logo" concept means needs a distinct, deliberate answer for master pages specifically — right now the reserved leading space just leaves them looking centered/floating with nothing to anchor to. Don't assume the homepage's eventual solution auto-transfers.
4. **Unrelated, older, still-open item — do NOT lose track of this:** the master booking page's calendar card has an unused gap below it that was flagged back at the very start of this feature's brainstorming (`docs/superpowers/specs/2026-07-25-content-pages-design.md` background) — shrink the calendar, remove the dead gap. Never implemented. Explicitly not part of C-6, but the user wants it bundled into the same "master page isn't done yet" pass.
5. **Public content-page rendering itself (`/pages/[slug]`, `PageRenderer` + block renderers) is rough/unfinished visually** ("там всё вообще ужасно сейчас") — needs its own design pass, separate from the nav bar. The user's instinct is that whatever visual language gets figured out for the tabs will likely extend to this too, but that's not confirmed — check before assuming.

None of Stage 6 (master pages CRUD + footer slot — the functional/data-plumbing work) is blocked by this list; it's specifically the *visual* layer above it (Stage 5's nav bar, plus these newly-raised page-rendering/calendar items) that needs to be resolved first per the user's explicit ordering request.

### Stage 6 — Master pages + footer slot

- [ ] **Step 24: `/admin/master/pages` routes + nav entry**
  - Files:
    - `src/app/admin/master/pages/page.tsx` (new) — Server Component with an explicit `session.user.role !== "MASTER"` → `redirect('/auth/login')` guard; loads the master's own pages (`listPagesForOwner`) + `enabledLocales` + their current `footerBlock`; renders `<MasterFooterBlockSection>` then `<PageListClient scope="master" detailHrefBase="/admin/master/pages">`.
    - `src/app/admin/master/pages/loading.tsx` (new), `src/app/admin/master/pages/[id]/page.tsx` (new, `<PageBlocksEditor>`), `src/app/admin/master/pages/[id]/loading.tsx` (new).
    - `src/components/admin/adminNavItems.ts` (edit) — add `{ labelKey: "admin.nav.pages", href: "/admin/master/pages", icon: FileText }` to `masterNavItems` (own entry, reusing the same label key).
  - ⚠️ **Per C-2.3:** this screen reuses the corrected `PageListClient`/`PageFormSheet` verbatim — **one** row entry point (pencil → sheet → "Manage blocks →"), drag handles for reorder. Do **not** reintroduce a `FolderOpen` row link or chevron move buttons here, and do not fork a master-specific copy of either component.

- [ ] **Step 25: Master footer slot — master's own editor**
  - Files: `src/app/admin/master/pages/actions.ts` (new), `src/app/admin/master/pages/MasterFooterBlockSection.tsx` (new)
  - Details: `actions.ts` exports one `"use server"` action, `saveMasterFooterBlock(prev, formData)`, gated on `session.user.role === "MASTER"`, writing `MasterProfile.footerBlock` for `session.user.id` only (upsert on `userId`), then `revalidatePath("/admin/master/pages")` + `revalidatePath("/", "layout")`. `MasterFooterBlockSection.tsx` is a small `<form action={...}>` wrapping `SingleBlockSlotEditor` (`allowed={['photoWidget','text']}`, `name="footerBlock"`) with its own submit button.
  - ⚠️ **Per C-3:** don't add a language-specific requirement to the slot. A `text` slot whose every enabled-locale value is empty is stored as `null` (treated as "none") rather than rejected — one line in the action, no new validation surface.

- [ ] **Step 26: Master footer slot — admin side**
  - Files: `src/app/admin/masters/MasterFooterBlockField.tsx` (new), `src/app/admin/masters/MasterForm.tsx` (edit), `src/app/admin/masters/actions.ts` (edit), `src/app/admin/masters/page.tsx` + `MastersClient.tsx` (edit — thread `footerBlock` and `enabledLocales` through if not already available)
  - Details: `MasterFooterBlockField.tsx` wraps `SingleBlockSlotEditor` with a `<Label>` + hint, sized for the Sheet. Add it to `MasterForm.tsx` after the "Show on homepage" block (import + ~6 lines JSX). In `masters/actions.ts`, add `footerBlock: z.string().optional().default("")` to **both** the create and update schemas, read it in `raw`, and write `footerBlock: parsed.data.footerBlock || null` into the `masterProfile` `create`/`update` payloads. Do not touch the password/encryption logic in that file, and do not change `bio_pl`'s existing required/nullable semantics (C-3 is scoped to `Page`/`Block` only).

- [ ] **Step 27: Master footer slot — public side**
  - Files: `src/app/[masterId]/page.tsx` (edit)
  - Details: render `<MasterFooterBlock masterId={masterId} />` as the last child inside the existing `mx-auto w-full max-w-5xl` container, **below** the booking `motion.div`. One added line plus the import. No other change to this file.

⏸ **STOP — user verifies the master panel and the booking-page footer.**

### Stage 7 — Tests, docs, verification

- [ ] **Step 28: API route test**
  - Files: `tests/app/api/content/route.test.ts` (new)
  - Details: mirror-path per `tests/AGENTS.md`; `vi.mock('@/lib/prisma')` with `page`/`block`/`masterProfile` shapes. Cover: no `masterId` ⇒ only `home`-visible enabled global pages; with `masterId` ⇒ `booking`-visible globals + that master's enabled pages, in that order, plus the parsed `footerBlock`; disabled pages excluded; a thrown Prisma error ⇒ `{ pages: [], footerBlock: null }` rather than a 500. If the route ends up importing `@/auth`, add `vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))` (mandatory per `tests/AGENTS.md`).

- [ ] **Step 29: DOX pass**
  - Files: `prisma/AGENTS.md`, `src/lib/AGENTS.md`, `src/app/AGENTS.md`, `src/app/api/AGENTS.md`, `src/app/admin/AGENTS.md`, `src/components/AGENTS.md`
  - Details (one focused bullet each, no diary entries):
    - `prisma/AGENTS.md` — add `Page`/`Block` to the Ownership model list; record the singleton JSON columns, the AD-3 NULL-uniqueness caveat, and (per C-3) that `Page.title_pl` is **nullable on purpose** — content pages require "any enabled locale", unlike `Service.name_pl`/`MasterProfile.bio_pl` which stay required.
    - `src/lib/AGENTS.md` — the `content/` module contract: `blocks.ts` and `pages-shared.ts` are pure/client-safe, `pages-server.ts` is Prisma-only; block config is never trusted (`parseBlockConfig` never throws); `localized-content.ts` now also owns `hasAnyEnabledLocaleValue` as the shared *input-validation* counterpart to `resolveLocalized`'s *display* fallback (C-3).
    - `src/app/api/AGENTS.md` — `GET /api/content` is public, soft-fails to an empty payload.
    - `src/app/admin/AGENTS.md` — `/admin/pages` + `/admin/master/pages`; the shared-actions/session-derived-owner rule (AD-5); the singleton-slot hidden-input pattern; ~~up/down reorder instead of DnD~~ → **dnd-kit drag reorder via whole-list `reorderPages`/`reorderBlocks` actions with exact-id-set ownership assertion** (C-1); the one-entry-point-per-row rule (C-2).
    - `src/app/AGENTS.md` — the two new public routes.
    - `src/components/AGENTS.md` — the `content/` (public renderers) and `admin/content/` (config editors) families and their one-file-per-variant split rule; `SortableList.tsx` as the single dnd-kit wiring point, including the "one `DndContext` per rendered list, never one spanning the desktop table and the mobile card list" caveat (C-1.3); `SheetContent`'s full-travel slide (C-4.3).
    - No new `AGENTS.md` files, so the root `CLAUDE.md` Child DOX Index needs no change — state that explicitly in the report.

- [ ] **Step 30: Full verification sweep**
  - Commands: `npm run lint` → `npm run i18n:check` → `npm run test` → `npm run build`. All must be clean (lint is zero-warnings). Do **not** start a dev server.
  - Also run `wc -l` on every file created or edited by this feature and confirm all are under 500.
  - **Baseline lint cleanup (confirmed by user, 2026-07-25):** Stage 1 found the repo already has ~40 pre-existing lint errors/5 warnings, unrelated to this feature, in: `TurnstileProvider.tsx`, `MasterContext.tsx`, `src/lib/availability.ts`, `booking-helpers.ts`, `turnstile.ts`, `tailwind.config.ts`, and two root `.cjs` scripts. Fix these as part of this step so the final `npm run lint` gate is genuinely zero-warning. **Lint-only fixes** (unused imports/vars, missing types, etc.) — no behavior change. `src/lib/availability.ts` is in the "must not be touched" list in Constraints & Risks for *booking-logic* changes; a pure lint fix there is allowed, but run the full test suite immediately after touching it and confirm zero new failures before moving on. If any "fix" would require an actual logic change to satisfy the linter, stop and report instead of changing behavior.

---

## Acceptance Criteria

- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` passes (no new failures vs. the pre-change baseline)
- [ ] `npm run i18n:check` passes (pl/en/uk key parity, every referenced key resolves)
- [ ] `npm run build` succeeds
- [ ] Every new/edited file is under 500 lines (`SettingsForm.tsx` explicitly re-checked)
- [ ] Exactly three new dependencies exist in `package.json` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) and nothing else was added or version-bumped
- [ ] Follows project conventions: server actions mirror `admin/services/actions.ts`; list surfaces use the desktop-table + `lg:hidden` `DataCard` pairing with a single shared edit `Sheet`; every admin `page.tsx` re-checks its own role; `async` Server Component pages have a sibling `loading.tsx`; no hardcoded user-facing strings
- [ ] With zero pages created and both slots unset, the homepage and `/[masterId]` render **exactly** as before (no nav line, no footer, no layout shift)
- [ ] An admin can create a global page, choose Home / Master-booking visibility, toggle enabled, **drag pages into a new order**, add/**drag-reorder**/remove blocks, and edit each block's config — with **no** up/down chevron buttons anywhere in the pages UI
- [ ] Each page row has exactly **one** entry point (the pencil → edit Sheet); the block-management screen is reached only from the "Manage blocks →" link inside that Sheet, and only when editing an existing page
- [ ] Reordering survives a page reload (the new `order` was actually persisted), and a `reorderPages`/`reorderBlocks` call carrying a foreign or missing id is rejected server-side
- [ ] A page can be created and saved with **only** English (or only Ukrainian) filled in — no field is marked required for a specific language anywhere in the pages UI; saving with *every* enabled locale empty is rejected with the generic "at least one language" message
- [ ] A `text` block saves with only one enabled locale filled and renders that locale's text publicly
- [ ] A master can do the same for their own pages from `/admin/master/pages`, sees no visibility checkboxes, and cannot read or mutate another owner's page or block (verified by the ownership re-check in every action)
- [ ] A master page's tab appears only on that master's booking page; a global page's tabs appear only where its `visibility` says
- [ ] `/pages/<slug>` and `/<masterId>/pages/<slug>` render title + blocks; a disabled or unknown slug 404s
- [ ] `photoGallery` opens a lightbox with arrow-key, swipe, and Escape handling; `photoWidget` renders all three styles and honours reduced-motion
- [ ] `text` blocks render in the visitor's active locale with fallback to any non-empty locale and preserved line breaks
- [ ] Every `Sheet` in the app (right, left, bottom) visibly slides in from off-screen rather than popping, with no layout/content regression at the seven existing call sites
- [ ] Homepage widget slot and master footer slot both save from admin **and** render publicly; unsetting either removes it
- [ ] All photo uploads go through the unmodified `/api/upload`; `src/app/api/upload/route.ts` is byte-identical after the change
- [ ] `Service.name_pl` / `MasterProfile.bio_pl` required-field behavior is unchanged, and `LocalizedFieldInput.tsx` was not modified
- [ ] DOX pass complete: the six listed `AGENTS.md` files updated, no stale text left
- [ ] Completion report lists manual verification steps for the user; confirms `ReviewsMarquee.tsx` / `src/lib/reviews.ts` (and any test covering them) were deleted with no remaining importers

---

## Constraints & Risks

**Must not be touched**
- `src/app/api/upload/route.ts` — reused unmodified; do not duplicate or relax its validation.
- The booking flow: `src/lib/availability.ts`, `src/app/api/{book,availability,bookings/*,procedures}`, `src/components/booking-management/**`, and the calendar/service/booking UI inside `src/app/[masterId]/page.tsx`. That file gets exactly two additive lines (`<TopNavLine>`, `<MasterFooterBlock>`) plus their imports — no changes to its state, refs, autoscroll effects, or framer-motion config.
- `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts` — the new routes are already covered by the `/admin/:path*` matcher; page-level `auth()` guards do the real work.
- Existing migrations and `prisma/app.db` — never hand-edit.
- Encryption/secrets paths (`src/lib/encryption.ts` consumers) — untouched by this feature.
- **`src/components/admin/LocalizedFieldInput.tsx`** and its `ServiceForm`/`MasterServiceForm`/`MasterForm` callers — C-3 is achieved by *not passing* `required`, not by changing the component (see C-3.5).
- **`Service.name_pl` / `MasterProfile.bio_pl` nullability and required-ness** — a separate earlier deliberate decision; C-3 applies only to `Page.title_*` and the `text` block config.

**Prisma migration gotcha (known from a prior session in this repo)**
`npx prisma migrate dev` cannot run non-interactively in this environment. Use the documented workaround (Step 2, and again in C-3.1): `prisma migrate diff --from-migrations … --to-schema-datamodel … --script` → hand-create the timestamped `prisma/migrations/<ts>_<name>/migration.sql` → `npx prisma migrate deploy` → `npx prisma generate`. Also note `prisma/AGENTS.md`: `DATABASE_URL`'s relative path resolves against `schema.prisma`'s own directory, so the live dev DB is `prisma/prisma/app.db`, not the stray `prisma/app.db`.

**Other risks**
- **C-3.1 is a SQLite table rebuild, not an `ALTER COLUMN`.** Making `Page.title_pl` nullable means create-copy-drop-rename. Verify the `INSERT … SELECT` and the recreated unique index before applying, confirm only `Page` is rebuilt, and check the existing test row survived afterwards.
- **dnd-kit duplicate ids.** The page list renders the same row ids twice (desktop table + mobile cards). Each list needs its own `DndContext`; one context spanning both is a real bug (C-1.3).
- **dnd-kit vs. nested buttons.** Rows/cards contain click targets (pencil, delete, save). Use a dedicated drag handle plus a `distance: 4` activation constraint; do not make the whole row draggable.
- **Prisma client types lag.** `prisma.page` / `prisma.block` only exist after `prisma generate`. If TS still complains, use the repo's existing `(prisma.x.findMany as any)` escape hatch with the same eslint-disable comment style — do not restructure the schema.
- **Test mocks.** `tests/app/api/**` mock `@/lib/prisma`; any new model used in a mocked route needs its mock shape added, and routes importing `@/auth` need `vi.mock('@/auth', …)`.
- **SQLite NULL uniqueness** (AD-3) — the composite unique index does not protect global-page slugs; `generateUniqueSlug` must be called on every create.
- **`SettingsForm.tsx` is at 477/500 lines** — the homepage widget section must be a separate file with a ≤8-line touch there.
- **`/api/tenant-config` returns the whole `TenantConfig` row** (a pre-existing over-exposure, out of scope). `homepageWidgetBlock` is non-sensitive, so this is acceptable — but do not add anything sensitive to that model as part of this work.
- **Uploaded photos are never garbage-collected** — deleting a block or page leaves its files in `public/uploads/`. Consistent with existing logo/avatar behavior; explicitly out of scope (the spec defers storage quotas).
- **`sheet.tsx` is a shared primitive** — C-4 changes the animation for all seven existing call sites. CSS-only and low risk, but it must be called out to the user, and C-4.2's read-through is not optional.
- **Dev-server staleness** (learned in Stage 3): after any locale-file change the user needs a hard refresh; after any `npm run build` run against a working copy with `next dev` open, the dev server needs a restart before manual testing.
- **Scope creep guard:** real client-review collection (submission form, moderation, appointment linkage) is a separate future project. Do not add review models, forms, or endpoints. Likewise: no rich-text editor, no drag-and-drop *canvas* builder (the spec's non-goal — sortable lists are not a canvas), no storage quotas, no admin-creates-a-page-for-a-master flow.
