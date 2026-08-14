import { useMemo, useState } from 'react'
import { t } from '../lib/i18n'
import { useSelectedMaster } from '../context/AppContext'
import { addBooking } from '../lib/localBookings'
import { computeFinalPrice } from '../lib/discounts'
import type { Procedure } from '../types'
import type { Slot } from './SlotsList'

// Simplified from the real BookingForm.tsx: name + phone only. The real form
// also handles auth pre-fill, Turnstile captcha, a GDPR consent modal, and a
// promo-code/discount preview — all backend-dependent and skipped here since
// there's no real submission target. The visible fields, copy, and button
// classes (`.btn.btn-primary`) are ported as-is. Unlike the real form (which
// POSTs to /api/book), this writes the booking to localStorage so it
// persists across reloads and the "Manage booking" widget can actually find
// it — the same local-persistence pattern already used for the theme.
export default function BookingForm({
  slot,
  procedure,
  onSuccess,
}: {
  slot: Slot
  procedure: Procedure | null
  onSuccess: (pricing: { percent: number; price: number }) => void
}) {
  const master = useSelectedMaster()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9

  function handleSubmit() {
    if (!master || !procedure) return
    const pricing = computeFinalPrice(procedure.priceOld, slot.startISO)
    addBooking({
      id: `${Date.now()}`,
      masterId: master.id,
      masterName: master.name,
      procedureId: procedure.id,
      procedureName: procedure.name,
      price: pricing.price,
      startISO: slot.startISO,
      endISO: slot.endISO,
      name: name.trim(),
      phone: phone.trim(),
    })
    onSuccess(pricing)
  }

  const startDate = useMemo(() => new Date(slot.startISO), [slot.startISO])
  const endDate = useMemo(() => new Date(slot.endISO), [slot.endISO])
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' })
  const terminLabel = `${fmtDate(startDate)}, ${fmtTime(startDate)}–${fmtTime(endDate)}`

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground">
        <div className="font-medium text-foreground mb-0.5">{procedure?.name}</div>
        <div className="text-sm">{terminLabel}</div>
      </div>

      <div className="space-y-2">
        <input
          className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('form.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('form.phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`btn btn-primary mt-4 w-full transition-all duration-200 ${!canSubmit ? 'opacity-60 pointer-events-none' : 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}
      >
        {t('booking.book')}
      </button>
    </div>
  )
}
