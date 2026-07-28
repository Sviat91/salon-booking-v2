"use client"
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CodeStatus } from '@/lib/discounts/shared'

/** Maps every non-"valid"/"none" CodeStatus to its booking.promo* i18n key. */
const STATUS_KEY: Partial<Record<CodeStatus, string>> = {
  valid: 'booking.promoValid',
  unknown: 'booking.promoUnknown',
  inactive: 'booking.promoInactive',
  expired: 'booking.promoExpired',
  not_applicable: 'booking.promoNotApplicable',
  already_used: 'booking.promoAlreadyUsed',
}

/**
 * Always-visible optional field, styled like the name/email inputs next to
 * it, with an inline Apply button — not a collapsed "have a code?" toggle.
 * Uppercases on change so what the user sees matches what is stored
 * (`normalizeDiscountCode`).
 */
export default function BookingPromoCodeField({
  appliedCode,
  codeStatus,
  loading,
  onApply,
  onRemove,
}: {
  appliedCode: string | null
  codeStatus: CodeStatus | null
  loading: boolean
  onApply: (code: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  if (appliedCode) {
    return (
      <div className="rounded-xl border border-border p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{appliedCode}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs underline text-muted-foreground hover:text-primary"
          >
            {t('booking.promoRemove')}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('booking.promoValid')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder={t('booking.promoPlaceholder')}
        />
        <button
          type="button"
          disabled={!input.trim() || loading}
          onClick={() => onApply(input.trim())}
          className="btn btn-outline text-sm px-3 disabled:opacity-60"
        >
          {t('booking.promoApply')}
        </button>
      </div>
      {codeStatus && codeStatus !== 'none' && codeStatus !== 'valid' && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {t(STATUS_KEY[codeStatus] ?? 'booking.promoUnknown')}
        </p>
      )}
    </div>
  )
}
