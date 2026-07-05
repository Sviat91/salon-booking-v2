# Calendar page container fix (post-Stage-3 bug)

**STATUS: approved by user 2026-07-05, implementation starting now.**

## Context

User reported (with a side-by-side screenshot vs. the design mockup) that `/admin/calendar` has no visible border/frame and the whole page scrolls instead of just the calendar grid scrolling internally. Root cause diagnosed by the orchestrator, not the coder — this is a value-only fix, no architectural decision needed.

## Root cause

`src/app/admin/layout.tsx` renders every admin page inside:
```
<main className="flex-1 overflow-y-auto bg-background">
  <div className="mx-auto max-w-5xl px-6 py-8">
    {children}
  </div>
</main>
```
`main`'s available height = `100vh - 4rem` (the `AdminTopBar` is `h-16` = 4rem, confirmed in `src/components/admin/AdminTopBar.tsx:19`). The `px-6 py-8` wrapper then consumes another `4rem` of vertical space (`py-8` = 2rem top + 2rem bottom) before `{children}` renders. So the true available height for a page's own content is `100vh - 8rem`, not `100vh - 4rem`.

`admin/calendar/page.tsx`'s card only accounts for the top bar (`h-[calc(100vh-4rem)]`), omitting the wrapper's own `4rem` padding. The card ends up ~4rem taller than the visible area, so `main`'s `overflow-y-auto` kicks in and scrolls the *whole page* — pushing the card's bottom edge and rounded corners below the fold. That's why the frame looks cut off/missing at the bottom in the screenshot.

Separately, the Stage 3 rewrite changed this card's background from `bg-background` to `bg-card` but never added a `border`. `--card` and `--background` both resolve from adjacent M3 surface tones (`--md-surface` / `--md-surface-container-low`, see `src/styles/globals.css:380-382,427-429`) — nearly indistinguishable without an explicit border. That's why there's no visible frame at all, even where the card *is* on-screen. `admin/master/schedule/page.tsx`'s equivalent card already has `border shadow-sm` (kept from before Stage 3), which is why that page wasn't reported as broken — but it has the *identical* height-arithmetic bug (`h-[calc(100vh-6rem)]`, 2rem short of the correct `8rem`), just less visually obvious since a border is present. Fix both for consistency; it's the same one-value correction.

## Fix (value-only changes, no structural/logic changes)

### `src/app/admin/calendar/page.tsx`
- [x] Line 28 (loading-state div): `h-[calc(100vh-6rem)]` → `h-[calc(100vh-8rem)]` (minor: was already inconsistent with line 35's value, both are wrong versions of the same bug).
- [x] Line 35: `h-[calc(100vh-4rem)]` → `h-[calc(100vh-8rem)]`.
- [x] Line 35: add `border border-border shadow-sm` to the class list (matching `admin/master/schedule/page.tsx:21`'s exact card convention: `bg-card border rounded-[20px] shadow-sm overflow-hidden`).

Result line 35: `"flex h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden bg-card border border-border rounded-[20px] shadow-sm"`

### `src/app/admin/master/schedule/page.tsx`
- [x] Line 15: `h-[calc(100vh-6rem)]` → `h-[calc(100vh-8rem)]`. No other change — the heading block above the card and the card's own `flex-1 min-h-[500px]` already absorb the corrected total height correctly via flexbox; only the outer total-height value was wrong.

## Explicitly not touched
- `admin/layout.tsx` itself — the shared `max-w-5xl`/`py-8` wrapper used by every admin page is untouched; this fix only corrects the two pages' own height math to match that wrapper's real dimensions, it does not restructure the shared layout. True edge-to-edge full-viewport width remains a separate, explicitly deferred decision (per the Stage 3 plan) — this fix is about the card fitting *within* the existing contained column without triggering page-level scroll, matching the mockup's "card doesn't exceed the page, scroll happens inside the calendar" behavior.
- No changes to `ModernCalendar.tsx`/`WeekView.tsx`/`DayView.tsx`/`MonthView.tsx` — their internal scroll areas (`custom-scrollbar` divs) are unaffected; once the outer card's height is correct, their existing internal `overflow-y-auto` grid areas will be the only thing that scrolls.

## Verification
- [x] `npx tsc --noEmit` — passed, no output
- [x] `npm run lint` — 55 pre-existing errors/5 warnings unrelated to the 2 edited files (none in `admin/calendar/page.tsx` or `admin/master/schedule/page.tsx`); no new errors introduced
- [x] `npm run build` — succeeded, all 73 pages generated
- Manual (user, in-browser, both `/admin/calendar` and `/admin/master/schedule`): confirm a full border/frame is visible on all 4 sides, confirm the page itself does not scroll (only the calendar's internal time grid scrolls), confirm this holds in both light and dark mode and at a typical desktop viewport height.

### Critical files
- `src/app/admin/calendar/page.tsx`
- `src/app/admin/master/schedule/page.tsx`
