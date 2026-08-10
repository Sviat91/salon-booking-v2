# Plan: configurable theme-toggle icon size

## Goal

Admin can adjust the size of the theme-toggle icon (default + custom-uploaded)
from Settings, without it ever overflowing its slot. The button's outer
footprint (currently 64×64px: `h-12` icon + `p-2` padding) stays **fixed** —
`Header.tsx` sizes its row at `h-16` (64px) around it, and `HomeClient.tsx`
has a comment documenting that other pages' nav-row height is derived from
this exact 64px figure. The new size setting only changes how much of that
fixed 64×64 box the icon fills (icon size ↑ → its own padding ↓), so the
overall box can never grow past what those layouts already reserve.

## Scope

1. **`prisma/schema.prisma`** — add to `TenantConfig`:
   ```prisma
   themeToggleIconSize Int? // px size of the icon inside its fixed 64px button (default 48)
   ```
   Place next to `themeToggleIconUrl`/`darkThemeToggleIconUrl`.
   Then: `npx prisma migrate dev --name add_theme_toggle_icon_size`.

2. **`src/lib/tenant.ts`** — add `themeToggleIconSize: null` to `DEFAULT_CONFIG`
   (matches the existing null-default style of the two icon-url fields next to it).

3. **`src/app/admin/settings/actions.ts`**:
   - Zod schema: `themeToggleIconSize: z.coerce.number().min(32).max(64).default(48),`
     (next to the other `themeToggleIconUrl` fields).
   - `raw` object: `themeToggleIconSize: formData.get("themeToggleIconSize") || 48,`
   - No special null-coalescing needed in the `data` object — it's a plain
     number field, `parsed.data.themeToggleIconSize` goes straight through
     (same as `logoWidth`/`logoHeight`, not like the nullable url fields).

4. **`src/app/admin/settings/page.tsx`** — add to `fullConfig`:
   `themeToggleIconSize: c.themeToggleIconSize as number ?? 48,`
   (same style/position as the other theme-toggle-icon lines).

5. **`src/app/admin/settings/SettingsForm.tsx`**:
   - Add `themeToggleIconSize: number` to the local `TenantConfig` type.
   - Pass `themeToggleIconSize={config.themeToggleIconSize}` as a new prop
     to `<ThemeToggleIconsSection>` (around line 274-278). No new local
     `useState` needed here — unlike logo width/height, nothing else on
     this page needs to read the live value, so it can stay fully local to
     `ThemeToggleIconsSection` (see step 6).

6. **`src/app/admin/settings/ThemeToggleIconsSection.tsx`**:
   - Add prop `themeToggleIconSize: number` to the component signature.
   - Add local state: `const [iconSize, setIconSize] = useState(themeToggleIconSize)`.
   - Add a slider UI block (mirror the existing range-input pattern in
     `LogoEditor.tsx` — `<input type="range" min={32} max={64} step={2} .../>`
     with a `<span>{iconSize}px</span>` label), placed above or below the
     two `ImageUploadField`s. On change: `setIconSize(...)` then call the
     existing `onChange()` prop (marks the form dirty, same as the upload
     handlers already do).
   - Render a hidden input the same way `ImageUploadField` does internally:
     `<input type="hidden" name="themeToggleIconSize" value={iconSize} />`
     so it rides along in the native form submit to `saveSettings`.
   - Label/hint text via new i18n keys (step 8) — follow the existing
     `t('admin.settings.general.themeToggleIconsTitle')` naming convention.

7. **`src/components/ThemeToggle.tsx`** (the public, client-facing component
   used in `Header.tsx`, `HomeClient.tsx`, `PageToolbar.tsx`, `PageRenderer.tsx`,
   `LegalPageHeader.tsx`, `[masterId]/page.tsx`):
   - Add `themeToggleIconSize: number | null` to the local `ThemeToggleConfig`
     type (it's already fetched via `/api/tenant-config`, which returns the
     full config object — no API route change needed).
   - Compute: `const size = config?.themeToggleIconSize ?? 48` (clamp
     defensively to 32-64 in case of bad data, e.g.
     `Math.min(64, Math.max(32, size))`).
   - Compute `const pad = (64 - clampedSize) / 2`.
   - Replace the button's `className="p-2 hover:opacity-80 ..."` padding
     with an inline `style={{ padding: pad }}` (keep the rest of the
     className, drop only `p-2`), so the button's total box always stays
     64×64 regardless of the slider value.
   - On both the custom `<img>` branch and the default `<Image>` branch,
     replace the hardcoded `width={48} height={48} className="h-12 w-12 ..."`
     with the dynamic `clampedSize` (inline `style={{ width: clampedSize,
     height: clampedSize }}` alongside the existing `width`/`height` props
     Next's `<Image>` needs, keep `object-contain`).
   - Do not touch anything else in this file (toggle logic, query, etc.).

8. **Locales** (`src/locales/{pl,en,uk}.json`) — add two keys near the
   existing `themeToggleIconsTitle`/`themeToggleIconsDesc`:
   - `admin.settings.general.themeToggleIconSizeLabel`
   - `admin.settings.general.themeToggleIconSizeHint`
   (short, e.g. PL: "Rozmiar ikony" / "Dopasuj rozmiar ikony w stałym
   przycisku 64×64 px" — match each locale's existing tone for this section;
   EN/UK equivalents.)

## Explicit non-goals

- Do not change `Header.tsx`'s `h-16`, `TopNavLine`, or any of the pixel
  math documented in `HomeClient.tsx`/`PageRenderer.tsx`/`LegalPageHeader.tsx`
  comments — the whole point of this feature is that those stay untouched.
- Do not add a separate size control for light vs dark icon — one shared
  size for both, consistent with how the URL fields already work as a pair
  but render through the same sizing logic in `ThemeToggle.tsx`.
- Do not touch `src/components/ui/theme-toggle.tsx` (the separate
  lucide-icon-based toggle used only in `AdminSidebar.tsx`) — out of scope,
  admin sidebar isn't part of this request.

## Verification

- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- `npx prisma migrate dev` applies cleanly against the dev DB.
- Manual check (report back, don't run a dev server — see project memory
  on this): confirm the slider persists across a save/reload, and confirm
  by reading the rendered JSX logic that button footprint math holds for
  size=32 and size=64 (padding 16px and 0px respectively, both summing to
  64px total with the icon).
