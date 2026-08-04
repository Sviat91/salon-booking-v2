# Plan: Render Turnstile widget in the app's current light/dark theme

**Date:** 2026-08-04
**Status:** In Progress
**Mode:** LIGHT (Cloudflare's `render()` API already supports a `theme` option; purely visual, no security/logic risk)

## Problem

Every Turnstile widget in the app renders with Cloudflare's default theme regardless of the app's own light/dark mode, because none of the 9 `turnstile.render({...})` call sites pass a `theme` option.

## Decision

Add a tiny, framework-free utility that reads the app's current theme the same way `ThemeToggle.tsx` does (`document.documentElement.classList.contains('dark')`), and pass its result as `theme` in every `render()` call. This fixes the theme **at the moment the widget renders** (which is always after the layout's pre-hydration script has already set the `dark` class, so it reads correctly on first paint) — it does **not** make an already-rendered widget live-react to the user toggling theme afterward; that would require a `MutationObserver` + widget reset and is explicitly out of scope per the user's own framing of this request.

## Implementation Steps

- [x] **Step 1: New utility**
  - File: `src/lib/turnstile-theme.ts` (new)
  - ```ts
    export function getTurnstileTheme(): 'light' | 'dark' {
      if (typeof document === 'undefined') return 'light'
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    ```
  - Pure, client-only-safe (guards `typeof document === 'undefined'` for any accidental SSR call), no React import — mirrors the style of other tiny `src/lib/*.ts` utilities in this codebase.

- [x] **Step 2: Wire into all 9 call sites**
  - Files: `src/app/support/page.tsx`, `src/components/DataExportModal.tsx`, `src/components/BookingForm.tsx`, `src/components/DataErasureModal.tsx`, `src/components/ConsentWithdrawalModal.tsx`, `src/components/auth/ForgotPasswordForm.tsx`, `src/components/auth/LoginForm.tsx`, `src/components/auth/RegisterForm.tsx`, `src/components/booking-management/hooks/useTurnstileSession.ts`
  - In each file: `import { getTurnstileTheme } from '@/lib/turnstile-theme'`, then add `theme: getTurnstileTheme(),` to the existing `turnstile.render({ sitekey: siteKey, language: '...', callback: ..., ... })` options object. Do not reorder or otherwise touch the surrounding options (`sitekey`, `language`, `callback`, `error-callback`, `expired-callback` etc. — whatever each file already passes stays exactly as-is).
  - Nothing else in any of these 9 files changes — no new state, no MutationObserver, no re-render-on-toggle logic.

## Acceptance Criteria

- [x] `npm run lint` — zero new warnings/errors
- [x] `npx tsc --noEmit` — clean
- [x] `npm run test` — still green (this is client-side-only rendering code with no existing test coverage of `render()` calls; no test should need changes)
- [x] All 9 files import and use `getTurnstileTheme()`; no file's unrelated logic changed
- [x] `src/lib/turnstile-theme.ts` is a new, pure, framework-free file under 20 lines

## Out of scope

- Live theme-change reactivity for an already-rendered widget (would need `MutationObserver` + `turnstile.reset()`/re-render) — explicitly deferred per the user's own framing.
- Any change to Turnstile's actual verification/security logic (`src/lib/turnstile.ts`, `src/lib/auth-guards.ts`) — purely a visual `render()` option.
