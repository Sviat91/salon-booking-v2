# Plan: Three deferred UI fixes (master-list arrows, fake placeholders, image-delete-button clipping)

**Date:** 2026-08-23
**Status:** Complete
**Mode:** LIGHT (orchestrator-authored plan; three small, independent, well-understood fixes, no architectural decisions)

## Goal

Fix three small UI issues reported by the user and deferred earlier this session (recorded in project memory `project_deferred_ui_fixes_2026-08-23.md`). Each is independent — different files, no shared risk — but bundled into one plan since they're all small and from the same reported batch.

---

## Fix 1: Master-list scroll arrows are invisible against the page background

**File:** `src/components/MasterSelector.tsx`

**Root cause:** the hover-revealed prev/next scroll buttons (lines 127 and 236) use `bg-background/60`. `--background` (Tailwind token) resolves to `var(--color-secondary, ...)` in `src/styles/globals.css` (light: line 387; dark: analogous dark mapping) — the exact same CSS variable the page's own base background renders from. So the button's translucent fill is sourced from the same color as the surface it sits on top of, making it blend in almost entirely, especially over gradient/picture backgrounds.

`--card` resolves to `var(--color-card, ...)` — the tenant's dedicated "Background for cards and panels" setting (visible in the theme settings screenshot: "Card Background", currently e.g. `#FFFFFF` for light theme), which exists specifically to contrast against the page background. This is the correct token per the user's own request ("цвет карточки" — card color).

- [x] Change `bg-background/60` → `bg-card/60` in **both** button `className` strings (scroll-left button, line 127; scroll-right button, line 236). Leave everything else in each className unchanged — `hover:bg-secondary` (the hover-highlight state), `backdrop-blur-md`, `text-foreground`, sizing, positioning, opacity/transition classes all stay exactly as they are.
- [x] Do not touch `text-foreground` — `--card-foreground` and `--foreground` resolve to the same underlying color (`--color-text` light / `--color-dark-text` dark) in `globals.css`, so no visual difference and no reason to change it.
- [x] Confirmed via grep this is the only scroll-arrow implementation in the codebase (`bg-background/60` combined with "Scroll left"/"Scroll right" labels appears nowhere else) — no other component needs this fix.

---

## Fix 2: Some settings-form placeholders show real address/phone data instead of generic examples

**Files:** `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`

**Root cause:** four placeholder strings under the `admin.settings.general` namespace (confirmed at line 614/617/620/623 in each locale file) contain specific, real-looking Warsaw address and phone data rather than obviously-fake examples — unlike the neighboring `contactEmailPlaceholder` ("info@salon.pl" / "np. info@salon.pl"), which is already an appropriately generic example. User confirmed this is their own real data left over from development, not intentional example content — a fresh salon install must not show a new owner the original developer's personal info.

- [ ] Replace these four keys in **all three** locale files with obviously-fake, address-book-style example data (keep each locale's own "e.g."-equivalent prefix and language):
  - `salonAddressPlaceholder`:
    - pl: `"np. Kwiatowa 12/3"`
    - en: `"e.g. Kwiatowa 12/3"`
    - uk: `"напр. вул. Квіткова 12/3"`
  - `salonCityPlaceholder`:
    - pl: `"np. 00-001 Warszawa"`
    - en: `"e.g. 00-001 Warszawa"`
    - uk: `"напр. 00-001 Варшава"`
  - `legalAddressPlaceholder`:
    - pl: `"np. Kwiatowa 12/3, 00-001 Warszawa"`
    - en: `"e.g. Kwiatowa 12/3, 00-001 Warszawa"`
    - uk: `"напр. вул. Квіткова 12/3, 00-001 Варшава"`
  - `phoneNumberPlaceholder`:
    - pl: `"np. +48 123 456 789"`
    - en: `"e.g. +48 123 456 789"`
    - uk: `"напр. +48 123 456 789"`
  - `"Kwiatowa"` ("Flower Street") is a deliberately generic, widely-recognized placeholder street name in Polish (the local equivalent of "Main Street"); `00-001` is a placeholder-style low postal code, not a real assigned one; `+48 123 456 789` is a sequential, obviously-fake phone number.
- [x] **Do not touch** `contactEmailPlaceholder` — it is already a generic example (`info@salon.pl`) and out of scope.
- [x] **Do not touch** any other key in these files — this is a scoped content fix on exactly four keys, not a placeholder audit.
- [x] Run `npm run i18n:check` — editing existing keys (not adding/removing any) should keep parity green automatically, but verify.

---

## Fix 3: Background-image delete ("x") button is clipped by its own preview container

**File:** `src/app/admin/settings/BackgroundSection.tsx`

**Root cause:** lines 164-171 —

```tsx
<div className="relative h-16 w-28 rounded-lg border border-border overflow-hidden">
  <img src={bgImagePreview} alt="Background" className="absolute inset-0 h-full w-full object-cover" />
  <button type="button" onClick={() => { setBgImagePreview(null); setBgImageUrl('') }}
    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
    <X className="h-3 w-3" />
  </button>
</div>
```

The delete button is deliberately positioned to poke outward past the corner (`-right-2 -top-2`, i.e. offset outside the box) — a standard "badge" placement. But it's a child of the same `div` that has `overflow-hidden` (needed to clip the `<img>` to the rounded-corner box), so the button's own overflow gets clipped by that same rule, leaving only a barely-visible sliver instead of a clickable circular badge.

- [ ] Restructure so the image-clipping element and the badge-positioning element are no longer the same node: wrap in an outer `relative` div **without** `overflow-hidden`, move `overflow-hidden` (plus the border/rounding) onto an inner div that wraps only the `<img>`, and keep the delete `<button>` as a sibling of that inner div (not a descendant), still positioned `absolute -right-2 -top-2` relative to the outer wrapper:
  ```tsx
  <div className="relative h-16 w-28">
    <div className="h-16 w-28 rounded-lg border border-border overflow-hidden">
      <img src={bgImagePreview} alt="Background" className="absolute inset-0 h-full w-full object-cover" />
    </div>
    <button type="button" onClick={() => { setBgImagePreview(null); setBgImageUrl('') }}
      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
      <X className="h-3 w-3" />
    </button>
  </div>
  ```
  Note the inner div no longer needs `relative` (the `<img>`'s `absolute inset-0` still resolves correctly against it since it's the nearest positioned/sized ancestor via its explicit `h-16 w-28`) — but keep `relative` on it too if there's any doubt; either works, prioritize matching the exact visual result (same image crop/fit, same border/rounding, same badge size/position/color) over a specific markup shape.
- [x] This component is shared between the Light and Dark theme sections (`prefix=''` vs `prefix="dark"` — see `SettingsForm.tsx`), so this single fix covers both automatically. Do not duplicate logic per-theme.
- [x] Do not touch the "no image yet" placeholder branch (the dashed-border `ImageIcon` block) — it has no delete button and is unaffected by this bug.
- [x] Do not touch anything else in this file — the checkbox logic, upload handler, tabs, gradient/solid sections are all unrelated and already correct.

---

## Acceptance Criteria

- [x] Master-list scroll arrows (visible on hover, ≥lg breakpoint, when there are enough masters to overflow) render with a background that visibly contrasts against the page background in both light and dark themes.
- [x] The four replaced locale placeholders no longer contain the original real address/phone data in any of the three locale files; `contactEmailPlaceholder` and every other key are unchanged.
- [x] The background-image delete "x" button is fully visible and fully clickable at its corner position, for both the Light Theme and Dark Theme picture uploads.
- [x] `npm run lint`, `npm run test`, `npm run i18n:check`, `npx tsc --noEmit` all stay clean — no new failures.
- [x] `git diff --stat` shows changes confined to `src/components/MasterSelector.tsx`, `src/locales/{pl,en,uk}.json`, and `src/app/admin/settings/BackgroundSection.tsx` — nothing else.

## Manual verification the user should perform

1. Restart the dev server.
2. Homepage with 4+ masters configured: hover over the master row on a wide (≥lg) screen — the left/right arrow buttons should now be clearly visible against the background, in both light and dark theme.
3. Admin → Settings → General (or wherever salon address/city/legal address/phone live): clear each field and confirm the greyed-out placeholder text now shows generic example data, not real address/phone info — check in all three UI languages.
4. Admin → Settings → Light Theme (and Dark Theme) → Page Background → Picture: upload an image, confirm the red "x" delete badge is fully visible and clickable at the top-right corner of the thumbnail, and clicking it actually removes the image.
