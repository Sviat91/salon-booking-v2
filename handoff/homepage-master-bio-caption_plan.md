# Plan: Show master bio under homepage cards + remove "choice remembered" hint text

**Date:** 2026-07-14
**Status:** In Progress
**Mode:** LIGHT (orchestrator-written plan; single-component UI change, no architectural decisions, direction already agreed with user)

## Goal

On the homepage "Choose your specialist" cards (`src/components/MasterSelector.tsx`), the master's `bio` field is already fetched from the API but never rendered anywhere (confirmed: `DbMaster` type includes `bio`, `/api/masters` already returns it). The user wants it shown as **plain, quiet text directly below each card** — no border, no background box, no icon, no hover-only reveal (must work identically on mobile and desktop, visible immediately without any interaction). If a master has no bio, nothing is rendered for them (no reserved empty space, no placeholder). The user does NOT want the card itself (its size, photo, name, hover "Book a visit" reveal) touched at all.

Separately, remove the "Subtle hint text" block entirely: `t('master.choiceRemembered', ...)` — the "Your choice will be remembered for a more convenient booking experience" text — the user considers it dead weight and wants it gone completely.

## Background — current structure (verified live)

`src/components/MasterSelector.tsx`:
- Line 111-114: a horizontally-scrolling flex row (`overflow-x-auto snap-x snap-mandatory`), whose direct children are currently the `<motion.button>` cards themselves (one per master, from `.map()` starting line 116).
- Line 117-134: the card is a single `<motion.button>` with `shrink-0 w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] snap-center` — width, height, and the scroll-snap target are all on this one element. All existing photo/gradient/name/hover-CTA content (lines 136-198) lives inside this button and must NOT be touched.
- Line 215-224: the entire "Subtle hint text" `<motion.p>` block to be deleted.
- `bio` is already on the `DbMaster` type (line 12) and in the `masters` array (from `/api/masters`) — no data-fetching changes needed, just start reading `master.bio`.
- Translation key `master.choiceRemembered` exists in `src/locales/en.json:72`, `src/locales/pl.json:72`, `src/locales/uk.json:44` — becomes orphaned once the hint text block is deleted (verify no other component uses this key before removing — a repo-wide grep should show only this one usage per locale file).

## Implementation Steps

- [x] Step 1: Restructure the card into an outer wrapper + caption, in `src/components/MasterSelector.tsx`
  - Wrap each `.map()` iteration's `<motion.button>` (currently the direct child of the scroll container, lines 117-199) in a new outer `<div>`:
    ```tsx
    <div key={master.id} className="flex flex-col items-center shrink-0 snap-center w-[160px] sm:w-[200px]">
      <motion.button
        ...
        className="group relative w-full h-[160px] sm:h-[200px] rounded-3xl overflow-hidden focus:outline-none hover:ring-4 hover:ring-secondary/50 transition-all duration-300"
      >
        {/* existing inner content — completely unchanged */}
      </motion.button>
      {master.bio && (
        <p className="mt-2 w-full text-center text-xs sm:text-sm text-muted-foreground line-clamp-2 px-1">
          {master.bio}
        </p>
      )}
    </div>
    ```
  - Move `key={master.id}`, `shrink-0`, and `snap-center` from the `<motion.button>` to this new outer `<div>` — the scroll-snap target and shrink behavior must apply to the whole card+caption unit now that it's the direct child of the scroll container, not just the photo square.
  - Move the fixed width (`w-[160px] sm:w-[200px]`) to the outer `<div>` too (so the caption naturally matches the card's width and centers under it). The `<motion.button>` itself changes from `w-[160px] h-[160px] sm:w-[200px] sm:h-[200px]` to `w-full h-[160px] sm:h-[200px]` (width now inherited from the wrapper, height stays fixed on the button since that's still the square photo card).
  - Do NOT add width/height/positioning classes to the caption beyond `w-full text-center` — it should be exactly as wide as the card and centered, nothing fancier.
  - Do NOT wrap the caption `<p>` in any bordered/background container — plain text only, matching the tone (`text-muted-foreground`) already used elsewhere in this same file for secondary text (e.g. the subtitle at line 93-95).
  - Use `line-clamp-2` (same convention already used for the master's name at line 177 in this file) so an unusually long bio doesn't blow out the layout — still centers/truncates consistently regardless of bio length, per the user's requirement that it "looks the same" across masters even with differing text length.
  - All existing motion props / entrance animation / hover effects on the `<motion.button>` itself stay completely unchanged — only its className width/height values change as described above. The caption `<p>` does not need its own entrance animation — plain conditional render is sufficient (the user asked for "just plain text," not a new animated element).

- [x] Step 2: Delete the "Subtle hint text" block
  - Remove the entire `<motion.p>` block at lines 215-224 (the comment `{/* Subtle hint text */}` and the element) from `src/components/MasterSelector.tsx`.

- [x] Step 3: Remove the now-orphaned translation key
  - First, grep the whole `src/` tree for `choiceRemembered` to confirm the only usage was the block removed in Step 2 (it should be — this key is scoped to `master.choiceRemembered` and nothing else in the codebase references it per this plan's research).
  - If confirmed unused, remove the `"choiceRemembered": "..."` line from all three locale files: `src/locales/en.json:72`, `src/locales/pl.json:72`, `src/locales/uk.json:44`. Take care to keep valid JSON (no trailing/dangling commas) after removing each line.

- [x] Step 4: Verify
  - `npx tsc --noEmit` clean.
  - `npm run build` succeeds.
  - `npm run lint` — no new problems vs. the current baseline (54 problems / 49 errors / 5 warnings, per this session's prior runs).
  - Grep `choiceRemembered` across the repo — should return nothing (or only this plan file / handoff notes, which is fine).
  - Read the final `MasterSelector.tsx` once to confirm: the scroll row's direct children are now `<div>` wrappers (not bare buttons), each wrapper carries `shrink-0 snap-center w-[160px] sm:w-[200px]`, the button inside is `w-full h-[160px] sm:h-[200px]`, and the bio `<p>` is conditionally rendered directly below the button, inside the same wrapper, with no border/background styling.

## Acceptance Criteria

- [x] Bio text renders directly below each master's card on the homepage when `master.bio` is non-empty; nothing renders (no gap, no placeholder box) when it's empty/null.
- [x] Bio text has no border, background, or box styling — plain centered text matching the app's existing muted secondary-text tone.
- [x] Bio text is visible immediately (no hover/tap required) — identical behavior on mobile and desktop.
- [x] Card itself (photo, size 160/200px square, name overlay, hover "Book a visit" reveal, entrance/hover/tap animations) is completely unchanged.
- [x] Horizontal scroll-snap still works correctly (each card+caption unit snaps to center as a whole).
- [x] The "Your choice will be remembered..." hint text and its `t('master.choiceRemembered', ...)` call are fully removed from the component.
- [x] `choiceRemembered` key removed from all three locale files (only if confirmed to have no other usages).
- [x] `tsc`/`build` clean; `lint` no new failures vs. baseline.

## Constraints & Risks

- **DO NOT** change the card's dimensions, photo, gradient overlay, name display, or the existing hover-reveal "Book a visit" CTA — none of that was requested and the user explicitly does not want the card redesigned.
- **DO NOT** add any icon, tooltip, popover, or hover/tap-to-reveal interaction for the bio — explicitly rejected by the user in favor of always-visible plain text.
- **DO NOT** reserve empty space for masters without a bio — if `bio` is falsy, render nothing for that master (not even an empty-height placeholder).
- **DO NOT** touch `src/app/[masterId]/page.tsx`, the admin masters list, or any other place bio might appear — this plan is scoped entirely to the homepage `MasterSelector.tsx` component and the one hint-text removal.
- No dev server — stop after implementation for the user's manual test: open the homepage, confirm bio shows under masters that have one (plain, centered, no box), confirm masters without bio show nothing extra, confirm the horizontal scroll/snap still feels right, and confirm the "Your choice will be remembered..." text is gone. Test at both mobile and desktop widths since visibility-without-interaction is the whole point of this change.
