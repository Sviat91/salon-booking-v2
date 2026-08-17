import { Upload, ImageIcon } from 'lucide-react'
import Switch from '../../shared/Switch'

// Structural, inert port of LogoEditor.tsx / ThemeToggleIconsSection.tsx —
// every control is disabled/static, no upload actually happens and no local
// state is kept (nothing here needs to be interactive to be shown).
function UploadField({ label, hint, dark }: { label: string; hint?: string; dark?: boolean }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-start gap-4">
        <div
          className={`flex h-16 w-32 items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs ${
            dark ? 'border-zinc-600 bg-zinc-900 text-zinc-400' : 'border-border bg-muted/20 text-muted-foreground'
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          {dark ? 'Uses light' : 'None'}
        </div>
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </div>
    </div>
  )
}

function LogoEditorBlock() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">Logo</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Upload logo, set position and visibility</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 min-w-0">
          <UploadField label="Light Theme Logo" hint="PNG with transparent background recommended" />
          <UploadField label="Dark Theme Logo" hint="Optional separate logo for dark mode" dark />

          <div className="grid gap-3">
            <span className="text-sm font-medium text-foreground">Logo Size</span>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Size</span>
                <span className="text-xs font-mono text-muted-foreground">200px</span>
              </div>
              <input
                type="range"
                disabled
                min={50}
                max={800}
                value={200}
                readOnly
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-not-allowed accent-primary opacity-60"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Overlap Setting (Z-Index)</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-muted-foreground cursor-not-allowed">
                <input type="radio" disabled checked readOnly className="accent-primary" />
                <span className="text-sm">Show Above Content (Default)</span>
              </label>
              <label className="flex items-center gap-2 text-muted-foreground cursor-not-allowed">
                <input type="radio" disabled readOnly className="accent-primary" />
                <span className="text-sm">Show Below Content</span>
              </label>
              <div className="ml-5">
                <Switch checked={false} onChange={() => {}} disabled label="Stretch to Full Screen" />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Show on Pages</span>
            <div className="flex flex-wrap gap-4">
              {[
                { label: 'Home Page', checked: true },
                { label: 'Booking Page', checked: true },
                { label: 'Master Profile', checked: false },
              ].map((page) => (
                <label key={page.label} className="flex items-center gap-2 text-muted-foreground cursor-not-allowed">
                  <input type="checkbox" disabled checked={page.checked} readOnly className="h-4 w-4 accent-primary" />
                  <span className="text-sm">{page.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <span className="text-sm font-medium text-foreground">Position Preview</span>
            <p className="text-xs text-muted-foreground">Click or drag on the page layout</p>
          </div>
          <div className="relative h-64 rounded-xl border border-dashed border-border bg-muted/10 overflow-hidden">
            <div className="absolute left-4 top-4 flex h-10 w-20 items-center justify-center rounded border border-border bg-card text-[10px] text-muted-foreground">
              Logo
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeToggleIconsBlock() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Theme Toggle Icon</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Custom icons for the light/dark switch on client-facing pages. Optional — the built-in icons are used when empty.
        </p>
      </div>
      <div className="grid gap-1.5 max-w-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Adjust the icon size within the fixed 64×64px button</span>
          <span className="text-xs font-mono text-muted-foreground">48px</span>
        </div>
        <input
          type="range"
          disabled
          min={32}
          max={64}
          step={2}
          value={48}
          readOnly
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-not-allowed accent-primary opacity-60"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <UploadField label="Toggle Icon (Light Theme)" hint="Shown while the light theme is active." />
        <UploadField label="Toggle Icon (Dark Theme)" hint="Shown while the dark theme is active." dark />
      </div>
    </div>
  )
}

// Rendered inside the existing Brand <Section> in SettingsPage/index.tsx,
// below the live Salon Name field (untouched, not part of this file).
export default function BrandSection() {
  return (
    <div className="flex flex-col gap-8">
      <LogoEditorBlock />
      <UploadField label="Favicon" hint="Small icon shown in the browser tab." />
      <ThemeToggleIconsBlock />
    </div>
  )
}
