# Plan: Replace master "Bio" with a short "Title" field, clarify footer-block Text hint

**Date:** 2026-08-04
**Status:** Done
**Mode:** LIGHT (repurposes existing `bio_pl`/`bio_en`/`bio_uk` columns, no schema change; written by orchestrator)

## Problem

User instruction (translated): the master admin form's "Bio" field is a full 500-char textarea, but nowhere in the app is a full bio ever actually displayed — the home page master-selector card only shows it as a 2-line-clamped snippet (`MasterSelector.tsx:222-226`, `line-clamp-2`). The admin form should instead present this as a short **Title** field (a tagline/specialization, e.g. "Top Barber · 8 years of experience" — see the user's own Gemini-generated example), not an open-ended biography. Separately, the master's "Booking page footer block" selector (`MasterFooterBlockField.tsx`) has a "Text" option whose purpose isn't obvious — the hint text should clarify that's where a fuller bio/description belongs, and that a dedicated page can be created if even more space is needed.

## Investigation (confirmed via grep, do not re-litigate)

- `MasterProfile.bio_pl`/`bio_en`/`bio_uk` (`prisma/schema.prisma:53-55`) are the only backing fields — used in exactly one admin call site (`MasterForm.tsx:240-251`, `LocalizedFieldInput baseName="bio" variant="textarea"`) and read in exactly one display call site (`MasterSelector.tsx:87-88,222-226`, already `line-clamp-2`).
- `actions.ts` validates both create and update with `z.string().max(500).optional()` for all three locale fields (lines 18-20, 31-33).
- i18n keys `admin.masters.bio` / `admin.masters.bioPlaceholder` (`en.json:442-443` and pl/uk equivalents) are used at exactly one place: `MasterForm.tsx:242,250`.
- `MasterFooterBlockField.tsx`'s hint (`admin.masters.footerBlockHint`) is its own dedicated i18n key, used at exactly one place — **not** shared with the generic block-type dropdown label (`admin.pages.blockType.text`, which IS shared across `HomepageWidgetSection.tsx`, `MasterFooterBlockSection.tsx` under `admin/master/pages/`, and `PageBlocksEditor.tsx`). Renaming the shared dropdown label itself would be wrong — "Text / Bio" makes no sense on the homepage widget picker or a generic content page. Only the master-specific hint paragraph gets touched.
- `LocalizedFieldInput`/`LocaleFieldControl` (`src/components/admin/LocalizedFieldInput.tsx`) has no `maxLength` pass-through today. Without one, a title over the new (shorter) limit would fail silently at submit — `bio` errors were never wired into `MasterForm.tsx`'s `state.fieldErrors` display (only `name`/`email` are). Adding a generic `maxLength?: number` prop (default `undefined` = no limit, zero behavior change for every other existing caller) is the simplest fix — the browser just won't let the admin type past it.

## Decisions

### D1 — Keep the DB columns exactly as `bio_pl`/`bio_en`/`bio_uk`; do not rename

Renaming the Prisma columns (e.g. to `title_pl`) would require a migration and touch `schema.prisma`, `actions.ts`, `route.ts` (`/api/masters`), `MasterSelector.tsx`, `MastersClient.tsx`, `page.tsx` — a schema change, which per this project's CLAUDE.md orchestration rules requires FULL mode (planner → coder → reviewer), for a purely internal rename with zero user-facing benefit (the column name is never shown to anyone). Not worth it. Only the **label, input widget, placeholder copy, and max length** change — the underlying field stays `bio_pl`/`bio_en`/`bio_uk` everywhere in code.

### D2 — `MasterForm.tsx`: textarea → single-line input, 80-char cap

Change the `LocalizedFieldInput` call (currently `variant="textarea"`) to the default `variant="input"` (single line), add `maxLength={80}`, and swap the label/placeholder i18n keys per D3. 80 chars comfortably fits the card's `line-clamp-2` at `text-xs sm:text-sm` in the ~200px-wide selector card without ever needing the clamp to cut mid-word for a well-written tagline.

### D3 — i18n key rename: `bio`/`bioPlaceholder` → `title`/`titlePlaceholder`

Single call site confirmed (`MasterForm.tsx:242,250`) — safe rename, not just a copy change, so a future reader isn't confused by a "bio" key holding "Title" text. New copy, all three locales:

| Key | EN | PL | UK |
|---|---|---|---|
| `title` (label) | `Title` | `Tytuł` | `Заголовок` |
| `titlePlaceholder` | `e.g. Top Barber · 8 years of experience` | `np. Top Barber · 8 lat doświadczenia` | `напр. Топ-барбер · 8 років досвіду` |

### D4 — `actions.ts`: lower validation from 500 to 80 chars

Both `buildCreateSchema`/equivalent and the update schema currently have `bio_pl: z.string().max(500).optional()` (and `bio_en`/`bio_uk` siblings) at lines 18-20 and 31-33 — change all six `max(500)` → `max(80)`. Keep field names (`bio_pl` etc.) unchanged per D1.

### D5 — `LocalizedFieldInput.tsx`: add optional `maxLength` prop

Thread a new optional `maxLength?: number` prop through `LocalizedFieldInputProps` → `LocaleFieldControlProps` → both the `<Input maxLength={maxLength}>` and `<Textarea maxLength={maxLength}>` render branches. Default `undefined` (no `maxLength` attribute rendered, i.e. today's unlimited behavior) so every other existing caller (`name`, page-content fields, etc.) is completely unaffected. `MasterForm.tsx`'s bio/title call site passes `maxLength={80}`.

### D6 — `MasterFooterBlockField.tsx`: clarify the hint, don't touch the shared dropdown label

Update only `admin.masters.footerBlockHint` (confirmed single call site, master-specific key) to explain that choosing "Text" is where a bio/description belongs, and that a dedicated page covers anything longer:

| Locale | New copy |
|---|---|
| EN | `Optional block at the bottom of this master's booking page. Choose "Text" to write a full bio or description — need more space? Create a dedicated page instead.` |
| PL | `Opcjonalny blok na dole strony rezerwacji tego specjalisty. Wybierz „Tekst", aby napisać pełne bio lub opis — potrzebujesz więcej miejsca? Utwórz osobną stronę.` |
| UK | `Необов'язковий блок внизу сторінки бронювання цього спеціаліста. Оберіть «Текст», щоб написати повне біо або опис — потрібно більше місця? Створіть окрему сторінку.` |

Do **not** touch `admin.pages.blockType.text` (the shared dropdown item label "Text") — it's used by `HomepageWidgetSection.tsx` and `PageBlocksEditor.tsx` too, where "bio" would be meaningless. Do **not** touch `MasterFooterBlockSection.tsx` (`admin/master/pages/`, the MASTER role's own self-service equivalent) unless it turns out to share this exact hint key — grep confirms it currently has its own separate copy, so leave it alone in this pass (out of scope, not the form the user showed in the screenshot).

### D7 — No display-side code change needed

`MasterSelector.tsx`'s `getMasterBio()` + `line-clamp-2` rendering (lines 87-88, 222-226) already works correctly for short text — a shorter admin-entered value just means it fits without ever needing the clamp to truncate mid-sentence. Verify this in review; no code change required here.

## Implementation Steps

- [x] **Step 1**: `src/components/admin/LocalizedFieldInput.tsx` — add `maxLength?: number` to `LocaleFieldControlProps` and `LocalizedFieldInputProps`, thread it to both `<Input>` and `<Textarea>`, default `undefined` (D5).
- [x] **Step 2**: `src/app/admin/masters/MasterForm.tsx` — the `LocalizedFieldInput baseName="bio" ...` call: remove `variant="textarea"` (falls back to default `"input"`), add `maxLength={80}`, change `label={t('admin.masters.bio')}` → `label={t('admin.masters.title')}`, change `placeholder={t('admin.masters.bioPlaceholder')}` → `placeholder={t('admin.masters.titlePlaceholder')}` (D2/D3). Do not rename `baseName="bio"` or touch anything else in the file.
- [x] **Step 3**: `src/app/admin/masters/actions.ts` — change all six `bio_pl`/`bio_en`/`bio_uk` `z.string().max(500).optional()` occurrences (create schema lines ~18-20, update schema lines ~31-33) to `.max(80)` (D4). Field names unchanged.
- [x] **Step 4**: `src/locales/en.json`, `pl.json`, `uk.json` — rename `admin.masters.bio` → `admin.masters.title` and `admin.masters.bioPlaceholder` → `admin.masters.titlePlaceholder` with the copy from D3's table; update `admin.masters.footerBlockHint` with the copy from D6's table. Keep the same position in each file (identical across all three locales for diff-friendliness).
- [x] **Step 5**: Verification — `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run i18n:check`. Do NOT run `npm run dev`/`npm run build`.

## Acceptance Criteria

- [x] Admin → Masters → Add/Edit Master shows a single-line "Title" input (not a multi-line textarea) with an example placeholder, capped at 80 characters (browser-enforced via `maxLength`, server-enforced via Zod).
- [x] Saving a master with a short title round-trips correctly through `bio_pl`/`bio_en`/`bio_uk` unchanged (no schema/column change).
- [x] Home page master-selector card still displays the title text under each master's photo, unchanged code path.
- [x] The "Booking page footer block" hint text (master admin form) now explains "Text" is for a bio/description and mentions creating a separate page for more.
- [x] `admin.pages.blockType.text` (the shared block-type dropdown label) is unchanged — confirmed via grep it's untouched, since it's shared with `HomepageWidgetSection.tsx`/`PageBlocksEditor.tsx`.
- [x] `prisma/schema.prisma` is untouched — no migration created.
- [x] Every other existing `LocalizedFieldInput` call site (name, page-content fields, etc.) is unaffected by the new `maxLength` prop (defaults to no limit) — confirmed via grep, no other caller passes `maxLength`.
- [x] `npm run lint` / `npx tsc --noEmit` / `npm run test` / `npm run i18n:check` all clean (lint has 40 pre-existing errors on master, unrelated to this change — confirmed via `git stash` comparison).

## Out of scope

- Renaming the `bio_pl`/`bio_en`/`bio_uk` Prisma columns — explicitly rejected in D1.
- `MasterFooterBlockSection.tsx` (`admin/master/pages/`, the MASTER role's own self-service footer-block editor) — has its own separate hint copy, not touched in this pass.
- `HomepageWidgetSection.tsx`, `PageBlocksEditor.tsx`, or any other consumer of the shared `admin.pages.blockType.*` labels.
- Any change to how `MasterSelector.tsx` renders/clamps the title text — already correct for short text.
