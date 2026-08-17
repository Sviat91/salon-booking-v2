import { ImageIcon } from 'lucide-react'
import SettingsSection from '../../shared/SettingsSection'

// Structural, inert port of the real HomepageWidgetSection.tsx / SingleBlockSlotEditor.tsx.
// The real `allowed` prop is `["photoWidget"]` only, so the type picker
// collapses to a single static value here — no interactive block editor is
// built, matching the same "no full block editor" precedent already set by
// the Pages section's inert "Manage blocks →" (PageEditSheet.tsx).
export default function HomepageWidgetSection() {
  return (
    <SettingsSection
      title="Homepage widget"
      description="Optional photo widget shown at the bottom of the homepage"
    >
      <div className="grid gap-1.5 max-w-xs">
        <span className="text-sm text-muted-foreground">Type</span>
        <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
          Photo widget
        </div>
      </div>

      <div className="grid gap-1.5 max-w-xs">
        <span className="text-sm text-muted-foreground">Widget style</span>
        <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
          Scrolling strip
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm text-muted-foreground">Photos</span>
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground"
            >
              <ImageIcon className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>
    </SettingsSection>
  )
}
