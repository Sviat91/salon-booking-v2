import { useMemo } from 'react'
import { t } from '../lib/i18n'
import type { Procedure } from '../types'
import type { Slot } from './SlotsList'

export default function BookingSuccessPanel({
  slot,
  procedure,
  pricing,
  onClose,
}: {
  slot: Slot
  procedure: Procedure | null
  pricing: { percent: number; price: number } | null
  onClose: () => void
}) {
  const startDate = useMemo(() => new Date(slot.startISO), [slot.startISO])
  const endDate = useMemo(() => new Date(slot.endISO), [slot.endISO])
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' })
  const terminLabel = `${fmtDate(startDate)}, ${fmtTime(startDate)}–${fmtTime(endDate)}`

  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-3 text-foreground">{t('success.title')}</div>

      <div className="space-y-1 mb-4">
        <div className="text-sm text-muted-foreground">
          <strong>{t('success.serviceLabel')}</strong> {procedure?.name}
        </div>
        <div className="text-sm text-muted-foreground">
          <strong>{t('success.dateLabel')}</strong> {terminLabel}
        </div>
        {pricing && (
          <div className="text-sm text-muted-foreground">
            <strong>{t('success.priceLabel')}</strong>{' '}
            {procedure?.priceOld && <span className="line-through text-muted-foreground/70">{procedure.priceOld} zł</span>}{' '}
            <span className="font-medium text-foreground">{pricing.price} zł</span>{' '}
            <span className="text-emerald-600 dark:text-emerald-400">(-{pricing.percent}%)</span>
          </div>
        )}
      </div>

      <div className="text-emerald-700 dark:text-emerald-400 mb-4">{t('success.thankYou')}</div>

      <button type="button" onClick={onClose} className="btn btn-outline w-full">
        {t('success.close')}
      </button>
    </div>
  )
}
