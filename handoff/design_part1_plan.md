# Plan: Material Design 3 — Part 1 (CSS Tokens + Font Swap)
**Date:** 2026-06-30
**Status:** In Progress

## Goal
Replace the current CSS custom-property palette with the new M3 warm-rose token set (light + dark), map shadcn semantic aliases to those tokens, swap the Inter font for Roboto, and repoint the page background gradient — all without touching any component, page, or logic.

## Architecture Decisions

1. **Correct file path.** The task brief says `src/app/globals.css`, but the real global stylesheet is **`src/styles/globals.css`** (imported in `src/app/layout.tsx` line 1 as `'../styles/globals.css'`). There is no `src/app/globals.css`. All globals.css edits target `src/styles/globals.css`.

2. **No `hsl()` wrapper exists — Tailwind needs no color remap.** `tailwind.config.ts` (lines 18-69) references every color as a raw `var(--token)` (e.g. `background: 'var(--background)'`), NOT `hsl(var(--token))`. Therefore the new **hex** values flow through unchanged and **`tailwind.config.ts` requires no color edits**. The risk flagged in the brief (hsl wrapping) does not apply to this codebase.

3. **Tokens split into a separate file to respect the 500-line limit.** globals.css is currently 494 lines. Inlining ~55 lines of `--md-*` tokens would push it past the hard 500-line project limit. Decision: put the raw `--md-*` tokens in a new file **`src/styles/m3-tokens.css`** (~70 lines), imported in `layout.tsx` *before* globals.css. globals.css then only holds the semantic-alias mapping. See "Line-count check" in Acceptance Criteria.

4. **Define semantic aliases ONCE (in `:root`); let `.dark` override only the raw `--md-*` tokens.** Because every alias resolves `var(--md-X)` at use-time, and `.dark` overrides the `--md-X` *values*, the aliases automatically adapt to dark mode. This lets us delete the entire duplicated `.dark { …aliases… }` color block (keeping only the chart oklch overrides, which are not M3-mapped). Cleaner, fewer lines, no light/dark drift.

5. **Decoupling from tenant theming (BEHAVIORAL CHANGE — see Risks).** After this change, shadcn-themed components read hardcoded M3 tokens instead of the DB-injected `--color-*` values. The `<style>` injection in `layout.tsx` (lines 74-141) stays untouched (it is logic / out of scope) but now only feeds the leftover raw `--color-*` consumers (`.btn-*`, `.rdp`, `.text-text` utilities). This is intentional for the new design system; flagged for confirmation.

6. **Font via `next/font` (Roboto), not an external `<link>`.** The codebase already uses `next/font/google` for Inter, so we keep that pattern (matches conventions, no FOUT/layout shift). It is also GDPR-relevant: `next/font` self-hosts the font and avoids leaking user IPs to Google Fonts — important for this GDPR-focused app. We wire Roboto through a CSS variable `--font-sans` + a Tailwind `fontFamily.sans` entry so the spec's `--font-sans` requirement and the existing `font-sans` utility both resolve to Roboto.

## Implementation Steps

- [x] **Step 1: Create `src/styles/m3-tokens.css`** with raw M3 tokens.
  - Files: `src/styles/m3-tokens.css` (NEW)
  - Details: Plain CSS (no `@layer`). Define `:root { … light --md-* … }` then `.dark { … dark --md-* … }`. Use this exact content:
    ```css
    /* Material Design 3 — raw tonal tokens (warm rose). Consumed by semantic aliases in globals.css. */
    :root {
      --md-primary: #8B4A58;
      --md-on-primary: #FFFFFF;
      --md-primary-container: #FFD9DC;
      --md-on-primary-container: #3B0017;
      --md-secondary: #7C5A47;
      --md-on-secondary: #FFFFFF;
      --md-secondary-container: #FFDCCA;
      --md-on-secondary-container: #2F1509;
      --md-tertiary: #7A5900;
      --md-on-tertiary: #FFFFFF;
      --md-tertiary-container: #FFDFA3;
      --md-on-tertiary-container: #271900;
      --md-error: #BA1A1A;
      --md-on-error: #FFFFFF;
      --md-error-container: #FFDAD6;
      --md-on-error-container: #410002;
      --md-success: #21A67A;
      --md-success-container: #B7F2DC;
      --md-surface: #FFF8F6;
      --md-on-surface: #211A1B;
      --md-surface-variant: #F4DDDE;
      --md-on-surface-variant: #524344;
      --md-outline: #857374;
      --md-outline-variant: #D8C2C3;
      --md-surface-container-lowest: #FFFFFF;
      --md-surface-container-low: #FFF0F1;
      --md-surface-container: #F9E9EA;
      --md-surface-container-high: #F3E3E4;
      --md-surface-container-highest: #EDE1E1;
    }
    .dark {
      --md-primary: #FFB2B8;
      --md-on-primary: #561D2A;
      --md-primary-container: #723340;
      --md-on-primary-container: #FFD9DC;
      --md-secondary: #FFBBA0;
      --md-on-secondary: #4A2F1E;
      --md-secondary-container: #634432;
      --md-on-secondary-container: #FFDCCA;
      --md-error: #FFB4AB;
      --md-on-error: #690005;
      --md-surface: #191112;
      --md-on-surface: #EDE1E1;
      --md-surface-variant: #524344;
      --md-on-surface-variant: #D8C2C3;
      --md-outline: #A08C8D;
      --md-outline-variant: #524344;
      --md-surface-container-lowest: #130D0E;
      --md-surface-container-low: #211A1B;
      --md-surface-container: #261E1F;
      --md-surface-container-high: #312829;
      --md-surface-container-highest: #3C3233;
    }
    ```
  - Note: The dark scheme intentionally omits `tertiary*`, `error-container`/`on-error-container`, and `success*` (the spec did not provide dark values). These are NOT referenced by any semantic alias, so in dark mode they harmlessly fall back to their light values. Do not invent hex values for them in this part.

- [x] **Step 2: Import the token file before globals.css in `src/app/layout.tsx`.**
  - Files: `src/app/layout.tsx`
  - Details: At the very top, change line 1 region so the import order is:
    ```ts
    import '../styles/m3-tokens.css'
    import '../styles/globals.css'
    ```
    (Add the `m3-tokens.css` import immediately above the existing globals.css import. Import order guarantees tokens load first; var resolution is order-independent anyway, but keep it tidy.)

- [x] **Step 3: Swap Inter → Roboto in `src/app/layout.tsx`.**
  - Files: `src/app/layout.tsx`
  - Details:
    - Line 4: replace `import { Inter } from 'next/font/google'` with `import { Roboto } from 'next/font/google'`.
    - Line 12: replace `const inter = Inter({ subsets: ['latin'] })` with:
      ```ts
      const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700'], variable: '--font-sans', display: 'swap' })
      ```
    - Line 55: change `<html lang="pl" className={cn("font-sans")}>` to `<html lang="pl" className={cn(roboto.variable, "font-sans")}>`.
    - Line 148: change `<body className={inter.className}>` to `<body>` (the font now cascades from `html` via the `font-sans` utility + `--font-sans` variable). Remove the now-orphaned `inter` reference entirely.
  - Constraint: do NOT modify the `generateMetadata` block, the theme-init script, the `<style>` tenant-color injection (lines 74-97), or the background-override blocks (lines 99-141). Those are logic / out of scope for Part 1.

- [x] **Step 4: Add `fontFamily.sans` to `tailwind.config.ts` (the ONLY change to this file).**
  - Files: `tailwind.config.ts`
  - Details: Inside `theme.extend` (alongside `colors`, `borderRadius`, etc.), add:
    ```ts
    fontFamily: {
      sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
    },
    ```
  - Do NOT touch the `colors` block — raw `var(--token)` already works with the new hex values. `borderRadius` already reads `var(--radius)`; no change.

- [x] **Step 5: Repoint the page background gradient + body/html colors in `src/styles/globals.css`.**
  - Files: `src/styles/globals.css`
  - Details:
    - Lines 6-7 (top `:root`): set `--bg-start: var(--md-primary-container);` and `--bg-end: var(--md-surface);` (replacing `--color-primary` / `--color-secondary`).
    - Lines 10-13 (top `.dark`): set `--bg-start: var(--md-primary-container);` and `--bg-end: var(--md-surface);` (under `.dark` these resolve to the dark token values automatically; replacing `--color-dark-primary` / `--color-dark-bg`).
    - Line 26 (`body`): change `color: var(--color-text);` to `color: var(--foreground);`.
    - Line 39 (base `body::before`): replace the gradient with the spec value:
      ```css
      background: radial-gradient(ellipse 140% 55% at 15% -5%, var(--bg-start) 0%, var(--bg-end) 58%) !important;
      ```
    - Lines 67-70 (`.dark body`): change `color: var(--color-dark-text);` to `color: var(--foreground);` and `background-color: var(--color-dark-bg);` to `background-color: var(--bg-end);`.
    - Lines 72-85 (`.dark body::before` desktop + 1024px + 640px variants): replace each `var(--color-dark-primary, var(--color-primary))` with `var(--bg-start)` and each `var(--color-dark-bg)` with `var(--bg-end)`.
  - Leave the light responsive gradient variants (lines 44-48, 61-65) as-is: they already reference `--bg-start`/`--bg-end`, so they inherit M3 colors automatically. Only geometry stays.

- [x] **Step 6: Rewrite the semantic-alias `:root` block (M3 mapping) in `src/styles/globals.css`.**
  - Files: `src/styles/globals.css`
  - Details: Replace the body of the `@layer base { :root { … } }` block (lines 380-429) with the M3 alias mapping below. Keep it inside the existing `@layer base`:
    ```css
    :root {
      /* Semantic aliases → M3 tokens (auto-adapt to dark via --md-* overrides) */
      --background:             var(--md-surface);
      --foreground:             var(--md-on-surface);
      --card:                   var(--md-surface-container-low);
      --card-foreground:        var(--md-on-surface);
      --popover:                var(--md-surface-container-low);
      --popover-foreground:     var(--md-on-surface);

      --primary:                var(--md-primary);
      --primary-foreground:     var(--md-on-primary);

      --secondary:              var(--md-secondary-container);
      --secondary-foreground:   var(--md-on-secondary-container);
      --muted:                  var(--md-surface-container-high);
      --muted-foreground:       var(--md-on-surface-variant);
      --accent:                 var(--md-primary-container);
      --accent-foreground:      var(--md-on-primary-container);

      --border:                 var(--md-outline-variant);
      --input:                  var(--md-outline-variant);
      --ring:                   var(--md-primary);

      --destructive:            var(--md-error);
      --destructive-foreground: var(--md-on-error);

      --success:                var(--md-success);
      --success-container:      var(--md-success-container);

      --radius: 0.75rem;

      /* Charts — kept (not part of M3 spec) */
      --chart-1: oklch(0.60 0.10 50);
      --chart-2: oklch(0.50 0.08 30);
      --chart-3: oklch(0.70 0.07 75);
      --chart-4: oklch(0.80 0.06 55);
      --chart-5: oklch(0.65 0.09 18);

      /* Sidebar → M3 */
      --sidebar:                    var(--md-surface-container-low);
      --sidebar-foreground:         var(--md-on-surface);
      --sidebar-primary:            var(--md-primary);
      --sidebar-primary-foreground: var(--md-on-primary);
      --sidebar-accent:             var(--md-primary-container);
      --sidebar-accent-foreground:  var(--md-on-primary-container);
      --sidebar-border:             var(--md-outline-variant);
      --sidebar-ring:               var(--md-primary);
    }
    ```
  - Notes: `--radius` changes `0.625rem` → `0.75rem` (M3 medium). `--destructive` was oklch; it now maps to `--md-error`. `--sidebar-*` and `--chart-*` are not in the M3 brief but are referenced by `tailwind.config.ts` (lines 52-68) and must remain defined — sidebar is remapped to M3, charts are kept as-is.

- [x] **Step 7: Slim the `.dark` semantic block in `src/styles/globals.css` to chart overrides only.**
  - Files: `src/styles/globals.css`
  - Details: Replace the body of the `@layer base { .dark { … } }` block (lines 432-471) with only the dark chart oklch values; every other token now adapts automatically via the `--md-*` overrides in `m3-tokens.css`:
    ```css
    .dark {
      /* Only charts differ in dark; all M3-mapped tokens adapt via --md-* overrides */
      --chart-1: oklch(0.70 0.10 50);
      --chart-2: oklch(0.60 0.08 30);
      --chart-3: oklch(0.75 0.07 75);
      --chart-4: oklch(0.82 0.06 55);
      --chart-5: oklch(0.68 0.09 18);
    }
    ```

- [x] **Step 8: Verify, do NOT add automated tests.** This part is pure CSS/font tokens — there is no unit-testable logic. Verification is build + lint + manual visual check (see Acceptance Criteria). Run `npm run lint` (zero-warning policy) and `npm run build` to confirm nothing breaks.

## Acceptance Criteria
- [ ] `npm run lint` passes with zero warnings; `npm run build` succeeds.
- [ ] No remaining reference to `Inter` / `inter` in `src/app/layout.tsx`.
- [ ] `src/styles/globals.css` stays **under 500 lines** (expected ≈ 464 after Steps 5-7: +3 alias lines in `:root`, ~−33 from the slimmed `.dark` block). `src/styles/m3-tokens.css` ≈ 70 lines.
- [ ] All tokens referenced by `tailwind.config.ts` (`--border --input --ring --background --foreground --primary(-foreground) --secondary(-foreground) --destructive(-foreground) --muted(-foreground) --accent(-foreground) --popover(-foreground) --card(-foreground) --sidebar-* --chart-* --radius`) remain defined — no undefined-variable color regressions.
- [ ] Light mode: page background shows the warm radial gradient `#FFD9DC → #FFF8F6`; surface `#FFF8F6`, text `#211A1B`, primary `#8B4A58`.
- [ ] Dark mode (`.dark`): surface `#191112`, primary `#FFB2B8`, gradient uses dark `--md-*` values.
- [ ] Body/UI renders in Roboto (300/400/500/700 available); `font-sans` utility resolves to Roboto.
- [ ] Follows project conventions (path alias, next/font pattern, 500-line limit).
- [ ] No component `.tsx`, page, or logic file modified (only `layout.tsx` font wiring + the two CSS files + tailwind `fontFamily`).

## Constraints & Risks

**Do NOT touch:**
- Any component under `src/components/**` or any page/route under `src/app/**` (except the font/import edits in `layout.tsx`).
- The tenant-color `<style>` injection and background-override logic in `layout.tsx` (lines 74-141) — logic, out of scope.
- `tailwind.config.ts` `colors` block (works as-is) — only add `fontFamily`.
- The legacy raw `--color-*` consumers in globals.css (`.btn-primary`, `.btn-outline`, `.rdp*`, scrollbar greys, `.text-text`/`.text-muted` utilities) — leave them in this part.

**Risks / things to verify manually:**
1. **Tenant theming is decoupled.** Shadcn-themed components now use hardcoded M3 tokens; the admin appearance/color settings and the recent `BackgroundSection` feature no longer affect them. Confirm this is the intended direction (it is, for the new design system) — the `--color-*` DB injection stays but only drives the leftover legacy consumers above.
2. **Tenant background may hide the new gradient.** `layout.tsx` (lines 99-141) injects `body { background: …!important }` + `body::before { display:none !important }` whenever the DB `bgType` / `darkBgType` is `gradient` or `picture`. If the current `TenantConfig` has a non-`solid` background, the new M3 `body::before` radial will be overridden and won't appear. To see the M3 gradient, the tenant background must be set to `solid` in admin (or the injection logic must be revisited in a later part). Flag for manual check.
3. **Legacy color clash (deferred).** `.btn-*`, `.rdp*`, and `.text-text/.text-muted` utilities still pull tenant `--color-*` values and may visually clash with M3 until refactored in a later part (components). Expected, not a blocker for Part 1.
4. **Dark-token gaps.** `tertiary*`, `error-container*`, `success*` are absent from the M3 dark spec and fall back to light values in dark mode. They are unused by semantic aliases, so this is cosmetic only; no action this part.
5. **`--success` is not a Tailwind color key.** It is defined as a CSS variable but cannot be used via a `bg-success`/`text-success` class unless a `success` entry is later added to `tailwind.config.ts`. Out of scope here (not in the spec's semantic-alias requirements).

**Critical dependency:** Both `m3-tokens.css` and `globals.css` are global stylesheets imported from the root layout — Next.js App Router permits multiple global CSS imports in the root layout, so this is safe. Token resolution is order-independent (custom props resolve at use-time), but keep `m3-tokens.css` imported first for clarity.
