import { useBrand } from '../../../context/BrandContext'

const tabs = ['Solid', 'Gradient', 'Picture']

// Structural, inert port of BackgroundSection.tsx — default tab fixed to
// Solid (matching real component's default bgType), only Solid-tab content
// rendered since the tabs aren't clickable. The light-instance Solid color
// is genuinely live (drives --background via BrandContext's draft/save
// flow), matching the same field (TenantConfig.secondaryColor) that drives
// the light page background in production.
export default function BackgroundField({ dark = false }: { dark?: boolean }) {
  const { draft, updateDraft } = useBrand()
  return (
    <div className="grid gap-3">
      <span className="text-sm text-muted-foreground">Page Background</span>
      <div className="inline-flex w-fit rounded-lg border border-border bg-card p-0.5">
        {tabs.map((tab) => (
          <span
            key={tab}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'Solid' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {tab}
          </span>
        ))}
      </div>
      {!dark && (
        <label className="flex flex-col gap-1.5 max-w-sm">
          <span className="text-sm text-muted-foreground">Background Color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.secondaryColor}
              onChange={(e) => updateDraft({ secondaryColor: e.target.value })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
            />
            <input
              value={draft.secondaryColor}
              onChange={(e) => updateDraft({ secondaryColor: e.target.value })}
              pattern="^#[0-9A-Fa-f]{6}$"
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <span className="text-xs text-muted-foreground">Main background color of pages</span>
        </label>
      )}
    </div>
  )
}
