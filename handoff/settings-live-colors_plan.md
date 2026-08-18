# Plan: Make all Light/Dark Theme colors live + Save button

## Context
`demo-widget/` is a frontend-only Vite/React marketing demo that structurally
mirrors the real production admin at `src/app/admin/`. Currently only 2
fields in Settings are genuinely live: Salon Name, and Primary Button /
Dark Primary Button accent colors (via `BrandContext`). Every other color
swatch in "Light Theme" and "Dark Theme Colors" is a static, non-interactive
display. **This is wrong — every color field in both sections must become
genuinely editable, with a Save button (disabled with no changes, enabled
when anything changes) that applies the new colors — exactly matching real
production `src/app/admin/settings/*`.** No architectural decision is
involved here: the real app already defines every part of this (field
names, CSS mapping, defaults, Save-button placement) — this plan is a
direct transcription of real source, not a design exercise.

## Real source facts (verified by reading production source directly)

### CSS variable mapping (from `src/styles/globals.css` `@layer base`)
| TenantConfig field | real UI label | maps to semantic var(s) |
|---|---|---|
| `primaryColor` | "Secondary Tint" | `--secondary`, `--muted`, `--accent` (light) |
| `cardColor` | "Card Background" | `--card` |
| `accentColor` | "Primary Button" | `--primary`, `--ring` |
| `textColor` | "Body Text" | `--foreground`, `--card-foreground`, `--secondary-foreground`, `--accent-foreground` |
| `mutedColor` | "Muted Text" | `--muted-foreground` |
| `borderColor` | "Borders" | `--border` |
| `darkBgColor` | "Dark Background" | `--background` (dark only) |
| `darkPrimaryColor` | "Dark Secondary Tint" | `--secondary`, `--muted`, `--accent` (dark) |
| `darkCardColor` | "Dark Card" | `--card` (dark) |
| `darkAccentColor` | "Dark Primary Button" | `--primary`, `--ring` (dark) |
| `darkTextColor` | "Dark Text" | `--foreground`, `--card-foreground`, etc. (dark) |
| `darkMutedColor` | "Dark Muted Text" | `--muted-foreground` (dark) |
| `darkBorderColor` | "Dark Borders" | `--border` (dark) |

Light theme's page background is driven by a *different* field
(`secondaryColor`, via the separate BackgroundSection, not this grid) — real
`lightColorFields` has 6 entries, `darkColorFields` has 7 (dark includes
`darkBgColor`). Do not invent a "light background" grid field.

### Labels + descriptions (from `src/locales/en.json` → `admin.settings.general.*`, verbatim)
- primaryColor: "Secondary Tint" / "Accent backgrounds, hover states"
- cardColor: "Card Background" / "Background for cards and panels"
- accentColor: "Primary Button" / "Buttons and highlighted elements"
- textColor: "Body Text" / "Main text color"
- mutedColor: "Muted Text" / "Subtitles, placeholders"
- borderColor: "Borders" / "Color of dividers and outlines"
- darkBgColor: "Dark Background" / "Main background in dark theme"
- darkPrimaryColor: "Dark Secondary Tint" / "Accent backgrounds, hover states" (reuses primaryColorDesc)
- darkCardColor: "Dark Card" / "Card / panel background"
- darkAccentColor: "Dark Primary Button" / "Buttons and highlighted elements" (reuses accentColorDesc)
- darkTextColor: "Dark Text" / "Main text on dark background"
- darkMutedColor: "Dark Muted Text" / "Subtitles on dark background"
- darkBorderColor: "Dark Borders" / "Dividers in dark theme"

### Real per-field UI (`src/app/admin/settings/FormFields.tsx`, `ColorRow`)
Label → row of [native `<input type="color">` swatch] + [hex text `<input>`,
validated `^#[0-9A-Fa-f]{6}$`] → description paragraph below.

### Real M3 reset defaults (`src/app/admin/settings/SettingsForm.tsx` lines 22-39)
```
M3_LIGHT_DEFAULTS = { primaryColor: '#FFF0F1', cardColor: '#FFF0F1', accentColor: '#8B4A58', textColor: '#211A1B', mutedColor: '#524344', borderColor: '#D8C2C3' }
M3_DARK_DEFAULTS  = { darkBgColor: '#191112', darkPrimaryColor: '#261E1F', darkCardColor: '#22160f', darkAccentColor: '#FFB2B8', darkTextColor: '#EDE1E1', darkMutedColor: '#D8C2C3', darkBorderColor: '#524344' }
```
Reset marks the form dirty but does NOT auto-save — user must still click Save.

### Real Save button (`src/components/admin/AdminSidebar.tsx` lines 31-39, 112-132)
Lives in the **sidebar nav**, not inside the form. `disabled={!isDirty}`,
filled-primary style when dirty, muted/disabled look otherwise. Real app
uses a `CustomEvent('settings-dirty', ...)` DOM bridge to cross the
server/client component boundary between the form and the sidebar — **do
not port that DOM-event mechanism**, it solves a problem specific to
Next.js's RSC tree that doesn't exist in the demo's plain client-side React
tree. Use ordinary React context instead to get the identical observable
behavior (Save button reacts to dirty state, applies colors on click).

### Confirmed bug to fix (demo-specific, not present in real prod)
`demo-widget/src/lib/brandSettings.ts`'s `applyBrandColors()` currently does
`document.documentElement.style.setProperty('--primary', accent)` where
`accent` is a raw hex string (e.g. `'#b35c37'`). But
`demo-widget/tailwind.config.ts` defines
`primary: { DEFAULT: 'rgb(var(--primary) / <alpha-value>)', ... }`, which
requires `--primary` to hold a **space-separated RGB triplet**
(e.g. `"179 92 55"`), not a hex string — `rgb(#b35c37 / 1)` is invalid CSS.
This has likely been silently broken (transparent/invisible) since it was
built. The RGB-triplet convention was a deliberate fix already made this
session for the Calendar's dark-theme gridlines (same bug class) and is the
demo's established, correct convention (confirmed still in
`demo-widget/src/index.css`'s `:root`/`.dark` blocks). Do **not** copy real
production's approach — production's own `tailwind.config.ts` uses bare
`var(--x)` with no triplet convention, and its own opacity-modifier classes
(`bg-primary/10` etc.) are independently confirmed to be silently broken/
emit zero CSS in production too. Fix: convert hex → `"R G B"` triplet before
writing to the CSS custom property.

## Current demo state (already read in full)
- `demo-widget/src/lib/brandSettings.ts` (36 lines): `BrandSettings = { name, lightAccent, darkAccent }`, `DEFAULT_BRAND = { name: 'Loom & Blade', lightAccent: '#b35c37', darkAccent: '#d0764d' }`, localStorage key `ordiset-demo-brand`.
- `demo-widget/src/context/BrandContext.tsx` (41 lines): `BrandProvider` holds `brand` state, a `useEffect` calling `applyBrandColors(brand)` + a `MutationObserver` watching `.dark` on `<html>` to re-apply on theme toggle (keep this pattern, just fix/expand what gets applied). `updateBrand(next)` currently merges + persists + applies **instantly** — no save-gating.
- `demo-widget/src/index.css`: `:root`/`.dark` already define all needed slots as RGB triplets, and — verified — **the current hardcoded triplet values already exactly match, hex-for-hex, the values currently displayed as static swatches in Settings** (light `--secondary`/`--muted`/`--accent` = `234 236 238` = `#EAECEE` = current "Secondary Tint" display; `--card` = `255 255 255` = `#FFFFFF`; `--primary`/`--ring` = `179 92 55` = `#B35C37` = current live accent; `--foreground` = `26 29 32` = `#1A1D20`; `--muted-foreground` = `108 117 125` = `#6C757D`; `--border` = `226 232 240` = `#E2E8F0`; dark: `121417`→Dark Background, `22262b`→Dark Secondary Tint, `1a1d22`→Dark Card, `d0764d`→Dark Primary Button, `f1f3f5`→Dark Text, `8b95a1`→Dark Muted Text, `2d3239`→Dark Borders). **Use these exact 13 values as the new `DEFAULT_BRAND` seed** — already correct, already displayed, just not wired to real state yet.
- `demo-widget/tailwind.config.ts`: exactly these slots exist, all `rgb(var(--x) / <alpha-value>)` — no `--input`/`--popover`/`--destructive` in the demo; only wire slots that actually exist.
- `demo-widget/src/admin/pages/SettingsPage/index.tsx`: local `Field`/`ColorField`/`EditableColorField`/`ResetToM3` helpers. Light/Dark sections each render `<BackgroundField />` then a 3-col grid of static `ColorField`s, `EditableColorField` only for the 2 accent fields. Salon Name binds directly to `brand.name` — instant-apply, same issue as colors.
- `demo-widget/src/admin/AdminSidebar.tsx`: no Save button yet. Has `section: AdminSection` prop (demo uses local state, not real routing). Rendered twice by `AdminApp.tsx` (desktop aside + mobile drawer), both receiving the same props. Already imports `useBrand()` for `brand.name`.
- Blast radius of `useBrand`/`BrandSettings` consumers (checked): `BrandContext.tsx`, `AdminSidebar.tsx` (only `brand.name`), `SettingsPage/index.tsx`, `Footer.tsx` (only `brand.name`), `brandSettings.ts`. No other file references `lightAccent`/`darkAccent`.

## Out of scope — do not touch
Calendar Settings colors (`availableSlotColor`/`dayOffColor` — confirmed these don't even go through the CSS-variable pipeline in real prod, separate mechanism entirely), Contact Info, Business Hours, Content Languages, Homepage widget, Background field (`secondaryColor`/Solid-Gradient-Picture tabs), Brand's logo/favicon/theme-icon controls, Security section, and the Email/Social Auth/Notifications/Client-bot/Legal Documents pages (none of these get pulled into the save-bridge). The user's complaint was specifically about the Light Theme / Dark Theme Colors sections.

## Changes

### 1. `demo-widget/src/lib/brandSettings.ts`
- [x] Replace `BrandSettings` type with the flat shape mirroring real `TenantConfig` field names:
```ts
export type BrandSettings = {
  name: string
  primaryColor: string
  cardColor: string
  accentColor: string
  textColor: string
  mutedColor: string
  borderColor: string
  darkBgColor: string
  darkPrimaryColor: string
  darkCardColor: string
  darkAccentColor: string
  darkTextColor: string
  darkMutedColor: string
  darkBorderColor: string
}
```
- [x] `DEFAULT_BRAND` = `{ name: 'Loom & Blade', primaryColor: '#EAECEE', cardColor: '#FFFFFF', accentColor: '#B35C37', textColor: '#1A1D20', mutedColor: '#6C757D', borderColor: '#E2E8F0', darkBgColor: '#121417', darkPrimaryColor: '#22262B', darkCardColor: '#1A1D22', darkAccentColor: '#D0764D', darkTextColor: '#F1F3F5', darkMutedColor: '#8B95A1', darkBorderColor: '#2D3239' }` (exact values already used today, listed above).
- [x] Add `M3_LIGHT_DEFAULTS`/`M3_DARK_DEFAULTS` exported consts with the exact real values quoted above.
- [x] Add `function hexToRgbTriplet(hex: string): string` — strips `#`, parses R/G/B as hex byte pairs, returns space-separated decimal string.
- [x] Replace `applyBrandColors` with `applyThemeColors(settings: BrandSettings)`: checks `.dark` on `document.documentElement`, then sets (light) `--foreground, --card, --card-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --border, --primary, --ring` from `textColor/cardColor/textColor/primaryColor/textColor/primaryColor/mutedColor/primaryColor/textColor/borderColor/accentColor/accentColor` respectively (each via `hexToRgbTriplet`), or (dark) `--background, --foreground, --card, --card-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --border, --primary, --ring` from `darkBgColor/darkTextColor/darkCardColor/darkTextColor/darkPrimaryColor/darkTextColor/darkPrimaryColor/darkMutedColor/darkPrimaryColor/darkTextColor/darkBorderColor/darkAccentColor/darkAccentColor`. Do NOT set light `--background` (no live field drives it — leave it at its current fixed CSS default).
- [x] Keep `getBrandSettings`/`saveBrandSettings` as-is (still localStorage-backed, same key), just typed against the new shape.

### 2. `demo-widget/src/context/BrandContext.tsx`
- [x] Add draft/dirty/save state to `BrandContextValue`:
```ts
interface BrandContextValue {
  brand: BrandSettings
  draft: BrandSettings
  isDirty: boolean
  updateDraft: (next: Partial<BrandSettings>) => void
  saveDraft: () => void
}
```
- [x] `draft` state initialized from `brand` (`useState(brand)` at provider init — no need to re-sync on every `brand` change since `saveDraft` is the only thing that changes `brand`, and it resets draft to match at the same time).
- [x] `updateDraft(patch)`: merges into `draft`, sets `isDirty = true`.
- [x] `saveDraft()`: sets `brand = draft` (persists via `saveBrandSettings`, same as today's `updateBrand` body), sets `isDirty = false`.
- [x] Rename the effect's call from `applyBrandColors(brand)` to `applyThemeColors(brand)` (applies committed `brand`, not `draft` — colors only take visual effect after Save, matching real behavior where nothing renders until the form is submitted). Keep the existing `MutationObserver` re-apply-on-`.dark`-toggle pattern unchanged, just calling the renamed function.
- [x] Remove the old `updateBrand` — check its 2 call sites (Salon Name onChange, and the 2 `EditableColorField`s in `SettingsPage/index.tsx`) get migrated to `updateDraft` in step 3below. Confirm no other file calls `updateBrand` (grep before removing).

### 3. `demo-widget/src/admin/pages/SettingsPage/index.tsx`
- [x] Replace the Salon Name input's `value={brand.name}`/`onChange={... updateBrand({name...})}` with `value={draft.name}`/`onChange={... updateDraft({name...})}` (destructure `draft, updateDraft` from `useBrand()` alongside existing `brand, updateBrand` — actually `updateBrand` will no longer exist after step 2, only destructure what's needed: `draft`, `updateDraft`).
- [x] Delete `ColorField` and `EditableColorField` helper functions (fully replaced — but check `ColorField` isn't still used for Calendar Settings' Available Slot/Day Off colors elsewhere in this same file; if it is, keep `ColorField` and only remove `EditableColorField`). — kept `ColorField` (still used by Calendar Settings' Available Slot/Day Off color rows), removed only `EditableColorField`.
- [x] Add a `DraftColorRow` helper component: `{ field, label, description }: { field: keyof BrandSettings; label: string; description: string }` — reads `draft[field]`/calls `updateDraft({ [field]: v })`, renders swatch `<input type="color">` + hex text `<input>` (with the same `^#[0-9A-Fa-f]{6}$` validation pattern as real `ColorRow`) + description paragraph, styled consistently with the rest of this file (rounded-xl/border-border/etc. patterns already used by `Field`/`ColorField` in this file).
- [x] Light Theme section: replace the 6-item static grid with 6 `DraftColorRow`s for `primaryColor` (Secondary Tint), `cardColor` (Card Background), `accentColor` (Primary Button), `textColor` (Body Text), `mutedColor` (Muted Text), `borderColor` (Borders) — using the exact labels/descriptions above.
- [x] Dark Theme Colors section: replace the 7-item static grid with 7 `DraftColorRow`s for `darkBgColor` (Dark Background), `darkPrimaryColor` (Dark Secondary Tint), `darkCardColor` (Dark Card), `darkAccentColor` (Dark Primary Button), `darkTextColor` (Dark Text), `darkMutedColor` (Dark Muted Text), `darkBorderColor` (Dark Borders) — exact labels/descriptions above.
- [x] Update `ResetToM3` button handlers: `onClick={() => updateDraft(M3_LIGHT_DEFAULTS)}` / `onClick={() => updateDraft(M3_DARK_DEFAULTS)}` (import both consts from `brandSettings.ts`), replacing the current accent-only reset.
- [x] `BackgroundField` calls, Contact Info, Business Hours, Languages, Homepage widget, Security — untouched.

### 4. `demo-widget/src/admin/AdminSidebar.tsx`
- [x] Destructure `isDirty, saveDraft` from `useBrand()` alongside existing `brand`.
- [x] Add a Save button block (mirroring real `src/components/admin/AdminSidebar.tsx` lines 112-132 for structure/Tailwind classes), placed at the bottom of the `<nav>` (after the "Back to site" block, before the closing `</nav>`, i.e. above the user/theme footer `<div>`), rendered only when `section === 'settings'`:
```tsx
{section === 'settings' && (
  <div className="mt-4 border-t border-border pt-4">
    <button
      onClick={saveDraft}
      disabled={!isDirty}
      title={!open ? 'Save changes' : undefined}
      className={cn(
        'flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors',
        open ? 'px-3' : 'justify-center px-0',
        isDirty ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground cursor-not-allowed opacity-50'
      )}
    >
      <Save className="h-4 w-4 shrink-0" />
      {open && 'Save changes'}
    </button>
  </div>
)}
```
(adjust placement to fit existing structure cleanly — the existing "Back to site" block already sits inside a `mt-4 border-t` wrapper at the end of `<nav>`; add this as a sibling block after it.) Import `Save` from `lucide-react`.
- [x] No changes needed for the mobile-drawer instance — it's the same component, reused as-is (per existing pattern).

## Verification
- [x] `npm run build` (demo-widget) succeeds with no new errors.
- [x] `grep -rn "lightAccent\|darkAccent\|updateBrand" demo-widget/src/` returns nothing (fully migrated to new field names / `updateDraft`+`saveDraft`) — only substring matches on the new `darkAccentColor` field name remain, which is correct/expected.
- [x] `grep -rn "EditableColorField" demo-widget/src/admin/pages/SettingsPage/index.tsx` returns nothing.
- [ ] Visual (light theme, Settings page): all 6 Light Theme colors show a working color-swatch + hex input + description; changing any of them does NOT immediately restyle the page (draft only); Save button in sidebar becomes enabled; clicking Save restyles the admin panel's card backgrounds/borders/muted text/accent buttons live, no reload.
- [ ] Visual (dark theme, Settings page): same for all 7 Dark Theme Colors fields, including "Dark Background" actually changing the page background after Save.
- [ ] Visual: navigate away from Settings to another section — Save button disappears from the sidebar entirely (only shows on `section === 'settings'`).
- [ ] Visual: with no changes made, Save button renders disabled/muted; after any single field change (including just Salon Name), it becomes enabled.
- [ ] Visual: "Reset to M3 defaults" on each section changes all fields in that section to the M3 values and marks the Save button enabled, without auto-applying until Save is clicked.
- [ ] Confirm Calendar Settings (Available Slot/Day Off), Contact Info, Business Hours, Languages, Homepage widget, Background field, Brand logo/favicon controls, Security all render unchanged and remain inert.
- [ ] Confirm the rest of the admin (nav highlighting, buttons using `bg-primary`/`text-primary`) still renders correctly after a Save with a changed Primary Button color — this is the regression check for the hex/triplet bug fix.

## Status
- [x] Implemented by coder
- [x] Reviewed — APPROVED, 1 minor stale-comment issue fixed directly by orchestrator (see `settings-live-colors_feedback.md`)
- [x] Verified by orchestrator (build clean, diff matches plan exactly across all 4 files)

## Follow-up fix (2026-08-18, same day, Mode: SINGLE — direct edit, no agents)
User caught a real gap after testing: the plan explicitly left light theme's
page-background field (`secondaryColor`, shown as "Background Color" inside
`BackgroundField.tsx`'s light-only Solid tab) inert/out-of-scope, while
dark theme's equivalent ("Dark Background", `darkBgColor`) was already part
of the live 7-field dark grid. This asymmetry was exactly what the user
noticed ("light doesn't change, not clickable... displays differently than
dark"). Fixed by extending the exact same draft/save pattern one field
further:
- `brandSettings.ts`: added `secondaryColor` to `BrandSettings`, seeded
  `DEFAULT_BRAND.secondaryColor = '#F8F9FA'` (matches current `index.css`
  light `--background: 248 249 250`, replacing an inaccurate `#ffffff`
  placeholder from the earlier BackgroundField default-tab fix), wired the
  light branch of `applyThemeColors` to set `--background` from it.
- `BackgroundField.tsx`: light-instance "Background Color" swatch+hex field
  now reads/writes `draft.secondaryColor` via `useBrand()`/`updateDraft`,
  same as every other `DraftColorRow`. Gradient/Picture tabs remain
  non-functional static pill entries, per explicit user instruction not to
  build that out ("сделай просто, чтобы он менялся" — just make the color
  itself change, nothing more).
Build verified clean after the change.

## Follow-up fix #2 (2026-08-18, same day, Mode: SINGLE — direct edit, no agents)
User reported the Save button scrolled out of view and wasn't always
visible, unlike real production. Root cause: the plan's own placement
instruction was wrong — it said to place the Save button block "before the
closing `</nav>`", i.e. *inside* the scrollable `<nav className="flex-1
overflow-y-auto">`, so it scrolled away with the nav list on longer
viewports. Real `src/components/admin/AdminSidebar.tsx` (lines 78-135)
actually renders the Save button as a **sibling of `<nav>`**, between
`</nav>` and the footer `<div>` (user/theme/sign-out block) — outside the
scrollable area entirely, so it's always pinned in place. Fixed by moving
the block in `demo-widget/src/admin/AdminSidebar.tsx` out from inside
`<nav>` to sit right after it, and corrected the wrapper `<div>`'s className
from an invented `mt-4 border-t border-border pt-4` to match real exactly:
`px-3 pb-2` (no top border), button `gap-2` instead of `gap-3` (also
matching real). Build verified clean after the change.
