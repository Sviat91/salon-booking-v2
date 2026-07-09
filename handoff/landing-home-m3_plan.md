# Landing/Home M3 Pass — v2 (redo, cards excluded)

## Context

The user reverted ALL of yesterday's landing/home M3 work (git working tree is back to
commit `4b57751`, `MasterSelector.tsx` is back to the original small-circle-card design).
Reason: the master cards kept flip-flopping between "big" and "small" across revisions and
the user is done iterating on them. **This redo must NOT touch `MasterSelector.tsx` at all —
zero diff, not even whitespace.**

The other real, still-unfixed complaint: the hover states on the language dropdown and the
user/account icon button are barely visible or fully invisible (especially in light theme).
Root cause (confirmed by reading current file state): `LanguageToggle.tsx` still uses
pre-M3 **dead Tailwind tokens** that don't resolve to real utilities — `text-text`,
`dark:text-dark-text`, `text-muted`, `dark:text-dark-muted`, `hover:bg-primary/30
dark:hover:bg-dark-border/50`, `bg-primary/20 dark:bg-dark-border/30`, `text-accent`. And
`UserDropdown.tsx`'s trigger button uses `hover:bg-black/5 dark:hover:bg-white/10`, which is
too low-contrast to read as an interactive state.

User's explicit new instruction for the hover fix: make it "тем цветом, которым обычно
выделяем кнопки" — the same color used to highlight buttons elsewhere in the app. In this
codebase that is `--primary` / `--primary-foreground` (see `src/components/ui/button.tsx`
`default` variant: `bg-primary text-primary-foreground`) — NOT `--accent` (which is a paler
tonal-container color, mapped from the tenant's `primaryColor` field, and is what caused the
last "barely visible" complaint). Do not touch `--accent`-based shared UI (e.g.
`DropdownMenuItem` in `src/components/ui/dropdown-menu.tsx`) — that component was never part
of the complaint and must stay as-is.

## Hard constraints

- [x] `src/components/MasterSelector.tsx` — **DO NOT EDIT**. Verify with
      `git diff --stat -- src/components/MasterSelector.tsx` showing empty output before
      finishing.
- [x] `src/components/ThemeToggle.tsx` — **DO NOT EDIT** (hard-locked per standing
      instruction, icon must stay ours). Verify with
      `git diff --stat -- src/components/ThemeToggle.tsx` showing empty output.
- [x] `src/components/home/HomeClient.tsx` — **DO NOT EDIT**. Its only prior change was
      passing a `brandName` prop into `MasterSelector`, which is out of scope now that cards
      aren't touched. No nav bar, no logo changes (already settled/rejected in a prior round).

## Steps

1. [x] **`src/components/LanguageToggle.tsx`** — fix dead tokens + make hover clearly visible
   - Trigger button (`className` on the outer `<button>`): change
     `"p-2 hover:opacity-80 transition-opacity duration-300 flex items-center gap-1"`
     to a bordered pill with a real hover state:
     `"px-3 py-2 rounded-full border border-border bg-transparent hover:bg-primary/10 hover:border-primary/40 transition-colors flex items-center gap-1"`
   - Trigger code text: `text-text dark:text-dark-text` → `text-foreground`
   - Trigger chevron: `text-muted dark:text-dark-muted` → `text-muted-foreground`
   - Dropdown panel container: change `py-1` → `p-1` (this is the fix for the overflow bug
     from last time — panel needs horizontal padding to match item corner radius). Keep
     everything else on that div (`bg-card border border-border rounded-xl shadow-lg
     min-w-[120px] z-50`) as-is.
   - Item buttons: remove the dead-token hover/selected classes and replace with a strong,
     clearly-visible primary-based state. Do NOT add `mx-1` (that's what caused the overflow
     bug before — the panel now has `p-1` instead, so items can stay full-width with no
     extra margin). New className:
     ```
     `w-full px-3 py-2 flex items-center justify-between rounded-md transition-colors hover:bg-primary hover:text-primary-foreground ${
       lang === language ? 'bg-primary/15 text-primary font-medium' : 'text-foreground'
     }`
     ```
     (hover always wins visually and uses the same bold `bg-primary`/`text-primary-foreground`
     pairing as the app's primary buttons; the resting "selected" state is a lighter primary
     tint so it doesn't look identical to hover)
   - Item label span: remove hardcoded `text-sm text-foreground` conflict — since the parent
     button now carries the text color via the classes above, change the label span to just
     `"text-sm"` (inherits color from parent button state) — do not hardcode `text-foreground`
     on the span anymore, or the hover text-color won't show through.
   - Checkmark svg: `text-accent` → `text-primary` (only shown in the non-hover selected
     state — leave as `text-primary`, that reads fine against both the transparent and
     `bg-primary/15` backgrounds since it's just an icon)
   - Everything else (state hooks, click-outside handling, escape handling, display code
     logic) — untouched.

2. [x] **`src/components/auth/UserDropdown.tsx`** — fix invisible trigger hover
   - Trigger `<button>` className: change
     `"p-2 outline-none hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors duration-300 text-foreground/80 hover:text-foreground focus:ring-2 focus:ring-primary/50"`
     to a filled primary icon button (same treatment as the app's primary buttons, always
     visible, not hover-dependent to discover):
     `"p-2.5 rounded-full bg-primary text-primary-foreground hover:ring-2 hover:ring-primary/40 hover:shadow-md transition focus:ring-2 focus:ring-primary/50 outline-none flex items-center justify-center"`
   - Loading-state skeleton div (`status === "loading"` branch) — update to match the new
     circle size so there's no layout jump when it resolves: change
     `"p-2 text-muted-foreground animate-pulse"` / inner `"h-5 w-5 bg-muted rounded-full"`
     to `"p-2.5 rounded-full bg-muted animate-pulse"` / inner `"h-5 w-5"` (matches the
     `p-2.5` sizing of the real button; do not add a background to the inner div since the
     outer one already has `bg-muted`).
   - `DropdownMenuContent` / `DropdownMenuItem` / `DropdownMenuLabel` / `DropdownMenuSeparator`
     usage below — **untouched**. These already use the correct shared `--accent` hover
     convention from `src/components/ui/dropdown-menu.tsx` and were never part of the
     complaint.

3. [x] **`src/components/reviews/ReviewsMarquee.tsx`** — minor chrome consistency (low risk,
   optional polish, previously done without any complaint)
   - Image card wrapper: `"relative overflow-hidden rounded-xl border-[3px] border-border shadow-sm hover:shadow-md transition-all duration-300 bg-card"`
     → `"relative overflow-hidden rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 bg-card"`
     (thinner border, larger radius — matches the M3 rounding scale used elsewhere; purely
     cosmetic, no logic change)

## Explicitly out of scope this pass

- `MasterSelector.tsx` (cards) — hard excluded per user instruction, do not touch
- `HomeClient.tsx` — no logo/nav changes, already settled in a prior round
- `ThemeToggle.tsx` — hard-locked
- Any sticky nav bar — already rejected by the user in a prior round, do not reintroduce

## Verification (coder must run before marking done)

- [x] `git diff --stat -- src/components/MasterSelector.tsx` → empty
- [x] `git diff --stat -- src/components/ThemeToggle.tsx` → empty
- [x] `git diff --stat -- src/components/home/HomeClient.tsx` → empty
- [x] `npx tsc --noEmit` → no new errors
- [x] `npm run lint` → compare error/warning count against `git stash` baseline on `master`,
      confirm no new errors introduced by these 3 files
- [x] `npm run test` → compare failure count against `git stash` baseline, confirm no
      regressions
