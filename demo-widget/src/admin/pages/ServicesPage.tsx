import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { masters } from '../../data'
import AdminCard from '../AdminCard'
import Badge from '../../components/ui/badge'
import ServiceEditSheet, { type EditableService } from './ServiceEditSheet'

type MergedService = {
  id: string
  name: string
  durationMin: number
  price: number
  overrides: { masterName: string; price: number }[]
}

// Real Service records are a single shared catalog (Service model), assigned
// to masters via a many-to-many MasterService join table with an optional
// per-master priceOverride — NOT one separate list per master. This demo's
// underlying data.ts still keeps services on each Master (the public booking
// flow depends on that shape), so this page merges both masters' lists by
// name into one flat catalog for display — matching the real page's actual
// structure (flat table, no per-master grouping, no "Master" column at all —
// the real page doesn't have one either; ownership only shows up as a price
// override badge when two masters charge differently for the "same" service).
function mergeServices(): MergedService[] {
  const byName = new Map<string, MergedService>()
  for (const master of masters) {
    for (const s of master.services) {
      const existing = byName.get(s.name)
      if (!existing) {
        byName.set(s.name, { id: s.id, name: s.name, durationMin: s.durationMin, price: s.price, overrides: [] })
      } else if (existing.price !== s.price) {
        existing.overrides.push({ masterName: master.name, price: s.price })
      }
    }
  }
  return Array.from(byName.values())
}

export default function ServicesPage() {
  const services = mergeServices()
  const [editTarget, setEditTarget] = useState<EditableService | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Services</p>
          <p className="mt-1 text-sm text-muted-foreground">Shared catalog — every service offered by any master.</p>
        </div>
        <button
          onClick={() => {
            setEditTarget({ id: 'new', name: '', durationMin: 60, price: 0 })
            setSheetOpen(true)
          }}
          className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      <AdminCard>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Name</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Duration</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Price</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Special Prices</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {services.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.durationMin} min</td>
                <td className="px-4 py-3 text-muted-foreground">{s.price.toFixed(2)} zł</td>
                <td className="px-4 py-3">
                  {s.overrides.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {s.overrides.map((o) => (
                        <Badge key={o.masterName} variant="muted" className="text-[11px]">
                          {o.masterName}: {o.price.toFixed(2)} zł
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditTarget(s)
                        setSheetOpen(true)
                      }}
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
            ))}
          </tbody>
        </table>
      </AdminCard>

      <ServiceEditSheet open={sheetOpen} service={editTarget} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
