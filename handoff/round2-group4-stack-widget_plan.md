# Round 2 — Group 4: Stack widget rewrite

## Context

`StackWidget` (`src/components/content/photo-widget/StackWidget.tsx`) is
currently a single Mac-Photos-style pile of up to 5 rotated photos
(`MAX_VISIBLE = 5`, `photos.slice(0, MAX_VISIBLE)`) — any photos beyond the
5th are silently never shown in the pile (though they do still exist in the
shared `Lightbox`'s full `photos` array once opened). Clicking any visible
photo opens the `Lightbox` directly at that photo's index.

Agreed spec (from the original Round 2 grouping pass): split photos into
several stacks instead of one, sized adaptively so the stack *count* never
forces horizontal scroll/wrapping; align all stacks in one row; first click
on a (collapsed) stack expands it in place, overlapping neighboring stacks,
showing its own photos in a flat row; clicking an individual photo inside
that expanded row opens the shared `Lightbox` at the correct global index.
Same "don't overlap the calendar" constraint as Groups 2/3 (vertical growth
must stay bounded).

## Design

### Grouping (adaptive group size, not a fixed pile of 5)

```ts
const CANDIDATE_GROUP_SIZES = [3, 5, 10, 20]
const MAX_STACKS_PER_ROW = 6

function getGroupSize(photoCount: number): number {
  for (const size of CANDIDATE_GROUP_SIZES) {
    if (Math.ceil(photoCount / size) <= MAX_STACKS_PER_ROW) return size
  }
  return Math.ceil(photoCount / MAX_STACKS_PER_ROW)
}
```

Picks the smallest candidate group size that keeps the resulting stack count
at or under 6; if even grouping by 20 would still produce more than 6 stacks
(i.e. 120+ photos), falls back to the exact size needed to hit 6 stacks —
this realizes "groups of 3 for few photos, 5 for more, growing further (10,
20...) so stack count never causes horizontal scroll/wrapping" without a
hardcoded photo-count threshold table.

Then slice `photos` into groups of that size, keeping each group's starting
offset into the full array (needed for correct `Lightbox` indexing):

```ts
const groupSize = getGroupSize(photos.length)
const groups: { startIndex: number; photos: string[] }[] = []
for (let i = 0; i < photos.length; i += groupSize) {
  groups.push({ startIndex: i, photos: photos.slice(i, i + groupSize) })
}
```

### Per-stack collapsed pile (visual only — unrelated to group size)

Each *collapsed* stack still shows the existing Mac-Photos rotated-pile
visual, capped at `MAX_PILE_VISIBLE = 5` photos regardless of how many
photos are actually in that group (a group of 20 still only *previews* 5 in
the pile) — reuse the existing `ROTATIONS` array and transform math
unchanged. The whole pile becomes a single `<button>` (one click target, not
per-photo) whose only job is to expand that stack — clicking a photo
directly is not possible while collapsed, matching "first click expands."

### Per-stack expanded view

Replace the pile with an absolutely-positioned overlay anchored to that
stack's own `relative` box (`z-30`, escapes into the row's stacking context
so it visually overlaps sibling stacks without an explicit backdrop —
verified: the sibling `Stack` wrappers are plain `position: relative` with
no `z-index`, so they don't trap the `z-30` child in an isolated stacking
context), containing the group's own photos in a flat, un-rotated row:

```tsx
<div className="relative h-40 w-32 shrink-0">
  <div
    className="absolute left-1/2 top-0 z-30 flex max-w-[min(90vw,640px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-xl bg-card/95 p-1.5 shadow-xl"
    onClick={onCollapse}
  >
    {photos.map((url, i) => (
      <button
        key={`${url}-${i}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onPhotoClick(startIndex + i)
        }}
        className="relative h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-border"
      >
        <Image src={url} alt="" fill className="object-cover" />
      </button>
    ))}
  </div>
</div>
```

- `max-w-[min(90vw,640px)]` + `overflow-x-auto` bounds the expanded row's
  width even for a 20-photo group, instead of letting it grow arbitrarily
  wide — height stays fixed at `h-40` (same as collapsed), so expanding
  never grows vertically and can't encroach on the calendar above.
- The overlay's own `onClick={onCollapse}` collapses the stack when the
  background/gap area is clicked; each photo button calls
  `e.stopPropagation()` before opening the lightbox, so clicking a *photo*
  never also collapses. **This close affordance is necessary, not extra
  scope**: with few enough photos there's only one group total, and without
  it a user who expands the only stack would have no way to collapse it
  again (no sibling stack to click instead).

### Parent component — single `expandedGroup` index, shared `Lightbox`

```tsx
const [expandedGroup, setExpandedGroup] = useState<number | null>(null)
const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
```

Clicking a different (collapsed) stack's pile sets `expandedGroup` to that
stack's index — this naturally collapses whichever stack was previously
expanded (its `isExpanded` becomes `false`, pile re-renders) while expanding
the new one, with no extra bookkeeping. `Lightbox` still receives the full,
un-grouped `photos` array and `lightboxIndex`, exactly as today.

### Row layout

```tsx
<div className="flex items-start gap-6 overflow-x-auto px-4 py-2">
  {groups.map((group, groupIndex) => (
    <Stack
      key={group.startIndex}
      photos={group.photos}
      startIndex={group.startIndex}
      isExpanded={expandedGroup === groupIndex}
      onExpand={() => setExpandedGroup(groupIndex)}
      onCollapse={() => setExpandedGroup(null)}
      onPhotoClick={setLightboxIndex}
    />
  ))}
</div>
```

**Deliberately no `justify-center`** — `justify-content: center` combined
with `overflow-x: auto` has a well-known cross-browser quirk where the
*start*-side overflow becomes unreachable/clipped (only the end side scrolls
by default), which the "adaptive grouping never wraps/overflows" guarantee
mostly avoids but a narrow mobile viewport with 6 stacks still could trigger.
Left-aligned + scrollable sidesteps that risk entirely; visually the row
still starts from the same left edge every other block on the page uses.

## Scope

Rewrite `src/components/content/photo-widget/StackWidget.tsx` in full,
following the design above exactly (constants, `getGroupSize`, the `Stack`
sub-component, the parent component). Keep the existing `MAX_PILE_VISIBLE`
(rename from `MAX_VISIBLE`, same value 5) and `ROTATIONS` array/transform
math unchanged for the collapsed-pile visual. Keep the existing `Lightbox`
import and usage pattern (full `photos` array, `index`, `onClose`,
`onIndexChange`) unchanged.

- Do NOT touch `StripWidget.tsx` or `FadeWidget.tsx` (Groups 2/3, already
  done) or `PhotoWidgetRenderer.tsx`/`BlockRenderer.tsx`/`Lightbox.tsx`.
- Do NOT touch `HomeClient.tsx`, `MasterFooterBlock.tsx`,
  `src/app/[masterId]/page.tsx`, or `PageRenderer.tsx` — same
  shared-component precedent as the prior groups; the fix must be entirely
  self-contained in `StackWidget.tsx` so the calendar-overlap constraint
  holds automatically (fixed `h-40` height, both collapsed and expanded).

## Steps

- [x] Add `CANDIDATE_GROUP_SIZES`, `MAX_STACKS_PER_ROW`, `getGroupSize`.
- [x] Compute `groups` (start index + slice) from `photos` using
      `getGroupSize(photos.length)`.
- [x] Extract a `Stack` sub-component with collapsed (single-button pile,
      capped at `MAX_PILE_VISIBLE`) and expanded (flat scrollable row,
      `onCollapse` on the container, `stopPropagation` + `onPhotoClick` on
      each photo) branches, exactly as specified above.
- [x] Parent: `expandedGroup`/`lightboxIndex` state, row layout without
      `justify-center`, `Lightbox` wired to the full flat `photos` array.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- Read the final file back and confirm it matches this design; confirm no
  other file was touched.
- Do NOT start the dev server — per project rule, only the user starts it.
