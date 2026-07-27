# Round 2 — Group 2: Strip widget full-bleed

## Context

`StripWidget` (`src/components/content/photo-widget/StripWidget.tsx`) is the
"летящая линия" marquee widget. It's rendered in three places:

1. Homepage bottom widget (`src/components/home/HomeClient.tsx`) — no `max-w`
   ancestor, already effectively full viewport width.
2. Master page footer (`src/components/content/MasterFooterBlock.tsx`, mounted
   inside `src/app/[masterId]/page.tsx`'s `mx-auto w-full max-w-5xl` container).
3. Any `photoWidget` block placed on a content page (`src/components/content/PageRenderer.tsx`'s
   `mx-auto w-full max-w-5xl` container).

In contexts 2 and 3 the widget currently only spans the `max-w-5xl` box, not
the real viewport — leaving dead space to the right and an ugly clipped edge
instead of flying genuinely edge-to-edge. User feedback: "не очень красиво
обрезается", "должна от края до края лететь".

## Root cause

Both top-level wrapper `<div>`s in `StripWidget.tsx` (the reduced-motion
static branch, ~line 23, and the animated marquee branch, ~line 42) use
`w-full`, which resolves to 100% of the *parent* container's width, not the
viewport's.

The `animate={{ x: ["0%", "-33.33%"] }}` translation is already a percentage
of the tripled content's own total width (not the container's), so no JS/math
change is needed there — once the outer wrapper is full-bleed, the marquee
automatically fills edge-to-edge and the "starts from an inset boundary
instead of the true viewport edge" complaint resolves as a side effect of the
same fix.

## Fix

Apply the standard CSS "full-bleed breakout" trick to **both** top-level
wrapper divs in `StripWidget.tsx` (add to existing classes, don't remove
anything else):

```
relative left-1/2 w-screen -ml-[50vw]
```

This works because the ancestor containers in both constrained contexts are
horizontally centered (`mx-auto`) — shifting right by 50% of the (centered)
parent's width then back left by 50% of the viewport width lands the box
exactly at the true viewport edges, regardless of how the parent is
constrained. In the already-full-width homepage context this is a no-op
(parent width ≈ viewport width already), so it's safe everywhere.

**Safety check already verified — no need to re-derive:** `src/styles/globals.css`
lines 18 and 29 already set `overflow-x: hidden` on both `html` and `body`
globally, so a `100vw`-wide element can never introduce a page-level
horizontal scrollbar in any of the three render contexts (including the
homepage's `<main>`, which has no `overflow-x-hidden` of its own — the global
rule covers it).

## Scope

**Only** `src/components/content/photo-widget/StripWidget.tsx`.

- Do NOT touch `FadeWidget.tsx` or `StackWidget.tsx` — separate groups
  (3 and 4), not part of this pass.
- Do NOT touch `HomeClient.tsx`, `MasterFooterBlock.tsx`,
  `src/app/[masterId]/page.tsx`, or `PageRenderer.tsx` — the fix must live
  entirely in the shared component so it applies automatically everywhere the
  widget is rendered, consistent with this project's established precedent
  (the D-1 Sheet scroll fix from the prior session was made at the shared
  `sheet.tsx` component level, not per-consumer).
- Do NOT change the `x: ["0%", "-33.33%"]` animation values, the loop
  duration math, or the tripled-content array — those are correct as-is and
  out of scope for this fix.

## Steps

- [x] Add the breakout classes to the reduced-motion static branch's outer
      `<div>` (currently `className="w-full overflow-x-auto custom-scrollbar py-4"`).
- [x] Add the breakout classes to the animated marquee branch's outer `<div>`
      (currently `className="w-full select-none overflow-hidden bg-transparent py-4"`).
- [x] Leave the inner `motion.div` (the actual scrolling flex row) and its
      `px-4` gutter untouched — the photos should have a small edge inset
      from the true viewport edge, not touch it with zero gap.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (zero-warnings tolerance).
- Read the final file back and confirm both wrapper divs carry the new
  classes and nothing else in the file changed.
- Do NOT start the dev server — per project rule, only the user starts it.
