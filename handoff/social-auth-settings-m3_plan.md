# Plan: Admin Social Login (OAuth) Settings Page — M3 (Somique) Restyle (Stage 8)

**Date:** 2026-07-06
**Status:** Implemented, reviewed (APPROVED), gates verified by orchestrator — pending user manual browser verification

## Goal
Restyle `/admin/settings/social` (the OAuth-provider settings page + its `SocialSettingsForm`) to the already-established Settings/Email M3 visual language (eyebrow header + `SettingsSection` tinted-header-bar cards), preserving 100% of the save/load logic and the encrypted-secret masked-sentinel round-trip, touching only presentation.

## Structural Assessment (read first — honest fit analysis)

**There is NO mockup for this page.** Confirmed by search: nothing named "social" exists anywhere in `Somique Beauty Design System/`. So this stage is **purely "apply the already-approved Settings/Email pattern," with zero new mockup-derived visual details** — do NOT invent design elements. The two canonical reference patterns, both already in the repo and already approved on the main Settings page (Stage 6) and Email page (Stage 7):

- **Eyebrow header** — a small uppercase primary "eyebrow" over a muted subtitle. Already on `/admin/settings` (`page.tsx` lines 39-42) and `/admin/settings/email` (`page.tsx` lines 13-18), both using kicker `<p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>` + a muted `<p className="mt-1 text-sm text-muted-foreground">`.
- **`SettingsSection` card** — the card wrapper extracted into `src/app/admin/settings/FormFields.tsx` (lines 110-133): `<section className="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">` + a tinted header bar `flex items-start justify-between gap-4 px-5 py-3 border-b border-border bg-muted/40` (renders `title` as `text-sm font-semibold`, optional `description` as `text-xs text-muted-foreground`, optional `action` slot on the right) + a body `flex flex-col gap-6 p-6`.

**`SettingsSection` API (verified — do not assume more):** props are exactly `title: string`, `description?: string`, `action?: React.ReactNode`, `children: React.ReactNode`. **There is NO `icon` slot.** `EmailSettingsForm` passed none. Therefore per-provider brand icons are NOT part of the established pattern — **do NOT add provider icons/emoji** (that would be inventing an unfounded detail). If a reviewer later wants provider icons, that is a separate design decision, out of scope here.

**Is `SettingsSection` reusable here? Yes — and it is the natural fit.** The form already has 3 clean provider blocks (Google / Telegram / Apple), each currently a shadcn `<Card>` with a title + description + a 2-column field grid. Each `<Card>` maps 1:1 onto one `SettingsSection` (title = the current `CardTitle`, description = the current `CardDescription`, body = the current field grid). This is the lowest-risk, most-consistent path.

### `SettingsSection` import-direction decision (call out — same as Stage 7)
`SettingsSection` lives at `src/app/admin/settings/FormFields.tsx`; `SocialSettingsForm.tsx` lives at `src/components/admin/`. Importing it means `src/components → src/app`, the reverse of the usual layering — a minor smell, deliberately accepted (identical to what Stage 7 did for the Email form).
- **DECISION (do this): reuse in place** — `import { SettingsSection } from "@/app/admin/settings/FormFields"`. `FormFields.tsx` is a `"use client"`, purely-presentational module (no server-only imports), so this is functionally safe and keeps this stage **fully isolated** to the social page.
- **Rejected (do NOT do):** promoting `SettingsSection` into `src/components/admin/` (would edit approved Stage 6/7 import sites — scope creep) or duplicating the markup inline (DRY violation + visual-drift risk). Deferred as possible future cleanup.

## What this page configures (verified — do not assume)
`SocialSettingsForm.tsx` (249 lines, `"use client"`, `export default`) is a self-contained OAuth-credentials form with its **own inline Save button** (not the shared sidebar save). Provider blocks and their fields (Zod schema lines 21-30, all `.optional()`):
- **Google** — `googleClientId`, `googleClientSecret` (`type="password"`).
- **Telegram** — `telegramBotUsername`, `telegramBotToken` (`type="password"`).
- **Apple** — `appleClientId`, `appleTeamId`, `appleKeyId`, `applePrivateKey` (a `<Textarea>` for `.p8` contents, `sm:col-span-2`, `min-h-[120px] font-mono`).

Current provider order in the file is **Google → Telegram → Apple**; preserve that order (surgical).

Lifecycle: loads current config on mount via `GET /api/admin/social-settings` → `form.reset(...)` (lines 52-75); `onSubmit` → `PATCH /api/admin/social-settings`, then **re-fetches and `form.reset(newData)`** to refresh masked secrets (lines 77-100). Loading branch at line 102. Save button "Save Config" in a `<div className="flex border-t pt-4">` footer AFTER all three cards (lines 241-245).

**No shared-form plumbing to preserve here (verified).** This form does NOT use `id="settings-form"` and does NOT dispatch a `settings-dirty` CustomEvent — those belong to the main `SettingsForm.tsx` sidebar-save flow, not to this self-contained inline-save form. So there is no dirty-tracking wiring to keep byte-identical on this page; the thing to preserve is the masked-secret round-trip (below).

## Encrypted-secret security (CRITICAL — the restyle must not touch any of this)
Three secrets are encrypted at rest and never sent to the browser in cleartext:
- **GET** (`src/app/api/admin/social-settings/route.ts` lines 14-23) returns `googleClientSecret`, `applePrivateKey`, and `telegramBotToken` as the masked **sentinel** `"••••••••"` when set (else `""`) — never the decrypted value.
- The form loads those sentinels into their fields (`form.reset`, lines 58-67) and renders them: two in `<Input type="password" autoComplete="new-password">`, and `applePrivateKey` in a `<Textarea>`.
- **PATCH** (route lines 37-56) `handleSecret(newVal, existingVal)`: empty → `null` (clears); `"••••••••"` → keep `existingVal`; anything else → `encrypt(newVal.trim())`.
- After a successful PATCH, `onSubmit` re-fetches and `form.reset(newData)` so the secret fields re-mask (lines 87-92).

**The restyle MUST NOT, under any circumstance:**
- Change `googleClientSecret` / `telegramBotToken` field `type` away from `password`.
- Change `applePrivateKey` from `<Textarea>` to anything else, or reveal it (it shows the `••••••••` sentinel when set — leave that behavior).
- Add a "show/reveal secret" toggle (does not exist today; would surface a freshly-typed plaintext — a security change).
- Alter the `••••••••` sentinel string, the `form.reset` mappings (lines 58-67, 91), the mount `GET`, the `onSubmit` `PATCH`, or the post-save re-fetch/re-mask.
- Log, echo, or otherwise surface any secret in the DOM.

The API route `src/app/api/admin/social-settings/route.ts` is **not edited** — it is referenced only as the security contract and a manual verification checkpoint.

## Architecture Decisions
- **Only presentation changes.** No `useForm`, `defaultValues`, Zod `formSchema`, `onSubmit`, mount `useEffect`, `fetch` call, or field `{...field}`/`name`/`type`/`placeholder`/`autoComplete` may change. Every changed line traces to visual/layout styling.
- **`page.tsx` is a Server Component and renders no `<Button>`/`buttonVariants()`.** Keep it that way — the header restyle is pure `<div>/<p>` JSX. (`SocialSettingsForm` is `"use client"`, so its `<Button>` is unaffected.) Do NOT change the `metadata` export.
- **Header pattern matches Settings/Email.** The topbar already renders "Social Auth" for this route (`adminNavItems.ts` line 57 — non-`exact` item, matched via `pathname.startsWith`; the "Settings" item is `exact`, so it does not claim this path). So the page's `<h1 className="text-2xl font-bold tracking-tight">Social Login (OAuth)</h1>` is redundant. Drop it; use eyebrow + subtitle.
  - **Eyebrow copy:** use **"Configuration"** (the exact kicker both approved settings pages use) for maximum consistency. (Reviewer-preference alternative if a page-specific kicker is wanted: "Authentication". Do NOT use "Social Auth" — duplicates the topbar title.)
  - **Subtitle copy:** keep the existing honest line verbatim — "Fill in keys to automatically enable social logins. Leave everything blank to disable a provider. Secrets are encrypted securely in the database." Do not invent new copy.
- **Three `SettingsSection`s, one per provider.** Each current `<Card>` becomes one `<SettingsSection title=… description=…>` reusing the existing `CardTitle`/`CardDescription` text verbatim ("Google Auth" / "Telegram Auth" / "Apple Auth" and their descriptions). Inside each section body, wrap the FormFields in a `<div className="grid sm:grid-cols-2 gap-4">` (the section body is `flex flex-col gap-6 p-6`, so the 2-col grid must be an explicit inner `div` — mirrors how `EmailSettingsForm` nests its grids inside `SettingsSection`). `applePrivateKey` keeps its `sm:col-span-2`.
- **Preserve provider order** Google → Telegram → Apple (no reordering — surgical).
- **Save button stays at form level, after the three sections.** A single Save persists ALL providers, so the button does NOT belong inside any one section (unlike Email, which had a single section). Keep the existing footer `<div className="flex border-t pt-4">` with the "Save Config" button as the last child of the `<form>`, after the third section. Keep the `<form>`'s `space-y-6` (it spaces the three cards + footer). Button text and `disabled={isSaving || isLoading}` unchanged; the button is already a `rounded-full` pill (base class) — no radius change.
- **No `--md-*` fixed tones.** This page has no persistent status pills (success/failure is transient `sonner` toast only), so use the tenant-customizable semantic layer only (`bg-card`, `bg-muted/40`, `border-border`, `text-primary`, `text-muted-foreground`) — exactly what `SettingsSection` already uses. Do NOT introduce any `--md-*` container tone.
- **Token/icon/emoji audit result: nothing to replace.** Reading the form found **no raw emoji, no emoji icons, and no hardcoded Tailwind color-scale classes** (e.g. no `bg-yellow-500`, `text-red-600`, etc.) — it relies entirely on shadcn semantic tokens. So there is **no token or icon substitution work in this stage** (do not add any). The only "icons" that could appear would be provider brand icons, which are explicitly out of scope (see the no-icon-slot note above).

## Implementation Steps
Ordered lowest-risk / most-isolated first. Line numbers reference current files. **No handler, `useForm`, Zod schema, `fetch`/API call, field `type`, `{...field}` binding, or secret round-trip may change — restyle/relayout classes, JSX wrappers, and the reused `SettingsSection` only.**

- [x] **Step 1: Header — eyebrow + subtitle (Server Component, no button)**
  - Files: `src/app/admin/settings/social/page.tsx`
  - Details: In the header `<div>` (lines 12-18), replace `<h1 className="text-2xl font-bold tracking-tight">Social Login (OAuth)</h1>` (line 13) with an eyebrow `<p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>`. Keep the existing subtitle `<p className="mt-1 text-sm text-muted-foreground">…</p>` (lines 14-17) verbatim. Keep the outer wrapper `<div className="flex flex-col gap-6 max-w-4xl">` and `<SocialSettingsForm />` exactly as-is. Do NOT add any `<Button>`/`buttonVariants()`; do NOT change the `metadata` export.

- [x] **Step 2: Convert the three provider `<Card>`s to `SettingsSection`s**
  - Files: `src/components/admin/SocialSettingsForm.tsx`
  - Details:
    - Add the import: `import { SettingsSection } from "@/app/admin/settings/FormFields"` (reuse in place — see the import-direction decision).
    - **Google block (lines 108-140):** replace `<Card><CardHeader><CardTitle>Google Auth</CardTitle><CardDescription>…</CardDescription></CardHeader><CardContent className="grid sm:grid-cols-2 gap-4">…</CardContent></Card>` with `<SettingsSection title="Google Auth" description="Get these credentials from the Google Cloud Console (APIs & Services -> Credentials).">` wrapping `<div className="grid sm:grid-cols-2 gap-4">{…the two existing FormFields, moved verbatim…}</div>`. Keep the `->` / `&gt;` exactly as the current description renders it.
    - **Telegram block (lines 142-176):** same conversion — `title="Telegram Auth"`, `description="Talk to @BotFather in Telegram, create a bot and map your domain via /setdomain."`, inner `<div className="grid sm:grid-cols-2 gap-4">` around the two existing FormFields (keep their `FormDescription`s verbatim).
    - **Apple block (lines 178-239):** same conversion — `title="Apple Auth"`, `description="Requires an active Apple Developer Program membership."`, inner `<div className="grid sm:grid-cols-2 gap-4">` around the four existing FormFields; `applePrivateKey` keeps its `<FormItem className="sm:col-span-2">`, `<Textarea className="min-h-[120px] font-mono">`, placeholder, and `FormDescription` verbatim.
    - Move every FormField (control, name, render, Input/Textarea, type, placeholder, autoComplete, FormDescription) **byte-for-byte**; only the surrounding card chrome changes.
    - Leave the footer `<div className="flex border-t pt-4">` + "Save Config" `<Button>` (lines 241-245) as the last child of `<form>`, after the Apple section — unchanged.
    - Leave the `<Form {...form}>` wrapper, `<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">`, the loading branch (line 102), all state, the mount `useEffect`, `onSubmit`, and the post-save re-fetch/re-mask untouched.

- [x] **Step 3: Clean up imports orphaned by Step 2**
  - Files: `src/components/admin/SocialSettingsForm.tsx`
  - Details: After the conversion, the card import line (line 18: `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"`) is fully unused — remove that entire line (these are orphans YOUR change created). Do NOT touch the pre-existing unused `FormMessage` import (line 16) — it was already unused before this stage; removing pre-existing dead code is out of scope. Confirm no other import became unused. Run the automated gates.

- [x] **Step 4: Verify & hand off** (automated gates below; then produce the manual browser checklist for the user)
  - Files: (none — verification only)
  - Details: Run the automated gates; confirm `npm run lint` shows **zero net-new** problems vs. baseline (A/B with `git stash` if unsure — the new `SettingsSection` import is used and the removed Card import nets out). No dev server. Then hand the manual checklist to the user.

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes (no type errors).
- [x] `npm run lint` introduces **zero net-new** problems vs. the repo baseline (the added `SettingsSection` import is used; the removed Card import nets out; no new unused imports). Verified via `git stash`/`npm run lint` A/B: baseline `SocialSettingsForm.tsx` had the same 4 errors (`FormMessage` unused, `err` unused, 2x unescaped-entity on the Telegram description) at lines 16/68/158; after the change the same 4 errors remain at lines 16/68/156 (2-line shift from the removed Card import). Zero net-new.
- [x] `npm run build` succeeds.
- [ ] Existing test suite unaffected — no social-page component tests exist; change is presentation-only. Any pre-existing unrelated `vitest` failures must be confirmed present before the change too. (Not run this pass — no social-page tests exist and change is presentation-only per plan; flagging as not explicitly re-verified.)
- [x] `SocialSettingsForm.tsx` stays well under 500 lines (247 lines after); `page.tsx` also under 500 (23 lines).
- [x] Header shows the uppercase "Configuration" eyebrow (primary color) + the honest subtitle; the redundant `<h1>Social Login (OAuth)</h1>` is gone (topbar already shows "Social Auth").
- [x] Google, Telegram, and Apple fields each render inside a `rounded-[20px] bg-card` `SettingsSection` with a tinted (`bg-muted/40`) header bar divided from the body — visually matching the main Settings and Email pages; provider order unchanged.
- [x] Follows project conventions: no emoji, no provider brand icons added, semantic tenant-customizable tokens only (no `--md-*` fixed tone), `rounded-full` pill button / `rounded-[20px]` cards, files < 500 lines.
- [ ] **Security preserved (manual):** `googleClientSecret` and `telegramBotToken` stay `type="password"`; `applePrivateKey` stays a `<Textarea>`; no reveal toggle added; the `••••••••` sentinel round-trip still keeps existing secrets on save-without-change and re-encrypts newly typed ones; no secret appears decrypted in the DOM. (Field types/element unchanged per code inspection; live-DOM/round-trip verification is manual, left to the user per plan.)
- [ ] **Functional preservation (manual):** load config, edit fields per provider, Save Config, and the post-save re-mask all still work unchanged. (Left to the user — no dev server permitted per standing rule.)

## Verification

### Automated (run after implementation)
```bash
npx tsc --noEmit
npm run lint
npm run build
```
No dev server may be started for verification (standing rule).

### Manual (user must confirm in-browser — flag explicitly)
Log in as ADMIN (and separately SUPERADMIN) and go to `/admin/settings/social`:
1. **Header/topbar:** topbar reads "Social Auth"; page shows the uppercase "Configuration" eyebrow (brand/primary color) + subtitle; no duplicate large "Social Login (OAuth)" heading.
2. **Card chrome:** three provider cards (Google, Telegram, Apple, in that order), each with a tinted header bar (title + description) divided from a 2-column field body; the "Save Config" button sits below all three; layout intact at `sm`/mobile widths (fields stack to 1 column).
3. **Load config:** if a Google/Telegram/Apple secret is already saved, its field shows the `••••••••` sentinel (dots), NOT the real value. Open devtools and confirm each secret `<input>`/`<textarea>` value is the sentinel (or empty), never the stored secret.
4. **Save without changing a secret:** edit a non-secret field (e.g. Google Client ID), Save Config → toast "Social login settings saved safely"; reload → the change persists AND the previously saved secret is still configured (not wiped) and re-masks to dots.
5. **Change a secret:** type a new value into a secret field, Save Config → succeeds; reload → the field shows dots again (the new plaintext is not echoed back).
6. **Clear a provider:** empty all of one provider's fields, Save → that provider's stored values are cleared (nulled) as before.
7. **Dark theme:** toggle the admin dark theme and confirm the page (cards, header bars, fields, button) reads correctly.

## Constraints & Risks
- **Security-sensitive page.** `googleClientSecret`, `telegramBotToken`, and `applePrivateKey` are encrypted-at-rest secrets. Do NOT change their field `type`/element, do NOT add a reveal toggle, do NOT alter the `••••••••` sentinel or the GET/PATCH/post-save-refetch round-trip. The API route `src/app/api/admin/social-settings/route.ts` is **not edited**.
- **Do NOT modify any form logic:** the Zod `formSchema`, `useForm`/`defaultValues`, `onSubmit`, the mount `useEffect` load, the field bindings, or any `fetch` call. Restyle/relayout only.
- **`page.tsx` is a Server Component:** do NOT add any `<Button>`/`buttonVariants()`; do NOT change the `metadata` export. Only the header block (Step 1) changes.
- **No mockup exists for this page** — apply only the already-approved Settings/Email visual language; do NOT invent new design details (no provider icons, no emoji, no new copy, no new sections beyond the three existing providers).
- **Import direction:** reusing `SettingsSection` from `@/app/admin/settings/FormFields` is a deliberate, accepted minor layering smell (keeps this stage isolated). Do NOT duplicate the component or edit Stage 6/7 files to "fix" layering this stage.
- **Do NOT touch approved Stage 6/7 files** (`src/app/admin/settings/FormFields.tsx`, `SettingsForm.tsx`, `SuperAdminCredentials.tsx`, `settings/page.tsx`, `settings/email/page.tsx`, `EmailSettingsForm.tsx`, `SmtpInstructions.tsx`). `FormFields.tsx` is only *imported from*, never modified.
- **Pre-existing observations (out of scope):**
  - `FormMessage` is imported but unused in `SocialSettingsForm.tsx` (line 16) — pre-existing dead code; leave it (do not remove pre-existing dead code, and do not add `<FormMessage />` — the schema fields are all optional with no validation UI).
  - `social/page.tsx` does not call `auth()` itself (relies on middleware + the API's own role check) — pre-existing; a restyle must not add auth logic. Flagged, not changed.
- **Deferred / out of scope (do not attempt this stage):**
  - `/admin/settings/notifications` (`page.tsx` still uses the old big-`<h1>` pattern) — a separate future stage; do NOT touch.
  - Promoting `SettingsSection` into `src/components/admin/` — possible future cleanup; deferred.
  - Adding provider brand icons or any per-provider enable/disable toggle (no toggle exists today — providers are enabled implicitly by filling keys) — not requested; do NOT add.
  - Client-facing booking flow — later, per admin-first sequencing.

## Critical Files
- `src/app/admin/settings/social/page.tsx` (23) — Server Component; header block only (Step 1); NO `<Button>`/`buttonVariants()`.
- `src/components/admin/SocialSettingsForm.tsx` (249) — primary target; three `<Card>` → `SettingsSection` (Step 2) + Card import cleanup (Step 3); ALL form/API/secret logic untouched.
- `src/app/admin/settings/FormFields.tsx` (143) — source of `SettingsSection` (lines 110-133); **import only, do NOT modify** (approved Stage 6 file).
- `src/components/admin/EmailSettingsForm.tsx` (298) — the Stage-7 precedent for reusing `SettingsSection` in a `src/components/admin` form; reference only, not edited.
- `src/app/api/admin/social-settings/route.ts` (73) — GET masks secrets to `••••••••` (lines 14-23); PATCH `handleSecret` keeps/`encrypt()`s them (lines 37-56); **not edited** — the security contract and a verification checkpoint.
- `src/components/admin/adminNavItems.ts` (line 57) — topbar resolves this route's title to "Social Auth" (why the page `<h1>` is dropped); not modified.
- `src/components/ui/card.tsx`, `src/components/ui/form.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/button.tsx` — existing primitives used by the form; unchanged.
- `src/app/admin/AGENTS.md`, `src/components/AGENTS.md` — conventions (encrypted secrets never rendered decrypted, semantic vs `--md-*` tokens, `buttonVariants()` server-boundary hazard, radius/pill rules, 500-line limit).
