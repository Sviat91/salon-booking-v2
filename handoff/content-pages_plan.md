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

### AD-4 — Reorder via up/down buttons, not drag-and-drop
The spec says "drag-reorder"; no DnD library is installed (`package.json` has no `dnd-kit`/`react-beautiful-dnd`), and adding a dependency is out of scope. Page order and block order are changed with `ChevronUp`/`ChevronDown` icon buttons calling a `move…(id, 'up'|'down')` server action that swaps `order` with the adjacent row. Same UX in the global and master screens. Flag this to the user in the completion report.

### AD-5 — One shared set of server actions, owner scope derived from the session
Admin CRUD in this repo uses `app/**/actions.ts` server actions (see `admin/services/actions.ts`, `admin/masters/actions.ts`), not API routes — follow that. To avoid duplicating page/block CRUD twice, **one** implementation lives in `src/app/admin/pages/actions.ts` + `block-actions.ts` and is imported by both `/admin/pages` and `/admin/master/pages` client components. Owner scope is never passed from the client — it is resolved inside every action from `auth()`:

- `ADMIN` / `SUPERADMIN` → `{ ownerType: 'global', masterId: null }`
- `MASTER` → `{ ownerType: 'master', masterId: session.user.id }`
- anything else → reject

Every mutation targeting an existing `Page`/`Block` re-loads the row and verifies it matches the resolved owner before writing. MVP scope: an admin manages global pages only, a master manages their own only (matches the spec's "Admin & Master UI" section). Admin-creating-a-page-on-a-master's-behalf is **not** built.

### AD-6 — Public reads: Server Components read Prisma directly; the nav line uses one public API route
`/pages/[slug]` and `/[masterId]/pages/[slug]` are Server Components reading `src/lib/content/pages-server.ts`. The nav line and master footer slot must also render on `src/app/[masterId]/page.tsx`, which is a `"use client"` component — so they get their data from one new public route, `GET /api/content?masterId=<optional>` → `{ pages, footerBlock }`, consumed via React Query with the shared key `['content-nav', masterId ?? 'home']` so `TopNavLine` and `MasterFooterBlock` share a single request. No Redis caching for content pages (cheap indexed reads; adding a cache layer means new invalidation obligations in `src/lib/cache.ts` for no measurable win).

### AD-7 — The nav line renders **nothing** when there are no eligible tabs
`TopNavLine` returns `null` when its page list is empty. Until an admin creates the first page, the homepage and master booking page are pixel-identical to today. Same rule for both singleton slots (`null`/unset ⇒ render nothing).

### AD-8 — The homepage widget slot replaces the (already-empty) `ReviewsMarquee` mount
`src/lib/reviews.ts`'s `getCachedReviews()` returns `[]` unconditionally today, so `ReviewsMarquee` already renders `null` on every load — swapping it is zero-risk. Remove the `ReviewsMarquee` usage and the now-orphaned `initialReviews` prop plumbing (`src/app/page.tsx` → `HomeClient`). **Delete** `src/components/reviews/ReviewsMarquee.tsx` and `src/lib/reviews.ts` outright as part of Step 23 — confirmed by the user (2026-07-25): no point keeping known-dead code around. Grep for any other importer of either file before deleting; if one exists, stop and report instead of deleting.

### AD-9 — Master footer slot editing surface
The spec says "the master's own profile/settings" — no such page exists (`masterNavItems` = dashboard / services / schedule). The footer-slot editor therefore lives as a section at the top of the new `/admin/master/pages` screen (the master's content surface), plus the admin-side field inside `masters/MasterForm.tsx` as specified. No new master settings page is created.

### AD-10 — File-splitting rules (500-line cap)
No file in this feature may approach 500 lines. The split is fixed up-front:

- one renderer file per block type, plus one per `photoWidget` style variant;
- one config-editor file per block type, plus a shared photo-list editor;
- page CRUD actions and block CRUD actions in separate files;
- list UI, form sheet, and block editor as three separate admin components.

`src/app/admin/settings/SettingsForm.tsx` is already **477 lines** — the homepage widget section may add **at most ~8 lines** there (one import + one JSX element, mirroring `LanguagesSection`). Verify with `wc -l` after editing; if it would exceed 500, stop and report instead of inventing a refactor.

### AD-11 — No new UI primitives or dropdown portals
Block-type pickers use the existing `src/components/ui/select.tsx`; checkboxes use `ui/checkbox.tsx`; sheets/dialogs use `ui/sheet.tsx`/`ui/dialog.tsx`. The lightbox is a plain `fixed inset-0` overlay with `framer-motion` (already a dependency) — no portal-positioning helper needed, so `TimePickerDropdown.tsx`'s pattern is **not** required here. Do not add any npm dependency.

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

- [x] **Step 4: Pure page helpers**
  - Files: `src/lib/content/pages-shared.ts` (new)
  - Details: framework-free. Export:
    - `PAGE_VISIBILITY_TARGETS = [{ id: 'home', labelKey: 'admin.settings.general.homePageLabel' }, { id: 'booking', labelKey: 'admin.settings.general.bookingPageLabel' }]` — reuses the existing i18n keys and mirrors the `AVAILABLE_PAGES` shape in `src/app/admin/settings/LogoEditor.tsx` (only the two targets the spec names: Home / Master booking pages)
    - `parseVisibility(json: string | null): string[]` (safe, `[]` on failure), `serializeVisibility(ids: string[]): string`
    - `slugify(title: string): string` — lowercase, map `ł→l`/`Ł→l`, `String.normalize('NFD')` + strip combining marks, non-`[a-z0-9]` → `-`, collapse/trim dashes, cap at 60 chars, fall back to `'page'` when the result is empty
    - `type NavPage = { id: string; slug: string; href: string; title_pl: string; title_en: string | null; title_uk: string | null }`

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

⏸ **STOP — report Stage 1. User verifies the migration applied cleanly (`npx prisma studio`) before Stage 2.**

### Stage 2 — Shared block-config editors (admin side)

All files below are `"use client"`, live in `src/components/admin/content/`, use `useTranslation()` directly, and map upload failures through `t(apiErrorKey(json.code))` (per `src/app/admin/AGENTS.md`).

- [x] **Step 7: Shared photo list editor**
  - Files: `src/components/admin/content/PhotoListEditor.tsx` (new)
  - Details: props `{ photos: string[]; onChange: (photos: string[]) => void }`. Renders a responsive thumbnail grid (`next/image`, local `/uploads/...` paths), each thumb with move-left / move-right / remove icon buttons, plus an "Upload photo" `<label><input type="file" hidden>` that POSTs `FormData` to **`/api/upload` unmodified** (same call shape as `MasterForm.tsx`'s `handleAvatarUpload`) and appends `json.url`. `accept="image/png,image/jpeg,image/webp,image/gif"` to match the endpoint's `ALLOWED_TYPES`. Show a per-upload pending state and an inline `text-destructive` error. No client-side size/type re-validation — the endpoint owns that.

- [x] **Step 8: Per-type config editors**
  - Files:
    - `src/components/admin/content/PhotoWidgetConfigEditor.tsx` (new) — style `<Select>` (`strip`/`fade`/`stack`, localized labels) + `<PhotoListEditor>`
    - `src/components/admin/content/PhotoGalleryConfigEditor.tsx` (new) — `<PhotoListEditor>` only
    - `src/components/admin/content/TextBlockConfigEditor.tsx` (new) — one `<Textarea>` per enabled locale, driven by an `enabledLocales: Language[]` prop; mirror `LocalizedFieldInput.tsx`'s tab UI conceptually but keep it controlled (`value`/`onChange`), since this editor writes into a JSON config object rather than emitting form fields. `text_pl` is required (non-empty) before the block can be saved.
  - Details: each takes `{ config, onChange(config) }` and is purely controlled. Keep each under 120 lines.

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

- [ ] **Step 11: Page CRUD server actions**
  - Files: `src/app/admin/pages/actions.ts` (new)
  - Details: `"use server"`. Follow `src/app/admin/services/actions.ts` exactly: `getServerT()` for messages, a `build…Schema(t)` factory (never a module-scope schema), `safeParse`, `{ error?, fieldErrors?, success? }` state, `revalidatePath` at the end. Every action starts by calling `auth()` → `resolvePageOwner()`; `null` owner ⇒ return `{ error: t('errors.UNAUTHORIZED') }`.
    - `createPage(prev, formData)` — reads `title_pl` (required) / `title_en` / `title_uk` (only when present in the FormData — reuse the `readOptionalLocaleField` pattern so a disabled locale never nulls a saved translation), `enabled` checkbox, `visibility` (hidden JSON input, ignored for master owners). Slug via `slugify(title_pl)` → `generateUniqueSlug`. `order` = current max + 1 within the owner scope.
    - `updatePage(id, prev, formData)` — same fields; **does not** touch `slug` (AD-3).
    - `deletePage(id)` — blocks cascade via the FK.
    - `movePage(id, direction)` — swap `order` with the adjacent row in the same owner scope.
    - `togglePageEnabled(id, enabled)`.
    - All of them: load the row first and reject if `ownerType`/`masterId` don't match the resolved owner.
    - `revalidatePath("/admin/pages")`, `revalidatePath("/admin/master/pages")`, `revalidatePath("/", "layout")`.

- [ ] **Step 12: Block CRUD server actions**
  - Files: `src/app/admin/pages/block-actions.ts` (new)
  - Details: `"use server"`, same auth/ownership gate, resolved through the block's parent page.
    - `createBlock(pageId, type)` — validates `type` against `BLOCK_TYPES`, stores `defaultConfigFor(type)`, `order` = max + 1.
    - `updateBlockConfig(blockId, configJson)` — re-validate with the type's Zod schema server-side before persisting; reject invalid JSON.
    - `deleteBlock(blockId)`, `moveBlock(blockId, direction)`.

- [ ] **Step 13: Shared admin page-management components**
  - Files:
    - `src/components/admin/content/PageListClient.tsx` (new) — the list surface, shared by `/admin/pages` and `/admin/master/pages`. Props `{ pages, scope: 'global' | 'master', enabledLocales, detailHrefBase: string }`. Follow the list chrome convention in `src/app/admin/AGENTS.md`: desktop `<table>` in `hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden` with `bg-muted/50` uppercase micro-label `<th>`s, plus a `lg:hidden` `DataCard` list. Columns: title (resolved with `useCurrentLanguage()` + `resolveLocalized`), slug, blocks count, visibility badges (`scope === 'global'` only), enabled `Badge variant="success"/"muted"`, actions (manage blocks link → `${detailHrefBase}/${page.id}`, edit, move up/down, delete with `confirm()`). ONE shared edit `Sheet` controlled by `editTarget`/`editOpen` — never a per-row Sheet (that convention is explicit in the admin AGENTS.md).
    - `src/components/admin/content/PageFormSheet.tsx` (new) — the create/edit form body. `LocalizedFieldInput baseName="title"` for the title, an `enabled` checkbox, and — for `scope === 'global'` only — the visibility checkbox group built from `PAGE_VISIBILITY_TARGETS` with a hidden `visibility` JSON input, styled like `LogoEditor.tsx`'s `AVAILABLE_PAGES` block (`Checkbox` + `onCheckedChange`).
    - `src/components/admin/content/PageBlocksEditor.tsx` (new) — the per-page block list: ordered block cards, each showing its type label, move up/down, delete, and an inline `BlockConfigEditor` with an explicit per-block "Save block" button calling `updateBlockConfig`; plus an "Add block" row (`BlockTypePicker` + add button) calling `createBlock`. Local optimistic state is fine, but truth comes from the server action + `router.refresh()`.

- [ ] **Step 14: `/admin/pages` routes**
  - Files:
    - `src/app/admin/pages/page.tsx` (new) — `async` Server Component; `auth()` guard redirecting to `/auth/login` unless role is `ADMIN`/`SUPERADMIN` (the page must guard itself — middleware is only a first pass); loads `listPagesForOwner({ ownerType: 'global', masterId: null })` + `parseEnabledLocales(config.enabledLocales)`; renders the eyebrow + muted subtitle header (no `<h1>`; the topbar supplies the title) and `<PageListClient scope="global" detailHrefBase="/admin/pages">`.
    - `src/app/admin/pages/loading.tsx` (new) — `TableSkeleton` from `src/components/admin/skeletons/`, wrapped in the same outer container classes as the real page.
    - `src/app/admin/pages/[id]/page.tsx` (new) — Server Component, same guard; loads the page + ordered blocks, 404s (`notFound()`) when the row isn't global-owned; renders `<PageBlocksEditor>` plus a "back to pages" link and the page's public URL.
    - `src/app/admin/pages/[id]/loading.tsx` (new) — `FormSkeleton`.

- [ ] **Step 15: Sidebar nav entry**
  - Files: `src/components/admin/adminNavItems.ts`, `src/locales/{pl,en,uk}.json`
  - Details: add `{ labelKey: "admin.nav.pages", href: "/admin/pages", icon: FileText }` to `adminNavItems` (own top-level entry, **not** nested under Settings — explicit user requirement), importing `FileText` from `lucide-react`. Add the `admin.nav.pages` key to all three locale files. `superadminNavItems` inherits it via the spread; `AdminTopBar`'s title resolves automatically through `getPageTitleKey`.
  - Verify: no `startsWith` collision with `/admin/masters` or any other existing href.

⏸ **STOP — user manually creates a global page with a text block and a gallery block in `/admin/pages`.**

### Stage 4 — Public block rendering

All files `"use client"` unless noted, in `src/components/content/`.

- [ ] **Step 16: Photo widget renderers (one file per style)**
  - Files:
    - `src/components/content/photo-widget/StripWidget.tsx` (new) — the scrolling marquee. Port the animation approach from `src/components/reviews/ReviewsMarquee.tsx` (framer-motion `animate={{ x: ['0%','-33.33%'] }}`, content tripled for a seamless loop); source photos from `config.photos` instead of `ReviewImage[]`. Respect `useReducedMotion()` (`src/hooks/useReducedMotion.ts`) — no animation when the user prefers reduced motion.
    - `src/components/content/photo-widget/FadeWidget.tsx` (new) — photos cross-fading in/out at different positions; framer-motion `AnimatePresence`, fixed-height container, also reduced-motion aware (falls back to a static row).
    - `src/components/content/photo-widget/StackWidget.tsx` (new) — Mac-Photos-style stacked thumbnails (slight rotation/offset), click expands via the shared `Lightbox`.
    - `src/components/content/PhotoWidgetRenderer.tsx` (new) — switch on `config.style`; renders `null` for an empty `photos` array.

- [ ] **Step 17: Gallery, lightbox, text**
  - Files:
    - `src/components/content/Lightbox.tsx` (new) — shared `fixed inset-0 z-50` overlay: backdrop, zoom/fade transition (framer-motion), prev/next arrows, `ArrowLeft`/`ArrowRight`/`Escape` key handling, touch-swipe navigation, click-outside to close, `document.body` scroll lock while open. Props `{ photos: string[]; index: number; onClose(); onIndexChange(i) }`.
    - `src/components/content/PhotoGalleryRenderer.tsx` (new) — full-bleed responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, rounded thumbs), click → `Lightbox`. Distinct from `PhotoWidgetRenderer`: no style variants.
    - `src/components/content/TextBlockRenderer.tsx` (new) — resolves the active locale via `useCurrentLanguage()` + `resolveLocalized({ pl: text_pl, en: text_en, uk: text_uk }, lang)`; renders with `whitespace-pre-line` so line breaks survive. Plain text only — no HTML, no `dangerouslySetInnerHTML`.

- [ ] **Step 18: Block/page composition**
  - Files:
    - `src/components/content/BlockRenderer.tsx` (new) — `parseBlockConfig(block.type, block.config)` then switch to the matching renderer; unknown type ⇒ `null`.
    - `src/components/content/PageRenderer.tsx` (new) — props `{ page, blocks, masterId?: string }`. Renders: the `TopNavLine` (Step 20), the localized page title (`resolveLocalized` on `title_*`), then the ordered blocks. Layout container matching the rest of the site (`mx-auto w-full max-w-5xl px-4`).

- [ ] **Step 19: Public page routes**
  - Files:
    - `src/app/pages/[slug]/page.tsx` (new) — Server Component, `export const dynamic = 'force-dynamic'`; `getPageWithBlocks({ ownerType: 'global', masterId: null, slug })`; `notFound()` when missing/disabled; renders `<BackButton />`, the top-right `LanguageToggle` + `ThemeToggle` cluster (same markup as `src/app/[masterId]/page.tsx` lines 255–258), and `<PageRenderer>`.
    - `src/app/[masterId]/pages/[slug]/page.tsx` (new) — same, with `ownerType: 'master'`, `masterId: params.masterId`; `notFound()` if the master doesn't exist or the page isn't theirs; passes `masterId` to `PageRenderer`; `<BackButton href={`/${params.masterId}`} />`.
    - `src/components/BackButton.tsx` (edit) — add an optional `href` prop defaulting to `'/'`. Additive only; do not change its styling or any existing call site.
  - Note: `app/pages/[slug]` (two segments) never collides with the one-segment `app/[masterId]` route.

⏸ **STOP — user opens the page created in Stage 3 at its public URL.**

### Stage 5 — Top nav line + homepage widget slot

- [ ] **Step 20: Public content API + nav line**
  - Files:
    - `src/app/api/content/route.ts` (new) — public `GET /api/content?masterId=<optional>`. No auth (public content). Returns `{ pages: NavPage[], footerBlock: BlockSlot | null }` (`footerBlock` is `null` when no `masterId`). `export const runtime = "nodejs"`; wrap in `try/catch` returning `{ pages: [], footerBlock: null }` on failure (match `/api/masters`'s soft-fail style — a content error must never break the booking page).
    - `src/components/content/TopNavLine.tsx` (new) — `"use client"`. Props `{ masterId?: string }`. React Query `useQuery({ queryKey: ['content-nav', masterId ?? 'home'], queryFn: () => fetch(`/api/content${masterId ? `?masterId=${masterId}` : ''}`).then(r => r.json()), staleTime: 60_000 })`. Returns `null` when the list is empty (AD-7). Renders: a 1px `bg-border` rule spanning the width, faded on the left with `[mask-image:linear-gradient(to_right,transparent,black_18%,black_100%)]` so the logo/back-button corner stays clean; tabs (`next/link`, active state via `usePathname()`) laid along it, titles resolved with `useCurrentLanguage()` + `resolveLocalized`. Mobile: the tab row is `overflow-x-auto custom-scrollbar` (the shared utility in `src/styles/globals.css`) — never wraps into the icon clusters.
    - `src/components/content/MasterFooterBlock.tsx` (new) — `"use client"`, reads the **same** query key so it costs no extra request; renders `<BlockRenderer>` for `footerBlock` or `null`.

- [ ] **Step 21: Mount the nav line**
  - Files: `src/components/home/HomeClient.tsx` (edit), `src/app/[masterId]/page.tsx` (edit)
  - Details:
    - `HomeClient.tsx`: render `<TopNavLine />` as the first child of `<main>`, absolutely positioned `top-4 left-0 right-0 z-10` with right padding reserved for the existing icon cluster. **Do not move, restyle, or re-parent** the existing `UserDropdown`/`LanguageToggle`/`ThemeToggle` blocks or the logo blocks.
    - `src/app/[masterId]/page.tsx`: render `<TopNavLine masterId={masterId} />` immediately after `<BackButton />`, with left padding reserved for the back button and right padding for the toggles. **Do not touch** anything else in this file in this step — no changes to the calendar/service/booking UI, its state, its refs, or its framer-motion config.

- [ ] **Step 22: Homepage widget slot — admin side**
  - Files: `src/app/admin/settings/HomepageWidgetSection.tsx` (new), `src/app/admin/settings/SettingsForm.tsx` (edit, ≤8 lines), `src/app/admin/settings/actions.ts` (edit), `src/app/admin/settings/page.tsx` (edit)
  - Details:
    - `HomepageWidgetSection.tsx`: wraps `SingleBlockSlotEditor` (`allowed={['photoWidget']}`, `name="homepageWidgetBlock"`) in the shared `SettingsSection` from `./FormFields`, and calls the `onChange` prop to mark the form dirty — exactly like `LanguagesSection.tsx`.
    - `SettingsForm.tsx`: add the import and render `<HomepageWidgetSection value={config.homepageWidgetBlock} onChange={() => setIsDirty(true)} />` next to `<LanguagesSection>`; add `homepageWidgetBlock: string | null` to the local `TenantConfig` type. Nothing else. Confirm `wc -l` stays under 500.
    - `actions.ts`: add `homepageWidgetBlock: z.string().optional().default("")` to the schema, `formData.get("homepageWidgetBlock") || ""` to `raw`, and `homepageWidgetBlock: parsed.data.homepageWidgetBlock || null` to `data`.
    - `settings/page.tsx`: thread `homepageWidgetBlock` through `fullConfig`.

- [ ] **Step 23: Homepage widget slot — public side**
  - Files: `src/app/page.tsx` (edit), `src/components/home/HomeClient.tsx` (edit)
  - Details: pass `config.homepageWidgetBlock` into `HomeClient`; where `<ReviewsMarquee>` is mounted today, render `<BlockRenderer>` for the parsed slot (or `null`). Keep the wrapper `<div className="mt-auto pt-12 w-full">` but **drop `hidden lg:block`** so an admin-configured widget is visible on mobile too — when the slot is unset the wrapper's content is `null`, so today's layout is unchanged. Remove the `ReviewsMarquee` import, the `initialReviews` prop, and the `getCachedReviews()` call orphaned by this change. Then **delete** `src/components/reviews/ReviewsMarquee.tsx` and `src/lib/reviews.ts` (AD-8) — verify with a grep first that nothing else imports them.

⏸ **STOP — user verifies the nav line on the homepage + booking page and the homepage widget.**

### Stage 6 — Master pages + footer slot

- [ ] **Step 24: `/admin/master/pages` routes + nav entry**
  - Files:
    - `src/app/admin/master/pages/page.tsx` (new) — Server Component with an explicit `session.user.role !== "MASTER"` → `redirect('/auth/login')` guard; loads the master's own pages (`listPagesForOwner`) + `enabledLocales` + their current `footerBlock`; renders `<MasterFooterBlockSection>` then `<PageListClient scope="master" detailHrefBase="/admin/master/pages">`.
    - `src/app/admin/master/pages/loading.tsx` (new), `src/app/admin/master/pages/[id]/page.tsx` (new, `<PageBlocksEditor>`), `src/app/admin/master/pages/[id]/loading.tsx` (new).
    - `src/components/admin/adminNavItems.ts` (edit) — add `{ labelKey: "admin.nav.pages", href: "/admin/master/pages", icon: FileText }` to `masterNavItems` (own entry, reusing the same label key).

- [ ] **Step 25: Master footer slot — master's own editor**
  - Files: `src/app/admin/master/pages/actions.ts` (new), `src/app/admin/master/pages/MasterFooterBlockSection.tsx` (new)
  - Details: `actions.ts` exports one `"use server"` action, `saveMasterFooterBlock(prev, formData)`, gated on `session.user.role === "MASTER"`, writing `MasterProfile.footerBlock` for `session.user.id` only (upsert on `userId`), then `revalidatePath("/admin/master/pages")` + `revalidatePath("/", "layout")`. `MasterFooterBlockSection.tsx` is a small `<form action={...}>` wrapping `SingleBlockSlotEditor` (`allowed={['photoWidget','text']}`, `name="footerBlock"`) with its own submit button.

- [ ] **Step 26: Master footer slot — admin side**
  - Files: `src/app/admin/masters/MasterFooterBlockField.tsx` (new), `src/app/admin/masters/MasterForm.tsx` (edit), `src/app/admin/masters/actions.ts` (edit), `src/app/admin/masters/page.tsx` + `MastersClient.tsx` (edit — thread `footerBlock` and `enabledLocales` through if not already available)
  - Details: `MasterFooterBlockField.tsx` wraps `SingleBlockSlotEditor` with a `<Label>` + hint, sized for the Sheet. Add it to `MasterForm.tsx` after the "Show on homepage" block (import + ~6 lines JSX). In `masters/actions.ts`, add `footerBlock: z.string().optional().default("")` to **both** the create and update schemas, read it in `raw`, and write `footerBlock: parsed.data.footerBlock || null` into the `masterProfile` `create`/`update` payloads. Do not touch the password/encryption logic in that file.

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
    - `prisma/AGENTS.md` — add `Page`/`Block` to the Ownership model list; record the singleton JSON columns and the AD-3 NULL-uniqueness caveat.
    - `src/lib/AGENTS.md` — the `content/` module contract: `blocks.ts` and `pages-shared.ts` are pure/client-safe, `pages-server.ts` is Prisma-only; block config is never trusted (`parseBlockConfig` never throws).
    - `src/app/api/AGENTS.md` — `GET /api/content` is public, soft-fails to an empty payload.
    - `src/app/admin/AGENTS.md` — `/admin/pages` + `/admin/master/pages`; the shared-actions/session-derived-owner rule (AD-5); the singleton-slot hidden-input pattern; up/down reorder instead of DnD (AD-4).
    - `src/app/AGENTS.md` — the two new public routes.
    - `src/components/AGENTS.md` — the `content/` (public renderers) and `admin/content/` (config editors) families and their one-file-per-variant split rule.
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
- [ ] Follows project conventions: server actions mirror `admin/services/actions.ts`; list surfaces use the desktop-table + `lg:hidden` `DataCard` pairing with a single shared edit `Sheet`; every admin `page.tsx` re-checks its own role; `async` Server Component pages have a sibling `loading.tsx`; no hardcoded user-facing strings
- [ ] With zero pages created and both slots unset, the homepage and `/[masterId]` render **exactly** as before (no nav line, no footer, no layout shift)
- [ ] An admin can create a global page, choose Home / Master-booking visibility, toggle enabled, reorder pages, add/reorder/remove blocks, and edit each block's config
- [ ] A master can do the same for their own pages from `/admin/master/pages`, sees no visibility checkboxes, and cannot read or mutate another owner's page or block (verified by the ownership re-check in every action)
- [ ] A master page's tab appears only on that master's booking page; a global page's tabs appear only where its `visibility` says
- [ ] `/pages/<slug>` and `/<masterId>/pages/<slug>` render title + blocks; a disabled or unknown slug 404s
- [ ] `photoGallery` opens a lightbox with arrow-key, swipe, and Escape handling; `photoWidget` renders all three styles and honours reduced-motion
- [ ] `text` blocks render in the visitor's active locale with `pl` fallback and preserved line breaks
- [ ] Homepage widget slot and master footer slot both save from admin **and** render publicly; unsetting either removes it
- [ ] All photo uploads go through the unmodified `/api/upload`; `src/app/api/upload/route.ts` is byte-identical after the change
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

**Prisma migration gotcha (known from a prior session in this repo)**
`npx prisma migrate dev` cannot run non-interactively in this environment. Use the documented workaround (Step 2): `prisma migrate diff --from-migrations … --to-schema-datamodel … --script` → hand-create the timestamped `prisma/migrations/<ts>_<name>/migration.sql` → `npx prisma migrate deploy` → `npx prisma generate`. Also note `prisma/AGENTS.md`: `DATABASE_URL`'s relative path resolves against `schema.prisma`'s directory, so the live dev DB is `prisma/prisma/app.db`, not the stray `prisma/app.db`.

**Other risks**
- **Prisma client types lag.** `prisma.page` / `prisma.block` only exist after `prisma generate`. If TS still complains, use the repo's existing `(prisma.x.findMany as any)` escape hatch with the same eslint-disable comment style — do not restructure the schema.
- **Test mocks.** `tests/app/api/**` mock `@/lib/prisma`; any new model used in a mocked route needs its mock shape added, and routes importing `@/auth` need `vi.mock('@/auth', …)`.
- **SQLite NULL uniqueness** (AD-3) — the composite unique index does not protect global-page slugs; `generateUniqueSlug` must be called on every create.
- **`SettingsForm.tsx` is at 477/500 lines** — the homepage widget section must be a separate file with a ≤8-line touch there.
- **`/api/tenant-config` returns the whole `TenantConfig` row** (a pre-existing over-exposure, out of scope). `homepageWidgetBlock` is non-sensitive, so this is acceptable — but do not add anything sensitive to that model as part of this work.
- **Uploaded photos are never garbage-collected** — deleting a block or page leaves its files in `public/uploads/`. Consistent with existing logo/avatar behavior; explicitly out of scope (the spec defers storage quotas).
- **Scope creep guard:** real client-review collection (submission form, moderation, appointment linkage) is a separate future project. Do not add review models, forms, or endpoints. Likewise: no rich-text editor, no drag-and-drop canvas, no storage quotas, no admin-creates-a-page-for-a-master flow.
