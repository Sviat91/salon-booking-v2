# Plan: Stage 5 — Booking Management (self-service) M3 pass

**Date:** 2026-07-09
**Status:** Implemented — pending manual visual walkthrough

## Goal
Bring the `src/components/booking-management/**` self-service flow (search → cancel/change → success/error panels) up to the same M3 token-hygiene standard as Stages 1–4: kill dead pre-M3 Tailwind tokens and fix the `text-white`+`dark:bg-accent` dark-mode contrast bug, with zero logic/state-machine/Turnstile changes.

## Architecture Decisions

Audit findings (whole module read; grep + Tailwind config + globals.css cross-checked):

1. **Dead tokens confirmed dead.** `tailwind.config.ts` defines only semantic color families (`foreground`, `muted`, `card`, `border`, `primary`, `accent`, `destructive`, …). There is **no** `dark-text` / `dark-muted` / `dark-border` color family, so `dark:text-dark-text`, `dark:text-dark-muted`, `dark:border-dark-border`, `dark:bg-dark-border`, `dark:placeholder-dark-muted`, `dark:hover:bg-dark-border/*` all compile to **zero CSS** — identical class to what Landing/Home fixed. Because their light-mode partner (`text-neutral-800`, etc.) then applies in *both* modes, several panel texts render dark-gray-on-dark-card in dark mode = a real readability bug, not just cosmetic. Fix by converting the neutral+dead-dark pair to the semantic token.

2. **The Stage-3 accent bug recurs here 6×.** Six primary-action buttons use `bg-primary … text-white … dark:bg-accent dark:hover:bg-accent/90`. In dark mode `--accent` resolves to `md-primary-container` (a pale container color) while text stays white → near-unreadable, exactly the `BookingConsentModal` bug from Stage 3. Confirmed against `src/styles/globals.css`: `--primary-foreground` is `#FFFFFF` (light) / `#3B0017` (dark), so swapping `text-white` → `text-primary-foreground` reads correctly in **both** modes (white on `bg-primary` in light, dark maroon on pale `bg-accent` in dark). Same fix Stage 3 shipped.

3. **Status-color language is left as-is (explicit non-goal).** The module ships a coherent status vocabulary — success=green, error/destructive=red, warning=amber, info=blue, disabled=gray/neutral — with valid `dark:` variants (real palette colors, correct in both modes). These are **not** dead and **not** the accent bug. There are no `--success` / `--warning` / `--info` CSS variables to map them to, and rewriting ~12 files of working status tints to match `LinkBookingsCard`'s exact shades (`green-50/700/200 dark:green-950/300/900`) would be a large, risky refactor with no functional bug driving it — outside a hygiene pass. Consistent with Stage 4's "reuse existing tints, don't invent, don't refactor working color systems." `text-white` on **saturated solid** status buttons (`bg-green-600`, `bg-red-600`, `bg-amber-500`, `bg-neutral-600`) has good contrast and stays.

4. **Three near-limit files, all handled by in-place swaps only.** `PanelRenderer.tsx` (423), `BookingManagement.tsx` (297), and `EditProcedurePanel.tsx` (420) are all near the 500-line hard limit. **Every** change in this stage is an in-place edit *inside an existing className string* (dead-token → equal-or-shorter semantic token, or `text-white` → `text-primary-foreground`). No new lines are added to any file. This is the same technique Stage 3 used to keep `BookingForm.tsx` at 496/500.

5. **`ConfirmChangePanel.tsx` is unused dead code.** It is not imported by `PanelRenderer.tsx` or anywhere else in `src/` (only self-references). Per the "mention, don't delete pre-existing dead code" rule it is **not** edited and **not** deleted — flagged to the user instead. Editing it would change zero rendered pixels.

### Token Mapping Reference (apply mechanically wherever the dead token appears)

| Dead / non-semantic token (compiles to nothing or wrong) | Replace with |
| --- | --- |
| `text-neutral-800 dark:text-dark-text` | `text-foreground` |
| `text-neutral-700 dark:text-dark-text` | `text-foreground` |
| `dark:text-dark-text` (standalone, no light partner) | `text-foreground` |
| `text-neutral-600 dark:text-dark-muted` | `text-muted-foreground` |
| `text-neutral-500 dark:text-dark-muted` | `text-muted-foreground` |
| `dark:text-dark-muted` (standalone) | `text-muted-foreground` |
| `dark:border-dark-border` | *drop it* (element already has `border-border`) |
| `dark:hover:bg-dark-border/30` | *drop it* (element already has `hover:bg-muted`) |
| `bg-neutral-200 dark:bg-dark-border` (skeleton) | `bg-muted` |
| `dark:bg-dark-border/50 dark:text-dark-muted` (disabled) | `dark:bg-muted dark:text-muted-foreground` |
| `dark:placeholder-dark-muted` | `placeholder:text-muted-foreground` |
| `dark:text-dark-muted dark:hover:text-dark-text` | `text-muted-foreground hover:text-foreground` |
| `text-white` **only when button is** `bg-primary … dark:bg-accent` | `text-primary-foreground` |

Do **not** touch: any `green-*`, `red-*`, `amber-*`, `blue-*`, `gray-*`, `neutral-600` solid-button colors; the `text-red-*` close-panel link; scrollbar utilities.

## Implementation Steps

### A. Near-limit files — in-place swaps only, verify final line count

- [x] Step 1: `BookingManagement.tsx` (297 lines — **verify still 297 after**)
  - Files: `src/components/booking-management/BookingManagement.tsx`
  - Details: Line 224 only — remove the dead `dark:border-dark-border` from the panel container (`border-border` already present). Leave line 213's `text-red-*` close link untouched. Leave the `scrollbar-thin scrollbar-thumb-gray-*` classes on line 224 untouched (separately dead — see Constraints). No other changes.

- [x] Step 2: `PanelRenderer.tsx` (423 lines — **verify still 423 after**)
  - Files: `src/components/booking-management/PanelRenderer.tsx`
  - Details: **No-op.** Pure state→panel routing switch, zero color/visual className tokens. Verify byte-identical (empty diff) — it is only near-limit, it is not edited.

- [x] Step 3: `EditProcedurePanel.tsx` (420 lines — **verify still 420 after**)
  - Files: `src/components/booking-management/EditProcedurePanel.tsx`
  - Details: Apply the mapping table to the dead tokens at lines 70, 71, 74, 77, 93, 100, 106, 113, 124, 126, 140, 413. Note the disabled-option branch (line 126) `dark:bg-dark-border/50 dark:text-dark-muted` → `dark:bg-muted dark:text-muted-foreground`, and the base option button (line 124) standalone `dark:text-dark-text` → `text-foreground`. **Accent-bug fix** at lines 276, 365, 376: `text-white` → `text-primary-foreground` (these three are `bg-primary … dark:bg-accent`). Leave the green/amber/red status boxes and the `bg-green-600`/`bg-amber-500` solid buttons (lines 307, 336) unchanged.

### B. Dead-token cleanup panels (apply mapping table)

- [x] Step 4: `SearchPanel.tsx`
  - Files: `src/components/booking-management/SearchPanel.tsx`
  - Details: Lines 32, 65 (`dark:text-dark-muted`), lines 38 & 53 (`dark:border-dark-border dark:placeholder-dark-muted` → drop `dark:border-dark-border`, `dark:placeholder-dark-muted` → `placeholder:text-muted-foreground`). Leave line 71 `text-red-*` error text (status).

- [x] Step 5: `ResultsPanel.tsx`
  - Files: `src/components/booking-management/ResultsPanel.tsx`
  - Details: Lines 62, 97 (`dark:text-dark-text`), lines 65, 68, 109, 112, 146 (`dark:text-dark-muted`), lines 72, 92 (`dark:border-dark-border` → drop), line 92 also `dark:hover:bg-dark-border/30` → drop. Leave amber (115) and red (138) status/action tints.

- [x] Step 6: `NoResultsPanel.tsx`
  - Files: `src/components/booking-management/NoResultsPanel.tsx`
  - Details: Line 16 (`dark:text-dark-text`), line 19 (`dark:text-dark-muted`).

- [x] Step 7: `LoadingPanel.tsx`
  - Files: `src/components/booking-management/LoadingPanel.tsx`
  - Details: Line 9 (`dark:text-dark-muted`), line 15 skeleton `bg-neutral-200 dark:bg-dark-border` → `bg-muted`.

- [x] Step 8: `ErrorFallbackPanel.tsx`
  - Files: `src/components/booking-management/ErrorFallbackPanel.tsx`
  - Details: Line 20 (`dark:text-dark-text`), line 23 (`dark:text-dark-muted`). Leave the red icon circle (status).

- [x] Step 9: `EditSelectionPanel.tsx`
  - Files: `src/components/booking-management/EditSelectionPanel.tsx`
  - Details: Lines 42, 50, 67, 85 (`dark:text-dark-text`), lines 51, 70, 88 (`dark:text-dark-muted`).

- [x] Step 10: `EditDatetimePanel.tsx`
  - Files: `src/components/booking-management/EditDatetimePanel.tsx`
  - Details: Lines 53, 59, 61, 85, 88, 92, 98 (`dark:text-dark-muted`), lines 60, 86 standalone `dark:text-dark-text` → `text-foreground`.

- [x] Step 11: `ContactMasterPanel.tsx`
  - Files: `src/components/booking-management/ContactMasterPanel.tsx`
  - Details: Lines 83, 100, 115, 128, 143 (`dark:text-dark-text`), lines 86, 154 (`dark:text-dark-muted`). **Accent-bug fix** line 174: `text-white` → `text-primary-foreground` (`bg-primary … dark:bg-accent`). Leave line 92–93 red error box (status).

- [x] Step 12: `ConfirmCancelPanel.tsx`
  - Files: `src/components/booking-management/ConfirmCancelPanel.tsx`
  - Details: Line 38 (`dark:text-dark-muted`) only. Leave all red status tints and the `bg-red-600 text-white` confirm button (saturated, good contrast).

- [x] Step 13: `ConfirmChangePanel.tsx` — **flagged unused; do NOT edit**
  - Files: `src/components/booking-management/ConfirmChangePanel.tsx`
  - Details: Not imported by `PanelRenderer.tsx` or anywhere in `src/` — dead code, renders nowhere. Leave byte-identical. Report to user (see Constraints) so they can decide on deletion separately. It does contain dead tokens (lines 39, 45, 46, 47) but editing invisible code is out of scope.

- [x] Step 14: `ConfirmTimeChangePanel.tsx`
  - Files: `src/components/booking-management/ConfirmTimeChangePanel.tsx`
  - Details: Lines 55, 65 (`dark:text-dark-text`), line 58 (`dark:text-dark-muted`). **Accent-bug fix** line 120: `text-white` → `text-primary-foreground`. Leave red/green comparison tints (71–94, 101–102).

- [x] Step 15: `DirectTimeChangePanel.tsx`
  - Files: `src/components/booking-management/DirectTimeChangePanel.tsx`
  - Details: Lines 76, 92, 99 (`dark:text-dark-text`), lines 79, 88, 94 (`dark:text-dark-muted`). **Accent-bug fix** line 173: `text-white` → `text-primary-foreground`. Leave red/green/gray comparison tints (106–153).

- [x] Step 16: `CancelErrorPanel.tsx`
  - Files: `src/components/booking-management/CancelErrorPanel.tsx`
  - Details: Line 96 only — `text-neutral-500 hover:text-neutral-700 dark:text-dark-muted dark:hover:text-dark-text` → `text-neutral-500 hover:text-neutral-700 text-muted-foreground hover:text-foreground` (i.e. drop the dead dark tokens and let the semantic `text-muted-foreground hover:text-foreground` govern; keep it a single clean pair — `text-muted-foreground hover:text-foreground`). Leave red/amber/blue status boxes and `bg-red-600 text-white` button.

### C. Accent-bug-only panel (no dead tokens)

- [x] Step 17: `ProcedureChangeErrorPanel.tsx`
  - Files: `src/components/booking-management/ProcedureChangeErrorPanel.tsx`
  - Details: **Accent-bug fix** line 85 only: `text-white` → `text-primary-foreground` (`bg-primary … dark:bg-accent`). All red/amber status tints stay. No dead tokens present.

### D. No-op panels — verify byte-identical (already semantic / only saturated status colors)

- [x] Step 18: `ContactMasterSuccessPanel.tsx` — verify empty diff (green/blue status + `bg-green-600 text-white`, all fine).
- [x] Step 19: `CancelSuccessPanel.tsx` — verify empty diff.
- [x] Step 20: `TimeChangeSuccessPanel.tsx` — verify empty diff.
- [x] Step 21: `ProcedureChangeSuccessPanel.tsx` — verify empty diff.
- [x] Step 22: `TimeChangeErrorPanel.tsx` — verify empty diff (red/blue status + `bg-neutral-600 text-white`, all fine).

### E. Non-visual & LOCKED files — DO NOT MODIFY, verify byte-identical

- [x] Step 23: `state/useBookingManagementState.ts` — **LOCKED (state machine).** Zero classNames. Do not touch; verify empty diff.
- [x] Step 24: `hooks/useTurnstileSession.ts` — **LOCKED (Turnstile gate).** Only className is `"rounded-xl"` (no color). Do not touch; verify empty diff.
- [x] Step 25: `hooks/useBookingMutations.ts` — pure logic, zero style tokens. Verify empty diff.
- [x] Step 26: `hooks/useBookingHandlers.ts` — pure logic, zero style tokens. Verify empty diff.
- [x] Step 27: `api/bookingManagementApi.ts` — API layer, no classNames. Verify empty diff.
- [x] Step 28: `types.ts` — types only. Verify empty diff.
- [x] Step 29: `index.ts` — barrel export only. Verify empty diff.

### F. Verify

- [x] Step 30: DOX pass — confirm `src/components/booking-management/AGENTS.md` needs **no** update (purpose, contracts, state-machine ownership, Turnstile gating, file structure all unchanged; this is a visual-token pass only). Report it intentionally left unchanged.
- [x] Step 31: Run `npm run lint` (zero warnings), `npm run build`, `npm run test` — all green, no new failures vs. baseline.

## Acceptance Criteria
- [x] All tests pass; `npm run lint` clean (zero warnings); `npm run build` succeeds.
- [x] Follows project conventions (semantic CSS-var tokens; no invented Tailwind colors; existing status vocabulary preserved).
- [x] Zero remaining `dark:text-dark-text` / `dark:text-dark-muted` / `dark:border-dark-border` / `dark:bg-dark-border` / `dark:placeholder-dark-muted` / `dark:hover:bg-dark-border` in any **edited** file (grep returns only the untouched, flagged `ConfirmChangePanel.tsx`).
- [x] All six accent-bug buttons (`EditProcedurePanel` ×3, `ConfirmTimeChangePanel`, `DirectTimeChangePanel`, `ProcedureChangeErrorPanel`, `ContactMasterPanel`) use `text-primary-foreground`, readable in dark mode.
- [x] `BookingManagement.tsx` = 297, `PanelRenderer.tsx` = 423, `EditProcedurePanel.tsx` = 420 lines — unchanged (no file grew).
- [x] Locked files (`useBookingManagementState.ts`, `useTurnstileSession.ts`) and all Section-D/E files verified empty-diff via live `git diff`.
- [ ] Manual walkthrough (Constraints): every panel state visually checked in **both** light and dark mode.

## Constraints & Risks
- **DO NOT MODIFY LOGIC:** `state/useBookingManagementState.ts` (panel state machine) and `hooks/useTurnstileSession.ts` (Cloudflare Turnstile gate for cancel/time/procedure mutations). This is a visual/token pass only — no state-machine, mutation, API, or Turnstile edits. Verify both byte-identical with a live `git diff` after work (reviewer git snapshots have been stale in prior stages — re-run `git diff` independently, do not trust snapshot claims).
- **Line-count discipline:** `BookingManagement.tsx` (297), `EditProcedurePanel.tsx` (420), `PanelRenderer.tsx` (423) are near the 500 hard limit. Every edit is an in-place className swap — **no new lines**. Verify line counts unchanged before declaring done.
- **`ConfirmChangePanel.tsx` is unused** (not routed by `PanelRenderer.tsx`). Left untouched; report to user as apparently-dead code they may want to delete in a separate change.
- **Out of scope, flag-only discovery:** the scrollbar utilities on `BookingManagement.tsx:224` (`scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent`) are also dead — no `tailwind-scrollbar` plugin is registered in `tailwind.config.ts` (only `tailwindcss-animate`). Not part of this M3 token pass; do not fix, just note to user (same handling as the prior-session `dropdown-menu.tsx` Tailwind-v4 discovery).
- **Do not "improve" the status-color system.** Green/red/amber/blue/gray status tints stay exactly as shipped; no realignment to `LinkBookingsCard` shades, no conversion to CSS vars (none exist for success/warning/info).
- **Shared/adjacent boundaries not crossed:** booking *creation* (`BookingForm.tsx` & friends — already done in Stage 3) is out of this module; do not touch. `MasterSelector.tsx` remains fully locked repo-wide.
- **Manual verification required** (no unit tests cover this module's visual layer): after coding, walk every panel state in the browser in both themes — search, loading, results, not-found, edit-selection, edit-procedure (incl. availability-check green/amber/red sub-states + accent-bug buttons), edit-datetime, confirm-time-change, direct-time-change, confirm-cancel, cancel-success/error, time-change-success/error, procedure-change-success/error, contact-master + success. Focus dark mode on the previously-unreadable neutral texts and the six primary buttons.
