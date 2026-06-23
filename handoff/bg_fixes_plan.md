# Plan: Background UI Fixes + Logo Size + Sticky Save

## Changes Required

### 1. Fix hollow button appearance (BackgroundSection.tsx)
The Solid/Gradient/Picture toggle buttons look hollow due to global `border-color` CSS leaking in.

In `src/app/admin/settings/BackgroundSection.tsx`, change every `<button>` in the tabs map:
```tsx
// OLD
className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${...}`}

// NEW
className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all outline-none ${
  bgType === tab.id
    ? 'bg-card shadow-sm text-foreground'
    : 'text-muted-foreground hover:text-foreground'
}`}
```
The key fix: `outline-none` removes the hollow border. Remove any `border` classes if they appear.

---

### 2. Move Background section into Light Theme Colors block (SettingsForm.tsx)

Currently: standalone `<section>` for Background, then Light Theme Colors, then Dark Theme Colors.

Change to:
- Remove the standalone `<section>` for Background
- Inside the "Light Theme Colors" `<section>`, add `<BackgroundSection>` as the FIRST child (before the color grid)
- The section heading changes to: h2 "Light Theme" + subheading stays same

---

### 3. Add "Apply to dark theme" checkbox (BackgroundSection.tsx + actions.ts + schema + layout)

When `bgType !== 'solid'`, show a checkbox below the gradient/picture controls:
```tsx
{bgType !== 'solid' && (
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={bgApplyToDark}
      onChange={(e) => setBgApplyToDark(e.target.checked)}
      className="accent-primary"
    />
    <span className="text-sm">Also apply to dark theme</span>
  </label>
)}
<input type="hidden" name="bgApplyToDark" value={String(bgApplyToDark)} />
```

Add state: `const [bgApplyToDark, setBgApplyToDark] = useState(config.bgApplyToDark ?? true)`

Add to `BgConfig` type: `bgApplyToDark: boolean`

**DB: `prisma/schema.prisma`** — add after `bgGradientAngle`:
```prisma
bgApplyToDark   Boolean  @default(true)
```

**Migration: `prisma/migrations/20260623000002_add_bg_apply_dark/migration.sql`**:
```sql
ALTER TABLE "TenantConfig" ADD COLUMN "bgApplyToDark" INTEGER NOT NULL DEFAULT 1;
```
Run after creating: `DATABASE_URL="file:./prisma/app.db" npx prisma migrate deploy && DATABASE_URL="file:./prisma/app.db" npx prisma generate`

**`src/lib/tenant.ts`** DEFAULT_CONFIG: add `bgApplyToDark: true`

**`src/app/admin/settings/actions.ts`**:
- SettingsSchema: `bgApplyToDark: z.string().optional().default('true')`
- raw: `bgApplyToDark: formData.get('bgApplyToDark') || 'true'`
- data: `bgApplyToDark: parsed.data.bgApplyToDark === 'true'`

**`src/app/layout.tsx`** — update the bg override styles:

```tsx
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
{(config as any).bgType === 'gradient' && (() => {
  const cfg = config as any
  const applyToDark = cfg.bgApplyToDark !== false
  const selector = applyToDark ? 'body, html' : 'html:not(.dark) body, html:not(.dark)'
  return (
    <style dangerouslySetInnerHTML={{
      __html: `${selector} { background: linear-gradient(${cfg.bgGradientAngle}deg, ${cfg.bgGradientFrom}, ${cfg.bgGradientTo}) fixed !important; } ${applyToDark ? 'body::before' : 'html:not(.dark) body::before'} { display: none !important; }`
    }} />
  )
})()}
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
{(config as any).bgType === 'picture' && (config as any).bgImageUrl && (() => {
  const cfg = config as any
  const applyToDark = cfg.bgApplyToDark !== false
  const selector = applyToDark ? 'body' : 'html:not(.dark) body'
  const beforeSelector = applyToDark ? 'body::before' : 'html:not(.dark) body::before'
  return (
    <style dangerouslySetInnerHTML={{
      __html: `${selector} { background: url('${cfg.bgImageUrl}') center/cover no-repeat fixed !important; } html { background: ${config.secondaryColor}; } ${beforeSelector} { display: none !important; }`
    }} />
  )
})()}
```

---

### 4. Logo size max increase (LogoEditor.tsx)

Change `max={400}` to `max={800}` in TWO places in `src/app/admin/settings/LogoEditor.tsx`:
1. In the inline size slider (inside the `<div className="grid gap-3">` for Logo Size)
2. In the fullscreen header size controls

---

### 5. Sticky Save button (SettingsForm.tsx)

Replace the current save button section at the bottom:
```tsx
// OLD
<div>
  <SubmitButton />
</div>
```

With a sticky footer:
```tsx
<div className="sticky bottom-0 z-10 -mx-1 bg-background/95 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
  {state.error && <p className="text-sm text-destructive">{state.error}</p>}
  {state.success && <p className="text-sm text-green-600 dark:text-green-400">Settings saved.</p>}
  {!state.error && !state.success && <span />}
  <SubmitButton />
</div>
```

Remove the old separate `{state.error && ...}` and `{state.success && ...}` paragraphs that currently appear just before the save button.

---

### 6. Update BackgroundSection props in SettingsForm

When calling `<BackgroundSection>`, pass `bgApplyToDark`:
```tsx
<BackgroundSection
  config={{
    bgType: config.bgType,
    bgImageUrl: bgImageUrl,
    bgGradientFrom: config.bgGradientFrom,
    bgGradientTo: config.bgGradientTo,
    bgGradientAngle: config.bgGradientAngle,
    secondaryColor: config.secondaryColor,
    bgApplyToDark: config.bgApplyToDark,
  }}
  onBgImageUpload={(url) => setBgImageUrl(url)}
/>
```

And add to TenantConfig type in SettingsForm.tsx: `bgApplyToDark: boolean`

---

## File Checklist
- [x] `prisma/schema.prisma` — add `bgApplyToDark`
- [x] `prisma/migrations/20260623000002_add_bg_apply_dark/migration.sql` — new migration
- [x] Run migrate deploy + prisma generate
- [x] `src/lib/tenant.ts` — add default `bgApplyToDark: true`
- [x] `src/app/layout.tsx` — update gradient/picture CSS injection
- [x] `src/app/admin/settings/actions.ts` — add bgApplyToDark
- [x] `src/app/admin/settings/SettingsForm.tsx` — restructure sections, sticky save, pass bgApplyToDark
- [x] `src/app/admin/settings/BackgroundSection.tsx` — fix buttons, add bgApplyToDark checkbox
- [x] `src/app/admin/settings/LogoEditor.tsx` — change max=400 to max=800 (2 places)
- [x] `npm run build` — no errors

## Verification
1. `npm run dev` → `/admin/settings`
2. Background section is now INSIDE Light Theme Colors block
3. Toggle buttons look solid, not hollow
4. Gradient/Picture mode shows "Also apply to dark theme" checkbox
5. Save is sticky at bottom, always visible
6. Logo size slider goes to 800px
7. Save gradient/picture → page background updates correctly
8. Uncheck "apply to dark" → dark mode has original solid background; light mode has gradient/picture
