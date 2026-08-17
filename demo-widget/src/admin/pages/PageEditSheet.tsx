import Sheet from '../shared/Sheet'

export type EditablePage = {
  title: string
  enabled: boolean
  visibleHome: boolean
  visibleBooking: boolean
}

const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'
const checkboxClass = 'h-4 w-4 accent-primary shrink-0 cursor-not-allowed'

// Structural port of PageFormSheet.tsx — title, enabled toggle, visibility
// checklist (PAGE_VISIBILITY_TARGETS: home/booking), and the "Manage blocks"
// link. No block editor is built here (a single real page doesn't need one
// demonstrated); everything is disabled and prefilled with the real row.
export default function PageEditSheet({ open, page, onClose }: { open: boolean; page: EditablePage | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={page ? 'Edit Page' : 'Add Page'}>
      {page && (
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Page Title</label>
            <input disabled defaultValue={page.title} className={fieldClass} />
          </div>

          <label className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <input type="checkbox" disabled defaultChecked={page.enabled} className={checkboxClass} />
            <span className="text-sm font-medium">Enabled</span>
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Show as a tab on</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled defaultChecked={page.visibleHome} className={checkboxClass} />
                Home page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled defaultChecked={page.visibleBooking} className={checkboxClass} />
                Booking page
              </label>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-2 h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <button className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              Manage blocks →
            </button>
            <p className="text-xs text-muted-foreground">Add and reorder the content blocks shown on this page.</p>
          </div>
        </div>
      )}
    </Sheet>
  )
}
