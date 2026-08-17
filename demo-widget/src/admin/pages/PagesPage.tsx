import { useState } from 'react'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import AdminCard from '../AdminCard'
import Badge from '../../components/ui/badge'
import PageEditSheet, { type EditablePage } from './PageEditSheet'

const ABOUT_PAGE: EditablePage = { title: 'About Us', enabled: true, visibleHome: false, visibleBooking: false }

// Ported from the real PageListClient.tsx table structure (drag handle,
// Title, Slug, Blocks, Visibility, Status, Actions). Real list supports
// drag-to-reorder via dnd-kit — with a single row here there's nothing to
// reorder, but the handle icon is kept for visual fidelity.
export default function PagesPage() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Pages</p>
          <p className="mt-1 text-sm text-muted-foreground">Content pages shown as tabs on the booking site.</p>
        </div>
        <button className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Add Page
        </button>
      </div>

      <AdminCard>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Title</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Slug</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Blocks</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Visibility</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-muted/40 transition-colors">
              <td className="px-2 py-3 text-muted-foreground">
                <GripVertical className="h-4 w-4 cursor-grab" />
              </td>
              <td className="px-4 py-3 font-medium">About Us</td>
              <td className="px-4 py-3 text-muted-foreground">/about</td>
              <td className="px-4 py-3 text-muted-foreground">2</td>
              <td className="px-4 py-3 text-muted-foreground">—</td>
              <td className="px-4 py-3">
                <Badge variant="success">Enabled</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setSheetOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </AdminCard>

      <PageEditSheet open={sheetOpen} page={ABOUT_PAGE} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
