"use client"
import { useTranslation } from 'react-i18next'

/**
 * Renders originalPrice/finalPrice; when finalPrice < originalPrice, shows
 * the original struck through, the final price, and a -{percent}% badge plus
 * label. When there is no discount, renders the single price. `provisional`
 * shows the "final price is confirmed when you book" hint — set whenever the
 * caller's evaluation stage isn't 'final' yet.
 */
export default function BookingPriceSummary({
  originalPrice,
  finalPrice,
  percent,
  label,
  currency,
  provisional,
}: {
  originalPrice: number
  finalPrice: number
  percent: number | null
  label: string | null
  currency: string
  provisional?: boolean
}) {
  const { t } = useTranslation()
  const hasDiscount = percent !== null && finalPrice < originalPrice

  return (
    <div className="text-sm">
      {hasDiscount ? (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="sr-only">{t('booking.priceOriginal')}</span>
          <span className="text-muted-foreground line-through">
            {originalPrice} {currency}
          </span>
          <span className="sr-only">{t('booking.priceFinal')}</span>
          <span className="font-semibold text-foreground">
            {finalPrice} {currency}
          </span>
          <span className="rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5">
            -{percent}%
          </span>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      ) : (
        <span className="font-medium text-foreground">
          {finalPrice} {currency}
        </span>
      )}
      {provisional && <p className="mt-1 text-xs text-muted-foreground">{t('booking.priceProvisional')}</p>}
    </div>
  )
}
