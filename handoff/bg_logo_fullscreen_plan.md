# Plan: Background Type Switcher + Logo Fullscreen

## Context
User wants three new features in the admin settings:
1. **Background type switcher** — 3-way toggle on the "Page Background" field: Solid | Gradient | Picture
2. **Background image upload** — custom image as page background (when "Picture" selected)
3. **Logo fullscreen** — when logo layer is "below", option to stretch it to 100vw/100vh as a decorative background

## Architecture Notes
- `TenantConfig` (SQLite) stores all visual config
- CSS vars injected in `src/app/layout.tsx` via `<style>` tag
- `body::before` in `globals.css` renders the current radial-gradient background
- Admin panel suppresses `body::before` via `body:has(.admin-layout)::before { display: none }`
- `LogoDisplay` component fetches config from `/api/tenant-config` and renders on booking page
- `/api/tenant-config` returns the full `getTenantConfig()` result (no explicit field list)

---

## Step 1: Prisma Schema + Migration

**File: `prisma/schema.prisma`** — add 6 fields to `TenantConfig` (after `logoLayer` field):
```prisma
bgType          String   @default("solid")    // "solid" | "gradient" | "picture"
bgImageUrl      String?
bgGradientFrom  String   @default("#FDE5C3")
bgGradientTo    String   @default("#FFF6E9")
bgGradientAngle Int      @default(135)
logoFullscreen  Boolean  @default(false)
```

**Create file: `prisma/migrations/20260623000001_add_bg_logo_fullscreen/migration.sql`**:
```sql
ALTER TABLE "TenantConfig" ADD COLUMN "bgType" TEXT NOT NULL DEFAULT 'solid';
ALTER TABLE "TenantConfig" ADD COLUMN "bgImageUrl" TEXT;
ALTER TABLE "TenantConfig" ADD COLUMN "bgGradientFrom" TEXT NOT NULL DEFAULT '#FDE5C3';
ALTER TABLE "TenantConfig" ADD COLUMN "bgGradientTo" TEXT NOT NULL DEFAULT '#FFF6E9';
ALTER TABLE "TenantConfig" ADD COLUMN "bgGradientAngle" INTEGER NOT NULL DEFAULT 135;
ALTER TABLE "TenantConfig" ADD COLUMN "logoFullscreen" INTEGER NOT NULL DEFAULT 0;
```

After creating: run `npx prisma migrate deploy && npx prisma generate`

---

## Step 2: Update DEFAULT_CONFIG in tenant.ts

**File: `src/lib/tenant.ts`** — add to `DEFAULT_CONFIG`:
```ts
bgType: 'solid',
bgImageUrl: null,
bgGradientFrom: '#FDE5C3',
bgGradientTo: '#FFF6E9',
bgGradientAngle: 135,
logoFullscreen: false,
```

---

## Step 3: Apply background in layout.tsx

**File: `src/app/layout.tsx`** — after the existing CSS vars `<style>` block, add a second `<style>` block:

```tsx
{/* Background override based on bgType */}
{(config as any).bgType === 'gradient' && (
  <style dangerouslySetInnerHTML={{
    __html: `
      body, html { background: linear-gradient(${(config as any).bgGradientAngle}deg, ${(config as any).bgGradientFrom}, ${(config as any).bgGradientTo}) fixed !important; }
      body::before { display: none !important; }
    `
  }} />
)}
{(config as any).bgType === 'picture' && (config as any).bgImageUrl && (
  <style dangerouslySetInnerHTML={{
    __html: `
      body { background: url('${(config as any).bgImageUrl}') center/cover no-repeat fixed !important; }
      html { background: ${config.secondaryColor}; }
      body::before { display: none !important; }
    `
  }} />
)}
```

Note: cast via `(config as any)` because new fields may not be in the TS type yet until prisma generate runs. 
Alternatively: cast the whole config as `Record<string, unknown>` selectively.

---

## Step 4: Update actions.ts (server action)

**File: `src/app/admin/settings/actions.ts`**

Add to `SettingsSchema`:
```ts
bgType:          z.string().optional().default('solid'),
bgImageUrl:      z.string().optional().default(''),
bgGradientFrom:  hexColor.default('#FDE5C3'),
bgGradientTo:    hexColor.default('#FFF6E9'),
bgGradientAngle: z.coerce.number().min(0).max(360).default(135),
logoFullscreen:  z.string().optional().default('false'),
```

Add to `raw` object (inside `saveSettings`):
```ts
bgType:          formData.get('bgType') || 'solid',
bgImageUrl:      formData.get('bgImageUrl') || '',
bgGradientFrom:  formData.get('bgGradientFrom') || '#FDE5C3',
bgGradientTo:    formData.get('bgGradientTo') || '#FFF6E9',
bgGradientAngle: formData.get('bgGradientAngle') || 135,
logoFullscreen:  formData.get('logoFullscreen') || 'false',
```

Add to `data` transform (after `parsed.data`):
```ts
bgImageUrl:    parsed.data.bgImageUrl || null,
logoFullscreen: parsed.data.logoFullscreen === 'true',
```

---

## Step 5: Update SettingsForm.tsx

**File: `src/app/admin/settings/SettingsForm.tsx`**

### 5a. Update TenantConfig type — add new fields:
```ts
bgType:          string
bgImageUrl:      string | null
bgGradientFrom:  string
bgGradientTo:    string
bgGradientAngle: number
logoFullscreen:  boolean
```

### 5b. Remove `secondaryColor` from `lightColorFields` array.
It is currently: `{ name: "secondaryColor", label: "Page Background", description: "Main background color of pages" }`
Remove this entry — it will be handled by the new `BackgroundSection` component.

### 5c. Add `BackgroundSection` component (inline in the same file):

```tsx
function BackgroundSection({ config, onBgImageUpload }: {
  config: Pick<TenantConfig, 'bgType' | 'bgImageUrl' | 'bgGradientFrom' | 'bgGradientTo' | 'bgGradientAngle' | 'secondaryColor'>
  onBgImageUpload: (url: string) => void
}) {
  const [bgType, setBgType] = useState(config.bgType || 'solid')
  const [bgImageUrl, setBgImageUrl] = useState(config.bgImageUrl || '')
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(config.bgImageUrl || null)
  const [bgGradientFrom, setBgGradientFrom] = useState(config.bgGradientFrom)
  const [bgGradientTo, setBgGradientTo] = useState(config.bgGradientTo)
  const [bgGradientAngle, setBgGradientAngle] = useState(config.bgGradientAngle)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const tabs = [
    { id: 'solid', label: 'Solid' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'picture', label: 'Picture' },
  ]

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setBgImageUrl(json.url)
      setBgImagePreview(json.url)
      onBgImageUpload(json.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <Label>Page Background</Label>
      {/* hidden inputs */}
      <input type="hidden" name="bgType" value={bgType} />
      <input type="hidden" name="bgImageUrl" value={bgImageUrl} />
      <input type="hidden" name="bgGradientFrom" value={bgGradientFrom} />
      <input type="hidden" name="bgGradientTo" value={bgGradientTo} />
      <input type="hidden" name="bgGradientAngle" value={bgGradientAngle} />

      {/* 3-way toggle */}
      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBgType(tab.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              bgType === tab.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Solid */}
      {bgType === 'solid' && (
        <ColorRow
          field={{ name: 'secondaryColor', label: 'Background Color', description: 'Main background color' }}
          defaultValue={config.secondaryColor}
        />
      )}

      {/* Gradient */}
      {bgType === 'gradient' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 flex-wrap">
            <div className="grid gap-1.5">
              <Label className="text-xs">From</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={bgGradientFrom} onChange={(e) => setBgGradientFrom(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0" />
                <Input value={bgGradientFrom} pattern="^#[0-9A-Fa-f]{6}$" className="font-mono text-sm w-28"
                  onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setBgGradientFrom(e.target.value) }} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">To</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={bgGradientTo} onChange={(e) => setBgGradientTo(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0" />
                <Input value={bgGradientTo} pattern="^#[0-9A-Fa-f]{6}$" className="font-mono text-sm w-28"
                  onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setBgGradientTo(e.target.value) }} />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Angle</Label>
              <span className="text-xs font-mono">{bgGradientAngle}°</span>
            </div>
            <input type="range" min={0} max={360} value={bgGradientAngle}
              onChange={(e) => setBgGradientAngle(parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
          </div>
          {/* Live preview */}
          <div className="h-12 rounded-lg border border-border"
            style={{ background: `linear-gradient(${bgGradientAngle}deg, ${bgGradientFrom}, ${bgGradientTo})` }} />
        </div>
      )}

      {/* Picture */}
      {bgType === 'picture' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            {bgImagePreview ? (
              <div className="relative h-16 w-28 rounded-lg border border-border overflow-hidden">
                <Image src={bgImagePreview} alt="Background" fill className="object-cover" />
                <button type="button" onClick={() => { setBgImagePreview(null); setBgImageUrl('') }}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                None
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={handleImageUpload} disabled={uploading} />
              <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload'}
              </div>
            </label>
          </div>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          <p className="text-xs text-muted-foreground">Image will be centered and cover the full page background.</p>
        </div>
      )}
    </div>
  )
}
```

### 5d. Add BackgroundSection to form state:
In `SettingsForm`, add state:
```tsx
const [bgImageUrl, setBgImageUrl] = useState(config.bgImageUrl ?? '')
```

### 5e. Add BackgroundSection to form JSX:
Insert as a new section **before** the "Light Theme Colors" section:
```tsx
<section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
  <div>
    <h2 className="text-base font-semibold">Background</h2>
    <p className="text-xs text-muted-foreground mt-0.5">Page background style — solid color, gradient, or image</p>
  </div>
  <BackgroundSection
    config={{
      bgType: config.bgType,
      bgImageUrl: bgImageUrl,
      bgGradientFrom: config.bgGradientFrom,
      bgGradientTo: config.bgGradientTo,
      bgGradientAngle: config.bgGradientAngle,
      secondaryColor: config.secondaryColor,
    }}
    onBgImageUpload={(url) => setBgImageUrl(url)}
  />
</section>
```

### 5f. Pass `logoFullscreen` to `LogoEditor`:
In SettingsForm state: `const [logoFullscreen, setLogoFullscreen] = useState(config.logoFullscreen ?? false)`

In LogoEditor call: add props `logoFullscreen={logoFullscreen}` and `onFullscreenChange={(v) => setLogoFullscreen(v)}`

Add hidden input: `<input type="hidden" name="logoFullscreen" value={String(logoFullscreen)} />`

---

## Step 6: Update LogoEditor.tsx

### 6a. Update `LogoConfig` type — add:
```ts
logoFullscreen: boolean
```

### 6b. Update `LogoEditorProps` — add:
```ts
logoFullscreen: boolean
onFullscreenChange: (v: boolean) => void
```

### 6c. Add toggle in the "Overlap Setting (Z-Index)" section, after the Below radio button, conditionally shown:
```tsx
{config.logoLayer === 'below' && (
  <label className="flex items-center gap-2 cursor-pointer ml-5">
    <input
      type="checkbox"
      checked={config.logoFullscreen}
      onChange={(e) => onFullscreenChange(e.target.checked)}
      className="accent-primary"
    />
    <span className="text-sm">Stretch to Full Screen</span>
  </label>
)}
```

Also add the same toggle in the fullscreen editor modal header (after the Above/Below toggle).

---

## Step 7: Update LogoDisplay.tsx

### 7a. Update `LogoConfig` type — add:
```ts
logoLayer: string
logoFullscreen: boolean
```

### 7b. Update rendering logic:

When `config.logoLayer === 'below' && config.logoFullscreen === true`:
- Render a `fixed inset-0 w-full h-full` container with `z-index: 0` (behind content)
- Use Next.js `Image` with `fill` prop and `objectFit: 'contain'` (so it doesn't distort)
- Show for both light/dark logo variants

When `config.logoLayer === 'below' && !config.logoFullscreen`:
- Current positioning but with `z-[0]` instead of `z-10` (behind content)

When `config.logoLayer === 'above'` (default):
- Current behavior: `z-10`

```tsx
// In the custom logo branch (when config.logoUrl || config.darkLogoUrl):
if (config.logoLayer === 'below' && config.logoFullscreen) {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <div className="relative w-full h-full dark:hidden">
        <Image src={logoSrc} alt={config.brandName} fill className="object-contain" />
      </div>
      <div className="relative w-full h-full hidden dark:block">
        <Image src={darkLogoSrc} alt={config.brandName} fill className="object-contain" />
      </div>
    </div>
  )
}

const zClass = config.logoLayer === 'below' ? 'z-[0]' : 'z-10'
return (
  <div className={`hidden lg:block cursor-pointer ${zClass}`} style={{ position: 'absolute', left: `${config.logoPositionX}%`, top: `${config.logoPositionY}%` }}>
    <Image src={logoSrc} alt={config.brandName} width={config.logoWidth} height={config.logoHeight} className="h-auto dark:hidden" />
    <Image src={darkLogoSrc} alt={config.brandName} width={config.logoWidth} height={config.logoHeight} className="h-auto hidden dark:block" />
  </div>
)
```

---

## Verification

1. Run `npx prisma migrate deploy` — migration applies cleanly
2. Run `npx prisma generate` — client updated
3. Run `npm run build` — no TS errors
4. `npm run dev`:
   - Open `/admin/settings`
   - In Background section: switch to Gradient → pick colors → save → visit home page → confirm gradient appears
   - Switch to Picture → upload image → save → visit home page → confirm image background
   - Switch back to Solid → save → confirm solid color returns
   - In Logo section: set layer to Below → check "Stretch to Full Screen" → save → visit booking page → confirm logo fills screen
   - Uncheck fullscreen → confirm logo returns to positioned mode

## Files changed (summary)
- `prisma/schema.prisma`
- `prisma/migrations/20260623000001_add_bg_logo_fullscreen/migration.sql` (new)
- `src/lib/tenant.ts`
- `src/app/layout.tsx`
- `src/app/admin/settings/actions.ts`
- `src/app/admin/settings/SettingsForm.tsx`
- `src/app/admin/settings/LogoEditor.tsx`
- `src/components/LogoDisplay.tsx`
