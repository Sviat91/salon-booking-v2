# Design: Content Pages & Photo Galleries

**Date:** 2026-07-25
**Status:** Approved (pending final user read-through)

## Goal

Let admins (and masters, for their own content) build simple content pages — photo galleries, short text sections — that plug into the site's design without touching the booking flow's code or the existing complex master booking page.

## Non-Goals (explicitly out of scope)

- **Real client review collection** (submission form, moderation, linking to an appointment) — flagged as a separate, sizable subsystem during brainstorming and deferred to its own follow-up design/plan. Not designed or built here.
- Rich-text editing for the `text` block — plain `<textarea>` only for MVP, no bold/lists/links.
- A drag-and-drop visual block builder — block management is an ordered add/remove/reorder list, not a canvas.
- Storage quotas / billing by upload volume — consciously deferred (dev-stage tradeoff, same as elsewhere in the project).
- Any change to the master booking page's existing calendar/service/booking UI, animations, or layout — it stays exactly as it is today, aside from two additive slots (see below).

## Data Model

Two new Prisma models:

```prisma
model Page {
  id         String   @id @default(cuid())
  ownerType  String   // 'global' | 'master'
  masterId   String?  // set when ownerType = 'master'
  slug       String
  title_pl   String
  title_en   String?
  title_uk   String?
  enabled    Boolean  @default(true)
  order      Int      @default(0)
  visibility String?  // JSON string[] of page-types, e.g. ["home","booking"] — only meaningful when ownerType='global'

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  master     User?    @relation(fields: [masterId], references: [id], onDelete: Cascade)
  blocks     Block[]

  @@unique([ownerType, masterId, slug])
}

model Block {
  id        String   @id @default(cuid())
  pageId    String
  type      String   // 'photoWidget' | 'photoGallery' | 'text'
  order     Int      @default(0)
  config    String   // JSON, shape depends on type (see Block Types)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  page      Page @relation(fields: [pageId], references: [id], onDelete: Cascade)
}
```

`title_pl/en/uk` follows the existing `Service.name_pl/en/uk` / `MasterProfile.bio_pl/en/uk` localization convention (structured columns, not a translation table), respecting `TenantConfig.enabledLocales`.

Two additional **singleton slots** exist outside the Page/Block list — same block-config shape, but not a navigable page:

- `TenantConfig.homepageWidgetBlock: String?` — JSON config for one `photoWidget` block shown where `ReviewsMarquee` sits today. `null` = nothing shown.
- `MasterProfile.footerBlock: String?` — JSON config for exactly one block (`photoWidget` or `text`) shown at the bottom of that master's booking page, below the existing UI. `null` = nothing shown.

## Ownership & Visibility

- **`ownerType: 'global'`** — created by admin. Tab shown in the top nav line on the homepage and/or on every master's booking page, controlled by `visibility` (checkbox list, reusing the exact pattern already in `LogoEditor.tsx`'s `AVAILABLE_PAGES`: Home / Master booking pages).
- **`ownerType: 'master'`, `masterId` set** — created by that master (from their own panel) or by admin on their behalf. Tab shown **only** in the nav line on that specific master's booking page — never globally, never on other masters' pages.

## Block Types

| Type | Config shape | Rendering |
|---|---|---|
| `photoWidget` | `{ style: 'strip' \| 'fade' \| 'stack', photos: string[] }` | `strip`: scrolling marquee (today's `ReviewsMarquee` behavior). `fade`: photos cross-fade in/out at different positions. `stack`: Mac-Photos-style stacked thumbnail, click to expand/enlarge. Small, embeddable — used inside any page, the homepage slot, or the master footer slot. |
| `photoGallery` | `{ photos: string[] }` | Full-bleed responsive grid + lightbox (click → zoom/fade transition, arrow-key/swipe navigation between photos). Distinct component from `photoWidget` — no style variants, always the grid+lightbox treatment. Typically the sole block on a dedicated gallery page. |
| `text` | `{ text_pl: string, text_en?: string, text_uk?: string }` | Localized plain-text block (line breaks preserved), shown per the visitor's active locale. |

A `Page` is an ordered list of one or more blocks — e.g., a page can combine one `text` block followed by one `photoGallery` block.

Photo uploads for `photoWidget`/`photoGallery` reuse the existing `/api/upload` endpoint unmodified: 4MB/file max, PNG/JPEG/WebP/GIF, already role-gated to ADMIN/MASTER/SUPERADMIN. No hard cap on photo count per block for MVP.

## Routing

- Global page: `/pages/[slug]`
- Master-owned page: `/[masterId]/pages/[slug]`

Slugs auto-generate from the title on creation, uniqueness enforced (per the `@@unique([ownerType, masterId, slug])` constraint) with a numeric suffix on collision.

## Top Nav Line

A new shared component rendered at the top of the homepage (`HomeClient.tsx`) and the master booking page (`[masterId]/page.tsx`, alongside `BrandHeader`), replacing/extending the current icon row:

- A thin horizontal line spanning the width, tapering/fading out on the left before reaching the corner — leaving clean space for the logo (homepage only; the master booking page keeps no logo there, per the existing back-button layout).
- Page tabs sit along the line: on the homepage, all `visibility`-eligible global pages; on a master's booking page, `visibility`-eligible global pages **plus** that master's own pages.
- Existing control icons (theme toggle, language toggle, user dropdown) keep their current position at the right end, unchanged.
- Mobile layout for the tabs (wrapping/scrolling behavior) is resolved during implementation against the existing mobile icon-split pattern already in `HomeClient.tsx` — not a blocking design decision.

## Master Booking Page — What Changes

The existing calendar/service-selection/booking UI, its layout, and its animations are **not touched**. Exactly two additive changes:

1. The top nav line described above (global + this master's own page tabs).
2. One optional footer slot below the existing booking card (`MasterProfile.footerBlock`) — a single `photoWidget` or `text` block, configured from the master's own panel (or admin's master-edit form). Not a list, not a page — one block or nothing.

## Admin & Master UI

- **New top-level admin nav item** `/admin/pages` (own sidebar entry per user's request — not nested under the already-crowded Settings section), following the existing `adminNavItems.tsx` pattern: list of global pages, create/edit/delete, drag-reorder (`order`), enabled toggle, visibility checkboxes, and per-page block management (add/remove/reorder blocks, edit each block's config).
- **New master nav item** `/admin/master/pages`, same CRUD scoped automatically to the session master's own pages — no visibility checkboxes, no owner picker.
- **Homepage widget slot**: a config field group inside existing `/admin/settings`, reusing the same `photoWidget` config editor (style selector + photo uploader/reorder/remove).
- **Master footer slot**: a config field group inside the master's own profile/settings and in admin's `MasterForm.tsx` — block-type picker (none / `photoWidget` / `text`) + the shared config editor for whichever type is chosen.

Shared config-editor components (used identically across the four surfaces above, to avoid duplicating block-editing UI):

- `PhotoWidgetConfigEditor` — style select + photo list (upload/reorder/remove)
- `PhotoGalleryConfigEditor` — photo list (upload/reorder/remove)
- `TextBlockConfigEditor` — pl/en/uk textareas, respecting `enabledLocales`

## Public Rendering

- `PhotoWidgetRenderer`, `PhotoGalleryRenderer`, `TextBlockRenderer` — one component per block type, switched on `block.type`.
- `PageRenderer` — given a `Page` + its ordered `blocks`, renders title + top nav line + each block via the renderers above.

Given the project's 500-line-per-file cap, the planner should split page-management admin UI, block-config editors, and public renderers into small dedicated files rather than a few large ones — this is an implementation-plan concern, not a further design decision.
