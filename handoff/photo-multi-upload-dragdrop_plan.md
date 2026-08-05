# Plan: Custom-page photo widgets — multi-file upload + drag-and-drop reordering

**Date:** 2026-08-05
**Status:** Implemented — lint/test green; browser/manual checks pending user verification

## Goal

In the shared photo editor used by every `photoWidget`/`photoGallery` config surface, let the admin (1) pick many photos at once in a single file-dialog interaction and upload them as one batch, and (2) reorder them by dragging the tiles instead of clicking left/right arrow buttons — reusing the existing `dnd-kit` wiring in `SortableList.tsx` rather than adding a second drag implementation.

---

## Verified current state (re-read this session, line numbers are current)

| File | Lines | Relevant facts |
| --- | --- | --- |
| `src/components/admin/content/PhotoListEditor.tsx` | **116** | Props `{ photos: string[]; onChange: (photos: string[]) => void }`. Imports `ChevronLeft, ChevronRight, Trash2, Upload` (L6). State: `uploading` (L22), `error: string \| null` (L23). `handleUpload` L25–43 (single `files?.[0]`, one `FormData` `file` field, `onChange([...photos, json.url])`). `move(index, direction)` L45–51. `remove(index)` L53–55. Grid `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` L60. Tile L62–66 (`key={`${url}-${i}`}`, `relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30`, `next/image` `fill`+`object-cover`). Overlay bar L67–94 (`absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1`) = ChevronLeft L68–76 / Trash2 L77–84 / ChevronRight L85–93. Upload `<label>`+hidden `<input>` L100–112 (`accept="image/png,image/jpeg,image/webp,image/gif"`, **no** `multiple`). Error line L113. |
| `src/components/admin/content/SortableList.tsx` | **86** | `DragHandleProps` L22–28 (`setNodeRef`/`style`/`attributes`/`listeners`/`isDragging` — all confirmed present on `useSortable()`'s return). `SortableItem` L35–42. `SortableListProps` L44–48. Doc comment L50–59 ("the single place dnd-kit is wired (AD-10, C-1.3)", no `DragOverlay` by design). Sensors L61–64 (`PointerSensor` `{distance: 4}` + `KeyboardSensor`). `handleDragEnd` L66–73 (`arrayMove(ids, oldIndex, newIndex)` → `onReorder`). Render L75–85: `DndContext` → `SortableContext items={ids} strategy={verticalListSortingStrategy}` (**hardcoded, L77**) → `ids.map(id => <SortableItem key={id} …>)`. **Emits no DOM of its own** — the caller owns the container element. |
| `src/lib/content/blocks.ts` | 54 | `photoWidgetConfigSchema` L15–18 (`{ style, photos: z.array(z.string()) }`), `photoGalleryConfigSchema` L21–23 (`{ photos: z.array(z.string()) }`). `defaultConfigFor` L49–53. Persisted shape is a bare `string[]`. |
| `src/app/api/upload/route.ts` | 51 | One `formData.get("file")` per POST, `ALLOWED_TYPES` incl. `image/svg+xml` (L7), 4 MB cap (L8), returns `{ url: "/uploads/<Date.now()>-<random>.<ext>" }`. Error codes `VALIDATION_ERROR` / `INVALID_FILE_TYPE` / `FILE_TOO_LARGE` / `UNAUTHORIZED` — all four are in `KNOWN_ERROR_CODES` (`src/lib/errors/apiErrorKey.ts`) and all have `errors.*` strings in `pl/en/uk.json` (L1331–1332 etc). **Contract frozen.** |
| `@dnd-kit/sortable@^10.0.0` | — | `dist/index.d.ts` L5/L9 confirm `rectSortingStrategy` and `type SortingStrategy` are both exported; `SortableContext`'s `strategy?: SortingStrategy` prop confirmed in `components/SortableContext.d.ts` L9. No new dependency needed. |

**`PhotoListEditor` has FOUR live surfaces** (verified by grep — this is wider than "the page block editor"):

1. `/admin/pages/[id]` → `PageBlocksEditor` → `BlockConfigEditor` → `Photo{Widget,Gallery}ConfigEditor` → `PhotoListEditor`. **Rendered inside `SortableList`'s `DndContext`** (block reordering) → the photo editor's own `DndContext` will be **nested**.
2. `/admin/master/pages/[id]` and `/admin/masters/[masterId]/pages/[id]` — same component chain.
3. `/admin/settings` → `HomepageWidgetSection` → `SingleBlockSlotEditor` → `BlockConfigEditor` → `PhotoListEditor`. Lives **inside `<form id="settings-form">`** and drives the sidebar Save button via the `settings-dirty` event.
4. `/admin/masters` → Masters **Sheet** → `MasterForm` → `MasterFooterBlockField` → `SingleBlockSlotEditor` → … → `PhotoListEditor`. Also inside a real `<form>`, inside a `Sheet`.

Consequences that must not be missed: every new `<button>` needs `type="button"` (surfaces 3 & 4 would otherwise submit the form on click **and** on the KeyboardSensor's Space activation), and drag must work inside a `Sheet` (surface 4) and inside a nested `DndContext` (surfaces 1–2).

Existing i18n (verified in all three of `pl.json`/`en.json`/`uk.json`):
`admin.pages.dragHandleLabel` = "Drag to reorder" / "Przeciągnij, aby zmienić kolejność" / "Перетягніть, щоб змінити порядок" (L519) — fully generic, **reused as-is**. `admin.pages.addPhoto` (L493), `admin.pages.removePhoto` (L496), `admin.masters.uploading` (L435), `admin.masters.uploadFailed` (L437) all stay in use. `admin.pages.movePhotoLeft`/`movePhotoRight` (L494–495) become orphaned.

---

## Architecture Decisions

### A. `SortableList` gains a `strategy?: "list" | "grid"` prop — a string union, not a dnd-kit value

`verticalListSortingStrategy` assumes single-column reflow and mis-animates a wrapping grid; `rectSortingStrategy` is the correct strategy for a multi-column grid (confirmed exported). The prop is a **string union mapped internally**, not a `SortingStrategy` value passed in by the caller, so that `PhotoListEditor` imports **nothing** from `@dnd-kit/*` and the file's own contract ("the single place dnd-kit is wired") stays literally true. Default `"list"` ⇒ `PageBlocksEditor.tsx` and `PageListClient.tsx` (3 call sites total: blocks, desktop table, mobile card list) need **zero changes and render byte-identically**. `collisionDetection={closestCenter}`, the two sensors, the 4px activation distance, `handleDragEnd`, `DragHandleProps`, and the no-`DragOverlay` decision are all untouched.

The caller keeps owning the container element: `SortableList` renders only context providers, so `PhotoListEditor` wraps `<SortableList>` in its existing `<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">` and the tiles become direct grid children. This is exactly how `PageListClient` already puts sortable `<tr>`s inside its own `<tbody>`.

### B. Tile ids are **derived** from `photos` on every render — never persisted

The persisted shape stays `string[]`; nothing about ids reaches the DB or the zod schemas. dnd-kit needs one unique, reorder-stable string id per tile, and the only content-derived identity available is the URL itself. Upload filenames are `Date.now()`-plus-random so real duplicates are practically impossible, but the persisted shape *permits* a repeated URL (that's why the current code hedges with `key={`${url}-${i}`}`), and a duplicate id inside one `DndContext` silently breaks dragging. So: **URL as id, with an occurrence suffix for repeats.**

Both the derivation and the reverse mapping go into a new pure module `src/lib/content/photo-ids.ts` (React-free, Prisma-free, client-safe — the same contract `content/pages-shared.ts` already carries), because the reverse mapping is the one place in this feature where a bug loses user data silently: an `undefined` in the array fails `z.array(z.string())` on save, and `parseBlockConfig` then falls back to `defaultConfigFor(type)` — i.e. **every photo in the block disappears**. It gets a small no-mock unit test (`tests/lib/content/photo-ids.test.ts`), matching the existing `tests/lib/content/` mirror and the "extract the one unit-testable piece" precedent from the calendar work.

Rejected alternatives: positional ids (`String(i)`) — always unique but identity is positional, so React reuses the DOM node at each slot and swaps `src`, killing dnd-kit's post-drop layout animation and forcing index parsing on the way back; a `useState`/`useRef` id table synced to the array — same positional semantics as `String(i)` with far more code and a sync bug surface.

### C. Drag affordance = a dedicated `GripVertical` handle in the existing overlay bar, **not** the whole tile

The whole-tile drag surface (Google-Photos style) was considered and rejected on one concrete, decisive ground: making the tile the drag activator requires `touch-action: none` on the tile (dnd-kit's documented requirement for `PointerSensor` touch drags — without it the browser claims the gesture for scrolling first). At the mobile breakpoint the grid is `grid-cols-2`, so tiles cover most of the viewport width, and `touch-none` on them would **block vertical page scroll** over the photo grid on every one of the four surfaces (the admin dashboard has a first-class `lg` mobile contract). The alternative touch fix — swapping `PointerSensor`'s activation constraint to a `{ delay, tolerance }` long-press — would change the shared sensor config and therefore change behaviour for the block/page lists, breaking the backward-compatibility bar in decision A.

A grip handle also: keeps `touch-none` confined to a ~22px button; needs no `stopPropagation` juggling next to the Trash2 button (the listeners simply aren't on the tile); avoids nesting an interactive `<button>` inside a `role="button"` element (dnd-kit's `attributes` set `role`/`tabIndex`); reproduces the exact drag/keyboard affordance the admin already learned from block and page reordering; and is a *smaller* diff.

Layout: the overlay bar keeps `justify-between` with exactly two children — `GripVertical` (left, where ChevronLeft was) and Trash2 (right, unchanged). Same `rounded p-1 text-white hover:bg-white/20` treatment as the buttons it replaces, plus `cursor-grab touch-none active:cursor-grabbing` copied verbatim from `PageBlocksEditor.tsx` L156.

### D. Multi-upload = chunked parallel (`UPLOAD_CONCURRENCY = 3`) + **one** `onChange` at the end

`/api/upload` stays untouched and is called once per file. Two sub-decisions:

- **Chunked concurrency of 3**, not one big `Promise.allSettled` over the whole selection and not strictly sequential. The route buffers each file whole in memory (`await file.arrayBuffer()` → `Buffer`), so an unbounded fan-out of a 30-file selection is ~120 MB of simultaneous server-side buffers on a small VPS. The browser's per-origin connection limit is *not* a safety net here — behind nginx/TLS this is HTTP/2, which multiplexes every request onto one connection with no 6-request cap. Chunking bounds peak server memory at 3 × 4 MB while still being ~3× faster than sequential, in ~6 lines and with no new dependency. `Promise.allSettled` per chunk means one rejected file never aborts the rest.
- **A single `onChange([...photosRef.current, ...urls])` after the whole batch**, not an append per file. N appends would each be computed from a stale render closure (`photos` is a prop, and `onChange` has no functional-update form), so the naive version drops all but the last upload. Accumulating locally and writing once removes that class of bug entirely, and successful URLs are appended in the user's selection order (`allSettled` results are index-aligned; chunks are processed in order).
  `photosRef` (`useRef` + `useEffect(() => { photosRef.current = photos }, [photos])`) is what makes the single write safe against the prop changing mid-flight — e.g. the admin deletes or drag-reorders a photo while an 8-file batch is still uploading. Basing the final append on the *latest committed* array instead of the closure means such an edit is preserved rather than silently reverted. This is also why no affordance needs to be disabled during upload.

Progress: `uploading: boolean` + `error: string | null` are replaced by **`progress: { done, total } | null`** (with `const uploading = progress !== null`) and **`errors: string[]`**. The counter is rendered as `` `${t('admin.masters.uploading')} ${done}/${total}` `` and only when `total > 1`, so the single-file copy is unchanged and no new i18n key is needed ("3/8" is locale-neutral). No progress bar, no placeholder/skeleton tiles — proportional to the component's existing simplicity.

### E. Error surface = one `text-xs text-destructive` line per failed file

`errors: string[]`, each entry `` `${file.name}: ${reason}` ``, where `reason` comes from the existing `json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed')` pattern lifted verbatim out of today's `handleUpload`. Rendered inline exactly where the single error line is today (a `<ul>` of the same `text-xs text-destructive` lines) — no toast, no modal, no new state machine. `errors` is cleared at the start of every batch. The endpoint keeps owning size/type validation: **no client-side re-validation is added** (the file's existing doc comment records that decision deliberately).

### F. i18n: zero new keys

`admin.pages.dragHandleLabel` is generic ("Drag to reorder") and is reused for the grip's `aria-label`/`title`, matching both existing drag handles. `admin.pages.movePhotoLeft`/`movePhotoRight` become orphaned and are **left in place** — same policy as the calendar work (a three-file locale edit for two strings that may be wanted back is not worth the merge risk). `admin.pages.addPhoto` ("Add photo" / "Dodaj zdjęcie") stays singular; see judgment call 4.

### G. Persistence semantics are unchanged (and must be communicated, not "fixed")

Both the batch append and the drag reorder write through `onChange` into the caller's **draft** state, exactly as the arrow buttons do today: on surfaces 1–2 the admin must still press the per-block Save (or the Save-all FAB); on surfaces 3–4 the surrounding form's own save. Nothing in this feature auto-persists, and `PageBlocksEditor`'s save-button logic is explicitly out of scope (separate tracker item).

---

## ⚠️ Judgment calls to sanity-check before the coder runs

1. **Drag affordance = grip handle, not full-tile (decision C).** The load-bearing argument is the mobile `touch-action: none` scroll trap on a `grid-cols-2` layout; the consistency-with-existing-handles and no-nested-interactive arguments are secondary. If you'd rather have full-tile dragging, this is the one call to overturn **before** coding — the flip is mechanical (move `{...attributes} {...listeners}` + `aria-label` + `touch-none` onto the tile root, add `onPointerDown={e => e.stopPropagation()}` to the Trash2 button, keep a decorative `GripVertical`), but it does knowingly cost mobile page-scroll over the grid.
2. **Ids = URL with an occurrence suffix for duplicates, derived per render (decision B).** Accepted degenerate case: with two *identical* URLs in one list, dragging occurrence #1 past occurrence #0 swaps their ids — visually indistinguishable tiles, so it has no observable effect. The reverse mapping is defensive (returns `photos` unchanged on any mismatch) precisely because the failure mode is silent whole-block data loss on save.
3. **Concurrency 3 (decision D).** The number bounds peak server memory at ~12 MB; 10 files = 4 rounds. If you'd prefer maximum speed over that bound, the change is one constant. There is deliberately **no** `MAX_FILES` cap on the selection itself.
4. **`admin.pages.addPhoto` stays "Add photo" (singular) on a button that now opens a multi-select dialog.** Under the reuse-aggressively bar this is mildly-off rather than wrong/confusing, so no new key. Say the word if you want `addPhotos` ("Dodaj zdjęcia" / "Add photos" / "Додати фото") and it becomes a 3-file locale addition + one call site.
5. **The upload `accept` list keeps omitting `image/svg+xml`** even though the route allows it. Pre-existing mismatch, intentionally left alone (it is *narrower* than the server, so it can only ever be conservative — not a bug to fix mid-feature).
6. **Nested `DndContext` (photo grid inside a block card that is itself sortable) is accepted, not designed around.** dnd-kit supports nesting, and both contexts attach their pointer/keyboard listeners to specific activator elements (the grips), never to a container — so an inner grip press cannot reach the outer context. It is nonetheless the highest-risk behaviour in this change and is on the manual checklist.
7. **`progress`/`errors` replace `uploading`/`error` outright.** No compatibility shim; nothing outside the component reads them.

---

## Implementation Steps

- [x] **Step 1: New pure module `src/lib/content/photo-ids.ts`.**
  - Files: `src/lib/content/photo-ids.ts` (new, ~35 lines)
  - Details: no `"use client"`, no imports at all. File doc comment: the persisted block-config shape is a bare `string[]` (`photoWidgetConfigSchema`/`photoGalleryConfigSchema` in `./blocks.ts`) and stays that way, so dnd-kit tile ids are derived per render, never stored; pure/React-free/Prisma-free, same client-safe contract as `pages-shared.ts`.
    ```ts
    /** URL as id; a repeated URL (legal in the persisted shape) gets an occurrence suffix. */
    export function derivePhotoIds(photos: string[]): string[] {
      const seen = new Map<string, number>()
      return photos.map((url) => {
        const n = seen.get(url) ?? 0
        seen.set(url, n + 1)
        return n === 0 ? url : `${url}#${n}`
      })
    }

    /**
     * Maps a reordered id list from `SortableList` back to a reordered photo array.
     * Returns `photos` unchanged on any mismatch: an `undefined` slot would fail
     * `z.array(z.string())` on save, and `parseBlockConfig` then falls back to
     * `defaultConfigFor(type)` — i.e. every photo in the block would be lost.
     */
    export function reorderPhotosByIds(photos: string[], ids: string[], orderedIds: string[]): string[] {
      if (orderedIds.length !== ids.length) return photos
      if (new Set(orderedIds).size !== orderedIds.length) return photos
      const next: string[] = []
      for (const id of orderedIds) {
        const index = ids.indexOf(id)
        if (index === -1) return photos
        next.push(photos[index])
      }
      return next
    }
    ```
  - Do **not** add anything else to this module (no upload helpers, no React), and do not touch `blocks.ts`.

- [x] **Step 2: Generalize `SortableList.tsx` with a backward-compatible `strategy` prop.**
  - Files: `src/components/admin/content/SortableList.tsx` (86 → ~97 lines)
  - Details:
    1. Add `rectSortingStrategy` to the existing `@dnd-kit/sortable` import block (L13–19), keeping the alphabetical order already used there (`SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy`).
    2. Above `SortableListProps` (L44) add:
       ```ts
       /** Layout of the caller's own container: `"list"` = single-column reflow, `"grid"` = wrapping multi-column grid. */
       export type SortableStrategy = "list" | "grid"

       const STRATEGIES = {
         list: verticalListSortingStrategy,
         grid: rectSortingStrategy,
       } as const
       ```
    3. `SortableListProps` gains `strategy?: SortableStrategy` (documented as "defaults to `"list"` — unchanged behaviour for existing callers").
    4. Signature → `export default function SortableList({ ids, onReorder, strategy = "list", children }: SortableListProps)`.
    5. L77 → `<SortableContext items={ids} strategy={STRATEGIES[strategy]}>`.
    6. Append one sentence to the existing doc comment (L50–59): it renders no DOM of its own, so the caller owns the container element (`<tbody>`, flex column, or CSS grid) and `strategy` must match that container's layout. **Keep the existing comment text byte-identical otherwise** — including the `(AD-10, C-1.3)` parenthetical; do not delete it and do not add any new decision-ID references.
  - Nothing else in this file changes: `DragHandleProps`, `SortableItem`, both sensors and the 4px activation distance, `closestCenter`, `handleDragEnd`/`arrayMove`, `key={id}`, and the no-`DragOverlay` decision all stay exactly as they are.

- [x] **Step 3: `PhotoListEditor.tsx` — batch upload.**
  - Files: `src/components/admin/content/PhotoListEditor.tsx`
  - Details:
    1. Imports: `useState` → `useEffect, useMemo, useRef, useState`; drop `ChevronLeft, ChevronRight` and add `GripVertical` (keep `Trash2, Upload`); add `SortableList from "./SortableList"`, `{ derivePhotoIds, reorderPhotosByIds } from "@/lib/content/photo-ids"`, `{ cn } from "@/lib/utils"`.
    2. Module-scope constant above the component:
       ```ts
       /** `/api/upload` takes one file per request and buffers it whole in memory, so a big
        *  selection is uploaded in small parallel batches instead of all at once. */
       const UPLOAD_CONCURRENCY = 3
       ```
    3. Replace the two state hooks (L22–23) with:
       ```ts
       const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
       const [errors, setErrors] = useState<string[]>([])
       const uploading = progress !== null

       // Latest committed `photos`: a batch upload is async and the prop can change
       // mid-flight (a delete or a drag-reorder), so the final append must not be
       // computed from a stale render closure.
       const photosRef = useRef(photos)
       useEffect(() => { photosRef.current = photos }, [photos])

       const ids = useMemo(() => derivePhotoIds(photos), [photos])
       ```
    4. Replace `handleUpload` (L25–43) with a one-file helper plus the batch driver:
       ```ts
       async function uploadOne(file: File): Promise<string> {
         const fd = new FormData()
         fd.append("file", file)
         const res = await fetch("/api/upload", { method: "POST", body: fd })
         const json = await res.json().catch(() => ({}))
         if (!res.ok) throw new Error(json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed'))
         return json.url as string
       }

       async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
         const files = Array.from(e.target.files ?? [])   // read BEFORE clearing the input
         e.target.value = ""
         if (files.length === 0) return
         setErrors([])
         setProgress({ done: 0, total: files.length })
         const urls: string[] = []
         const failed: string[] = []
         for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
           const chunk = files.slice(i, i + UPLOAD_CONCURRENCY)
           const settled = await Promise.allSettled(chunk.map(uploadOne))
           settled.forEach((result, j) => {
             if (result.status === 'fulfilled') urls.push(result.value)
             else failed.push(`${chunk[j].name}: ${result.reason instanceof Error ? result.reason.message : t('admin.masters.uploadFailed')}`)
           })
           setProgress({ done: i + chunk.length, total: files.length })
         }
         if (urls.length > 0) onChange([...photosRef.current, ...urls])
         setErrors(failed)
         setProgress(null)
       }
       ```
       `Array.from(e.target.files ?? [])` **must** run before `e.target.value = ""` — clearing the input invalidates its `FileList`.
    5. Delete `move()` (L45–51) entirely. Keep `remove(index)` (L53–55) byte-identical.
    6. Upload trigger (L100–112): add `multiple` to the `<input>`; keep `type`, the `accept` list, `className="hidden"`, `onChange={handleUpload}`, `disabled={uploading}` and the whole `<label>`/`<div>` wrapper unchanged. Label text becomes:
       ```tsx
       {progress
         ? progress.total > 1
           ? `${t('admin.masters.uploading')} ${progress.done}/${progress.total}`
           : t('admin.masters.uploading')
         : t('admin.pages.addPhoto')}
       ```
    7. Error line (L113) → the per-file list, same typography:
       ```tsx
       {errors.length > 0 && (
         <ul className="flex flex-col gap-0.5">
           {errors.map((msg, i) => <li key={`${msg}-${i}`} className="text-xs text-destructive">{msg}</li>)}
         </ul>
       )}
       ```
    8. Update the file's top doc comment (L14–19): keep the "uploads go through the unmodified `/api/upload` endpoint, no client-side size/type re-validation, the endpoint owns that" statement, and add that a multi-file selection is uploaded one request per file in `UPLOAD_CONCURRENCY`-sized batches, that per-file failures are collected instead of aborting the batch, and that ordering is drag-and-drop via `SortableList` (no arrow buttons).
  - Do not change the component's props, `PhotoListEditorProps`, or the `onChange` contract.

- [x] **Step 4: `PhotoListEditor.tsx` — replace the arrow buttons with `SortableList` dragging.**
  - Files: `src/components/admin/content/PhotoListEditor.tsx`
  - Details: keep the `{photos.length > 0 && (…)}` guard and the **existing grid `<div>` exactly as-is** (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`) — it must stay *outside* `SortableList`, which emits no DOM, so the tiles remain direct grid children. Replace the `photos.map(...)` body (L61–96) with:
    ```tsx
    <SortableList
      ids={ids}
      strategy="grid"
      onReorder={(orderedIds) => onChange(reorderPhotosByIds(photos, ids, orderedIds))}
    >
      {(id, handle) => {
        const index = ids.indexOf(id)
        if (index === -1) return null
        return (
          <div
            ref={handle.setNodeRef}
            style={handle.style}
            className={cn(
              "relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30",
              handle.isDragging && "z-10 shadow-lg"
            )}
          >
            <Image src={photos[index]} alt="" fill className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1">
              <button
                type="button"
                {...handle.attributes}
                {...handle.listeners}
                aria-label={t('admin.pages.dragHandleLabel')}
                title={t('admin.pages.dragHandleLabel')}
                className="cursor-grab touch-none rounded p-1 text-white hover:bg-white/20 active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t('admin.pages.removePhoto')}
                className="rounded p-1 text-white hover:bg-white/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      }}
    </SortableList>
    ```
    Notes the coder must respect: no `key` on the tile (`SortableList` already does `key={id}`); `type="button"` on **both** buttons is mandatory (two of the four surfaces are inside a real `<form>`, and the KeyboardSensor activates on Space); the tile keeps `relative` so `z-10` works while dragging; `aspect-square`, `overflow-hidden rounded-lg border border-border bg-muted/30`, the `next/image` `fill`+`object-cover` render, the overlay bar's own classes, and the Trash2 button's behaviour are all unchanged from today.

- [x] **Step 5: Tests — one no-mock unit test for the id helpers.**
  - Files: `tests/lib/content/photo-ids.test.ts` (new)
  - Details: `import { derivePhotoIds, reorderPhotosByIds } from '@/lib/content/photo-ids'`, no `vi.mock` of anything (the module is pure and import-free), style matching `tests/lib/content/blocks.test.ts`.
    - `derivePhotoIds`: `[]` → `[]`; distinct URLs → ids identical to the URLs; `['/uploads/a.png','/uploads/b.png','/uploads/a.png','/uploads/a.png']` → `['/uploads/a.png','/uploads/b.png','/uploads/a.png#1','/uploads/a.png#2']`; result length always equals input length and contains no duplicates.
    - `reorderPhotosByIds`: moving the first id to the end reorders the photos accordingly; passing the ids back unchanged returns the same order; `orderedIds` with a wrong length → input returned unchanged; `orderedIds` containing an unknown id → unchanged; `orderedIds` containing the same id twice → unchanged; a photos array **with a duplicate URL** round-trips through `derivePhotoIds` + a reorder without losing or duplicating any photo (assert the sorted arrays are equal and the length matches).
  - Verify with `npx vitest run tests/lib/content/photo-ids.test.ts`, then the full `npm run test` (baseline is green — keep it green, add no skips).

- [x] **Step 6: Ripple grep + line-budget check (read-only, report each result).**
  - Details:
    - `rg -n "movePhoto|ChevronLeft|ChevronRight" src/components/admin/content/PhotoListEditor.tsx` → must be **empty**.
    - `rg -n "verticalListSortingStrategy|rectSortingStrategy|@dnd-kit" src/components/admin/content/` → hits **only** in `SortableList.tsx`.
    - `git diff --name-only` → must **not** list `PageBlocksEditor.tsx`, `PageListClient.tsx`, `PhotoGalleryConfigEditor.tsx`, `PhotoWidgetConfigEditor.tsx`, `BlockConfigEditor.tsx`, `SingleBlockSlotEditor.tsx`, `src/app/api/upload/route.ts`, anything under `prisma/`, or anything under `src/locales/`.
    - `wc -l` on `PhotoListEditor.tsx` (baseline 116, expect ~170), `SortableList.tsx` (baseline 86, expect ~97), `src/lib/content/photo-ids.ts`, `tests/lib/content/photo-ids.test.ts` — all must be well under 500.
    - `npm run lint` (zero warnings — watch for the removed `ChevronLeft`/`ChevronRight` imports, the removed `error`/`uploading` state, and `react-hooks/exhaustive-deps` on the two new hooks; both have honest dep arrays, so **no eslint-disable should be needed** — if one seems necessary, stop and report instead of adding it).
  - If any grep contradicts the above, stop and report rather than improvising.

- [x] **Step 7: DOX pass.**
  - Files: `src/components/AGENTS.md`, `src/lib/AGENTS.md`, `tests/AGENTS.md`
  - Details:
    - `src/components/AGENTS.md` → Local Contracts, one new bullet placed next to the existing `admin/content/PageListClient.tsx` bullet (L22): `admin/content/SortableList.tsx` is the single place dnd-kit is wired (render-prop `children(id, handle)`, `PointerSensor` 4px + `KeyboardSensor`, no `DragOverlay`, emits no DOM so the caller owns the container) and takes `strategy?: "list" | "grid"` (default `"list"` = `verticalListSortingStrategy` for the block/page lists, `"grid"` = `rectSortingStrategy` for the photo grid) — add a new layout there rather than instantiating a second `DndContext`; `admin/content/PhotoListEditor.tsx` is the shared photo editor behind both `Photo{Widget,Gallery}ConfigEditor` (so it renders on four surfaces: the three page block editors, `/admin/settings`'s homepage widget, and the Masters Sheet footer block) — multi-file select uploads one request per file to the unchanged single-file `/api/upload` in `UPLOAD_CONCURRENCY`-sized `Promise.allSettled` batches with per-file error lines and a single `onChange` computed from a latest-`photos` ref, ordering is drag-only via a `GripVertical` handle (arrow buttons removed; the tile itself is deliberately **not** the drag surface because `touch-action: none` on a `grid-cols-2` tile would block mobile page scroll), and the persisted shape stays a bare `string[]` with ids derived per render.
    - `src/lib/AGENTS.md` → Local Contracts, one bullet near the `content/pages-server.ts` bullet (L28): `content/photo-ids.ts` is pure/React-free/Prisma-free (client-safe like `content/pages-shared.ts`) and holds `derivePhotoIds()`/`reorderPhotosByIds()` — dnd-kit tile ids for the photo editors are derived from the persisted `string[]` on every render and never stored; `reorderPhotosByIds` returns its input unchanged on any id-list mismatch because an `undefined` slot would fail `z.array(z.string())` on save and make `parseBlockConfig` fall back to `defaultConfigFor()`, wiping the block's photos.
    - `tests/AGENTS.md` → Local Contracts, one dated (2026-08-05) bullet: new `tests/lib/content/photo-ids.test.ts`, no mocks by design.
    - Explicitly leave unchanged and report why: `src/app/admin/AGENTS.md` (L18 describes the content-page surfaces/authorization and the shared component set, never the photo editor's upload or arrow reordering — nothing there goes stale), `src/app/api/AGENTS.md` (no route touched), `prisma/AGENTS.md` (no schema change), root `CLAUDE.md` Child DOX Index (no AGENTS.md added/moved/renamed).

---

## Acceptance Criteria

- [x] `npm run lint` passes with **zero** *new* warnings/errors (repo baseline is 46 pre-existing problems, byte-identical with and without this change — confirmed via `git stash`); no new `eslint-disable` comment anywhere in this change.
- [x] `npm run test` passes, including the new `tests/lib/content/photo-ids.test.ts`; nothing pre-existing starts failing and nothing is skipped (309/309 across 35 files).
- [?] One file-dialog interaction can select and upload many photos (5–10+)... — requires browser interaction; not run (no dev server/browser tool per constraints). Pending user manual check (item 1 below).
- [?] A batch containing an invalid file... — requires browser interaction; not run. Pending user manual check (item 2 below).
- [x] Photos reorder by dragging the `GripVertical` handle... the ChevronLeft/ChevronRight buttons and `move()` no longer exist — confirmed via grep/read (code-level); actual drag animation is runtime-only, pending user manual check (item 3 below).
- [?] Keyboard reordering works on the photo grid... — requires browser interaction; not run. Pending user manual check (item 4 below).
- [x] No new i18n key in any of `pl.json`/`en.json`/`uk.json`; `git diff --stat src/locales` is empty. `admin.pages.movePhotoLeft`/`movePhotoRight` are still present in all three files (orphaned on purpose, untouched).
- [x] `/api/upload`'s request/response contract is byte-identical (route file not in `git diff --name-only`), and `MasterForm`'s avatar / favicon / logo uploads are untouched (file not in `git diff --name-only`).
- [x] Zero changes to `PageBlocksEditor.tsx`, `PageListClient.tsx`, `PhotoGalleryConfigEditor.tsx`, `PhotoWidgetConfigEditor.tsx`, `BlockConfigEditor.tsx`, `SingleBlockSlotEditor.tsx` — confirmed via `git diff --name-only` (none listed); runtime block/page reordering behaviour pending user manual check (item 7 below).
- [x] The persisted config shape is still `{ photos: string[] }` / `{ style, photos: string[] }`; no derived id is ever written into the array, and `src/lib/content/blocks.ts` is untouched (not in `git diff --name-only`).
- [x] Every touched/new file is well under 500 lines; before/after: `PhotoListEditor.tsx` 116 → 153, `SortableList.tsx` 86 → 101, `src/lib/content/photo-ids.ts` 34 (new), `tests/lib/content/photo-ids.test.ts` 76 (new).

## Constraints & Risks

**Must not be touched**
- `src/app/api/upload/route.ts` — no `multiple`-file body, no new response shape, no new field.
- `PageBlocksEditor.tsx` (including its Save / Save-all FAB logic — that's a separate tracker item), `PageListClient.tsx`, both `Photo*ConfigEditor.tsx` wrappers, `BlockConfigEditor.tsx`, `SingleBlockSlotEditor.tsx`.
- `prisma/**`, `src/lib/content/blocks.ts`, `src/locales/**`.
- Public-facing block renderers (nothing about this change alters how photos render on the site).
- Page-open transition animations (separate tracker item).

**Do not run**
- `npm run dev`, any long-running server, or `npm run build` — the user keeps a dev server running and a concurrent build corrupts `.next/`. Verification is `npm run lint` + `npm run test` only.
- No browser/visual-testing tool; the user verifies visually from screenshots.

**Risks**
1. **Nested `DndContext` (highest risk).** On `/admin/pages/[id]` the photo grid's context sits inside the block list's context. Expected to be fine (each context's listeners live on its own grip element, and document-level listeners only exist during an active drag), but a regression here would show up as "dragging a photo also drags the block card" or "block dragging stopped working". Manual check 5 below is the gate.
2. **Drag inside a `Sheet`.** Surface 4 (Masters Sheet → footer block) drags inside a modal overlay. If the drag doesn't start there, do **not** start patching the Sheet or the sensors — report it.
3. **Stale-closure append.** The single-`onChange`-from-`photosRef` design (decision D) is the mitigation; a later "cleanup" that inlines `photos` into the final append, or that re-introduces a per-file `onChange`, silently drops uploads. Keep the comment above the ref.
4. **Silent whole-block data loss on a bad reorder.** `reorderPhotosByIds`'s three guards are load-bearing; a `undefined` reaching the config kills every photo in the block via the zod-fallback path. Do not "simplify" the guards away.
5. **`FileList` invalidation.** Reading `e.target.files` after `e.target.value = ""` yields an empty list in some browsers — the read must come first (and it is invisible to `tsc`/`lint`).
6. **Server load / disk.** A 30-file batch is 30 sequential-in-chunks writes into `public/uploads/`; concurrency 3 bounds memory but not total disk growth. Pre-existing property of the endpoint, out of scope.
7. **Many photos in one widget.** Nothing caps the array, so an admin can now add 50 photos to a `photoWidget` far faster than before; how the public `strip`/`fade`/`stack` styles cope with that count is untested and out of scope — mention only if the user asks.
8. **Draft-vs-saved confusion.** Multi-upload and drag reorder both only change draft state (decision G); the user may read "my order didn't stick" as a bug when they simply didn't press Save. Covered by manual check 3.

## Manual verification for the user (RU, short)

1. `/admin/pages/<страница>` → блок «Галерея фото» или «Фото-виджет» → «Добавить фото» → в диалоге выбрать сразу 5–10 файлов (Ctrl/Shift или Cmd) → все должны появиться в сетке в том же порядке; на кнопке во время загрузки счётчик вида «3/8».
2. Ещё раз то же самое, но добавить в выбор один слишком большой файл (>4 МБ): остальные должны загрузиться, а под кнопкой — строка(и) только по неудачным файлам с именем файла и причиной. Следующая загрузка эти строки очищает.
3. Перетащить фото за «ручку» (иконка слева в тёмной полоске внизу плитки) — соседние плитки должны плавно расходиться, фото встаёт на новое место. Стрелок ‹ › больше нет. **Важно:** и новый порядок, и новые фото сохраняются только после нажатия «Сохранить блок» (или круглой кнопки Save внизу справа) — как и раньше.
4. Клавиатура: Tab до ручки → Space → стрелки → Space. Порядок должен меняться.
5. Главная проверка на конфликт: перетаскивание фото **не должно** тащить саму карточку блока; и наоборот — перетаскивание блока за его ручку (слева от названия типа блока) должно работать как раньше.
6. Те же действия проверить на остальных экранах, где есть фото-блок: `/admin/settings` («виджет главной страницы»), `/admin/masters` → карточка мастера → «Блок в футере» (там внутри всплывающей панели), `/admin/master/pages` (вход мастером).
7. Регресс: `/admin/pages` — перетаскивание страниц в списке (и на широком экране в таблице, и на узком в карточках) работает точно как раньше.
8. Мобильный вид (<1024px): страница должна нормально скроллиться пальцем поверх сетки фото; перетаскивание фото — только за ручку.
9. Корзина (удаление фото) работает как раньше.
