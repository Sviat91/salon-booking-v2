# Plan: Roadmap Priority 4 cleanup (items 1–5) — dropdown-menu Tailwind v4→v3, PhoneInput dead dark classes, DataExportModal 500-line split, Settings preview theme bug, stale ROADMAP note

**Date:** 2026-07-15
**Status:** In Progress
**Mode:** FULL (planner-written; architectural decisions on the v4→v3 class mapping, the file-split decomposition, and the iframe-preview theme-reload strategy)

## Goal
Close the five source-level "minor cleanup after redesign" items of Roadmap Priority 4 in one surgical pass: (1) make `ui/dropdown-menu.tsx` work under the project's real Tailwind v3 config, (2) strip the redundant dead dark-mode classes from `PhoneInput.tsx`, (3) split the 543-line `DataExportModal.tsx` under the 500-line limit without behavior change, (4) fix the admin Settings homepage-preview iframe not updating its background on theme switch, (5) delete the confirmed-stale ROADMAP note. **Item 6 (the failing test suite) is deliberately NOT in this plan — it is its own, larger pass in `handoff/priority4-tests_plan.md`.**

## Scope note — what is explicitly NOT in this pass
- **Item 6 of Priority 4 — the 11 failing test files** — split into a separate plan (`handoff/priority4-tests_plan.md`). Rationale: item 6 is fundamentally different in nature (test-suite restoration + a vitest/next-auth module-resolution infra fix + per-file diagnosis/decision + two justified test deletions) and much larger than the five surgical source edits here. Bundling would make one unwieldy plan and fights the user's stagewise-checkpoint preference. Items 1–5 here are quick, low-risk, independently verifiable source edits; item 6 is its own reviewable unit. See that plan for the full test work.
- **Do NOT change the public API/props of `dropdown-menu.tsx`** — only the `className` string contents change (`UserDropdown.tsx` is the sole consumer and depends on the exported component/prop shape). No function renames, no prop additions/removals.
- **`PhoneInput.tsx` — remove only redundant/duplicate/no-op `dark:` classes.** Do NOT touch `dark:` classes that produce a genuinely different value than a co-located base class (error reds, `dark:hover:bg-dark-border/60`, `text-gray-500 dark:text-dark-muted`) — those are real overrides, not dead code. Do NOT add new classes (no drive-by "consistency" refactor of placeholders).
- **`DataExportModal.tsx` split is a pure refactor — zero behavior change.** No logic edits, no copy changes, no i18n-key changes. The only user-visible acceptance is "behaves exactly as before."
- **Settings preview fix touches ONLY `HomepagePreview.tsx`.** Do NOT modify `layout.tsx`'s dark-mode bootstrap, the `ThemeToggle` components, or the homepage — the fix rides on the existing `localStorage.theme` bootstrap.
- **Item 5 is a docs-only deletion** — no code changes; nothing to "fix" in the app (already investigated & confirmed stale in the task brief).
- **No dev server** — user tests manually after implementation (per stagewise-checkpoint preference).

## Architecture Decisions

### Item 1 — `dropdown-menu.tsx`: what is v4-only, and the v3 mapping (the core correctness decision)
- **Root cause.** The file is a shadcn/base-ui component authored for Tailwind **v4** syntax, but `tailwind.config.ts` is **v3** (`tailwindcss ^3.4.10`, plugin `tailwindcss-animate`, `darkMode: ['class']`). Several class tokens are v4-only, so v3's JIT silently drops them → the dropdown open/close animations (and a few focus/inset states) never generate any CSS. The component is used only by `src/components/auth/UserDropdown.tsx` (confirmed via grep — no other importer).
- **The base-ui menu emits the right data-attributes for the fix to work.** `node_modules/@base-ui/react/menu/popup/MenuPopupDataAttributes.d.ts` confirms the Popup renders `data-open`, `data-closed`, `data-side` (`top|bottom|left|right|inline-end|inline-start`), `data-align`, plus `data-starting-style`/`data-ending-style`. So `data-[open]:` / `data-[closed]:` / `data-[side=…]:` selectors will actually match, and `tailwindcss-animate`'s `animate-in`/`animate-out`/`fade-in-0`/`zoom-in-95`/`slide-in-from-*` (all v3-valid, provided by the installed plugin) will fire once the variants are v3-legal.
- **Fix = translate every v4-only token to its v3 equivalent inside the `className` strings only.** Do NOT touch function signatures, `data-slot`/`data-inset`/`data-variant` attribute wiring, exports, or the base-ui imports. The exhaustive v4→v3 token map to apply everywhere it appears in the file:

  | v4-only token (drop) | v3 replacement | Why |
  | --- | --- | --- |
  | `max-h-(--available-height)` | `max-h-[var(--available-height)]` | `(--var)` arbitrary-value shorthand is v4-only |
  | `w-(--anchor-width)` | `w-[var(--anchor-width)]` | same |
  | `origin-(--transform-origin)` | `origin-[var(--transform-origin)]` | same |
  | `outline-hidden` | `outline-none` | `outline-hidden` is a v4 utility; v3 uses `outline-none` |
  | `data-open:` | `data-[open]:` | bare named data-variant is v4-only; v3 needs the `[attr]` arbitrary form |
  | `data-closed:` | `data-[closed]:` | same |
  | `data-inset:` | `data-[inset]:` | same (attr present when `inset` truthy) |
  | `data-disabled:` | `data-[disabled]:` | same |
  | `data-popup-open:` | `data-[popup-open]:` | same (SubTrigger only) |
  | `focus:**:text-accent-foreground` | `focus:[&_*]:text-accent-foreground` | `**:` all-descendants variant is v4-only |
  | `not-data-[variant=destructive]:focus:**:text-accent-foreground` | `[&:not([data-variant=destructive])]:focus:[&_*]:text-accent-foreground` | `not-*` variant is v4-only |
  | `data-[variant=destructive]:*:[svg]:text-destructive` | `data-[variant=destructive]:[&_svg]:text-destructive` | `*:` child variant + the mangled `[svg]` are v4-only; the intent is "svg inside a destructive item is destructive-colored" |

  **Leave unchanged (already v3-valid):** `data-[side=bottom]:` / `data-[side=top]:` / `data-[side=left]:` / `data-[side=right]:` / `data-[side=inline-start]:` / `data-[side=inline-end]:` (arbitrary `[key=value]` form), `data-[variant=destructive]:text-destructive` and the other `data-[variant=…]` value variants, `[&_svg]:pointer-events-none`, `[&_svg:not([class*='size-'])]:size-4`, named groups `group/dropdown-menu-item` + `group-focus/dropdown-menu-item:`, all color tokens (`bg-popover`, `text-popover-foreground`, `bg-accent`, `text-accent-foreground`, `ring-foreground/10`, etc. — all defined in the config), `duration-100`, `select-none`, `outline-none` on the Positioner (line 36 — already correct).
- **Priority order for correctness.** `DropdownMenuContent` (lines 42–46) and `DropdownMenuSubContent` (line 138) carry the animation/positioning tokens — those are the "animations don't work" bug. `DropdownMenuItem` (line 91), `DropdownMenuSubTrigger` (line 116), `DropdownMenuLabel` (line 68), `DropdownMenuCheckboxItem` (line 162), `DropdownMenuRadioItem` (line 204) carry the focus/inset/disabled tokens. Convert ALL of them so the whole primitive is v3-correct, even the parts `UserDropdown` doesn't currently use (the file is a reusable primitive).
- **Why not just delete the unused Sub/Checkbox/Radio parts?** Out of scope and risky — they're exported public API. Convert, don't prune.

### Item 2 — `PhoneInput.tsx`: which `dark:` classes are dead, and the exact rule
- **How dark mode really works here.** `tailwind.config.ts` has `darkMode: ['class']`; the semantic tokens (`border-border`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary/…`) are CSS vars that `globals.css` re-points to the `--color-dark-*` values under `.dark` (lines 425–465). So a semantic-token utility already adapts to dark **with no `dark:` variant needed**. The legacy `dark:*-dark-*` utilities (`dark:border-dark-border`, `dark:text-dark-text`, `dark:text-dark-muted`, `dark:placeholder-dark-muted`, `dark:bg-dark-border/60`) resolve via the hand-rolled utilities in `globals.css` lines 482–486 (`.text-dark-text`, `.border-dark-border`, …) — they are NOT invalid/no-op classes, they render a real color; they are **redundant** wherever a co-located semantic token already yields the same value under `.dark`. Those redundant ones are the "мёртвые классы" the roadmap means.
- **Decision rule (apply per class):** remove a `dark:X` **only if** the same element already carries a base/semantic class that produces the identical rendered value under `.dark` (or `dark:X` is a byte-for-byte duplicate of the light class). If removing `dark:X` would change the dark appearance (no semantic equivalent on that element, or a genuinely different value), KEEP it.
- **Exact remove/keep list** (line numbers from the current file):

  | Line | Class | Action | Reason |
  | --- | --- | --- | --- |
  | 192 | `dark:border-dark-border` | **remove** | element already has `border-border` (== dark border under `.dark`) |
  | 204 | `dark:text-dark-text` | **remove** | input inherits `text-foreground` (Preflight sets `color:inherit` on inputs) which already adapts |
  | 204 | `dark:placeholder-dark-muted` | **keep** | no base placeholder color on this input; produces a real dark-only effect |
  | 207 | `dark:text-dark-text` | **remove** | span inherits `text-foreground` from the L192 container |
  | 219 | `dark:text-dark-muted` | **keep** | chevron has no base text color; muted-in-dark is a real (distinct) effect |
  | 239–240 | `dark:border-dark-border` | **remove** | input already has `border-border` |
  | 240 | `dark:placeholder-dark-muted` | **keep** | real dark-only placeholder color, no base equivalent |
  | 244 | `dark:border-red-400` | **keep** | distinct from `border-red-500` (error state) |
  | 252 | `dark:border-dark-border` | **remove** | container already has `border-b border-border` |
  | 273 | `dark:bg-primary/30` | **remove** | byte-for-byte duplicate of `bg-primary/30` on the same element |
  | 273 | `dark:hover:bg-primary/40` | **remove** | duplicate of `hover:bg-primary/40` |
  | 274 | `dark:hover:bg-dark-border/60` | **keep** | distinct from light `hover:bg-primary/60` |
  | 280 | `dark:text-dark-text` | **remove** | inherits body `--foreground`, already adapts |
  | 281 | `dark:text-dark-muted` | **keep** | distinct from light `text-gray-500` |
  | 296 | `dark:border-dark-border` | **remove** | element already has `border-t border-border` |
  | 298 | `dark:bg-primary/30` | **remove** | duplicate of `bg-primary/30` |
  | 298 | `dark:hover:bg-primary/40` | **remove** | duplicate of `hover:bg-primary/40` |
  | 299 | `dark:hover:bg-dark-border/60` | **keep** | distinct from `hover:bg-primary/60` |
  | 305 | `dark:text-dark-text` | **remove** | inherits `--foreground` |
  | 306 | `dark:text-dark-muted` | **keep** | distinct from `text-gray-500` |
  | 319 | `dark:text-red-400` | **keep** | distinct from `text-red-600` |

  Net: remove 10 redundant `dark:` classes, keep 8 that carry a real distinct effect. This is intentionally conservative — it deletes only unambiguously dead code and leaves the (minor, pre-existing) light/dark placeholder inconsistency alone rather than expanding scope by adding `placeholder:text-muted-foreground`.

### Item 3 — `DataExportModal.tsx`: co-located folder split, zero behavior change
- **The file is 543 lines; the 500-line rule requires a split.** Follow the project's established decomposition convention (per `src/components/AGENTS.md` line 18 and the `booking-management/` module): co-located folder + `types.ts` + extracted pure utils + extracted sub-component(s), no logic change.
- **Keep `src/components/DataExportModal.tsx` as the entry component** so the single import site (`src/app/support/page.tsx:7` — `import DataExportModal from '../../components/DataExportModal'`) is untouched. Zero blast radius on callers.
- **Decomposition (three new sibling files under `src/components/data-export/`):**
  1. `src/components/data-export/types.ts` — move `ModalState`, `ApiError`, `UserDataExport` (current lines 10–15, 22–45). Keep `DataExportModalProps` inline in the main file (it's the component's own prop type) OR move it too — coder's choice, but if moved, re-import it.
  2. `src/components/data-export/exportFormat.ts` — move the pure helpers `generateRequestId`, `formatDate`, `generateCSV`, `generateJSON`, `downloadFile` (current lines 47–134). These import nothing app-specific except the `UserDataExport` type (import from `./types`). Export all five (`formatDate` is also needed by the result view and the main file).
  3. `src/components/data-export/ExportResultView.tsx` — extract the success-view JSX (current lines 388–449, the `state === "success" && exportData` branch). Make it a presentational component taking props: `{ exportData: UserDataExport; onDownloadCSV: () => void; onDownloadJSON: () => void; onClose: () => void }`. It needs `useTranslation` (`t`) and `formatDate` (import from `./exportFormat`) internally, or receive `t` — prefer calling `useTranslation()` inside the sub-component to keep the prop surface minimal (it's a `"use client"` file).
- **Main file after extraction** imports the three siblings, renders `<ExportResultView .../>` in the success branch, and keeps all state/effects/Turnstile/`handleSubmit`/`handleDownloadCSV`/`handleDownloadJSON`. Expected length ≈ 355 lines (543 − ~36 types − ~88 utils − ~62 view + ~ a few import lines) — comfortably under 500. Each new file is well under 500.
- **Do NOT extract the Turnstile effect into a hook** — it's intertwined with `resetTurnstile`/`resetForm`/refs; extracting it is a larger refactor with breakage risk and isn't needed to get under 500 lines. Keep it in the main file.
- **Verification of "no behavior change":** the diff must be pure code-motion + prop-threading. `npx tsc --noEmit` and manual smoke (open/submit/download in the support page) confirm.

### Item 4 — Settings preview iframe not updating background on theme switch
- **What "the color-scheme preview" is.** The only preview-with-a-background in `src/app/admin/settings/**` is `HomepagePreview.tsx`, which renders `<iframe src="/?preview=1">` (used by `LogoEditor.tsx` for logo positioning). There is no separate color-swatch preview component. The reported bug is: toggling the global light/dark theme does not change the iframe's background.
- **Root cause.** The theme toggle (`ThemeToggle.tsx` / `ui/theme-toggle.tsx`) toggles `.dark` on the **parent** `document.documentElement` and writes `localStorage.theme`. The iframe is a **separate same-origin document**; it applied its `.dark` (and the tenant dark-bg `<style>` from `layout.tsx`) once at load, reading `localStorage.theme` in the `layout.tsx` bootstrap (lines 62–68). Toggling the parent never touches the iframe's own `<html>`, so its background is frozen at load-time theme.
- **Fix (self-contained in `HomepagePreview.tsx`, rides the existing localStorage bootstrap):**
  - Track `isDark` in state, initialized from `document.documentElement.classList.contains('dark')`.
  - Add a `useEffect` that attaches a `MutationObserver` to `document.documentElement` with `{ attributes: true, attributeFilter: ['class'] }`; in the callback, set `isDark` to the current `.dark` presence. Disconnect on cleanup. (Client component already — `"use client"` at top.)
  - Force the iframe to reload when `isDark` flips by keying it: add `key={isDark ? 'preview-dark' : 'preview-light'}` to the `<iframe>`. On theme toggle → parent `.dark` mutates → observer updates `isDark` → React remounts the iframe → fresh load → `layout.tsx` bootstrap re-reads the now-updated `localStorage.theme` → correct `.dark` + tenant dark background inside the iframe.
  - The `containerRef` `ResizeObserver`/`scale` state is on the outer `<div>`, not the iframe, so the `key`-remount does not reset the scale.
- **Why key-reload, not `postMessage`/direct `contentDocument` class toggle.** Key-reload is the minimal, robust fix that reuses the existing bootstrap and touches one file. Directly mutating `iframe.contentDocument.documentElement.classList` avoids a reload flash but is more fragile (load-timing, re-sync on reloads) and is not worth the extra complexity for a settings preview. If the coder finds the reload flash unacceptable during manual test, the `contentDocument` class-toggle is an acceptable alternative — but key-reload is the default.

### Item 5 — stale ROADMAP note (docs-only)
- The bullet on line 68 ("Таблицы 'Услуги'/'Мастера' в админке — было что-то по меню 'ещё'/колонке статуса…") has already been investigated and confirmed stale/inapplicable (no kebab/"more" menu exists; the Masters "Visible/Hidden" status badge is correctly wired via `master.masterProfile?.showOnHomepage`). **Delete the bullet.** No code change. This happens in the DOX step (F1) alongside marking items 1–4 done.

---

## Implementation Steps

### Group A — Item 1: dropdown-menu Tailwind v4 → v3
- [x] **A1 — Convert every v4-only token in `dropdown-menu.tsx`**
  - Files: `src/components/ui/dropdown-menu.tsx`
  - Apply the v4→v3 map from Architecture Decisions to EVERY `className` string in the file (functions: `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuItem`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`). Concretely: `(--var)` → `[var(--var)]`; `outline-hidden` → `outline-none`; `data-open:`/`data-closed:`/`data-inset:`/`data-disabled:`/`data-popup-open:` → `data-[open]:`/`data-[closed]:`/`data-[inset]:`/`data-[disabled]:`/`data-[popup-open]:`; `**:` → `[&_*]:`; `not-data-[variant=destructive]:` → `[&:not([data-variant=destructive])]:`; `data-[variant=destructive]:*:[svg]:text-destructive` → `data-[variant=destructive]:[&_svg]:text-destructive`.
  - Do NOT touch: function names/signatures, `data-slot`/`data-inset`/`data-variant` attribute assignments, exports, the `@base-ui/react/menu` import, or the already-valid `data-[side=…]` / `data-[variant=…]` value variants.
  - Sanity after edit: grep the file — `grep -nE '\(--|outline-hidden|data-open:|data-closed:|data-inset:|data-disabled:|data-popup-open:|\*\*:|not-data-' src/components/ui/dropdown-menu.tsx` must return nothing.

### Group B — Item 2: PhoneInput dead dark classes
- [x] **B1 — Remove the 10 redundant `dark:` classes**
  - Files: `src/components/ui/PhoneInput.tsx`
  - Remove exactly the 10 classes marked **remove** in the Item-2 table (lines 192, 204 text, 207, 239/240 border, 252, 273 ×2, 280, 296, 298 ×2, 305). Keep the 8 marked **keep**. Do not add any class. Do not reflow/re-indent unrelated lines.
  - Sanity: the file must still contain `dark:border-red-400`, `dark:text-red-400`, `dark:hover:bg-dark-border/60`, `dark:text-dark-muted`, and `dark:placeholder-dark-muted` (the kept ones), and must NOT contain any `dark:border-dark-border`, `dark:text-dark-text`, or the duplicated `dark:bg-primary/30` / `dark:hover:bg-primary/40`.

### Group C — Item 3: split DataExportModal under 500 lines
- [x] **C1 — Extract types** → `src/components/data-export/types.ts`
  - Move `ModalState`, `ApiError`, `UserDataExport` (and optionally `DataExportModalProps`) verbatim; `export` each. No logic change.
- [x] **C2 — Extract pure utils** → `src/components/data-export/exportFormat.ts`
  - Move `generateRequestId`, `formatDate`, `generateCSV`, `generateJSON`, `downloadFile` verbatim; `export` each; import `UserDataExport` from `./types`.
- [x] **C3 — Extract success view** → `src/components/data-export/ExportResultView.tsx` (`"use client"`)
  - Move the `state === "success"` JSX branch (current lines 389–449) into a component `ExportResultView({ exportData, onDownloadCSV, onDownloadJSON, onClose })`. Use `useTranslation()` + `formatDate` (from `./exportFormat`) inside. Keep the exact markup/classes/i18n keys.
- [x] **C4 — Rewire the main file** → `src/components/DataExportModal.tsx`
  - Delete the moved code; import from `./data-export/types`, `./data-export/exportFormat`, `./data-export/ExportResultView`. In the render, replace the success branch with `<ExportResultView exportData={exportData} onDownloadCSV={handleDownloadCSV} onDownloadJSON={handleDownloadJSON} onClose={handleClose} />` (guarded by `state === "success" && exportData ? … : (form)` as today). Confirm the file is now < 500 lines (`wc -l`). Keep the default export and the import path `@/components/DataExportModal` unchanged.

### Group D — Item 4: Settings preview iframe theme reload
- [x] **D1 — Make `HomepagePreview` react to theme toggles**
  - Files: `src/app/admin/settings/HomepagePreview.tsx`
  - Add `const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))`.
  - Add a `useEffect(() => { const el = document.documentElement; const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark'))); obs.observe(el, { attributes: true, attributeFilter: ['class'] }); return () => obs.disconnect() }, [])`.
  - Add `key={isDark ? 'preview-dark' : 'preview-light'}` to the `<iframe>` element. No other changes; do not touch the container `ResizeObserver`/`scale` logic or `layout.tsx`.

### Group E — Item 5 + DOX + verification
- [x] **E1 — Delete the stale ROADMAP bullet**
  - Files: `ROADMAP.md`
  - Remove the Priority-4 bullet on line 68 ("Таблицы 'Услуги'/'Мастера' в админке — было что-то по меню 'ещё'/колонке статуса, но заметка потерялась…"). Do not touch other bullets.
- [x] **E2 — DOX pass**
  - `ROADMAP.md`: mark items 1–4 done under Priority 4 (dropdown-menu v4→v3; PhoneInput dead dark classes; DataExportModal split; Settings preview theme). Add an "Уже сделано (сессия 2026-07-15)" entry summarizing this cleanup bundle. Note that Priority-4 item 6 (test suite) is being handled in its own pass (`handoff/priority4-tests_plan.md`). Keep the "Новая находка (2026-07-13)" test-suite bullet until item 6 is actually done.
  - `src/components/AGENTS.md`: line 18 already states the 500-line/split convention — add a one-line Local Contract note that `DataExportModal` follows it via the co-located `data-export/` folder (types + exportFormat + ExportResultView), and that `ui/dropdown-menu.tsx` is authored against the project's **Tailwind v3** config (base-ui `data-[open]`/`data-[closed]` variants, not v4 syntax) so future edits keep v3-legal class tokens.
  - No new AGENTS.md needed (`ui/` has none; `settings/` has none — the parent `src/components/AGENTS.md` and root `ROADMAP.md` suffice).
- [x] **E3 — Verify** (automated checks; manual smoke tests below are for the user)
  - `npx tsc --noEmit` — clean.
  - `npm run lint` — no NEW problems vs. the established baseline (the removed PhoneInput classes and the dropdown edits are class-string-only; the DataExportModal split must not leave unused imports — ESLint `no-unused-vars` will catch orphans).
  - `npm run build` — succeeds (validates the Tailwind class changes compile and the new files resolve).
  - `wc -l src/components/DataExportModal.tsx src/components/data-export/*.ts*` — main file < 500; every new file < 500.
  - `npm run test` — **no NEW failures** vs. the current known-broken baseline. This plan does not fix tests; it must not break additional ones. (The DataExportModal split has no test; the dropdown/PhoneInput changes are UI-only.)

## Acceptance Criteria
- [ ] **Item 1:** `dropdown-menu.tsx` contains zero v4-only tokens (grep clean per A1); public API/props unchanged; `UserDropdown` still renders; open/close animations now generate CSS (manual: open the user menu, see fade/zoom/slide in).
- [ ] **Item 2:** the 10 redundant `dark:` classes are gone; the 8 distinct-effect `dark:` classes remain; no classes added; dark-mode appearance of PhoneInput is visually unchanged (manual toggle check).
- [ ] **Item 3:** `DataExportModal.tsx` < 500 lines; three new files under `src/components/data-export/` each < 500 lines; import path `@/components/DataExportModal` and behavior unchanged; no unused imports.
- [ ] **Item 4:** toggling the admin theme updates the Settings homepage-preview iframe background (manual: open `/admin/settings`, toggle light/dark, preview bg follows); only `HomepagePreview.tsx` changed.
- [ ] **Item 5:** the stale Priority-4 bullet is deleted from `ROADMAP.md`.
- [ ] `tsc`/`build` clean; `lint`/`test` no new failures vs. baseline; DOX (`ROADMAP.md`, `src/components/AGENTS.md`) updated; item 6 explicitly deferred to `handoff/priority4-tests_plan.md`.

## Constraints & Risks
- **Tailwind exit-animation nuance (Item 1):** base-ui keeps the popup mounted during close only if it detects a CSS animation; `tailwindcss-animate`'s `data-[closed]:animate-out` provides one, so exit should animate — but the *enter* animation is the primary regression being fixed, and even if the exit animation is imperfect the bug ("animations silently don't work") is resolved. Do not add custom keyframes to force it.
- **PhoneInput placeholder inconsistency (Item 2) is intentionally left as-is:** the kept `dark:placeholder-dark-muted` (with no light `placeholder:` base) is a minor pre-existing asymmetry, not dead code — fixing it would mean *adding* a class, which is out of scope. Note it, don't fix it.
- **DataExportModal must be pure code-motion (Item 3):** any accidental logic/markup change would silently alter the GDPR export UX. Reviewer should diff for behavior equivalence, not just line count.
- **Iframe reload flash (Item 4):** keying the iframe reloads it on each toggle (brief flash). Acceptable for a settings preview; documented as the chosen trade-off vs. the more fragile `contentDocument` class-toggle.
- **Do NOT touch** `layout.tsx`, the `ThemeToggle` components, the homepage, `UserDropdown.tsx`, the base-ui import, or any test file in this pass. **Do NOT** attempt any Priority-4 item 6 (test) work here.
- **Stagewise checkpoint / no dev server:** stop after implementation for the user's manual test — (1) open the user dropdown and confirm the menu animates in/out; (2) toggle dark mode and confirm PhoneInput looks unchanged; (3) open the GDPR export modal from `/support`, submit, and download CSV/JSON to confirm the split changed nothing; (4) on `/admin/settings`, toggle theme and confirm the homepage-preview background updates.
