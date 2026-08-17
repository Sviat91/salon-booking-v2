import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import AdminCard from '../AdminCard'
import Badge from '../../components/ui/badge'
import DiscountEditSheet, { type EditableDiscount } from './DiscountEditSheet'

type DiscountRow = EditableDiscount & {
  type: 'Automatic' | 'Promo code'
  appliesTo: string
  happyHour: string
  period: string
  active: boolean
}

// The first two rows are the discounts actually live on the public booking
// site (Happy Hours matches the -20% Wed/Thu window in TodayPromoCard/
// computeFinalPrice; SPA Special matches the one service — Deep Nourishing
// Hair SPA Treatment — that's genuinely -15% instead of the blanket -10% in
// data.ts). Welcome Glow demonstrates the promo-code discount type the real
// product supports; it isn't wired into the booking flow's price
// calculation (that only implements the two time/blanket rules). The extra
// requiresCode/scopeMode/windowDays/etc. fields feed the edit Sheet only —
// they're not read by the table itself.
const INITIAL_DISCOUNTS: DiscountRow[] = [
  {
    label: 'Happy Hours -20%', percent: 20, type: 'Automatic', appliesTo: 'All services', happyHour: 'Wed, Thu · 11:00–15:00', period: '—', active: true,
    requiresCode: false, oncePerClient: false, scopeMode: 'all', windowEnabled: true, windowDays: [3, 4], windowStart: '11:00', windowEnd: '15:00',
  },
  {
    label: 'SPA Special', percent: 15, type: 'Automatic', appliesTo: 'Deep Nourishing Hair SPA Treatment', happyHour: '—', period: '—', active: true,
    requiresCode: false, oncePerClient: false, scopeMode: 'selected', scopeServices: ['Deep Nourishing Hair SPA Treatment'], windowEnabled: false,
  },
  {
    label: 'Welcome Glow', percent: 10, type: 'Promo code', code: 'WELCOME10', appliesTo: 'All services', happyHour: '—', period: '—', active: true,
    requiresCode: true, oncePerClient: true, scopeMode: 'all', windowEnabled: false,
  },
]

// "+ Add discount" and the row edit/delete icons are present for visual
// fidelity with the real page, same as the rest of this admin — inert, no
// add/edit/delete actually happens in this demo. The Status badge is the one
// exception: it toggles local component state only, matching the real
// interaction (nothing persists past a refresh).
export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState(INITIAL_DISCOUNTS)
  const [editTarget, setEditTarget] = useState<DiscountRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const toggleActive = (label: string) => {
    setDiscounts((prev) => prev.map((d) => (d.label === label ? { ...d, active: !d.active } : d)))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Manage</p>
          <p className="mt-1 text-sm text-muted-foreground">Percentage discounts applied at booking time</p>
        </div>
        <button className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Add discount
        </button>
      </div>

      <AdminCard>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Label</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Discount</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Applies to</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Happy hour</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Period</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {discounts.map((d) => (
              <tr key={d.label} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 font-medium">{d.label}</td>
                <td className="px-4 py-3 text-muted-foreground">-{d.percent}%</td>
                <td className="px-4 py-3">
                  {d.type === 'Promo code' ? (
                    <Badge variant="warning">Code: {d.code}</Badge>
                  ) : (
                    <Badge variant="muted">Automatic</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{d.appliesTo}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.happyHour}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.period}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => toggleActive(d.label)}>
                    {d.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditTarget(d)
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

      <DiscountEditSheet key={editTarget?.label} open={sheetOpen} discount={editTarget} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
