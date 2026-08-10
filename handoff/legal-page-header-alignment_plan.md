# Plan: align in-flow page toolbars to the edge-to-edge nav bar

## Root cause (pre-existing, not from today's ThemeToggle work)

Two different toolbar patterns exist in this codebase:

1. **Absolutely-positioned nav bar** (`HomeClient.tsx`, `PageRenderer.tsx`,
   `[masterId]/page.tsx`, `[masterId]/pages/[slug]/page.tsx`,
   `pages/[slug]/page.tsx`): `<div className="absolute top-2 left-0 right-0 ...">`.
   CSS offsets on an absolutely-positioned element are relative to the
   parent's **padding box**, not its content box — so `left-0 right-0`
   ignores the parent `<main>`'s own padding entirely and sits flush to the
   true edge, even though that `<main>` has `px-3 py-4 sm:p-6`.

2. **In-flow toolbar** (`LegalPageHeader.tsx` — used by `/privacy`,
   `/terms`, `/support` — and `PageToolbar.tsx` — used by `/profile`,
   `/profile/edit`): rendered as a normal flow child, so it fully inherits
   the parent `<main>`'s `px-3 py-4 sm:p-6` padding. That's why these five
   routes visibly sit lower and inset from the right edge compared to
   everywhere else.

The in-flow choice for `LegalPageHeader` was deliberate (see its own
comment, 2026-08-07 fix): absolute positioning previously caused the bar to
overlap page content when it wrapped to two lines on narrow desktop widths,
on these specific content-dense pages. **Do not revert that — do not make
these bars `position: absolute`.** The fix here is to stop the `<main>`
padding from reaching the toolbar at all, while keeping it in normal flow.

## Fix

For each affected `<main>`: remove its own padding, keep everything else
(`relative flex-1 flex flex-col w-full max-w-full box-border
overflow-x-hidden`), and move the padding down onto the content wrapper
below the toolbar instead — so the toolbar becomes the flush, unpadded
first child (matching the visual position of the absolute-positioned bars
elsewhere), while the actual page content keeps the same spacing it has
today.

### 1. `src/components/legal/LegalPageHeader.tsx`
Add `pt-2` to the existing wrapper div (currently
`className="pl-3 lg:pl-28 xl:pl-32"` → `className="pt-2 pl-3 lg:pl-28 xl:pl-32"`),
matching the `top-2` (8px) offset the absolutely-positioned bars use, for
exact vertical parity. One file, applies to all three routes below since
they all render `<LegalPageHeader />` the same way.

### 2. `src/components/PageToolbar.tsx`
Same reasoning, same fix: add `pt-2` to the outer wrapper div (currently
`className="flex items-center justify-between gap-2"` →
`className="pt-2 flex items-center justify-between gap-2"`). Used only by
`/profile` and `/profile/edit` (verified — no other consumers).

### 3. `src/app/privacy/page.tsx`, `src/app/privacy/loading.tsx`,
   `src/app/terms/page.tsx`, `src/app/terms/loading.tsx`,
   `src/app/support/page.tsx`, `src/app/support/loading.tsx`
In each: change `<main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">`
to `<main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">`.
Then on the content `<div>` immediately below `<LegalPageHeader />` in that
same file, change `px-0` to `px-3 sm:px-6` (keep every other class on that
div exactly as-is — `pt-4`/`pt-12`, `pb-8`/`pb-6`, `space-y-4`, `container
mx-auto max-w-4xl`/`max-w-6xl`, unchanged).

### 4. `src/app/profile/page.tsx`, `src/app/profile/edit/page.tsx`
Same `<main>` change as above (drop the `px-3 py-4 sm:p-6`, keep the rest).
The content wrapper here is `<div className="mx-auto w-full max-w-lg mt-4 space-y-6">`
(no existing `px-*`) — add `px-3 sm:px-6` to it: `<div className="mx-auto w-full max-w-lg mt-4 px-3 sm:px-6 space-y-6">`.
Do not touch the other two conditional `<main>` blocks in these files
(loading/error states at `profile/page.tsx:151,162` and
`profile/edit/page.tsx:116` use a different, unrelated className
`"flex-1 flex items-center justify-center"` — not part of this bug, leave
untouched).

## Explicit non-goals

- Do not touch `HomeClient.tsx`, `PageRenderer.tsx`, `[masterId]/page.tsx`,
  `[masterId]/pages/[slug]/page.tsx`, or `pages/[slug]/page.tsx` — their nav
  bars are already edge-to-edge via absolute positioning; they are the
  reference behavior this fix is matching, not something to change.
- Do not revert `LegalPageHeader`'s in-flow (non-absolute) positioning —
  that was a deliberate fix for a different, real bug (2-line wrap overlap
  on narrow desktop for dense-text pages). This plan only removes the
  parent `<main>`'s padding around it, it does not change how it's
  positioned in the flow.
- Do not touch `ThemeToggle.tsx`, `TopNavLine.tsx`, or today's
  icon-size feature — unrelated, already reviewed/approved separately.

## Verification

- `npx tsc --noEmit` and `npm run lint` clean.
- Manual (report back, don't run a dev server): confirm by reading the
  final JSX that on all 8 touched routes, the toolbar row is now the first
  unpadded child of `<main>` and the content below still has its original
  horizontal/vertical spacing values, just relocated from `<main>` to the
  content div. Flag explicitly if any route's content div had a
  non-obvious reason for `px-0` that isn't just "main already padded it"
  (i.e., don't apply this mechanically if a file turns out to differ from
  what's described above — re-read it and report instead of guessing).
- This is exactly the kind of edge/pixel alignment work flagged before as
  needing real-viewport verification, not just math — call this out
  explicitly in the manual-check list for the user, don't claim it's
  visually confirmed.

## Implementation status

- [x] 1. `src/components/legal/LegalPageHeader.tsx` — `pt-2` added
- [x] 2. `src/components/PageToolbar.tsx` — `pt-2` added
- [x] 3. privacy/terms/support `page.tsx` + `loading.tsx` (6 files) — `<main>` padding removed, content div `px-0` → `px-3 sm:px-6`
- [x] 4. `src/app/profile/page.tsx`, `src/app/profile/edit/page.tsx` — `<main>` padding removed, content div gained `px-3 sm:px-6`

All 8 route files matched the plan's assumed content exactly, no discrepancies found.
`npx tsc --noEmit` clean. `npm run lint` shows only pre-existing errors unrelated to these changes (verified via `git stash` diff).
