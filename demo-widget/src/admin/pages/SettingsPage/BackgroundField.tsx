import { Upload, ImageIcon } from 'lucide-react'

const tabs = ['Solid', 'Gradient', 'Picture']

// Structural, inert port of BackgroundSection.tsx — the tab pill is shown
// for visual fidelity (Picture pre-selected) but isn't clickable, matching
// the "background-image upload field, disabled" scope for this section.
export default function BackgroundField() {
  return (
    <div className="grid gap-3">
      <span className="text-sm text-muted-foreground">Page Background</span>
      <div className="inline-flex w-fit rounded-lg border border-border bg-card p-0.5">
        {tabs.map((tab) => (
          <span
            key={tab}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'Picture' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-28 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          None
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
      <p className="text-xs text-muted-foreground">Image will be centered and cover the full page background.</p>
    </div>
  )
}
