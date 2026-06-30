# Plan: Restore Admin Color Customization + Reset to M3 Defaults

**Date:** 2026-06-30
**Status:** In Progress

## Problem
After Part 1, semantic aliases (`--background`, `--card`, `--primary`, etc.) point to `--md-*` tokens directly,
bypassing the DB-injected `--color-*` variables. Admin color customization is broken.

## Solution
1. Restore semantic aliases → `--color-*` (with `--md-*` as CSS fallbacks)
2. Expand `.dark` alias block to use `--color-dark-*` variables
3. Set default `--color-*` values in m3-tokens.css = M3 palette (CSS fallback before DB injection)
4. Update tenant.ts DEFAULT_CONFIG to M3 colors (for fresh deploys)
5. Add "Reset to M3 defaults" buttons in SettingsForm

## DB injection recap (layout.tsx injects to :root)
```
--color-primary    ← config.primaryColor    → form label "Secondary Tint" (hover/accent bg)
--color-secondary  ← config.secondaryColor  → BackgroundSection solid bg color
--color-accent     ← config.accentColor     → form label "Primary Button"
--color-text       ← config.textColor       → "Body Text"
--color-muted      ← config.mutedColor      → "Muted Text"
--color-border     ← config.borderColor     → "Borders"
--color-card       ← config.cardColor       → "Card Background"
--color-success    ← config.successColor
--color-error      ← config.errorColor
--color-dark-bg    ← config.darkBgColor
--color-dark-primary ← config.darkPrimaryColor → "Dark Secondary Tint" (hover)
--color-dark-accent  ← config.darkAccentColor  → "Dark Primary Button"
--color-dark-text    ← config.darkTextColor
--color-dark-muted   ← config.darkMutedColor
--color-dark-border  ← config.darkBorderColor
--color-dark-card    ← config.darkCardColor
```

## M3 color defaults (for DB DEFAULT_CONFIG and Reset button)
```
Light theme:
  primaryColor (secondary tint): #FFF0F1   ← md-surface-container-low
  secondaryColor (page bg):      #FFF8F6   ← md-surface
  accentColor (primary button):  #8B4A58   ← md-primary
  textColor:                     #211A1B   ← md-on-surface
  mutedColor:                    #524344   ← md-on-surface-variant
  borderColor:                   #D8C2C3   ← md-outline-variant
  cardColor:                     #FFF0F1   ← md-surface-container-low
  successColor:                  #21A67A
  errorColor:                    #BA1A1A

Dark theme:
  darkBgColor:      #191112   ← md-surface dark
  darkPrimaryColor: #261E1F   ← md-surface-container dark
  darkAccentColor:  #FFB2B8   ← md-primary dark
  darkTextColor:    #EDE1E1   ← md-on-surface dark
  darkMutedColor:   #D8C2C3   ← md-on-surface-variant dark
  darkBorderColor:  #524344   ← md-outline-variant dark
  darkCardColor:    #211A1B   ← md-surface-container-low dark
```

## Implementation Steps

- [x] **Step 1: Add default `--color-*` to `src/styles/m3-tokens.css`.**
  Append at the end (after existing .dark block):
  ```css
  /* Default --color-* values = M3 palette.
     CSS fallbacks only; layout.tsx DB injection overrides at runtime. */
  :root {
    --color-secondary:    #FFF8F6;
    --color-primary:      #FFF0F1;
    --color-accent:       #8B4A58;
    --color-text:         #211A1B;
    --color-muted:        #524344;
    --color-border:       #D8C2C3;
    --color-card:         #FFF0F1;
    --color-success:      #21A67A;
    --color-error:        #BA1A1A;
  }
  .dark {
    --color-dark-bg:      #191112;
    --color-dark-primary: #261E1F;
    --color-dark-accent:  #FFB2B8;
    --color-dark-text:    #EDE1E1;
    --color-dark-muted:   #D8C2C3;
    --color-dark-border:  #524344;
    --color-dark-card:    #211A1B;
  }
  ```
  Note: DB injection from layout.tsx puts ALL --color-* in :root (including dark-*), so no .dark specificity needed for the defaults — but adding .dark here helps in SSR before hydration.

- [x] **Step 2: Fix `--bg-start`/`--bg-end` at the top of `src/styles/globals.css`.**
  Lines 5-12. Replace:
  ```css
  :root {
    --bg-start: var(--md-primary-container);
    --bg-end: var(--md-surface);
  }
  .dark {
    --bg-start: var(--md-primary-container);
    --bg-end: var(--md-surface);
  }
  ```
  With:
  ```css
  :root {
    --bg-start: var(--color-primary, var(--md-primary-container));
    --bg-end:   var(--color-secondary, var(--md-surface));
  }
  .dark {
    --bg-start: var(--color-dark-primary, var(--md-primary-container));
    --bg-end:   var(--color-dark-bg, var(--md-surface));
  }
  ```

- [x] **Step 3: Rewrite `@layer base { :root { } .dark { } }` in `src/styles/globals.css`.**
  Find the `@layer base { :root {` block (around line 378) and replace its entire content.
  Replace the current `:root` and `.dark` blocks inside `@layer base` with:

  ```css
  @layer base {
    :root {
      /* Semantic aliases → --color-* (DB-customisable) with --md-* as CSS fallbacks */
      --background:             var(--color-secondary, var(--md-surface));
      --foreground:             var(--color-text,      var(--md-on-surface));
      --card:                   var(--color-card,      var(--md-surface-container-low));
      --card-foreground:        var(--color-text,      var(--md-on-surface));
      --popover:                var(--color-card,      var(--md-surface-container-low));
      --popover-foreground:     var(--color-text,      var(--md-on-surface));

      --primary:                var(--color-accent,    var(--md-primary));
      --primary-foreground:     #FFFFFF;

      --secondary:              var(--color-primary,   var(--md-surface-container-low));
      --secondary-foreground:   var(--color-text,      var(--md-on-surface));
      --muted:                  var(--color-primary,   var(--md-surface-container-high));
      --muted-foreground:       var(--color-muted,     var(--md-on-surface-variant));
      --accent:                 var(--color-primary,   var(--md-primary-container));
      --accent-foreground:      var(--color-text,      var(--md-on-primary-container));

      --border:                 var(--color-border,    var(--md-outline-variant));
      --input:                  var(--color-border,    var(--md-outline-variant));
      --ring:                   var(--color-accent,    var(--md-primary));

      --destructive:            var(--color-error,     var(--md-error));
      --destructive-foreground: #FFFFFF;

      --success:                var(--color-success,   var(--md-success));
      --success-container:      var(--md-success-container);

      --radius: 0.75rem;

      --chart-1: oklch(0.60 0.10 50);
      --chart-2: oklch(0.50 0.08 30);
      --chart-3: oklch(0.70 0.07 75);
      --chart-4: oklch(0.80 0.06 55);
      --chart-5: oklch(0.65 0.09 18);

      --sidebar:                    var(--color-card,   var(--md-surface-container-low));
      --sidebar-foreground:         var(--color-text,   var(--md-on-surface));
      --sidebar-primary:            var(--color-accent, var(--md-primary));
      --sidebar-primary-foreground: #FFFFFF;
      --sidebar-accent:             var(--color-primary,var(--md-primary-container));
      --sidebar-accent-foreground:  var(--color-text,   var(--md-on-primary-container));
      --sidebar-border:             var(--color-border, var(--md-outline-variant));
      --sidebar-ring:               var(--color-accent, var(--md-primary));
    }

    .dark {
      /* Dark semantic aliases → --color-dark-* with --md-* fallbacks */
      --background:             var(--color-dark-bg,      var(--md-surface));
      --foreground:             var(--color-dark-text,    var(--md-on-surface));
      --card:                   var(--color-dark-card,    var(--md-surface-container-low));
      --card-foreground:        var(--color-dark-text,    var(--md-on-surface));
      --popover:                var(--color-dark-card,    var(--md-surface-container-low));
      --popover-foreground:     var(--color-dark-text,    var(--md-on-surface));

      --primary:                var(--color-dark-accent,  var(--md-primary));
      --primary-foreground:     #3B0017;

      --secondary:              var(--color-dark-primary, var(--md-surface-container));
      --secondary-foreground:   var(--color-dark-text,    var(--md-on-surface));
      --muted:                  var(--color-dark-primary, var(--md-surface-container-high));
      --muted-foreground:       var(--color-dark-muted,   var(--md-on-surface-variant));
      --accent:                 var(--color-dark-primary, var(--md-primary-container));
      --accent-foreground:      var(--color-dark-text,    var(--md-on-primary-container));

      --border:                 var(--color-dark-border,  var(--md-outline-variant));
      --input:                  var(--color-dark-border,  var(--md-outline-variant));
      --ring:                   var(--color-dark-accent,  var(--md-primary));

      --destructive:            #FFB4AB;
      --destructive-foreground: #690005;

      --chart-1: oklch(0.70 0.10 50);
      --chart-2: oklch(0.60 0.08 30);
      --chart-3: oklch(0.75 0.07 75);
      --chart-4: oklch(0.82 0.06 55);
      --chart-5: oklch(0.68 0.09 18);

      --sidebar:                    var(--color-dark-card,   var(--md-surface-container-low));
      --sidebar-foreground:         var(--color-dark-text,   var(--md-on-surface));
      --sidebar-primary:            var(--color-dark-accent, var(--md-primary));
      --sidebar-primary-foreground: #3B0017;
      --sidebar-accent:             var(--color-dark-primary,var(--md-primary-container));
      --sidebar-accent-foreground:  var(--color-dark-text,   var(--md-on-primary-container));
      --sidebar-border:             var(--color-dark-border, var(--md-outline-variant));
      --sidebar-ring:               var(--color-dark-accent, var(--md-primary));
    }
  }
  ```

  **Line count check**: The current @layer base block is lines ~378-437 (~60 lines).
  New block is ~70 lines. Net +10. globals.css was 459 lines → ~469. Under 500. ✓

- [x] **Step 4: Update `DEFAULT_CONFIG` in `src/lib/tenant.ts`.**
  Replace the old color defaults with M3 values:
  ```ts
  primaryColor: '#FFF0F1',    // was '#FDE5C3'
  secondaryColor: '#FFF8F6',  // was '#FFF6E9'
  accentColor: '#8B4A58',     // was '#FFBBBD'
  textColor: '#211A1B',       // was '#2B2B2B'
  mutedColor: '#524344',      // was '#6B6B6B'
  borderColor: '#D8C2C3',     // was '#E9E2D6'
  cardColor: '#FFF0F1',       // was '#FFFFFF'
  successColor: '#21A67A',    // unchanged
  errorColor: '#BA1A1A',      // was '#D84E4E'
  darkBgColor: '#191112',     // was '#9c6849'
  darkPrimaryColor: '#261E1F',// was '#FDE5C3'
  darkAccentColor: '#FFB2B8', // was '#FFBBBD'
  darkCardColor: '#211A1B',   // was '#2A2A2A'
  darkTextColor: '#EDE1E1',   // was '#FFFFFF'
  darkMutedColor: '#D8C2C3',  // was '#D0D0D0'
  darkBorderColor: '#524344', // was '#7A4F35'
  bgGradientFrom: '#FFD9DC',  // was '#FDE5C3'
  bgGradientTo: '#FFF8F6',    // was '#FFF6E9'
  darkBgGradientFrom: '#723340', // was '#9c6849'
  darkBgGradientTo: '#191112',   // was '#2A2A2A'
  ```
  Leave all other DEFAULT_CONFIG fields unchanged.

- [x] **Step 5: Add Reset to M3 defaults buttons in `src/app/admin/settings/SettingsForm.tsx`.**

  **5a. Add M3 constants at the top of the component file (after imports):**
  ```ts
  const M3_LIGHT_DEFAULTS = {
    primaryColor:  '#FFF0F1',
    cardColor:     '#FFF0F1',
    accentColor:   '#8B4A58',
    textColor:     '#211A1B',
    mutedColor:    '#524344',
    borderColor:   '#D8C2C3',
  } as const

  const M3_DARK_DEFAULTS = {
    darkBgColor:      '#191112',
    darkPrimaryColor: '#261E1F',
    darkCardColor:    '#211A1B',
    darkAccentColor:  '#FFB2B8',
    darkTextColor:    '#EDE1E1',
    darkMutedColor:   '#D8C2C3',
    darkBorderColor:  '#524344',
  } as const
  ```

  **5b. Add state in SettingsForm component body (after existing state declarations):**
  ```ts
  const [lightReset, setLightReset] = useState(0)
  const [darkReset,  setDarkReset]  = useState(0)
  const [lightColorOverrides, setLightColorOverrides] = useState<Record<string, string> | null>(null)
  const [darkColorOverrides,  setDarkColorOverrides]  = useState<Record<string, string> | null>(null)
  ```

  **5c. Add reset handler functions in component body:**
  ```ts
  function resetLightToM3() {
    setLightColorOverrides(M3_LIGHT_DEFAULTS)
    setLightReset(k => k + 1)
    setIsDirty(true)
  }
  function resetDarkToM3() {
    setDarkColorOverrides(M3_DARK_DEFAULTS)
    setDarkReset(k => k + 1)
    setIsDirty(true)
  }
  ```

  **5d. In the Light Theme section header, add Reset button:**
  Find:
  ```tsx
  <div>
    <h2 className="text-base font-semibold">Light Theme</h2>
    <p className="text-xs text-muted-foreground mt-0.5">
      Colors used when the light theme is active
    </p>
  </div>
  ```
  Replace with:
  ```tsx
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-base font-semibold">Light Theme</h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Colors used when the light theme is active
      </p>
    </div>
    <button
      type="button"
      onClick={resetLightToM3}
      className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
    >
      Reset to M3 defaults
    </button>
  </div>
  ```

  **5e. Add `key` to the light color grid and use overrides:**
  Find:
  ```tsx
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {lightColorFields.map((field) => (
      <ColorRow key={field.name} field={field} defaultValue={config[field.name] as string} />
    ))}
  </div>
  ```
  Replace with:
  ```tsx
  <div key={lightReset} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {lightColorFields.map((field) => (
      <ColorRow
        key={field.name}
        field={field}
        defaultValue={lightColorOverrides?.[field.name as keyof typeof M3_LIGHT_DEFAULTS] ?? config[field.name] as string}
      />
    ))}
  </div>
  ```

  **5f. In the Dark Theme section header, add Reset button:**
  Find:
  ```tsx
  <div>
    <h2 className="text-base font-semibold">Dark Theme Colors</h2>
    <p className="text-xs text-muted-foreground mt-0.5">
      Colors used when the dark theme is active
    </p>
  </div>
  ```
  Replace with:
  ```tsx
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-base font-semibold">Dark Theme Colors</h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Colors used when the dark theme is active
      </p>
    </div>
    <button
      type="button"
      onClick={resetDarkToM3}
      className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
    >
      Reset to M3 defaults
    </button>
  </div>
  ```

  **5g. Add `key` to the dark color grid and use overrides:**
  Find:
  ```tsx
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {darkColorFields.map((field) => (
      <ColorRow key={field.name} field={field} defaultValue={config[field.name] as string} />
    ))}
  </div>
  ```
  Replace with:
  ```tsx
  <div key={darkReset} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {darkColorFields.map((field) => (
      <ColorRow
        key={field.name}
        field={field}
        defaultValue={darkColorOverrides?.[field.name as keyof typeof M3_DARK_DEFAULTS] ?? config[field.name] as string}
      />
    ))}
  </div>
  ```

- [x] **Step 6: Verify.**
  Run `npm run build` — must succeed.
  Run `npm run lint` — no new errors introduced.
  Check line counts: globals.css ≤ 500, m3-tokens.css ≤ 500, SettingsForm.tsx ≤ 500.

## Acceptance Criteria
- [ ] `npm run build` succeeds
- [ ] `npm run lint` — no new errors
- [ ] globals.css ≤ 500 lines
- [ ] m3-tokens.css ≤ 500 lines (was 55, after step 1: ~75)
- [ ] SettingsForm.tsx ≤ 500 lines
- [ ] Semantic aliases use `--color-*` with `--md-*` fallbacks
- [ ] `.dark` block in @layer base has full dark alias set using `--color-dark-*`
- [ ] DEFAULT_CONFIG in tenant.ts has M3 color values
- [ ] "Reset to M3 defaults" button appears in both Light Theme and Dark Theme sections
- [ ] Clicking Reset changes the color inputs in the form (via key-based remount)
- [ ] No out-of-scope files touched

## Files to change
1. `src/styles/m3-tokens.css` — append default --color-* block
2. `src/styles/globals.css` — fix --bg-start/--bg-end + rewrite @layer base aliases
3. `src/lib/tenant.ts` — update DEFAULT_CONFIG colors
4. `src/app/admin/settings/SettingsForm.tsx` — add M3 constants, state, Reset buttons
