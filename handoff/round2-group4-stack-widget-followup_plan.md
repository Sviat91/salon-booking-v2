# Round 2 — Group 4 follow-up: stack widget centering + off-screen + close bugs

Live-testing found four problems in the current `StackWidget.tsx`
(`src/components/content/photo-widget/StackWidget.tsx`):

1. Piles aren't centered — the row is left-aligned (no `justify-*`), so on
   the homepage (no `max-w` ancestor) a single pile sits flush at the true
   left edge of the browser, visibly clipped by the viewport boundary.
   Wanted: 1 stack → centered; 2 stacks → centered side-by-side; more →
   expand outward from center symmetrically.
2. Expanding a stack that sits near an edge sends the flat photo row
   off-screen ("уходит за горизонт") — the expanded overlay is centered on
   *its own* small `w-32` stack box via `left-1/2 -translate-x-1/2`; if that
   box itself is near x=0 (exactly the homepage case from bug 1), half the
   (up to 640px-wide) overlay lands at a negative x-coordinate, off-screen.
3. Clicking "empty space" to collapse an expanded stack doesn't work in
   practice — the container's `onClick={onCollapse}` is technically wired,
   but the actual empty area is only the `p-1.5` (6px) padding ring and
   `gap-2` (8px) inter-photo gaps; with every other pixel covered by a
   `shrink-0` photo `<button>`, there's effectively no reliably-clickable
   empty area for a user to find.
4. A horizontal scrollbar sometimes shows under the stacks on the master
   page even with only 2 groups (plenty of room) — a symptom of the same
   left-alignment/off-center issue rather than genuine overflow.

## Fix — restructure `StackWidget.tsx`

### 1. Centered row that degrades gracefully instead of clipping

Change the row's className from
`"flex items-start gap-6 overflow-x-auto px-4 py-2"` to
`"flex items-start justify-[safe_center] gap-6 overflow-x-auto px-4 py-2"`.

`justify-[safe_center]` is Tailwind's arbitrary-value escape hatch for CSS
Box Alignment's `justify-content: safe center` (modern, broadly supported
since Safari 16.4 / Chrome 115 / long-standing Firefox) — centers normally
when the row fits, but automatically falls back to start-alignment instead
of clipping the start side when it would overflow (this is the standard,
correct fix for the flexbox "center + overflow clips one side" quirk noted
— and now hit — in the original Group 4 plan). This alone fixes bug 1 for
the common case (few stacks fit and center) and prevents any *clipping* in
the rare overflow case (falls back to scrollable-from-start, not lost).

### 2. Lift the expanded overlay to widget level, center it on the whole widget instead of on the clicked stack

Restructure so there's exactly **one** expanded-overlay render site (not one
per `Stack`), centered on the outer widget wrapper — which is itself always
within the page's actual centered content column (`max-w-5xl mx-auto` on
master/content pages, or the ~full-viewport-width homepage `<main>`) — so it
can never land off-screen regardless of which stack (leftmost, rightmost)
triggered it:

```tsx
export default function StackWidget({ photos }: StackWidgetProps) {
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  const groupSize = getGroupSize(photos.length)
  const groups: { startIndex: number; photos: string[] }[] = []
  for (let i = 0; i < photos.length; i += groupSize) {
    groups.push({ startIndex: i, photos: photos.slice(i, i + groupSize) })
  }

  const expanded = expandedGroup !== null ? groups[expandedGroup] : null

  return (
    <div className="relative">
      <div className="flex items-start justify-[safe_center] gap-6 overflow-x-auto px-4 py-2">
        {groups.map((group, groupIndex) => (
          <Pile key={group.startIndex} photos={group.photos} onExpand={() => setExpandedGroup(groupIndex)} />
        ))}
      </div>

      {expanded && (
        <div className="absolute left-1/2 top-0 z-30 flex max-w-[min(90vw,640px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-xl bg-card/95 p-1.5 shadow-xl">
          {expanded.photos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setLightboxIndex(expanded.startIndex + i)}
              className="relative h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-border"
            >
              <Image src={url} alt="" fill className="object-cover" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setExpandedGroup(null)}
            aria-label="Collapse"
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  )
}
```

Note `max-w-[min(90vw,640px)]` already caps the overlay at 90% of the
viewport width on narrow screens, so combined with being centered on an
already page-centered wrapper, it structurally cannot extend past either
viewport edge on any screen size — fixes bug 2 and bug 4 (no genuine
overflow left to trigger a scrollbar in the common case).

The outer `<div className="relative">` only wraps normal-flow content (the
piles row); the overlay is `position: absolute`, so it never adds height —
the widget's total height stays pinned to the row's own `h-40`, whether a
stack is expanded or not (preserves the "never overlaps the calendar above"
guarantee from Groups 2-4).

### 3. Replace "click empty space to collapse" with an explicit close button

Drop the container-level `onClick={onCollapse}` + per-photo
`e.stopPropagation()` pattern entirely (per point 3 above, it isn't a
reliable affordance). Add a visible round close button (`X` icon from
`lucide-react`, already a project dependency — see `ChevronLeft`/
`ChevronRight` usage in `src/components/MasterSelector.tsx`) at the end of
the expanded photo row, `onClick={() => setExpandedGroup(null)}` — shown in
the snippet above. This is the sole way to collapse without picking a
different stack; clicking a different (collapsed) pile still also collapses
the current one as a side effect of `setExpandedGroup` changing (unchanged
from the current implementation).

### 4. Extract a plain `Pile` component (collapsed-only)

Since the expanded view is no longer per-`Stack`, replace the current
`Stack` component (which branched on `isExpanded` internally) with a
simpler `Pile` component that only renders the collapsed rotated-photo
button (its `onExpand` prop). Keep the `MAX_PILE_VISIBLE`/`ROTATIONS`
constants and the transform math byte-for-byte unchanged — only the
component's shape changes (no more internal expanded branch, no more
`onCollapse`/`onPhotoClick`/`startIndex` props on it — those move to the
widget-level expanded-overlay block shown above).

## Scope

Only `src/components/content/photo-widget/StackWidget.tsx`. Add the
`import { X } from "lucide-react"` line. Do not touch any other file
(consistent with every prior group in this round).

## Steps

- [x] Row: add `justify-[safe_center]` to the piles row's className.
- [x] Replace the `Stack` component with a collapsed-only `Pile` component
      (same visual/transform logic, simplified props).
- [x] Move the expanded overlay to be rendered once at the `StackWidget`
      level, centered on the outer `relative` wrapper (not per-stack),
      exactly matching the snippet above.
- [x] Add the explicit round `X` close button inside the expanded overlay;
      remove the old container-`onClick`/`stopPropagation` collapse pattern.
- [x] Import `X` from `lucide-react`.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- Read the final file back; confirm it matches this design and no other
  file was touched.
- Do NOT start the dev server — per project rule, only the user starts it.
