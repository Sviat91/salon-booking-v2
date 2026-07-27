# Round 2 — Group 3: Fade widget fixes

## Context

`FadeWidget` (`src/components/content/photo-widget/FadeWidget.tsx`) renders
several independently-cycling cross-fading photo slots. Same three usage
contexts as the strip widget (Group 2): homepage bottom widget, master-page
footer, content-page blocks.

User feedback (2026-07-26 batch): stretched/wrong-proportion frames, slot
count changes depending on how many photos exist, and the crossfade "blinks"
instead of smoothly dissolving. Also: on the master page specifically, must
not overlap the calendar or cause a forced scroll/hidden footer.

## Bugs and root causes

1. **Stretched frames.** The outer grid uses a fixed `h-40` (160px) height
   with `repeat(slotCount, minmax(0, 1fr))` columns — each column's *width*
   stretches to fill available space while height stays pinned at 160px, so
   with few slots the tiles become very wide but still only 160px tall:
   heavily distorted proportions. `StripWidget`'s tiles use a fixed
   `width = height * 0.8` (140×112px) — an 0.8 width:height ratio (4:5) —
   never stretched.

2. **Unstable slot count.** `slotCount = Math.min(SLOT_COUNT_MAX, photos.length)`
   — with 1-2 photos configured, only 1-2 slots render (each then extremely
   wide per bug 1). Slot count should be constant regardless of how many
   photos the master/admin actually uploaded.

3. **Crossfade "blinking".** `FadeSlot`'s `<AnimatePresence mode="wait">`
   sequences the transition: the exiting photo fades 1→0 over 1s, only *then*
   unmounts, only *then* does the next photo mount and fade 0→1 over another
   1s. Exit and enter never overlap, so there's a visible dip toward the bare
   card background at the handoff point each cycle — reads as a "blink"
   rather than a smooth dissolve. `CYCLE_MS = 3000` (3s dwell) also reads as
   fast/twitchy.

## Fix

Edit only `src/components/content/photo-widget/FadeWidget.tsx`:

1. **Aspect ratio:** replace the outer grid's fixed `h-40` with per-tile
   `aspect-[4/5]` (Tailwind's built-in native aspect-ratio utility, no plugin
   needed — matches `StripWidget`'s 0.8 width:height ratio). Apply
   `aspect-[4/5] w-full` to each tile's own wrapper div (both in `FadeSlot`
   and the reduced-motion branch), and drop `h-40`/`h-full` from the outer
   grid and slot wrapper. The grid's row height is then derived per-column
   from the aspect ratio, never stretched, and adapts naturally on narrow
   viewports (fr-based columns, no fixed pixel width, so no horizontal
   overflow risk).

2. **Stable slot count:** replace `const SLOT_COUNT_MAX = 5` +
   `Math.min(SLOT_COUNT_MAX, photos.length)` with a constant
   `const SLOT_COUNT = 5`, used unconditionally (as long as `photos.length > 0`,
   the existing empty-array early return stays). Slots beyond the real photo
   count cycle through the same photos via the existing
   `startIndex % photos.length` / `(i + 1) % photos.length` modulo logic —
   already correct, no change needed there. Apply the same fixed `SLOT_COUNT`
   to the reduced-motion branch too (currently `photos.slice(0, slotCount)`,
   which under-fills when there are few photos — change to map over
   `Array.from({ length: SLOT_COUNT })` and index with `i % photos.length`,
   same pattern as the animated branch, so both branches are visually
   consistent).

3. **Smooth crossfade, slower pace:**
   - Remove `mode="wait"` from `<AnimatePresence>` in `FadeSlot` (use the
     default `mode="sync"`, which runs the exiting and entering elements'
     animations concurrently — a true overlapping dissolve instead of a
     sequential fade-out-then-fade-in with a dip in between).
   - Change the fade `transition` duration from `1` to `1.5` seconds.
   - Change `CYCLE_MS` from `3000` to `4500` (slower dwell per photo).

4. **Master-page overlap/scroll guard:** no separate code change identified
   as necessary — `MasterFooterBlock` is already mounted in normal document
   flow (not absolutely positioned) after the booking `motion.div` in
   `src/app/[masterId]/page.tsx`, and fix #1 above removes the one thing that
   could previously cause a height mismatch (the fixed `h-40` no longer
   agreeing with stretched content). This item is a **live visual check
   only** — if overlap or forced scroll is still reproducible after this fix,
   it's a new finding for a follow-up round, not something to guess a code
   fix for now.

## Scope

**Only** `src/components/content/photo-widget/FadeWidget.tsx`.

- Do NOT touch `StripWidget.tsx` (Group 2, already done) or `StackWidget.tsx`
  (Group 4, separate pass).
- Do NOT touch `HomeClient.tsx`, `MasterFooterBlock.tsx`,
  `src/app/[masterId]/page.tsx`, or `PageRenderer.tsx` — same shared-component
  precedent as Group 2.
- Do NOT change `PhotoWidgetRenderer.tsx` or the `photos.length === 0 → null`
  early-return behavior.

## Steps

- [x] Replace `SLOT_COUNT_MAX`/`Math.min` logic with a fixed `SLOT_COUNT = 5`,
      used in both the animated and reduced-motion branches.
- [x] Apply `aspect-[4/5] w-full` to each tile wrapper (both branches);
      remove the outer grid's `h-40` and `FadeSlot`'s `h-full`.
- [x] Remove `mode="wait"` from `AnimatePresence` in `FadeSlot`.
- [x] Change fade transition duration `1` → `1.5`.
- [x] Change `CYCLE_MS` `3000` → `4500`.
- [x] Reduced-motion branch: pad to `SLOT_COUNT` tiles via `i % photos.length`
      indexing instead of `photos.slice(0, slotCount)`.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- Read the final file back and confirm the diff matches this plan exactly,
  nothing else touched.
- Do NOT start the dev server — per project rule, only the user starts it.
