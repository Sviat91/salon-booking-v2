import { useState } from 'react'
import Sheet from '../shared/Sheet'

export type EditableDiscount = {
  label: string
  percent: number
  requiresCode: boolean
  code?: string
  oncePerClient: boolean
  scopeMode: 'all' | 'selected'
  scopeServices?: string[]
  windowEnabled: boolean
  windowDays?: number[]
  windowStart?: string
  windowEnd?: string
  startDate?: string
  endDate?: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'
const checkboxClass = 'h-4 w-4 accent-primary shrink-0 cursor-not-allowed'

// Structural port of DiscountForm.tsx + DiscountScopeFields.tsx +
// DiscountWindowFields.tsx. Every field mirrors the real shape and shows
// that row's mock data, but stays disabled — except "Require promo code",
// the one field this task asks to make genuinely interactive (locally, no
// persistence). The parent keys this component per discount row, so
// `requiresCode` always starts fresh from that row's own mock value.
export default function DiscountEditSheet({ open, discount, onClose }: { open: boolean; discount: EditableDiscount | null; onClose: () => void }) {
  const [requiresCode, setRequiresCode] = useState(discount?.requiresCode ?? false)

  return (
    <Sheet open={open} onClose={onClose} title={discount ? 'Edit Discount' : 'Add Discount'}>
      {discount && (
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Label</label>
            <input disabled defaultValue={discount.label} className={fieldClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Discount %</label>
            <input disabled type="number" defaultValue={discount.percent} className={fieldClass} />
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={requiresCode}
                onChange={(e) => setRequiresCode(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Require promo code
            </label>
            {requiresCode && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Promo Code</label>
                <input disabled defaultValue={discount.code ?? ''} placeholder="e.g. WELCOME10" className={fieldClass} />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" disabled defaultChecked={discount.oncePerClient} className={checkboxClass} />
            One use per client
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Applies to</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" disabled defaultChecked={discount.scopeMode === 'all'} className={checkboxClass} />
                All services
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" disabled defaultChecked={discount.scopeMode === 'selected'} className={checkboxClass} />
                Selected services
              </label>
            </div>
            {discount.scopeMode === 'selected' && (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {(discount.scopeServices ?? []).map((name) => (
                  <label key={name} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" disabled defaultChecked className={checkboxClass} />
                    {name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" disabled defaultChecked={discount.windowEnabled} className={checkboxClass} />
              Limit to a recurring time window
            </label>
            {discount.windowEnabled && (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, d) => (
                      <label key={label} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" disabled defaultChecked={discount.windowDays?.includes(d)} className={checkboxClass} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">From</label>
                    <input disabled type="time" defaultValue={discount.windowStart} className={fieldClass} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <input disabled type="time" defaultValue={discount.windowEnd} className={fieldClass} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Active from</label>
              <input disabled type="date" defaultValue={discount.startDate} className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Active until</label>
              <input disabled type="date" defaultValue={discount.endDate} className={fieldClass} />
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-2 h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>
        </div>
      )}
    </Sheet>
  )
}
