# Plan: Admin Email Settings Page — M3 (Somique) Restyle (Stage 7)

**Date:** 2026-07-05
**Status:** Steps 1-3 implemented and verified (tsc/lint/build green); Step 4 manual browser verification pending user

## Goal
Restyle `/admin/settings/email` (the SMTP settings page + its `EmailSettingsForm`) to the established Stage-6 M3 visual language (eyebrow header + `SettingsSection` card with a tinted header bar), preserving 100% of the SMTP save / test-send functionality and — critically — the encrypted-password round-trip, without touching any form logic or API.

## Structural Assessment (read first — honest fit analysis)

**The mockup has NO Email/SMTP design.** Verified in `Somique Beauty Design System/ui_kits/admin/index.html`: the `email` route (line 483) renders a generic `PlaceholderPage title="Email" desc="SMTP configuration and templates."` (component at lines 464–474) — just an eyebrow header + a "Coming soon in this UI kit" empty card. There is **no SMTP field layout, no section spec, nothing Email-specific** to copy. This is exactly the situation Stage 6 flagged (the mockup only fleshed out Brand + Colors).

**Therefore this stage is purely "apply the already-approved Stage 6 pattern," with zero new mockup-derived visual details.** The two reference patterns, both already in the repo:
- **Eyebrow header** — the mockup's `PlaceholderPage`/`SettingsPage` header: a small uppercase primary "eyebrow" over a muted subtitle (mockup lines 440–441, 468–470). Stage 6 already implemented this on `/admin/settings` (eyebrow "Configuration" + subtitle).
- **`SettingsSection` card** — the tinted-header-bar card wrapper Stage 6 extracted into `src/app/admin/settings/FormFields.tsx` (lines 110–133): `<section class="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">` + a header bar `px-5 py-3 border-b border-border bg-muted/40` (title + optional description + optional `action` slot) + a body `flex flex-col gap-6 p-6`.

**Is `SettingsSection` reusable here? Yes.** The Email page has clear section-like structure (a block of SMTP fields with the current `<form class="… bg-card border border-border p-6 rounded-xl">` already being a single plain card). Wrapping those fields in `SettingsSection` gives the exact same tinted-header-bar chrome as the main Settings page — the most consistent, lowest-effort path. Reuse it; do NOT invent a new card pattern.

**Note — no file-size pressure this time.** Unlike Stage 6 (`SettingsForm.tsx` was at 473/500 and extraction was *forced*), `EmailSettingsForm.tsx` is 295 lines with ample headroom. So `SettingsSection` is used here purely for **visual consistency with Stage 6**, not to save lines. It is still not single-use (already used 6× in Stage 6), so reuse does not violate "no abstractions for single-use code."

### `SettingsSection` import-direction decision (call out)
`SettingsSection` lives at `src/app/admin/settings/FormFields.tsx`; `EmailSettingsForm.tsx` lives at `src/components/admin/`. Importing it means `src/components → src/app`, which is the reverse of the usual app-imports-components direction — a minor layering smell.

- **DECISION (recommended): reuse in place** — `import { SettingsSection } from "@/app/admin/settings/FormFields"`. `FormFields.tsx` is a `"use client"`, purely-presentational module (no server-only code), so this is functionally safe. This keeps Stage 7 **fully isolated to the Email page** and touches ZERO of the just-approved Stage 6 files — which matches the user's "one page at a time / don't touch approved stages" preference.
- **Rejected alternative (do NOT do this stage): promote** `SettingsSection` to `src/components/admin/SettingsSection.tsx` and repoint both consumers. Cleaner layering, but it edits Stage 6's approved `SettingsForm.tsx` import and moves the export out of `FormFields.tsx` — scope creep + risk to an approved stage. Recorded as a possible future cleanup, explicitly deferred.
- Do NOT duplicate the markup inline (DRY violation + risks visual drift from the canonical component) and do NOT create a second `SettingsSection` definition.

## What this page configures (verified — do not assume)
`EmailSettingsForm.tsx` (295 lines, `"use client"`) is a self-contained SMTP config form with its OWN inline save (not the sidebar save Stage 6 used). Fields (schema lines 28–39): `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass` (`type="password"`), `smtpFrom`, `smtpSecure` (Switch). Two actions: **Save Config** (`onSubmit` → `PATCH /api/admin/email-settings`) and **Save & Send Test Email** (opens a Dialog, then `POST /api/admin/email-settings/test`). Loads current config on mount via `GET /api/admin/email-settings`. The page also renders an aside `SmtpInstructions` card (provider setup guides).

## SMTP-password security (CRITICAL — the restyle must not touch any of this)
The encrypted password never reaches the browser, by design:
- **GET** (`src/app/api/admin/email-settings/route.ts` line 18) returns `smtpPass: config?.smtpPass ? "••••••••" : ""` — a masked **sentinel**, never the real/decrypted secret.
- The form loads that sentinel into the `smtpPass` field (`form.reset`, line 73) and renders it in an `<Input type="password">` (line 198, with `autoComplete="new-password"`).
- **PATCH** (route line 39): `data.smtpPass === "••••••••" ? (existing?.smtpPass || null) : (encrypt(data.smtpPass) || null)` — an unchanged sentinel keeps the existing encrypted value; a newly typed value is `encrypt()`-ed at rest.

**The restyle MUST NOT, under any circumstance:**
- Change the `smtpPass` field `type` from `password` to `text`.
- Add a "show/reveal password" toggle (does not exist today; would reveal a freshly-typed plaintext — a behavior + security change).
- Alter the `form.reset` mapping, the `••••••••` sentinel string, or any request/response wiring.
- Log, echo, or otherwise surface the password value anywhere in the DOM.

This is a className/wrapper restyle only. It touches none of the form handlers, schema, or the API route (the API route is not edited at all).

## Architecture Decisions
- **Only presentation changes.** No handler, `useForm`, schema, `fetch`, Dialog logic, Switch wiring, or API code is modified. Every changed line traces to visual/layout styling.
- **`page.tsx` is a Server Component and renders no `<Button>`/`buttonVariants()`.** The Stage-2 request-time `buttonVariants()` `TypeError` hazard cannot occur here today. The header restyle stays pure `<div>/<p>` JSX — **do NOT introduce any `<Button>` or `buttonVariants()` into `page.tsx`.** (`EmailSettingsForm` and `SmtpInstructions` render `<Button>`/`Card` as JSX, which is safe; `EmailSettingsForm` is `"use client"` so its buttons are unaffected either way.)
- **Header pattern matches Stage 6.** The topbar already renders the page title "**Email**" for this route (`adminNavItems.ts`: the non-exact "Email" item `href:"/admin/settings/email"` matches via `pathname.startsWith`; the "Settings" item is `exact`, so it does not claim this path — confirmed in `getPageTitle`/`isNavItemActive`, lines 112–122). So the page's `<h1>Email Settings (SMTP)</h1>` is redundant. Drop it; use eyebrow + subtitle.
  - **Eyebrow copy:** use **"Configuration"** (same kicker Stage 6 used on the main Settings page) rather than the placeholder's literal "Email", so it does not duplicate the topbar's "Email" title and keeps the whole settings area visually coherent. (Alternative, if the reviewer prefers a page-specific kicker: "Email delivery". Do NOT use "Email" — duplicates the topbar.)
  - **Subtitle copy:** keep the existing honest line — "Configure how the application sends emails for password resets, booking confirmations, and other notifications." (Do NOT adopt the placeholder's "SMTP configuration and templates." — there is no template feature here; it would be inaccurate.)
- **Section chrome via `SettingsSection`.** The current single plain card (`<form class="space-y-6 max-w-2xl bg-card border border-border p-6 rounded-xl">`) becomes: the SMTP fields wrapped in one `SettingsSection` (tinted header bar + `rounded-[20px]` + `shadow-sm`), matching Stage 6 exactly. Keep `max-w-2xl` on the outer `<form>` (preserves the current column width).
- **One section, not two.** With only ~6 fields, a single `SettingsSection` (title e.g. "SMTP Server") is the minimum that solves the problem. A two-card split (Server + Sender) was considered and **rejected** as over-abstraction for 6 fields. The mockup gives no guidance either way (it's a placeholder).
- **Save/Test buttons stay inside the section body.** Keep the existing footer row (`flex … gap-4 pt-4 border-t`) as the last child inside the `SettingsSection` body — lowest visual delta, preserves current UX, and both `<Button>`s are already `rounded-full` pills (button base class, no change needed).
- **No status pills on this page → semantic tokens are correct.** Fresh assessment: this form has no persistent "connected"/"test successful" indicator — success/failure is transient `sonner` toast only. So the calendar/services/masters raw-`--md-*`-container fixed-tone rule (which protects status pills) **does not apply**; use the tenant-customizable semantic layer (`bg-card`, `bg-muted/40`, `border-border`, `text-primary`, `text-muted-foreground`) for all page/section chrome. Do NOT introduce any `--md-*` fixed tone here.
- **`SmtpInstructions` aside — minimal/no change.** It already uses the shadcn `Card` (`rounded-[--radius] bg-card shadow-sm ring-1`), which is M3-aligned; it is a distinct content type (setup accordions), not a form section, so it does NOT need `SettingsSection` chrome. Only an optional, low-priority token note (below). Do not restyle its accordions or logic.
- **No emoji; icons via `lucide-react` only.** No new icons required.

## Implementation Steps

Ordered lowest-risk / most-isolated first. Line numbers reference current files. **No handler, `useForm`, Zod schema, `fetch`/API call, Dialog, Switch/field wiring, field `type`, or password round-trip may change — restyle/relayout classes, JSX wrappers, and the reused `SettingsSection` only.**

- [x] **Step 1: Header — eyebrow + subtitle (Server Component, no button)**
  - Files: `src/app/admin/settings/email/page.tsx`
  - Details: In the header `<div>` (lines 13–18), replace `<h1 className="text-2xl font-bold tracking-tight">Email Settings (SMTP)</h1>` with an eyebrow `<p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>`. Keep the existing subtitle `<p>` (lines 15–17) as-is (optionally tighten its wrapping, no copy change required). Keep the outer `<div className="flex flex-col gap-6">` and the `grid lg:grid-cols-3` layout (lines 20–27) exactly as-is. **Do NOT add any `<Button>`/`buttonVariants()`.** Do NOT change the `metadata` export.

- [x] **Step 2: Wrap the SMTP fields in `SettingsSection`**
  - Files: `src/components/admin/EmailSettingsForm.tsx`
  - Details:
    - Add the import: `import { SettingsSection } from "@/app/admin/settings/FormFields"` (see the import-direction decision above; reuse in place).
    - Change the `<form>` className (line 144) from `"space-y-6 max-w-2xl bg-card border border-border p-6 rounded-xl"` to layout-only `"max-w-2xl"` (drop the card classes — `SettingsSection` now provides the card; drop `space-y-6` since the section body uses its own `gap`).
    - Immediately inside the `<form>`, wrap ALL current children — the host/port grid (145–174), the user/pass grid (176–204), the `smtpFrom` field (206–219), the `smtpSecure` Switch row (221–240), and the footer button row (242–256) — in `<SettingsSection title="SMTP Server" description="Server credentials used to send transactional email."> … </SettingsSection>`. Move the existing children **verbatim**; do not alter any `name`/`type`/`placeholder`/`autoComplete`/`{...field}`/`control`/handler. The `pt-4 border-t` footer row stays the last child inside the section body.
    - Leave the `<Dialog>` (259–292), the `<Form {...form}>` wrapper, `onSubmit`, `handleTestEmail`, the loading branch (138–140), all state, and the `useEffect` load untouched.
    - **Password field (191–203): unchanged** — `type="password"`, `autoComplete="new-password"`, `{...field}`, and the `••••••••` round-trip all stay byte-for-byte identical.

- [x] **Step 3 (optional, low-priority polish — apply only if lint-neutral):** minor token/consistency touches
  - Files: `src/components/admin/EmailSettingsForm.tsx`, `src/components/admin/SmtpInstructions.tsx`
  - Details (each independent, each skippable):
    - [x] The `smtpSecure` toggle row (line 225) `rounded-lg border p-4` → `rounded-[20px] border border-border bg-muted/30 p-4`, so the nested control reads as a distinct sub-panel inside the card. Switch wiring unchanged.
    - [x] Pre-existing copy typo in the toggle description (line 229): "Keep disabled (flase) for port 587" → "(false)". Cosmetic; flagged, fix only if touching this line anyway.
    - [skipped] `SmtpInstructions.tsx` yellow warning callout (line 25) uses `bg-yellow-500/10 text-yellow-600 dark:text-yellow-500` (Tailwind color scale). Left as-is per plan's own guidance ("skip if it risks the lint/visual baseline") — no functional/consistency gain that justifies the visual-diff risk on an already-acceptable static callout.
  - Applied 2 of 3 sub-items; skipped the `SmtpInstructions` token touch (see above).

- [ ] **Step 4: Verify & hand off** (skipped per coder task scope — automated gates run separately below; manual browser checklist deferred to user)
  - Files: (none — verification only)
  - Details: Run the automated gates (below); then produce the manual browser checklist for the user. No dev server.

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` introduces **zero net-new** problems vs. the repo baseline (verify via `git stash` A/B if unsure; the new `SettingsSection` import is used, no new unused imports). Confirmed via git-stash A/B: 60 problems (55 errors, 5 warnings) both before and after.
- [x] `npm run build` succeeds.
- [ ] Existing test suite unaffected — no Email-page component tests exist; changes are presentation-only. (Any pre-existing unrelated `vitest` failures must be confirmed present before the change too.) — not run (out of coder task scope per instructions; presentation-only change, no Email-page tests exist).
- [x] `EmailSettingsForm.tsx` stays under 500 lines (≈300 after); `page.tsx` and `SmtpInstructions.tsx` also under 500. (298 lines.)
- [x] Header shows the uppercase "Configuration" eyebrow (primary color) + the honest subtitle; the redundant `<h1>Email Settings (SMTP)</h1>` is gone (topbar already shows "Email").
- [x] SMTP fields render inside a `rounded-[20px] bg-card` `SettingsSection` with a tinted (`bg-muted/40`) header bar divided from the body — visually matching the main Settings page.
- [x] Follows project conventions (no emoji, semantic tenant-customizable tokens, no unneeded `--md-*` fixed tone, `rounded-full` pills / `rounded-[20px]` cards, files < 500 lines).
- [ ] **Security preserved (manual):** the `smtpPass` field stays `type="password"`; the real password is never present in the DOM; the `••••••••` sentinel round-trip still keeps the existing password on save-without-change and re-encrypts a newly typed one. — code-level check passed (field JSX byte-for-byte unchanged); full manual browser verification still required by user.
- [ ] **Functional preservation (manual):** load config, Save Config, Save & Send Test Email, and the Secure toggle all still work unchanged. **Requires manual browser verification — not automatable.**

## Verification

### Automated (run after implementation)
```bash
npx tsc --noEmit
npm run lint
npm run build
```
No dev server may be started for verification (standing rule).

### Manual (user must confirm in-browser — flag explicitly)
Log in as ADMIN (and separately SUPERADMIN) and go to `/admin/settings/email`:
1. **Header/topbar:** topbar reads "Email"; page shows the uppercase "Configuration" eyebrow (brand/primary color) + subtitle; no duplicate large "Email Settings (SMTP)" heading.
2. **Card chrome:** SMTP fields sit in a rounded card with a tinted header bar ("SMTP Server") divided from the body; the `SmtpInstructions` guides render correctly in the aside beside it; layout intact at `lg` and mobile widths.
3. **Load config:** if an SMTP password is already saved, the Password field shows dots (the `••••••••` sentinel), NOT the real value. Open devtools and confirm the password `<input>`'s value is the sentinel (or empty), never the stored secret.
4. **Save without changing password:** edit host/port/from, Save Config → toast "Email settings saved safely"; reload → changes persist AND the previously saved password is still configured (not wiped).
5. **Change password:** type a new password, Save Config → succeeds; reload → the field shows dots again (the new plaintext is not echoed back).
6. **Test send:** click "Save & Send Test Email", enter an address in the dialog, send → appropriate success/error toast; a real test email is delivered when SMTP is valid.
7. **Secure toggle:** flip Secure Connection (SSL), Save → persists on reload.
8. **Dark theme:** toggle the admin dark theme and confirm the page (card, header bar, fields, aside) reads correctly.

## Constraints & Risks
- **Security-sensitive page.** The SMTP password is an encrypted-at-rest secret. Do NOT change the `smtpPass` field `type` (`password`), do NOT add a reveal toggle, do NOT alter the `••••••••` sentinel or the `form.reset`/GET/PATCH round-trip. The API route `src/app/api/admin/email-settings/route.ts` is **not edited**.
- **Do NOT modify any form logic:** the Zod `formSchema`, `useForm`/`defaultValues`, `onSubmit`, `handleTestEmail`, the mount `useEffect` load, the `<Dialog>` test flow, the Switch/field bindings, or any `fetch` call. Restyle/relayout only.
- **`page.tsx` is a Server Component:** do NOT add any `<Button>`/`buttonVariants()`; do NOT change the `metadata` export. Only the header block (Step 1) changes.
- **Import direction:** reusing `SettingsSection` from `@/app/admin/settings/FormFields` is a deliberate, accepted minor layering smell (keeps this stage isolated from approved Stage 6). Do NOT duplicate the component or edit Stage 6 files to "fix" layering this stage.
- **Do NOT touch Stage 6 files** (`src/app/admin/settings/SettingsForm.tsx`, `FormFields.tsx`, `page.tsx`, `actions.ts`, `SuperAdminCredentials.tsx`, `LogoEditor.tsx`, `BackgroundSection.tsx`). `FormFields.tsx` is only *imported from*, never modified.
- **Pre-existing observation (out of scope):** `email/page.tsx` does not call `auth()` itself (it relies on middleware + the API's own role check), unlike the AGENTS.md guidance that admin pages self-check. This is pre-existing and a restyle task must not add auth logic — flagged, not changed.
- **Deferred / out of scope (do not attempt this stage):**
  - `/admin/settings/social` (Social Auth) and `/admin/settings/notifications` — separate future stages; do NOT touch.
  - Promoting `SettingsSection` to `src/components/admin/` — possible future cleanup; deferred to avoid touching approved Stage 6.
  - Splitting the form into multiple section cards — rejected as over-abstraction for ~6 fields.
  - Any restyle of the `SmtpInstructions` accordions or the test-email `<Dialog>` internals beyond the optional Step-3 token touches.
  - Client-facing booking flow — later, per admin-first sequencing.

## Critical Files
- `src/app/admin/settings/email/page.tsx` (30) — Server Component; header block only (Step 1); NO `<Button>`/`buttonVariants()`.
- `src/components/admin/EmailSettingsForm.tsx` (295) — primary target; wrap fields in `SettingsSection` (Step 2); ALL form/API/password logic untouched; `smtpPass` stays `type="password"`.
- `src/app/admin/settings/FormFields.tsx` (142) — source of `SettingsSection` (lines 110–133); **import only, do NOT modify** (Stage 6 file).
- `src/components/admin/SmtpInstructions.tsx` (63) — aside guides; already M3-aligned; optional token-only touch (Step 3).
- `src/app/api/admin/email-settings/route.ts` — GET masks the password to `••••••••` (line 18); PATCH keeps/`encrypt()`s it (line 39); **not edited** — reference for the security guarantee.
- `src/components/admin/adminNavItems.ts` / `AdminTopBar.tsx` — topbar resolves this route's title to "Email" (why the page `<h1>` is dropped); not modified.
- `src/components/ui/button.tsx` — buttons are already `rounded-full` (base class); confirms no button-radius change needed.
- `Somique Beauty Design System/ui_kits/admin/index.html` — mockup: Email route is a `PlaceholderPage` (line 483; component 464–474); eyebrow/section-card reference in `SettingsPage` (431–462). No Email-specific design exists.
- `src/app/admin/AGENTS.md`, `src/components/AGENTS.md` — conventions (encrypted secrets never rendered decrypted, semantic vs `--md-*` tokens, `buttonVariants()` server-boundary hazard, radius/pill rules, 500-line limit).
```
