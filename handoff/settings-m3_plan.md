# Plan: Admin Settings Page — M3 (Somique) Restyle (Stage 6)

**Date:** 2026-07-05
**Status:** Implemented (Steps 1-6) — pending manual browser verification (Step 7 not run by coder, per instructions)

## Goal
Restyle the **main** admin Settings page (`/admin/settings` only) to match the Somique Beauty admin mockup's `SettingsPage` visual language (eyebrow header + card sections with a tinted header bar + rounded-full save), while preserving 100% of the existing branding/configuration functionality (save/validation, dirty-tracking + sidebar Save, reset-to-M3-defaults, every color picker, logo editor, favicon, background config, contact info, business hours, and super-admin credential security UI) — and without pushing `SettingsForm.tsx` over the 500-line limit.

## Structural Assessment (read first — honest fit analysis)

**The mockup depicts only a tiny SUBSET of this page, and only as static read-only rows.** Verified against the actual markup (`Somique Beauty Design System/ui_kits/admin/index.html`, `SettingsPage` at lines 431–462; theme object `AT` 30–55):

- **Mockup layout** (lines 437–460): a width-constrained column (`maxWidth:640`) containing:
  1. A header block — an uppercase primary **eyebrow "Configuration"** (line 440) over a muted subtitle **"Brand identity and colour theme"** (line 441).
  2. A vertical stack of **section cards** (`background:t.card`, `border:1px solid t.border`, `borderRadius:16`, `overflow:hidden`, `boxShadow:t.shadow`, `marginBottom:16`). Each card has a **tinted header bar** (`padding:'12px 20px'`, `borderBottom:1px solid t.border`, `background:t.surface`) with the section title, then a body of **label→value rows** (`display:flex; justify-content:space-between; padding:'14px 20px'`, with a bottom divider between rows). Rows whose value starts with `#` show a `20×20` rounded color swatch next to a monospace value.
  3. A single **rounded-full primary "Save changes" pill** at the bottom (line 459: `borderRadius:9999`, `background:t.primary`, `color:t.onPri`).
- **Mockup only shows two sections** — "Brand" (Brand name, Website URL) and "Colors" (Primary color, Accent color, Dark background) — and its rows are **read-only display rows, not editable inputs**. It is a visual-language reference, NOT a spec for this page's real controls.

**The real page has vastly more, all of it functional and must be preserved.** Six editable sections in `SettingsForm.tsx` — Brand (name + `LogoEditor` drag-positioning + favicon), Salon Contact Info (7 fields), Calendar Settings (2 color pickers), Business Hours (2 number inputs), Light Theme (`BackgroundSection` + 6 color pickers + reset), Dark Theme (`BackgroundSection` + 7 color pickers + reset) — plus a conditional `SuperAdminCredentials` block (2 credential forms) for SUPERADMIN. The mockup does NOT depict: the logo editor, favicon, contact info, calendar colors, business hours, background config, the light/dark reset buttons, or super-admin credentials.

**Therefore this is a REFINEMENT, not a paradigm shift.** The current page already uses one card per section (`bg-card border border-border p-6 rounded-xl shadow-sm` with the heading inside the padded body). The only real visual deltas the mockup prescribes are: (1) drop the big `<h1>` for an eyebrow+subtitle header; (2) give each section card a **tinted header bar** separated from the body by a divider (currently the heading floats inside the body); (3) bump radius to the project's `rounded-[20px]`; (4) a rounded-full primary save (already satisfied — see below). Every editable control keeps its exact wiring — this is a class/wrapper restyle, not a logic change. That makes the mockup-faithful path also the least-risky path.

### Genuine mockup↔reality mismatches, and the decided handling for each

1. **Mockup rows are read-only label→value; the real page is a full editable form.** We keep ALL real controls (`Input`, `ColorRow`, `LogoEditor`, `BackgroundSection`, checkboxes, number inputs) exactly as they are. We adopt ONLY the mockup's *card + header-bar* chrome around each section, not its static-row internals. The color-swatch-next-to-value idea is already realized better by `ColorRow` (swatch + editable hex) — no change needed there.

2. **Mockup shows an inline "Save changes" pill; the app's real save is the sidebar button.** The app already has a superior, dirty-aware save: `AdminSidebar.tsx` (lines 147–164) renders a `Save Settings` button with `form="settings-form"`, `disabled={!isDirty}`, driven by the `settings-dirty` custom event `SettingsForm` dispatches (lines 142–144). The mockup's inline button is a static simplification with no persistent-sidebar concept. **DECISION: keep the sidebar save as the single canonical save; do NOT add a redundant inline "Save changes" button.** (This is the same substitute-real-mechanism-for-mockup-simplification stance as prior stages.) Consequence: the pre-existing **orphaned `SubmitButton` import** (`SettingsForm.tsx` line 10, never rendered) stays orphaned — see Constraints; per the "mention, don't delete pre-existing dead code" rule it is flagged, not removed, and it does not affect the net-new lint delta.

3. **Mockup shows only Brand + Colors; the real page has 6 sections + credentials.** All six sections get the header-bar card treatment; `SuperAdminCredentials` (not in the mockup) gets only a trivial radius bump to match. `LogoEditor` (not in the mockup, and near the 500-line limit) is left structurally untouched.

## File-Size Risk Plan (REQUIRED — this is the crux of this stage)

`SettingsForm.tsx` is **473 lines** — 27 lines of headroom. Adding a header-bar wrapper inline to each of the 6 sections (an extra wrapper `<div>` for the bar + a `<div>` for the body + closing tags ≈ +3 lines/section × 6 ≈ **+18 lines → ~491**, before the light/dark reset-button relocation) would crowd or breach the limit. **Inline restyle is NOT viable here.**

**DECISION: extract a small presentational `SettingsSection` wrapper (card + tinted header bar + optional header `action` slot + body) and apply it across all 6 sections.** This simultaneously (a) delivers the mockup's section-card-with-header-bar look, and (b) *reduces* `SettingsForm.tsx` size, because each section's current 5-line inline header (`<section>` → `<div>` → `<h2>` → `<p>` → `</div>`) collapses to a 1-line `<SettingsSection title=… description=… action={…}>` open tag (net ≈ **−3 lines/section × 6 ≈ −18 → ~455 lines**, comfortable margin).

- **Home for the wrapper:** add `SettingsSection` to `src/app/admin/settings/FormFields.tsx` (currently **117 lines** — grows to ~150, ample headroom; it is already the shared home of `ColorRow`/`ImageUploadField`/`SubmitButton`). A separate `SettingsSection.tsx` file is an acceptable alternative but adds a file for no benefit.
- **Justified, not speculative:** used 6× (not single-use), so it does not violate "no abstractions for single-use code."
- **`LogoEditor.tsx` (443 lines):** the mockup does NOT depict it; it already uses semantic tokens. **Leave it structurally unchanged — add zero net lines** so it stays at 443 and its drag/fullscreen logic is untouched. Any token polish here is explicitly out of scope for this stage (too close to the limit, too much interaction surface).

## Architecture Decisions

- **No server/action logic is touched.** `actions.ts` (`saveSettings`, the `SettingsSchema` Zod validation, `revalidatePath` calls) stays byte-for-byte identical. Every changed line traces to visual/layout styling only.
- **`page.tsx` is a Server Component (`async function SettingsPage`, `await auth()`).** It renders NO `<Button>` and calls NO `buttonVariants()` today, so the Stage-2 request-time `buttonVariants()` `TypeError` regression cannot occur. The header restyle in `page.tsx` is pure `<div>/<p>` text+class JSX with **no button** — safe. **Do NOT introduce any `<Button>` or `buttonVariants()` into `page.tsx`.**
- **Do NOT touch the config-seeding literal-hex fallbacks in `page.tsx`** (lines 13–33, e.g. `availableSlotColor … || "#21A67A"`, `dayOffColor … || "#BA1A1A"`). Per `src/app/admin/AGENTS.md` (line 25) these must stay literal hex strings kept in lockstep with the other calendar call sites — they are data-correctness, not visual restyle. Only the header block (lines 38–43) changes in `page.tsx`.
- **Save mechanism is preserved wholesale.** `id="settings-form"`, `action={formAction}`, the `onChange={() => setIsDirty(true)}` handler, the `settings-dirty` `CustomEvent` dispatch (lines 142–144), and the `useEffect` that clears dirty on `state.success` (lines 135–139) MUST remain exactly as-is so the sidebar Save button keeps working.
- **Reset-to-M3-defaults is preserved wholesale.** `M3_LIGHT_DEFAULTS`/`M3_DARK_DEFAULTS` (lines 12–29), `resetLightToM3`/`resetDarkToM3` (lines 172–181), the `lightReset`/`darkReset` counters, the `lightColorOverrides`/`darkColorOverrides` state, and especially the **`key={lightReset}` / `key={darkReset}` on the color-grid `<div>`s** (lines 417, 458 — load-bearing: forces remount so `ColorRow` re-reads `defaultValue`) all stay. Only the reset `<button>`'s *position* changes: it moves from the current `flex items-start justify-between` heading into the new `SettingsSection` header-bar `action` slot; its `onClick`, label, and `type="button"` are unchanged.
- **Header pattern matches Stages 2/4/5.** Drop the redundant `<h1>Salon Settings</h1>` (line 39) — the topbar already renders the page title "Settings" via `AdminTopBar`/`getPageTitle` (`adminNavItems.ts` line 46–48 registers `/admin/settings` → label "Settings"). Use the mockup's eyebrow + subtitle: uppercase primary **"Configuration"** over a muted subtitle. (Coder note: since sub-routes `/admin/settings/email|social|notifications` are also registered, confirm the topbar resolves the base `/admin/settings` to "Settings"; the `isNavItemActive` match used in prior stages handles this — do not hardcode a title in the page.)
- **Subtitle honesty.** The mockup subtitle "Brand identity and colour theme" undersells the real page. Use an honest subtitle covering the real scope, e.g. **"Brand, colours, contact details and business hours"** (or keep the existing "Brand name, logo, favicon and colors."). This is a small copy choice; prefer the honest fuller line.
- **Section card chrome (the mockup's core visual):** each section = `bg-card border border-border rounded-[20px] shadow-sm overflow-hidden` (project favors 20px; mockup uses 16); a **header bar** `px-5 py-3 border-b border-border bg-muted/40` (mockup `t.surface` → tenant-safe `bg-muted/40`, matching the `bg-muted/50` tint already used by `thead` in services and the toggle in `BackgroundSection`) containing the title (`text-sm font-semibold text-foreground`) + optional description (`text-xs text-muted-foreground`) + an optional right-aligned `action` slot; then a **body** `flex flex-col gap-6 p-6` holding the existing controls verbatim.
- **Tenant-safety — fresh assessment for THIS page.** This is the page where tenant colors are *defined*, so using the tenant-customizable semantic layer for the page's OWN chrome is exactly correct: `text-primary` eyebrow, `bg-primary` sidebar save, `bg-card`/`bg-muted`/`border-border` section cards. There are **no status pills here**, so the calendar/services/masters "raw `--md-*-container` fixed tone vs. semantic layer" rule (which guards pills that would collapse under a single brand hue) **does not apply on this page** — do NOT introduce any `--md-*` fixed tone here; none is needed. The only literal-hex usage is the color-swatch previews inside `ColorRow`/`BackgroundSection`, which correctly bind to the very hex being edited (inline `style`/`value`) — that is the whole point and stays.
- **No emoji; icons via `lucide-react` only.** No new icons are required for the header/section chrome. Existing icon imports (`Upload`, `X`, `ImageIcon`, `Maximize2`, `Minimize2`, `Move`, `Save`) stay as-is in their files.

## Implementation Steps

Ordered lowest-risk / most-isolated first. Line numbers reference current files. **No handler, state, form `id`/`action`, dirty-tracking, reset mechanism, `key={…}` remount, color-input wiring, upload handler, or `actions.ts`/Zod logic may change — restyle/relayout classes, JSX wrappers, and the new presentational `SettingsSection` only.**

- [x] **Step 1: Header block — eyebrow + subtitle (Server Component, no button)** (`page.tsx` lines 38–43)
  - Files: `src/app/admin/settings/page.tsx`
  - Details: Replace the header `<div>` (lines 38–43) — currently `<h1 className="text-2xl font-bold tracking-tight">Salon Settings</h1>` + the subtitle `<p>` — with the mockup header pattern:
    - Eyebrow: `<p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>` (mockup `t.primary`, uppercase, `.05em` tracking).
    - Subtitle: `<p className="mt-1 text-sm text-muted-foreground">Brand, colours, contact details and business hours</p>` (honest fuller copy; the existing shorter copy is also acceptable).
    - Drop the `<h1>` entirely (title comes from the topbar). Keep the outer `<div className="flex flex-col gap-6">` and the `<SettingsForm>` / SUPERADMIN `<SuperAdminCredentials>` block exactly as-is. **Do NOT add any `<Button>`/`buttonVariants()` here.** Do NOT touch the `fullConfig` seeding block (lines 11–34).

- [x] **Step 2: Add the `SettingsSection` wrapper** (new component in `FormFields.tsx`)
  - Files: `src/app/admin/settings/FormFields.tsx`
  - Details: Add a purely presentational `SettingsSection` component (no hooks, no state) that renders the mockup's card-with-header-bar:
    - Props: `{ title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }`.
    - Markup: outer `<section className="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">`; a header bar `<div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-border bg-muted/40">` with a left block (`<h2 className="text-sm font-semibold text-foreground">{title}</h2>` + optional `{description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}`) and, when provided, `{action && <div className="shrink-0">{action}</div>}`; then a body `<div className="flex flex-col gap-6 p-6">{children}</div>`.
    - Export it (`export function SettingsSection(...)`). This is additive; it changes no existing exports. Keep `FormFields.tsx` under 500 (≈150 after).

- [x] **Step 3: Apply `SettingsSection` to the 4 non-reset sections** (`SettingsForm.tsx`)
  - Files: `src/app/admin/settings/SettingsForm.tsx`
  - Details: Import `SettingsSection` from `./FormFields` (add to the existing line-10 import). For each of the four sections below, replace the current `<section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm"><div><h2>…</h2><p>…</p></div> …body… </section>` with `<SettingsSection title="…" description="…"> …body… </SettingsSection>` — **moving the exact same body children unchanged** into the wrapper:
    - **Brand** (lines 191–252): `title="Brand"`, `description="Salon name and visual identity"`. Body = the `brandName` field, `<LogoEditor …/>`, the `logoFullscreen` hidden input, and the favicon `<ImageUploadField …/>` — all verbatim.
    - **Salon Contact Info** (lines 254–344): `title="Salon Contact Info"`, `description="Address, phone, email and legal details. Displayed on booking confirmation, support page, terms and privacy policy."`. Body = all 7 field grids verbatim.
    - **Calendar Settings** (lines 346–364): `title="Calendar Settings"`, `description="Colors used in the booking calendar"`. Body = the two `ColorRow`s (`availableSlotColor`, `dayOffColor`) verbatim.
    - **Business Hours** (lines 366–386): `title="Business Hours"`, `description="Global salon opening and closing hours"`. Body = the two number inputs verbatim.
  - Do not alter any `name`/`id`/`defaultValue`/`onChange` on any field. The form's outer `onChange` dirty-tracking still bubbles from the moved children.

- [x] **Step 4: Apply `SettingsSection` to the Light & Dark theme sections (reset button → `action` slot)** (`SettingsForm.tsx`)
  - Files: `src/app/admin/settings/SettingsForm.tsx`
  - Details: These two sections currently carry the reset button in a `flex items-start justify-between` heading. Convert each to `SettingsSection` and pass the reset button via the `action` prop:
    - **Light Theme** (lines 388–426): `<SettingsSection title="Light Theme" description="Colors used when the light theme is active" action={<button type="button" onClick={resetLightToM3} className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Reset to M3 defaults</button>}>`. Body = `<BackgroundSection …/>` (lines 405–416) + the color grid `<div key={lightReset} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lightColorFields.map(…)}</div>` (lines 417–425) — **`key={lightReset}` MUST be preserved**.
    - **Dark Theme** (lines 428–467): `<SettingsSection title="Dark Theme Colors" description="Colors used when the dark theme is active" action={<button type="button" onClick={resetDarkToM3} …same classes…>Reset to M3 defaults</button>}>`. Body = the `<BackgroundSection … prefix="dark" />` (lines 445–457) + the color grid `<div key={darkReset} …>{darkColorFields.map(…)}</div>` (lines 458–466) — **`key={darkReset}` MUST be preserved**.
    - The reset handlers, `M3_*_DEFAULTS`, override state, and the `<BackgroundSection>` props all stay byte-for-byte identical.
    - Leave the trailing `state.error`/`state.success` messages (lines 469–470) as-is (optional token polish in Step 6).
  - After Steps 3–4, verify `SettingsForm.tsx` is comfortably under 500 lines (expected ~455).

- [x] **Step 5: `SuperAdminCredentials` — radius bump only** (`SuperAdminCredentials.tsx` line 41)
  - Files: `src/app/admin/settings/SuperAdminCredentials.tsx`
  - Details: This is a **security-sensitive** credential UI not depicted in the mockup. Change ONLY the card container radius for consistency: `CredentialForm`'s wrapper `rounded-xl border border-border bg-card p-5` (line 41) → `rounded-[20px] border border-border bg-card p-5`. **Do NOT touch** `handleSubmit`, `patchCredentials`, the `PATCH /api/admin/superadmin/credentials` call, the `required` fields, `e.currentTarget.reset()`, or the `<Button>` submit wiring. (Optional token polish for the success text is listed in Step 6.)

- [x] **Step 6 (optional, low-priority): token polish for success messages** — apply only if lint-neutral and desired
  - Files: `src/app/admin/settings/SettingsForm.tsx` (line 470), `src/app/admin/settings/SuperAdminCredentials.tsx` (line 51)
  - Details: Both use raw `text-green-600 dark:text-green-400` for the success message, which deviates from the "use `--md-success` not the `green-*` scale" convention (same class Stage 5 aligned in `MasterForm`). Optionally swap to the success token, e.g. `text-[var(--md-on-success-container)]` (or keep a simple `text-[var(--md-success)]`). Transient status text, cosmetic only — skip if it risks the lint baseline. `LogoEditor`'s intentional `bg-zinc-*` dark-logo preview backdrop (lines 291, 302) is deliberate and stays. If nothing here is changed, note so.

- [ ] **Step 7: Verify & hand off**
  - Files: (none — verification only)
  - Details: Run the automated gates (below); then produce the manual browser checklist for the user. No dev server.

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` introduces **zero net-new** problems vs. the repo baseline (the pre-existing orphaned `SubmitButton` import is not newly introduced; `SettingsSection` is imported and used; no new unused imports). Verified via `git stash` A/B comparison — same 2 pre-existing errors (`LogoEditor.tsx` unescaped quotes, `SettingsForm.tsx` unused `SubmitButton`) on both sides.
- [x] `npm run build` succeeds.
- [x] Existing test suite unaffected — no Settings-page component tests exist; changes are presentation/layout-only. Full `vitest run` has pre-existing unrelated failures (booking-helpers, support/contact) confirmed present before this change via `git stash` A/B run.
- [x] `SettingsForm.tsx` stays under 500 lines (446 actual); `FormFields.tsx` (142 actual) and `LogoEditor.tsx` (unchanged, 443) also stay under 500.
- [x] Header shows the uppercase "Configuration" eyebrow (brand/primary color) + honest subtitle; the redundant `<h1>Salon Settings</h1>` is gone (title comes from the topbar).
- [x] All six sections render as `rounded-[20px] bg-card` cards with a tinted (`bg-muted/40`) header bar divided from the body; Light/Dark theme cards show the "Reset to M3 defaults" button in the header bar.
- [x] Follows project conventions (no emoji, semantic tenant-customizable tokens for page chrome, no unnecessary `--md-*` fixed tones, `rounded-full` pills / `rounded-[20px]` cards, files < 500 lines).
- [ ] **Functional preservation (manual):** save (via sidebar), dirty-tracking, reset-to-defaults (light & dark), every color picker, logo editor (upload/drag/size/pages/layer/fullscreen), favicon, background config (solid/gradient/picture, apply-to-dark), contact info, business hours, homepage preview accuracy, and super-admin credential change (password & email) all still work unchanged. **Requires manual browser verification by user — not automatable.**

## Verification

### Automated (run after implementation)
```bash
npx tsc --noEmit
npm run lint
npm run build
```
No dev server may be started for verification (standing rule). Anything visual is deferred to the manual checklist below.

### Manual (user must confirm in-browser — flag explicitly)
Navigate to `/admin/settings` (logged in as ADMIN, and separately as SUPERADMIN) and verify:
1. **Header:** uppercase "Configuration" eyebrow (in the brand/primary color) over the subtitle; no big "Salon Settings" heading duplicated below the topbar's "Settings" title.
2. **Section cards:** all six (Brand, Salon Contact Info, Calendar Settings, Business Hours, Light Theme, Dark Theme) render as rounded cards with a tinted header bar (title + description) separated by a divider from the body of controls.
3. **Save (sidebar):** editing any field enables the sidebar "Save Settings" button; clicking it saves and shows "Settings saved."; the button disables again (dirty cleared).
4. **Brand:** change the salon name and save → persists. Logo editor: upload a light logo and a dark logo; drag the logo in the preview to reposition; adjust size slider; toggle "Show on Pages"; switch Above/Below and "Stretch to Full Screen"; open/close the fullscreen editor. Favicon: upload and remove.
5. **Homepage preview accuracy:** the embedded preview reflects the current logo position/size/layer; the fullscreen editor mirrors it.
6. **Salon Contact Info:** edit company/NIP/address/city/legal/phone/email and save → persists.
7. **Calendar Settings & Business Hours:** change the available-slot/day-off colors and open/close hours and save → persists (and the calendar reflects the colors).
8. **Light Theme:** change several color pickers; use the Background section (Solid color, Gradient with from/to + angle slider + preview, Picture upload, and "Also apply to dark theme"); click **Reset to M3 defaults** → the six light color fields visibly reset to the M3 defaults and the form becomes dirty; save persists.
9. **Dark Theme:** same for the seven dark color fields and the dark Background section; **Reset to M3 defaults** resets them; save persists. Toggle the admin theme to dark and confirm the whole settings page reads correctly.
10. **Super Admin Credentials (SUPERADMIN only):** the "Security" block appears with two cards (rounded to match); changing the password (current + new) and changing the login email (current + new) each succeed and show the success message; the forms reset after success. Confirm this block is **absent** for a plain ADMIN.
11. **Tenant blast-radius check:** after saving a non-default brand/primary color here, confirm the rest of the admin app (sidebar, topbar, other pages) and the public homepage still render correctly — this page controls whole-app branding.

## Constraints & Risks
- **Highest blast radius of the initiative so far:** this page defines the WHOLE APP's tenant branding. A mistake in the save path or color wiring could visually break every other page — so this stage changes **only** presentation wrappers/classes and adds one presentational component. Every changed line must trace to a visual requirement.
- **Do NOT modify** `src/app/admin/settings/actions.ts` (the `saveSettings` action, `SettingsSchema` Zod validation, `revalidatePath` calls).
- **Do NOT modify** the dirty-tracking / save plumbing in `SettingsForm.tsx`: `id="settings-form"`, `action={formAction}`, `onChange={() => setIsDirty(true)}`, the `settings-dirty` `CustomEvent` dispatch, and the success-clears-dirty `useEffect`. The sidebar Save button depends on all of these.
- **Do NOT modify** the reset-to-M3 mechanism: `M3_LIGHT_DEFAULTS`/`M3_DARK_DEFAULTS`, `resetLightToM3`/`resetDarkToM3`, the override state, and especially the `key={lightReset}`/`key={darkReset}` remount on the color grids (removing the key silently breaks the visual reset — invisible to tsc/lint/build).
- **Do NOT modify** any color-input wiring (`ColorRow` value/pattern/onChange), the `<input type="color">`s, the hidden inputs in `LogoEditor`/`BackgroundSection` (they carry submitted values), or the image-upload handlers (`uploadFile`, `handleImageUpload`, `uploadImage`).
- **Do NOT modify** `SuperAdminCredentials` logic (submit, `patchCredentials`, the `/api/admin/superadmin/credentials` PATCH, required fields, form reset) — security-sensitive; only the card radius (Step 5).
- **`page.tsx` is a Server Component:** do NOT add any `<Button>`/`buttonVariants()`; do NOT touch the literal-hex config-seeding fallbacks (lines 13–33). Only the header block (Step 1) changes.
- **File-size limit:** the `SettingsSection` extraction is REQUIRED to keep `SettingsForm.tsx` under 500 — do not restyle sections inline. Leave `LogoEditor.tsx` (443) structurally untouched (zero net lines).
- **Pre-existing dead code (mention, don't delete):** `SubmitButton` is imported in `SettingsForm.tsx` line 10 but never rendered. It is a pre-existing orphan (unrelated to this restyle) — flagged here, left in place per the "mention, don't delete pre-existing dead code" rule. It does not affect the net-new lint delta.
- **Deferred / out of scope (do not attempt in this stage):**
  - **The three sub-routes `/admin/settings/email`, `/admin/settings/social`, `/admin/settings/notifications`** — separate future stages; do NOT touch them or their forms.
  - **An inline "Save changes" button** — the sidebar Save is canonical; do not add a redundant second save affordance.
  - **`LogoEditor` restyle/refactor** — not in the mockup, near the line limit, drag/fullscreen logic; leave alone.
  - **Deep `BackgroundSection` redesign** — complex bg logic not depicted in the mockup; leave functional (optional card-on-card contrast tweak is NOT in scope here).
  - **Client-facing booking flow** — later stage per the admin-first sequencing.

## Critical Files
- `src/app/admin/settings/SettingsForm.tsx` (473) — primary restyle target; sections wrapped in `SettingsSection` (Steps 3–4); all save/dirty/reset/color logic untouched.
- `src/app/admin/settings/FormFields.tsx` (117) — add the new `SettingsSection` presentational wrapper (Step 2); `ColorRow`/`ImageUploadField`/`SubmitButton` unchanged.
- `src/app/admin/settings/page.tsx` (55) — Server Component; header block only (Step 1); NO `<Button>`/`buttonVariants()`; do not touch config-seeding fallbacks.
- `src/app/admin/settings/SuperAdminCredentials.tsx` (108) — radius bump only (Step 5); security logic untouched.
- `src/app/admin/settings/LogoEditor.tsx` (443) — leave structurally unchanged (near limit; not in mockup).
- `src/app/admin/settings/BackgroundSection.tsx` (202) — leave functional; not restyled this stage.
- `src/app/admin/settings/HomepagePreview.tsx` (100) — leave unchanged; verify preview accuracy manually.
- `src/app/admin/settings/actions.ts` — leave unchanged; server logic/validation.
- `src/components/admin/AdminSidebar.tsx` (lines 147–164) — the canonical Save Settings button (`form="settings-form"`, `disabled={!isDirty}`); do not modify, but understand it drives save.
- `Somique Beauty Design System/ui_kits/admin/index.html` — mockup reference: `SettingsPage` at lines 431–462 (eyebrow "Configuration" 440, section card + header bar 444–447, rows 448–456, save pill 459; theme `AT` 30–55, `t.surface`/`t.card`/`t.border`/`t.primary`).
- `src/app/admin/AGENTS.md`, `src/components/AGENTS.md` — conventions (semantic vs. raw `--md-*` tokens, `buttonVariants()` server-boundary hazard, literal-hex calendar-color rule, radius/pill rules, 500-line limit).
