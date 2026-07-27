# Round 2 — Group 2 & 3 live-testing follow-up

Three separate corrections found after the user tested Group 2 (strip) and
Group 3 (fade) live. Each is scoped to one file; bundled into one plan
because they're small and were reported together.

## A. Strip widget: content doesn't reach the true right edge on wide screens

**Symptom (screenshots):** on the homepage and master-page footer, the strip
reaches the true left edge (Group 2's breakout fix works) but stops short of
the true right edge — visible dead space past roughly the middle of the
screen, especially with few unique photos.

**Root cause:** `src/components/content/photo-widget/StripWidget.tsx` always
triples the photo array (`[...photos, ...photos, ...photos]`) regardless of
how many unique photos exist or how wide the viewport is. With few photos
(e.g. 2), the tripled row's total width (~800px) is far narrower than a wide
monitor, so after the Group 2 full-bleed fix the *container* spans the full
viewport but the *content* inside it doesn't — it just sits at the left with
blank space to the right.

**Fix:** make the repeat count dynamic instead of a fixed 3, so the total
rendered width always comfortably exceeds a safe minimum (covers very wide
monitors), with 3 as the floor (preserves current behavior once there are
already enough photos):

```ts
const TILE_TOTAL_WIDTH = HEIGHT * 0.8 + 24 // tile width + gap-6 (24px)
const MIN_TOTAL_WIDTH = 4200 // px — comfortably covers ultra-wide screens
const MIN_COPIES = 3

function getRepeatCount(photoCount: number) {
  const setWidth = photoCount * TILE_TOTAL_WIDTH
  return Math.max(MIN_COPIES, Math.ceil(MIN_TOTAL_WIDTH / setWidth))
}
```

Then in the animated branch:
```ts
const repeatCount = getRepeatCount(photos.length)
const content = Array.from({ length: repeatCount }, () => photos).flat()
```
and change `animate={{ x: ["0%", "-33.33%"] }}` to
`animate={{ x: ["0%", `-${100 / repeatCount}%`] }}`.

Note the animated distance per loop is always exactly `repeatCount`'s one
"set" width in real pixels (`100/repeatCount` percent of `repeatCount` sets
== 1 set), so this doesn't change the perceived scroll speed for
already-plentiful-photo masters — it only adds more repeated copies when
needed to avoid the visible gap. Leave the existing
`duration: Math.max(60, photos.length * 8)` untouched.

**Do NOT** touch the reduced-motion static branch (the manually-scrollable
fallback) — it intentionally shows real photos once, not a looping
duplicate-padded row; "doesn't reach the right edge" doesn't apply to a
finite, user-scrollable list.

File: `src/components/content/photo-widget/StripWidget.tsx` only.

## B. Master footer block: sits flush against the calendar/booking box

**Symptom (screenshot):** on the master's page, both a text footer block and
a photo-widget footer block render with zero gap directly under the
calendar/booking area — looks cramped, and contributes to the fade widget
"overlapping the calendar" complaint in part C.

**Root cause:** the outer `motion.div` in
`src/components/content/MasterFooterBlock.tsx` has no `className` at all —
no top margin separates it from the booking `motion.div` above it in
`src/app/[masterId]/page.tsx`.

**Fix:** add `className="mt-16"` to that `motion.div` (64px gap — roughly
doubles the current zero-gap spacing, matching the user's "push it down by
about 50%" ask applied as a generous fixed gap since there was no existing
gap to scale). This is a shared-component-level fix, so it applies to every
footer block type (text and photoWidget alike) automatically.

File: `src/components/content/MasterFooterBlock.tsx` only.

## C. Fade widget: still too fast, and genuinely oversized on wide screens

**Symptom (screenshots):** on the homepage (no `max-w` ancestor — see Group 2
context notes) the fade widget's tiles render enormous, because Group 3's
fix locked the *aspect ratio* (`aspect-[4/5]`) but left the *grid* stretching
tiles to fill 100% of the available (here: full viewport) width across 5
`fr` columns. On the master page the tiles are smaller (constrained by
`max-w-5xl`) but still large enough, combined with issue B's zero gap, to
read as "running into the calendar." Also, even after Group 3's slowdown
(`CYCLE_MS 3000→4500`, fade duration `1→1.5`), the user still finds the pace
too fast.

**Fix (`src/components/content/photo-widget/FadeWidget.tsx`):**

1. **Fixed pixel size, not stretchy grid** — replace the CSS Grid
   (`grid` + `gridTemplateColumns: repeat(${SLOT_COUNT}, minmax(0, 1fr))`)
   with a centered flex row, and give each tile a **fixed** pixel size
   (matches `StripWidget`'s approach, so size no longer depends on container
   width at all — this is what actually fixes "gigantic on homepage"):
   ```ts
   const TILE_HEIGHT = 110 // ~20% smaller than StripWidget's 140
   const TILE_WIDTH = TILE_HEIGHT * 0.8
   ```
   Container: `className="flex flex-wrap items-center justify-center gap-3"`.
   Each tile wrapper (both the animated `FadeSlot` and the reduced-motion
   branch): drop `aspect-[4/5] w-full`, use
   `style={{ height: TILE_HEIGHT, width: TILE_WIDTH }}` instead (same pattern
   `StripWidget` already uses for its own tiles) — keep
   `relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm`.
   `flex-wrap` means on narrow mobile widths, if 5 fixed-width tiles don't
   fit one row, they wrap to a second row rather than overflowing or being
   squeezed — acceptable, avoids horizontal scroll.

2. **Slower pace** — `CYCLE_MS` `4500 → 6000`; fade `transition` duration
   `1.5 → 2`.

Scope: only `FadeWidget.tsx`. Do not touch `StripWidget.tsx` or
`StackWidget.tsx`. Do not touch `PhotoWidgetRenderer.tsx`.

## Verification (all three)

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- Read all three changed files back; confirm nothing outside the three
  listed files was touched.
- Do NOT start the dev server — per project rule, only the user starts it.

## Steps

- [x] A: dynamic repeat count + matching translate percentage in `StripWidget.tsx`.
- [x] B: `mt-16` on `MasterFooterBlock.tsx`'s outer `motion.div`.
- [x] C1: fixed-pixel-size flex row layout in `FadeWidget.tsx` (both branches).
- [x] C2: `CYCLE_MS` → 6000, fade duration → 2 in `FadeWidget.tsx`.
