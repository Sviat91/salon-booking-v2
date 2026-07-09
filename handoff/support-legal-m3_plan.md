# Plan: Stage 6 — Support + Legal (privacy/terms) + GDPR modals M3 pass (final stage)

**Date:** 2026-07-09
**Status:** In Progress

## Goal
Bring the last client-facing surfaces up to the same M3 token-hygiene standard as Stages 1–5: `src/app/support/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, plus the three GDPR self-service modals rendered by the support page (`ConsentWithdrawalModal`, `DataErasureModal`, `DataExportModal`). Convert legacy `text-text` / `dark:text-dark-*` classes to semantic tokens and kill the `dark:*-accent` dark-mode contrast bug, with **zero** logic, form-submission, Turnstile, GDPR-API-wiring, or legal-copy changes.

## Architecture Decisions

Whole-tree read (all six files in full) + grep + `tailwind.config.ts` + `globals.css` + `m3-tokens.css` cross-checked. Findings:

1. **Correction to the "dead token" framing carried from prior stages — verified against source, do not assume.**
   `tailwind.config.ts` defines **no** `dark-text` / `dark-muted` / `dark-border` color family. **However**, `src/styles/globals.css` lines 478–487 defines a legacy `@layer utilities` block:
   ```css
   @layer utilities {
     .text-text { color: var(--color-text); }
     .text-muted { color: var(--color-muted); }
     .text-dark-text { color: var(--color-dark-text); }
     .text-dark-muted { color: var(--color-dark-muted); }
     .bg-dark-card { background-color: var(--color-dark-card); }
     .border-dark-border { border-color: var(--color-dark-border); }
     .placeholder-dark-muted::placeholder { color: var(--color-dark-muted); }
   }
   ```
   Custom utilities in `@layer utilities` **do** get Tailwind variant support, so `dark:text-dark-text` / `dark:text-dark-muted` / `text-text` / `dark:border-dark-border` actually **resolve** (to raw `--color-*` values) — they are *legacy*, not literally dead-to-zero-CSS as earlier plans claimed. This does not change the fix: these classes bypass the semantic-alias system and hardcode `--color-*`, and since the semantic tokens (`--foreground`, `--muted-foreground`, `--border`) alias those **same** `--color-*` values per theme, swapping is visually equivalent (or a negligible `neutral-700 → foreground` shift in light) and correct in both themes. The M3 standard is the semantic alias; we migrate to it. **Genuinely dead** (no utility defined, compiles to zero CSS): `dark:bg-dark-border` / `dark:hover:bg-dark-border` — these appear only on the three modal close-buttons and are dropped.

2. **The Stage-3/Stage-5 accent bug — confirmed present in the 3 page files, confirmed ABSENT in the 3 modals.** Verified against live CSS values in `m3-tokens.css` + `globals.css`:
   - `--accent` (dark) = `var(--color-dark-primary)` = **#261E1F** (near-black), foreground pairing `--accent-foreground` = light text.
   - `--primary` (dark) = `var(--color-dark-accent)` = **#FFB2B8** (light pink); `--primary` (light) = `--color-accent` = **#8B4A58** (rose).
   Elements using `text-primary dark:text-accent` or `bg-primary/10 dark:bg-accent/10` flip to near-black **#261E1F** in dark mode = unreadable. Specificity confirms the bug: `.dark .dark\:text-accent` (0,2,0) beats `.text-primary` (0,1,0).
   **Verified-correct fix (same as the 6 booking-management files just shipped): drop the `dark:*-accent` override entirely.** `text-primary` alone already resolves correctly in both themes (rose in light, light pink in dark). Do **not** substitute another dark override. *(The three GDPR modals already use bare `text-primary` / `bg-primary` / `focus:ring-primary` with no dark override — they are already correct on this axis, so no accent fixes are needed there; see finding 7.)*

3. **Status colors, `prose`, and the global `.btn-primary`/`.btn-outline` classes are explicit non-goals.** Amber/blue/green/emerald/red/orange info & status boxes carry valid `dark:` palette variants with good contrast — leave exactly as shipped. `prose prose-neutral dark:prose-invert` stays. `.btn btn-primary` / `.btn btn-outline` are **global CSS classes** (`globals.css` lines 105–127), not Tailwind tokens — out of scope, do not touch.

4. **Legal copy is frozen.** privacy/terms are static legal documents. Every edit is inside a `className=""` attribute only. No visible Polish/legal text, `§` headings, list items, or interpolations may change.

5. **Support page logic is locked.** `support/page.tsx`'s only in-scope edits are 4 sidebar-icon classNames (lines 325, 326, 342, 343). The contact-form submit + `/api/support/contact` fetch, Turnstile, `useQuery`, all state, modal handlers, and modal renders are **DO NOT MODIFY LOGIC**.

6. **Page-file line-count headroom is fine.** support 398, privacy 192, terms 179 — far under 500. Every change is a zero-growth in-place className swap.

7. **GDPR modal audit (folded into this stage).** All three modals (`ConsentWithdrawalModal` 443 lines, `DataErasureModal` 471, `DataExportModal` 543) were read in full. Findings:
   - **23 legacy tokens total, ZERO accent bugs, ZERO `text-white`.** Breakdown: ConsentWithdrawal 8 lines, DataErasure 8, DataExport 7 — all are `text-text`/`dark:text-dark-text` (titles + labels), `text-neutral-600/500 dark:text-dark-muted` (subtitles + optional spans), the close-button `dark:text-dark-muted dark:hover:bg-dark-border` pair, and `dark:border-dark-border` (checkbox, ×2 — export has no checkbox). This is a **pure legacy→semantic migration**; no accent fix and no `text-white` fix apply here.
   - **Already-semantic and left as-is:** `bg-card`, `text-card-foreground`, `border-border`, `border-border/70`, `bg-muted/25`, `bg-muted/20`, `placeholder:text-muted-foreground`, `text-primary`, `focus:ring-primary`, `focus:ring-primary/20`.
   - **`DataExportModal.tsx` is 543 lines — a PRE-EXISTING breach of the 500-line limit** (see Constraints). Our edits are zero-growth; splitting it is out of scope for a visual pass.

### Token Mapping Reference (apply mechanically wherever the token appears)

| Current class (legacy / bugged) | Replace with | Notes |
| --- | --- | --- |
| `text-text dark:text-dark-text` (h2 / h3 / labels) | `text-foreground` | keep sibling `text-xl`/`text-lg`/`text-sm`/`font-semibold`/`font-medium`/`mb-*` |
| `text-neutral-700 dark:text-dark-text` (body copy, lists) | `text-foreground` | keep sibling `list-disc pl-6`, `mb-4`, `space-y-*`, etc. |
| `text-sm text-neutral-600 dark:text-dark-muted` (sub-notes / subtitles) | `text-sm text-muted-foreground` | |
| `text-xs text-neutral-500 dark:text-dark-muted` (optional-field spans) | `text-xs text-muted-foreground` | modals |
| `text-neutral-500 transition hover:bg-neutral-200/70 dark:text-dark-muted dark:hover:bg-dark-border` (modal close ×) | `text-muted-foreground transition hover:bg-muted` | drops the genuinely-dead `dark:hover:bg-dark-border` + legacy dark/neutral pair |
| `dark:border-dark-border` (checkbox, already has `border-border`) | *drop it* | modals |
| `text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80` (links) | `text-primary hover:text-primary/80` | **accent bug** — drop the two `dark:*-accent` tokens |
| `bg-primary/10 dark:bg-accent/10` (icon container) | `bg-primary/10` | **accent bug** — support only, drop `dark:bg-accent/10` |
| `text-primary dark:text-accent` (svg icon) | `text-primary` | **accent bug** — support only, drop `dark:text-accent` |

Do **NOT** touch: `bg-amber-*`/`border-amber-*`/`text-amber-*` boxes; `bg-blue-*`/`text-blue-*` box; `bg-emerald-*`/`border-emerald-*`/`text-emerald-*` success boxes + `emerald-100/50`/`emerald-300/50` dividers; `text-orange-700`; `bg-green-100 dark:bg-green-900/30` + `text-green-600 dark:text-green-400`; `border-red-200 bg-red-50 text-red-700 dark:...` error boxes; `bg-muted/*`, `bg-card`, `text-card-foreground`, `border-border*`, `focus:ring-primary*`, `focus:ring-ring`, `placeholder:text-muted-foreground` (already semantic); `prose ...`; `.btn btn-primary`/`.btn btn-outline`; the page `<h1>` (already `text-foreground`).

## Implementation Steps

- [x] Step 1: `src/app/privacy/page.tsx` — legacy-token migration + 2 accent-bug link fixes
  - Files: `src/app/privacy/page.tsx`
  - Details: Apply the mapping table in place, line-by-line:
    - **Headings → `text-foreground`** (lines 70, 85, 101, 104, 114, 125, 127, 138, 155, 174).
    - **Body/list `text-neutral-700 dark:text-dark-text` → `text-foreground`** (lines 71, 75, 86, 89, 105, 115, 128, 131, 139, 156, 159, 168, 175, 179).
    - **Sub-notes `text-sm text-neutral-600 dark:text-dark-muted` → `text-sm text-muted-foreground`** (lines 108, 116, 117, 118).
    - **Accent-bug links (lines 169, 180):** `text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80` → `text-primary hover:text-primary/80`.
    - Leave untouched: amber notice (55–60), blue GDPR notice (63–67), `bg-muted/30` blocks (74, 178). No legal text changes.

- [x] Step 2: `src/app/terms/page.tsx` — legacy-token migration + 1 accent-bug link fix
  - Files: `src/app/terms/page.tsx`
  - Details: Apply the mapping table in place:
    - **Headings `text-text dark:text-dark-text` → `text-foreground`** (lines 64, 88, 99, 115, 128, 140, 162, 164).
    - **Body/list `text-neutral-700 dark:text-dark-text` → `text-foreground`** (lines 65, 71, 74, 77, 80, 89, 100, 103, 108, 111, 116, 123, 130, 141, 144, 147, 153, 156, 165).
    - **Accent-bug link (line 169):** drop `dark:text-accent dark:hover:text-accent/80`, keep `text-primary hover:text-primary/80`.
    - No `dark:text-dark-muted` present in this file. Leave amber notice (55–60) and `bg-muted/30` block (163) untouched. No legal text changes.

- [x] Step 3: `src/app/support/page.tsx` — accent-bug icon fixes ONLY (logic locked)
  - Files: `src/app/support/page.tsx`
  - Details: Exactly four in-place className edits, all in the "Contact Info" sidebar card:
    - Line 325: `... bg-primary/10 dark:bg-accent/10 rounded-lg ...` → drop `dark:bg-accent/10` (keep `bg-primary/10`).
    - Line 326: `w-5 h-5 text-primary dark:text-accent` → `w-5 h-5 text-primary`.
    - Line 342: same as 325 → drop `dark:bg-accent/10`.
    - Line 343: same as 326 → drop `dark:text-accent`.
    - **DO NOT MODIFY LOGIC (verify byte-identical):** the contact-form `handleSubmit` + `/api/support/contact` fetch (103–136), Turnstile `useEffect`/refs/token (52–101), `useQuery` salon-config (46–50), all `useState` (32–56), the three modal open/close handlers (142–164), and the `<ConsentWithdrawalModal>`/`<DataErasureModal>`/`<DataExportModal>` renders (393–395). Do **not** touch `btn btn-primary` (209, 306), the green success icon (195–196), or the red error box (284). The page has no other legacy or accent tokens.

- [x] Step 4: `src/components/ConsentWithdrawalModal.tsx` (443 lines — **verify still 443 after**) — legacy-token migration, logic locked
  - Files: `src/components/ConsentWithdrawalModal.tsx`
  - Details: In-place className swaps only:
    - Line 267: title `text-xl font-semibold text-text dark:text-dark-text` → `text-xl font-semibold text-foreground`.
    - Line 270: subtitle `text-sm text-neutral-600 dark:text-dark-muted` → `text-sm text-muted-foreground`.
    - Line 276: close button `rounded-full p-2 text-neutral-500 transition hover:bg-neutral-200/70 dark:text-dark-muted dark:hover:bg-dark-border` → `rounded-full p-2 text-muted-foreground transition hover:bg-muted`.
    - Lines 342, 358, 370: labels `text-sm font-medium text-text dark:text-dark-text` → `text-sm font-medium text-foreground`.
    - Line 371: optional span `text-xs text-neutral-500 dark:text-dark-muted` → `text-xs text-muted-foreground`.
    - Line 388: checkbox — drop `dark:border-dark-border` (keep `... rounded border-border text-primary focus:ring-primary`).
    - **DO NOT MODIFY LOGIC (verify byte-identical):** `handleSubmit` + `/api/consents/withdraw` fetch and its 404/202/!ok/catch branches (189–248), the `ModalState` machine, `canSubmit` guard (181–187), Turnstile load/reset/render (59–177), `resetForm`/`resetTurnstile`/`handleClose`, `requestId` generation, the success/already-processed/form render-branch structure. Leave emerald success box (285), amber already-processed box (314), red error box (406) and their `dark:` variants untouched.

- [x] Step 5: `src/components/DataErasureModal.tsx` (471 lines — **verify still 471 after**) — legacy-token migration, logic locked
  - Files: `src/components/DataErasureModal.tsx`
  - Details: In-place className swaps only:
    - Line 286: title `text-text dark:text-dark-text` → `text-foreground`.
    - Line 289: subtitle `text-sm text-neutral-600 dark:text-dark-muted` → `text-sm text-muted-foreground`.
    - Line 295: close button → `rounded-full p-2 text-muted-foreground transition hover:bg-muted` (same mapping as Step 4 line 276).
    - Lines 370, 386, 398: labels `text-sm font-medium text-text dark:text-dark-text` → `text-sm font-medium text-foreground`.
    - Line 399: optional span `text-xs text-neutral-500 dark:text-dark-muted` → `text-xs text-muted-foreground`.
    - Line 416: checkbox — drop `dark:border-dark-border`.
    - **DO NOT MODIFY LOGIC (verify byte-identical):** `handleSubmit` + `/api/consents/erase` and its 404/409-`ALREADY_ERASED`/!ok/success/catch branches (202–267), `SuccessResponse` rendering of erased/retained/booking lists (302–341), `ModalState` machine, `canSubmit`, Turnstile, reset/close handlers. Leave emerald success box (304), amber already-processed box (350), red error box (434).

- [x] Step 6: `src/components/DataExportModal.tsx` (543 lines — **PRE-EXISTING over-limit; verify still 543, do NOT split in this pass**) — legacy-token migration, logic locked
  - Files: `src/components/DataExportModal.tsx`
  - Details: In-place className swaps only, all in the header/labels (the success-preview markup and helpers stay untouched):
    - Line 372: title `text-text dark:text-dark-text` → `text-foreground`.
    - Line 375: subtitle `text-sm text-neutral-600 dark:text-dark-muted` → `text-sm text-muted-foreground`.
    - Line 381: close button → `rounded-full p-2 text-muted-foreground transition hover:bg-muted`.
    - Lines 455, 471, 483: labels `text-sm font-medium text-text dark:text-dark-text` → `text-sm font-medium text-foreground`.
    - Line 484: optional span `text-xs text-neutral-500 dark:text-dark-muted` → `text-xs text-muted-foreground`.
    - No checkbox in this modal (no `dark:border-dark-border`).
    - **DO NOT MODIFY LOGIC (verify byte-identical):** `handleSubmit` + `/api/consents/export` (288–339), the module-level `generateCSV`/`generateJSON`/`downloadFile`/`formatDate` helpers (54–134), `handleDownloadCSV`/`handleDownloadJSON` (341–353), Turnstile, `canSubmit`, reset/close handlers, and the entire export-preview success block (388–449 — emerald boxes, `emerald-100/50`/`emerald-300/50` dividers, `text-orange-700`, the personal-data/consent-history display markup). Only the seven header/label className instances above change.

- [x] Step 7: Verify — lint, build, DOX, manual walkthrough
  - Files: none (verification only)
  - Details: Run `npm run lint` (zero-warning) and `npm run build`; run `npm run test` to confirm no regression (no unit tests cover these presentational surfaces — parity is via manual walkthrough, same as Stages 1–5). Grep all **six** files to confirm **zero** remaining `text-text`, `dark:text-dark-text`, `dark:text-dark-muted`, `dark:border-dark-border`, `dark:hover:bg-dark-border`, `dark:text-accent`, `dark:bg-accent`. Confirm line counts unchanged/shorter (support ≤398, privacy ≤192, terms ≤179, ConsentWithdrawal 443, DataErasure 471, DataExport 543). DOX pass: `src/app/AGENTS.md` and `src/components/AGENTS.md` need **no** update (no change to routing, contracts, or component boundaries — visual-token pass only); report them intentionally left unchanged. No automated test file is added.

## Acceptance Criteria
- [x] `npm run lint` clean (zero warnings); `npm run build` succeeds; `npm run test` no new failures vs. baseline.
- [x] Follows project conventions: semantic CSS-var tokens only; no invented Tailwind colors; existing amber/blue/emerald/green/red/orange status vocabulary and `prose`/`.btn-*` untouched.
- [x] Zero remaining `text-text` / `dark:text-dark-text` / `dark:text-dark-muted` / `dark:border-dark-border` / `dark:hover:bg-dark-border` / `dark:text-accent` / `dark:bg-accent` in any of the six files (grep returns nothing).
- [?] All three accent-bug links (privacy ×2, terms ×1) and both support sidebar icon pairs render readable in **dark** mode (light pink #FFB2B8, not near-black #261E1F). — CSS-verified via token mapping; needs user's manual browser walkthrough (no dev server run per project policy).
- [?] The three modals render titles, subtitles, labels, optional-spans, and close-buttons readable in **both** themes (semantic tokens); no `dark:*-accent` was present and none introduced. — needs user's manual browser walkthrough.
- [x] `support/page.tsx` (4-line diff), and each modal's `/api/consents/*` fetch, Turnstile gate, `canSubmit`, `ModalState` machine, reset/close handlers, and (export) CSV/JSON/download helpers verified byte-identical via live `git diff` — only className attributes changed.
- [x] No legal/Polish copy altered in privacy or terms (only `className` attributes changed).
- [x] Line counts unchanged: page files under 500; modals at 443 / 471 / 543 (no growth — `DataExportModal` not split in this pass).

## Constraints & Risks
- **DO NOT MODIFY LOGIC:** In `support/page.tsx`, the contact-form submission (`/api/support/contact`), Turnstile gate, `useQuery` salon-config fetch, all state hooks, and the three GDPR modal open/close handlers + renders are locked. Re-run `git diff` independently after coding (reviewer snapshots have been stale in prior stages) — support must show a 4-line diff, nothing else.
- **GDPR modals are IN SCOPE with logic locked** (`src/components/ConsentWithdrawalModal.tsx`, `DataErasureModal.tsx`, `DataExportModal.tsx`). Visual className changes only — same risk class as the support contact form and the Turnstile hook. Their `/api/consents/{withdraw,erase,export}` fetch calls, `ModalState` state machines, `canSubmit` guards, Turnstile load/reset/render effects, `resetForm`/`resetTurnstile`/`handleClose`, `requestId` generation, `SuccessResponse`/`UserDataExport` rendering, and the export CSV/JSON/download helpers are DO-NOT-MODIFY-LOGIC. Verify each byte-identical via live `git diff` — each modal must show only className-attribute diffs. **None of the three contained a `dark:*-accent` bug or `text-white`** — all 23 legacy tokens are `text-text`/`dark:text-dark-text`/`dark:text-dark-muted`/`dark:border-dark-border`/`dark:hover:bg-dark-border`, so this is a pure legacy→semantic migration; do **not** invent accent fixes where none are needed.
- **`DataExportModal.tsx` is 543 lines — a PRE-EXISTING breach of the 500-line limit, not introduced by this pass.** All edits here are zero-growth in-place className swaps (they shorten strings), so the file does not grow. Splitting it would require touching the CSV/JSON export + download + `/api/consents/export` logic, directly conflicting with the logic-lock — explicitly OUT OF SCOPE for this visual pass. Flag to the user as a separate refactor task.
- **Accent bug — do NOT re-introduce a dark override.** The fix (page files only) is to *remove* `dark:text-accent` / `dark:bg-accent` / `dark:hover:text-accent/80`, leaving `text-primary`/`bg-primary/10`. Do **not** replace with `dark:text-primary-foreground` or any other `dark:` token — `--primary` already resolves correctly in dark mode. (Exact bug corrected across 6 `src/components/booking-management/` files this session and in Stage 3.)
- **Do not "improve" the status-color system, `prose`, or the global `.btn-primary`/`.btn-outline`.** They are working and out of scope.
- **Legal copy frozen:** Only `className` attributes may change in privacy/terms. Do not touch any visible text, `§` headings, list content, or interpolations.
- **No dev server / stagewise checkpoint:** stop after implementation for the user's manual light+dark walkthrough of `/support`, `/privacy`, `/terms`, and each of the three GDPR modals (open via the support-page "Szybkie akcje" buttons; walk the form + success + already-processed + error states). Do not chain further without sign-off.
