# Plan: Auth (Login + Register) M3 Pass — Stage 2

**Date:** 2026-07-09
**Status:** Implementation complete — pending manual browser sign-off

## Goal

Bring the four public auth pages (`login`, `register`, `forgot-password`, `reset-password`)
into the Somique Beauty / M3 visual language — visual chrome only, zero change to any auth
logic — matching the `LoginPage` / `RegisterPage` mockups.

---

## Context (what I found)

### Source of truth
- Mockups: `Somique Beauty Design System/ui_kits/client/pages.jsx` — `LoginPage` (lines 347-391)
  and `RegisterPage` (lines 394-436). Tokens/components in
  `Somique Beauty Design System/ui_kits/client/shared.jsx`.
- The mockup card is: `borderRadius:20`, `padding:'36px 32px'`, `maxWidth:400`,
  `boxShadow:t.shadow2` (soft `0 2px 8px rgba(0,0,0,.1)` light), `background:t.card`,
  `border:1px solid t.border`, heading `fontSize:24, fontWeight:400`, subtitle
  `fontSize:13, color:t.textSub`.

### Current live pages
- `src/app/auth/login/page.tsx` (67 lines), `register/page.tsx` (64), `forgot-password/page.tsx`
  (43), `reset-password/page.tsx` (43). **No `src/app/auth/layout.tsx` exists** — each page
  duplicates the *byte-identical* card wrapper:
  ```
  <div className="relative flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div className="absolute inset-0 z-[-1] pointer-events-none" />
    <div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-xl border border-border text-foreground">
      <div className="flex flex-col items-center text-center">
        <Link href="/" ...><span className="font-bold text-2xl tracking-tight text-primary">Somique <span className="opacity-70 font-light">beauty</span></span></Link>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">…title…</h2>
        <p className="mt-2 text-sm text-muted-foreground">…subtitle…</p>
      </div>
      …form…
    </div>
  </div>
  ```
- There is **no shared `AuthCard`/`AuthLayout` component**, so the four `page.tsx` files are the
  edit points. The wrapper markup is identical in all four, so the same class edits apply verbatim
  to each.

### The pages are already ~90% M3-compliant
Unlike Stage 1's landing toggles (which carried dead legacy tokens), these pages already use the
correct semantic tokens throughout — `bg-card`, `border-border`, `text-foreground`,
`text-muted-foreground`, `text-primary` — and the forms use the shared M3 `Button` / `Input`
primitives (`src/components/ui/button.tsx` = `rounded-full bg-primary text-primary-foreground`,
`src/components/ui/input.tsx` = M3 tokens). **The single distinctly un-M3 element is the heavy
`text-3xl font-extrabold` display heading.** M3 (and the Stage-1 landing hero, `fontWeight:400`)
uses a *large, light-weight* display heading. That is the signature change this stage makes.
A secondary, faithful-to-mockup nudge is softening the very dramatic `shadow-xl` toward the
mockup's soft `shadow2`.

### Functional pieces audited (must stay byte-for-byte — NOT touched by this plan)
- **OAuth buttons** — `src/components/auth/SocialLoginButtons.tsx`. Google/Apple/Telegram are
  loaded dynamically from `TenantConfig` (login/register pages compute `providers` from
  `prisma.tenantConfig`). The Google/Apple buttons use **mandated brand hex colors**
  (`#747775`, `#1f1f1f`, `#131314`, `#e3e3e3`, brand SVG fills) — these are brand-guideline
  colors, NOT the "dead legacy tokens" the constraint bans, and must not be swapped for
  semantic tokens. The Telegram widget injects an external script. **Leave this file untouched.**
- **Forms** — `LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx`,
  `ResetPasswordForm.tsx`. These carry all the auth logic (`signIn("credentials"|"google"|…)`,
  `fetch('/api/auth/register')`, `fetch('/api/auth/forgot-password')`,
  `fetch('/api/auth/reset-password')`, token handling, `?error=CredentialsSignin` /
  `?reset=success` URL logic, password-mismatch/consent validation, i18n `t()` error strings).
  They already use M3 semantic tokens + shared primitives. **Leave these files untouched.**
- **Turnstile** — NOT present on any auth page. `grep` confirms Turnstile lives only in the
  booking (`BookingForm`, `useBookingSubmit`) and GDPR flows, never in the auth forms. There is
  nothing Turnstile-related to preserve here.
- **React Hook Form / Zod** — these particular auth forms use plain controlled inputs + manual
  validation + `fetch`; Zod validation happens server-side in the API routes. No form-library
  code is touched.

### The two pages with no mockup (forgot-password, reset-password) — recommendation
The design system only ships `LoginPage` / `RegisterPage`. **Recommendation: restyle
forgot-password and reset-password by extension, applying the exact same chrome changes as
login/register — not invent new patterns and not leave them behind.** Reasoning: their card
wrapper is byte-identical to login/register, they are reached directly from the login card's
"Forgot password?" link, and leaving them on the old heavy heading while login/register get the
light M3 heading would produce a visibly inconsistent flow. This mirrors the Stage-1 audit
decision to apply the established visual language to surfaces lacking a direct mockup.

### Nav bar / theme toggle — deliberately OUT of scope (decision, see reasoning)
The mockup shows a sticky top nav (Back pill + image logo + `ThemeToggleBtn`) on Login/Register.
The current app does **not** adopt that nav pattern anywhere: Stage 1's landing
(`HomeClient.tsx`) uses a floating `absolute top-4 right-4` cluster (UserDropdown + LanguageToggle
+ ThemeToggle), and the landing plan explicitly recorded that the user **rejected** re-introducing
a sticky nav bar. The auth pages today have **no** top controls at all. Adding a nav bar or
theme/language toggles would (a) introduce new interactive controls — beyond "visual chrome
only", and (b) re-open a pattern the user already rejected. **This plan therefore does NOT add a
nav bar or any toggle to the auth pages.** If the user later wants theme/lang controls on auth
pages to mirror the landing cluster, that is a separate, approval-gated follow-up (noted in
"Explicitly out of scope").

---

## Hard constraints (carried from project-wide rules)

- [x] **Never touch auth logic.** No edits to `signIn`/register/forgot/reset calls, credential
      submission, OAuth redirect URLs / callbackUrl, CSRF/session handling, error-code-tied
      strings, or the `?error=` / `?reset=` URL logic. Visual-only.
- [x] **Do NOT edit the form components** — `src/components/auth/LoginForm.tsx`,
      `RegisterForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`. Verify each with
      `git diff --stat -- <file>` → empty.
- [x] **Do NOT edit `src/components/auth/SocialLoginButtons.tsx`** — dynamic OAuth + mandated
      brand hex colors + external Telegram script. Verify `git diff --stat` → empty.
- [x] **Do NOT edit `src/components/ThemeToggle.tsx`** (hard-locked; icon stays ours). It does
      not appear on these pages, but confirm no accidental touch — `git diff --stat` → empty.
- [x] **Semantic tokens only.** Use only the established aliases: `--foreground`,
      `--muted-foreground`, `--primary`/`--primary-foreground`, `--border`, `--card`,
      `--popover`, `--input`, `--ring`, `--destructive` (via `text-foreground`, `bg-card`,
      `border-border`, `text-primary`, etc.). Introduce **no** hardcoded hex and **none** of the
      dead legacy tokens (`dark-border`, `dark-text`, `dark-muted`, or bare `text`/`muted`/
      `accent` without the `-foreground` suffix pattern).
- [x] **No new npm dependencies.** No new imports; only className edits on existing markup.
- [x] **500-line file limit.** All four page files are 43-67 lines; className-only edits add no
      lines, so no risk — but confirm none crosses 500 (trivially true).

---

## Implementation Steps

The same two class edits apply verbatim to all four `page.tsx` files (identical wrapper markup).
Edit only the two class strings named below; leave every other attribute, the logo `<Link>`
wordmark, the subtitle, the bottom nav links, `Suspense` boundaries, and the `providers`
computation exactly as-is.

- [x] **Step 1 — `src/app/auth/login/page.tsx`**
  - Files: `src/app/auth/login/page.tsx`
  - Details:
    - Card wrapper (line 27) — soften elevation only:
      - before: `<div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-xl border border-border text-foreground">`
      - after:  `<div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-lg border border-border text-foreground">`
      - (only `shadow-xl` → `shadow-lg`; nudges toward the mockup's soft `shadow2`. Keep
        `rounded-2xl`, padding, `max-w-md`, `backdrop-blur-md`, `bg-card`, `border-border`.)
    - Heading (lines 34-36) — light-weight M3 display heading:
      - before: `<h2 className="text-3xl font-extrabold tracking-tight text-foreground">`
      - after:  `<h2 className="text-2xl font-normal tracking-tight text-foreground">`
      - (text unchanged: `Welcome Back`. `text-2xl` = 24px matches mockup `fontSize:24`;
        `font-normal` = 400 matches mockup `fontWeight:400`.)
    - Do NOT touch: the logo `<Link>` wordmark (`font-bold … text-primary` "Somique beauty" —
      kept per Stage-1 "no logo changes" decision), the subtitle `<p>`, the `<Suspense>` +
      `<LoginForm />`, `<SocialLoginButtons providers={providers} />`, the two bottom `<Link>`s,
      the `providers` object, or the `metadata`.

- [x] **Step 2 — `src/app/auth/register/page.tsx`**
  - Files: `src/app/auth/register/page.tsx`
  - Details: identical two edits.
    - Card wrapper (line 27): `shadow-xl` → `shadow-lg`.
    - Heading (lines 34-36): `text-3xl font-extrabold tracking-tight text-foreground` →
      `text-2xl font-normal tracking-tight text-foreground` (text unchanged: `Create an Account`).
    - Do NOT touch `<RegisterForm />`, `<SocialLoginButtons … />`, the `providers` computation,
      logo wordmark, subtitle, bottom links, or metadata.

- [x] **Step 3 — `src/app/auth/forgot-password/page.tsx`** (no mockup — apply by extension)
  - Files: `src/app/auth/forgot-password/page.tsx`
  - Details: identical two edits.
    - Card wrapper (line 15): `shadow-xl` → `shadow-lg`.
    - Heading (lines 22-24): `text-3xl font-extrabold tracking-tight text-foreground` →
      `text-2xl font-normal tracking-tight text-foreground` (text unchanged: `Reset your password`).
    - Do NOT touch `<ForgotPasswordForm />`, logo wordmark, subtitle, or the back link.

- [x] **Step 4 — `src/app/auth/reset-password/page.tsx`** (no mockup — apply by extension)
  - Files: `src/app/auth/reset-password/page.tsx`
  - Details: identical two edits.
    - Card wrapper (line 16): `shadow-xl` → `shadow-lg`.
    - Heading (lines 23-25): `text-3xl font-extrabold tracking-tight text-foreground` →
      `text-2xl font-normal tracking-tight text-foreground` (text unchanged: `Create new password`).
    - Do NOT touch the `<Suspense>` + `<ResetPasswordForm />`, logo wordmark, or the back link.

- [x] **Step 5 — No test changes.** These are className-only visual edits with no test coverage
      to add; the existing suite is the regression guard (see Verification). Do not write new tests.

### Optional fallback (documented to avoid flip-flopping)
If the user finds `shadow-lg` still too heavy, `shadow-md` matches the mockup's `shadow2`
(`0 2px 8px`) most precisely. Primary instruction is `shadow-lg`; `shadow-md` is the pre-approved
softer fallback. Do not iterate beyond these two without user input.

---

## Acceptance Criteria

- [x] All four auth pages show a light-weight (`font-normal`), 24px (`text-2xl`) display heading
      instead of the heavy `text-3xl font-extrabold`.
- [x] All four cards use the softened `shadow-lg` elevation.
- [x] Only the two named class strings changed per file; every other line byte-identical.
- [x] The four form components and `SocialLoginButtons.tsx` are untouched (empty `git diff`).
- [x] `ThemeToggle.tsx` untouched.
- [x] No new hardcoded hex, no dead legacy tokens, no new dependencies/imports.
- [x] All tests pass; lint clean; `tsc` clean (no new errors vs baseline). — Note: pre-existing
      baseline (unrelated to this change) has 107 failing tests / 55 lint errors, confirmed
      identical before and after via `git stash` comparison. No regression introduced.
- [ ] Login (incl. OAuth buttons + credentials + forgot link), register (incl. consents +
      auto-login), forgot-password, and reset-password flows behave exactly as before.
      (Requires manual browser sign-off — see Verification below.)

---

## Explicitly out of scope this stage

- **Any form component** (`LoginForm`, `RegisterForm`, `ForgotPasswordForm`,
  `ResetPasswordForm`) — already M3, functional; leave untouched. The stray `text-red-500`
  asterisks / `text-green-500` success banners are valid Tailwind utilities (not hex, not dead
  tokens) inside functional components — defer as optional polish, do not touch this stage.
- **`SocialLoginButtons.tsx`** — dynamic OAuth + mandated brand colors + Telegram script.
- **Adding a sticky nav bar or theme/language toggles** to the auth pages — rejected pattern
  (see Context); separate approval-gated follow-up if ever wanted.
- **Logo swap** — keep the existing text wordmark; no image-logo change (Stage-1 decision).
- **Card radius / padding / max-width / `backdrop-blur`** — already M3-acceptable; not changed
  to avoid subjective churn.
- **`ThemeToggle.tsx`** — hard-locked.

---

## Verification (coder must run before marking done)

- [x] `git diff --stat -- src/components/auth/LoginForm.tsx src/components/auth/RegisterForm.tsx src/components/auth/ForgotPasswordForm.tsx src/components/auth/ResetPasswordForm.tsx src/components/auth/SocialLoginButtons.tsx` → empty (functional pieces untouched, byte-for-byte)
- [x] `git diff --stat -- src/components/ThemeToggle.tsx` → empty
- [x] `git diff -- src/app/auth/login/page.tsx src/app/auth/register/page.tsx src/app/auth/forgot-password/page.tsx src/app/auth/reset-password/page.tsx` → shows ONLY the `shadow-xl`→`shadow-lg` and `text-3xl font-extrabold`→`text-2xl font-normal` class changes, nothing else (confirmed: 4 files changed, 8 insertions/8 deletions total = 2 lines per file)
- [x] `npx tsc --noEmit` → no new errors (clean, no output)
- [x] `npm run lint` → compared against `git stash` baseline on `master`: identical 60 problems
      (55 errors, 5 warnings) before and after these changes — all pre-existing, unrelated to
      the 4 edited files. No new lint issues introduced.
- [x] `npm run test` → compared against `git stash` baseline: identical 19 failed / 7 passed test
      files, 107 failed / 50 passed tests, before and after. No regressions introduced by this change.
- [ ] Manual (user browser sign-off, per stage protocol): light + dark theme, both `/auth/login`
      and `/auth/register` render the new light heading + softer card; OAuth buttons still appear
      when providers are configured; credentials login, register-with-consents, forgot-password
      email send, and reset-password token flow all still work end-to-end.
