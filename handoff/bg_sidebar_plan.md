# Plan: Dark Theme Background + Button Fix + Sidebar Save Button

## Context

Three fixes required:
1. Separate background config for each theme (light gets Solid/Gradient/Picture, dark gets its own)
2. Fix toggle button styling — active button looks like dark pill on beige, should match card colors
3. Move Save button to sidebar above the user info divider, disable it when form is unchanged

---

## Fix 1: Dark theme background — DB + schema + layout

### `prisma/schema.prisma`
Add after `bgApplyToDark` line:
```prisma
darkBgType        String   @default("solid")
darkBgImageUrl    String?
darkBgGradientFrom String  @default("#9c6849")
darkBgGradientTo  String   @default("#2A2A2A")
darkBgGradientAngle Int    @default(135)
```
Keep `bgApplyToDark` field as-is (just unused going forward).

### New migration: `prisma/migrations/20260623000003_add_dark_bg/migration.sql`
```sql
ALTER TABLE "TenantConfig" ADD COLUMN "darkBgType" TEXT NOT NULL DEFAULT 'solid';
ALTER TABLE "TenantConfig" ADD COLUMN "darkBgImageUrl" TEXT;
ALTER TABLE "TenantConfig" ADD COLUMN "darkBgGradientFrom" TEXT NOT NULL DEFAULT '#9c6849';
ALTER TABLE "TenantConfig" ADD COLUMN "darkBgGradientTo" TEXT NOT NULL DEFAULT '#2A2A2A';
ALTER TABLE "TenantConfig" ADD COLUMN "darkBgGradientAngle" INTEGER NOT NULL DEFAULT 135;
```
Run: `DATABASE_URL="file:./prisma/app.db" npx prisma migrate deploy && DATABASE_URL="file:./prisma/app.db" npx prisma generate`

### `src/lib/tenant.ts`
Add to DEFAULT_CONFIG:
```ts
darkBgType: 'solid',
darkBgImageUrl: null,
darkBgGradientFrom: '#9c6849',
darkBgGradientTo: '#2A2A2A',
darkBgGradientAngle: 135,
```

### `src/app/layout.tsx`
Replace the gradient/picture style blocks with theme-aware versions:

```tsx
{/* Light theme bg override */}
{(config as any).bgType !== 'solid' && (() => {
  const cfg = config as any
  if (cfg.bgType === 'gradient') {
    return (
      <style dangerouslySetInnerHTML={{
        __html: `html:not(.dark) body, html:not(.dark) { background: linear-gradient(${cfg.bgGradientAngle}deg, ${cfg.bgGradientFrom}, ${cfg.bgGradientTo}) fixed !important; } html:not(.dark) body::before { display: none !important; }`
      }} />
    )
  }
  if (cfg.bgType === 'picture' && cfg.bgImageUrl) {
    return (
      <style dangerouslySetInnerHTML={{
        __html: `html:not(.dark) body { background: url('${cfg.bgImageUrl}') center/cover no-repeat fixed !important; } html:not(.dark) body::before { display: none !important; }`
      }} />
    )
  }
  return null
})()}
{/* Dark theme bg override */}
{(config as any).darkBgType !== 'solid' && (() => {
  const cfg = config as any
  if (cfg.darkBgType === 'gradient') {
    return (
      <style dangerouslySetInnerHTML={{
        __html: `.dark body, .dark html { background: linear-gradient(${cfg.darkBgGradientAngle}deg, ${cfg.darkBgGradientFrom}, ${cfg.darkBgGradientTo}) fixed !important; } .dark body::before { display: none !important; }`
      }} />
    )
  }
  if (cfg.darkBgType === 'picture' && cfg.darkBgImageUrl) {
    return (
      <style dangerouslySetInnerHTML={{
        __html: `.dark body { background: url('${cfg.darkBgImageUrl}') center/cover no-repeat fixed !important; } .dark body::before { display: none !important; }`
      }} />
    )
  }
  return null
})()}
```

### `src/app/admin/settings/actions.ts`
Add to SettingsSchema:
```ts
darkBgType:          z.string().optional().default('solid'),
darkBgImageUrl:      z.string().optional().default(''),
darkBgGradientFrom:  hexColor.default('#9c6849'),
darkBgGradientTo:    hexColor.default('#2A2A2A'),
darkBgGradientAngle: z.coerce.number().min(0).max(360).default(135),
```
Add to `raw` object: extract these 5 fields from formData.
Add to `data` object: include all 5 (darkBgImageUrl: empty string → null).

---

## Fix 2: BackgroundSection — prefix prop + button style fix

### `src/app/admin/settings/BackgroundSection.tsx`

Add `prefix` prop (default `''`). Used to namespace form input names for dark theme:
```tsx
export default function BackgroundSection({ config, onBgImageUpload, prefix = '' }: {
  config: BgConfig
  onBgImageUpload: (url: string) => void
  prefix?: string
}) {
  // Helper: prefix='' → 'bgType', prefix='dark' → 'darkBgType'
  const n = (field: string) =>
    prefix ? `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` : field
```

Then every `name="bgType"` becomes `name={n('bgType')}`, `name="bgImageUrl"` → `name={n('bgImageUrl')}`, etc.
For dark prefix: `n('bgType')` → `darkBgType`, `n('bgGradientFrom')` → `darkBgGradientFrom`, etc.

**IMPORTANT**: When `prefix='dark'`, the `secondaryColor` hidden input should NOT be rendered (it's a light-theme-only concept). Add a condition: `{!prefix && <input type="hidden" name="secondaryColor" value={solidColor} />}`. Also `bgApplyToDark` hidden input: only render when `!prefix`.

**Button style fix**:
Change the toggle container and button classes:
```tsx
{/* Container: use bg-card + border instead of bg-muted */}
<div className="inline-flex bg-card border border-border rounded-lg p-0.5 w-fit">
  {tabs.map(tab => (
    <button
      key={tab.id}
      type="button"
      onClick={() => setBgType(tab.id)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all outline-none border-0 ${
        bgType === tab.id
          ? 'bg-muted text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```
Key: `bg-card` container (dark in dark mode), `bg-muted` active (slightly different shade), no black pill.

### `src/app/admin/settings/SettingsForm.tsx`
- Add `darkBgType`, `darkBgImageUrl`, `darkBgGradientFrom`, `darkBgGradientTo`, `darkBgGradientAngle` to TenantConfig type
- Add state for dark bg image: `const [darkBgImageUrl, setDarkBgImageUrl] = useState(config.darkBgImageUrl || '')`
- In the Dark Theme Colors section, add a BackgroundSection with `prefix="dark"`:
  ```tsx
  <BackgroundSection
    config={{
      bgType: config.darkBgType || 'solid',
      bgImageUrl: darkBgImageUrl || null,
      bgGradientFrom: config.darkBgGradientFrom || '#9c6849',
      bgGradientTo: config.darkBgGradientTo || '#2A2A2A',
      bgGradientAngle: config.darkBgGradientAngle ?? 135,
      secondaryColor: config.darkBgColor || '#724b27',
      bgApplyToDark: false,
    }}
    onBgImageUpload={(url) => setDarkBgImageUrl(url)}
    prefix="dark"
  />
  ```
  Place it as the FIRST element in the Dark Theme Colors section (before the dark color grid).
- Give form element an ID: `<form id="settings-form" action={formAction}>` 
- Add dirty tracking: `const [isDirty, setIsDirty] = useState(false)`
  - On any `onChange` in inputs that control component state (bgImageUrl, darkBgImageUrl, logoPositionX etc.), also call `setIsDirty(true)`
  - After `formAction` completes (use `useEffect` on `state.success`): `setIsDirty(false)`
  - Dispatch custom event: `useEffect(() => { document.dispatchEvent(new CustomEvent('settings-dirty', { detail: { isDirty } })) }, [isDirty])`
  - Also dispatch on any native form input change with a capture listener at the form level:
    ```tsx
    // On the form element:
    onChange={() => { setIsDirty(true) }}
    ```
    This catches ALL input changes including native ones.
- Remove the sticky footer from bottom of form. Instead, remove the old `state.error`, `state.success`, and save button from the bottom. Add them back as a simple `<div className="pt-4">` at the bottom (non-sticky), OR keep just error/success there and let the sidebar have the button.
  Actually: Keep a simple non-sticky save button at the bottom of the form too as a backup — just `<SubmitButton />` in a `<div className="pt-6">`. The sidebar button is the primary.

---

## Fix 3: AdminSidebar — Save button

### `src/components/admin/AdminSidebar.tsx`

Add save button above the `border-t` bottom divider. The button:
- Only renders when `pathname.startsWith('/admin/settings')`
- Has `form="settings-form"` attribute
- Is disabled when `!isDirty` (read from custom event state)
- Styled to match nav items visually but clearly "save" action

```tsx
// New state in component:
const [isDirty, setIsDirty] = useState(false)

// New effect:
useEffect(() => {
  const handler = (e: Event) => {
    setIsDirty((e as CustomEvent<{ isDirty: boolean }>).detail.isDirty)
  }
  document.addEventListener('settings-dirty', handler)
  return () => document.removeEventListener('settings-dirty', handler)
}, [])
```

Add `Save` icon import from lucide-react.

Render above the `<div className="border-t border-border px-3 py-3 space-y-2">`:
```tsx
{pathname.startsWith('/admin/settings') && (
  <div className="px-3 pb-2">
    <button
      type="submit"
      form="settings-form"
      disabled={!isDirty}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isDirty
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "text-muted-foreground cursor-not-allowed opacity-50"
      )}
    >
      <Save className="h-4 w-4" />
      Save Settings
    </button>
  </div>
)}
```

---

## File Checklist
- [x] `prisma/schema.prisma` — add 5 dark bg fields
- [x] `prisma/migrations/20260623000003_add_dark_bg/migration.sql` — new migration
- [x] Run migrate deploy + prisma generate
- [x] `src/lib/tenant.ts` — add 5 dark bg defaults
- [x] `src/app/layout.tsx` — split light/dark bg CSS with `:not(.dark)` and `.dark` selectors
- [x] `src/app/admin/settings/actions.ts` — add 5 dark bg fields to schema + raw + data
- [x] `src/app/admin/settings/BackgroundSection.tsx` — add `prefix` prop, fix button styles, conditional secondaryColor/bgApplyToDark inputs
- [x] `src/app/admin/settings/SettingsForm.tsx` — add dark bg state + BackgroundSection in dark block, form ID, dirty tracking, keep simple non-sticky save at bottom
- [x] `src/components/admin/AdminSidebar.tsx` — add Save button with form ID + isDirty state + custom event listener
- [x] `npm run build` — no errors

## Notes
- `n('bgType')` with prefix `''` → `'bgType'` ✓
- `n('bgType')` with prefix `'dark'` → `'dark' + 'B' + 'gType'` = `'darkBgType'` ✓
- `n('bgGradientFrom')` with prefix `'dark'` → `'darkBgGradientFrom'` ✓
- `n('bgImageUrl')` with prefix `'dark'` → `'darkBgImageUrl'` ✓
- `n('bgGradientTo')` with `prefix 'dark'` → `'darkBgGradientTo'` ✓
- `n('bgGradientAngle')` with prefix `'dark'` → `'darkBgGradientAngle'` ✓
