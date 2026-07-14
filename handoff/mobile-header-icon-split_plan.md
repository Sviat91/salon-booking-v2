# Plan: Split header icon group on mobile to stop crowding the centered logo

**Date:** 2026-07-14
**Status:** In Progress
**Mode:** LIGHT (orchestrator-written plan; mechanical responsive-class split, replicates the existing `hidden lg:block`/`block lg:hidden` pattern already used in this same file for the logo, no architectural decisions)

## Goal

On the homepage (`src/components/home/HomeClient.tsx`), the icon group (profile/account icon `UserDropdown`, language switcher `LanguageToggle`, theme toggle `ThemeToggle`) is a single `absolute top-4 right-4 z-20 flex items-center gap-2` div (line 62-66) — identical at every viewport width. On desktop (`lg:` and up) this is fine because the desktop logo sits absolutely at the far left/wherever configured (lines 68-108), with no overlap. On mobile (below `lg`), the logo switches to a different, centered block (lines 110-150, centered via `text-center` + `mx-auto`), and because the icon group was never given a mobile-specific position, all three icons cluster in the top-right corner right above/overlapping the now-centered logo — looks bad (user-reported, confirmed via screenshot).

Fix (user-specified, already decided — do not redesign further): on mobile/narrow viewports, split the group — keep `ThemeToggle` pinned in the top-right corner, move `UserDropdown` + `LanguageToggle` to the top-left corner. On desktop/wide, keep the exact current behavior (all three together on the right) — completely unchanged.

## Background — current code (verified live)

`src/components/home/HomeClient.tsx:62-66`:
```tsx
<div className="absolute top-4 right-4 z-20 flex items-center gap-2">
  <UserDropdown />
  <LanguageToggle />
  <ThemeToggle />
</div>
```

This is the ONLY place this icon group is rendered — no responsive variants exist for it today. Compare to the logo a few lines below in the same file, which already uses this exact pair-of-blocks convention for responsive show/hide:
- Line 69: `<div className="hidden lg:block z-10" ...>` (desktop-only)
- Line 110: `<div className="block lg:hidden pt-6 pb-2 px-4 text-center">` (mobile-only)

This plan replicates that same `hidden lg:...` / `...lg:hidden` convention for the icon group, splitting it into a desktop block (unchanged content) and two mobile-only blocks (one per corner).

## Implementation Steps

- [x] Step 1: Replace the single icon-group div (lines 62-66) in `src/components/home/HomeClient.tsx` with three divs:

  ```tsx
  {/* Desktop: all three icons together on the right — unchanged from before */}
  <div className="hidden lg:flex absolute top-4 right-4 z-20 items-center gap-2">
    <UserDropdown />
    <LanguageToggle />
    <ThemeToggle />
  </div>

  {/* Mobile: split so nothing crowds the centered logo below — theme toggle stays top-right */}
  <div className="flex lg:hidden absolute top-4 right-4 z-20 items-center">
    <ThemeToggle />
  </div>

  {/* Mobile: account + language move to top-left */}
  <div className="flex lg:hidden absolute top-4 left-4 z-20 items-center gap-2">
    <UserDropdown />
    <LanguageToggle />
  </div>
  ```

  - Keep `UserDropdown` before `LanguageToggle` in the mobile left-corner group — matches their existing left-to-right order in the original single group (profile icon, then language, then theme), just now split at a different point.
  - Do not add `gap-2` to the theme-toggle-only mobile div (no other element inside it, unnecessary).
  - `z-20` stays on all three (matching the original), so the icons still sit above the logo/content if anything visually intersects.
  - Do not touch `ThemeToggle.tsx`, `LanguageToggle.tsx`, or `UserDropdown.tsx` themselves — only the wrapping divs in `HomeClient.tsx` change.
  - Do not touch the logo blocks (lines 68-150) or anything else in this file.

- [x] Step 2: Verify
  - `npx tsc --noEmit` clean.
  - `npm run build` succeeds.
  - `npm run lint` — no new problems vs. the current baseline (54 problems / 49 errors / 5 warnings).
  - Read the final file once to confirm: exactly one `hidden lg:flex` div containing all three components (desktop), and exactly two `flex lg:hidden` divs (one with just `ThemeToggle` at `right-4`, one with `UserDropdown` + `LanguageToggle` at `left-4`) — no leftover single combined div, no duplicate imports, no orphaned braces.

## Acceptance Criteria

- [x] On viewports at or above the `lg` breakpoint (1024px), the header icon layout is pixel-identical to before this change — all three icons together, top-right.
- [x] Below `lg`, `ThemeToggle` renders alone in the top-right corner; `UserDropdown` + `LanguageToggle` render together in the top-left corner.
- [x] The centered mobile logo (lines 110-150, untouched) no longer has any icon directly overlapping/crowding it at typical mobile widths (this plan doesn't change the logo, only clears space around it by relocating the icons).
- [x] No changes to `ThemeToggle.tsx`, `LanguageToggle.tsx`, `UserDropdown.tsx`, or the logo blocks.
- [x] `tsc`/`build` clean; `lint` no new failures vs. baseline.

## Constraints & Risks

- **DO NOT** change the desktop (`lg:` and up) layout in any way — it must remain exactly as it is today.
- **DO NOT** touch the logo positioning/sizing logic — this plan only relocates the icon group, per the user's explicit direction.
- **DO NOT** introduce JavaScript-based viewport detection (`useMediaQuery`, `window.innerWidth`, etc.) — this is a pure Tailwind responsive-class change, matching the existing `hidden lg:*` / `*lg:hidden` convention already used in this exact file for the logo.
- No dev server — stop after implementation for the user's manual test: resize the browser (or use device emulation) from mobile width up through and past the `lg` breakpoint (1024px) and confirm the icons smoothly relocate at that exact breakpoint, with no overlap with the logo at any mobile width tested, and no change to the desktop layout.
