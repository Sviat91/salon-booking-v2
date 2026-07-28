"use client"
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getFullDateFormatter, formatTimeRange } from '@/lib/utils/date-formatters'
import { useSelectedMasterId } from '@/contexts/MasterContext'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { resolveLocalized } from '@/lib/localized-content'
import { localeFor } from '@/lib/i18n-shared'
import BookingPriceSummary from './BookingPriceSummary'
import type { BookedPricing } from './hooks/useBookingSubmit'

type Procedure = { id: string; name_pl: string; name_en?: string; name_uk?: string; price_pln?: number }
type ProceduresResponse = { items: Procedure[] }

// Only the fields we actually use from tenant config
type SalonContactInfo = {
  salonAddress?: string | null
  salonCity?: string | null
  salonPhone?: string | null
}

interface BookingSuccessPanelProps {
  slot: { startISO: string; endISO: string }
  procedureId?: string
  /** Preferred over the /api/procedures lookup below when present (AD-2: the actual charged price). */
  pricing?: BookedPricing | null
  onClose: () => void
}

export default function BookingSuccessPanel({ slot, procedureId, pricing, onClose }: BookingSuccessPanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const masterId = useSelectedMasterId()
  const { data: proceduresData } = useQuery<ProceduresResponse>({
    queryKey: ['procedures', masterId],
    queryFn: () => fetch(`/api/procedures?masterId=${masterId}`).then(r => r.json() as Promise<ProceduresResponse>),
    staleTime: 60 * 60 * 1000, // 1 hour - procedures rarely change
  })

  // Fetch salon contact info from tenant config
  const { data: tenantConfig } = useQuery<SalonContactInfo>({
    queryKey: ['tenant-config-contact'],
    queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<SalonContactInfo>),
    staleTime: 60 * 60 * 1000, // 1 hour — config rarely changes
  })

  const selectedProcedure = useMemo(() => {
    if (!procedureId) return null
    return proceduresData?.items.find(p => p.id === procedureId) ?? null
  }, [procedureId, proceduresData])

  const selectedProcedureName = useMemo(() => {
    if (!selectedProcedure) return null
    return resolveLocalized({ pl: selectedProcedure.name_pl, en: selectedProcedure.name_en, uk: selectedProcedure.name_uk }, language)
  }, [selectedProcedure, language])

  const startDate = useMemo(() => new Date(slot.startISO), [slot.startISO])
  const endDate = useMemo(() => new Date(slot.endISO), [slot.endISO])
  const label = formatTimeRange(startDate, endDate, localeFor(language))
  const terminLabel = `${getFullDateFormatter(localeFor(language)).format(startDate)}, ${label}`

  const hasAddress = tenantConfig?.salonAddress || tenantConfig?.salonCity || tenantConfig?.salonPhone

  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-3 text-foreground">{t('success.title')}</div>
      
      <div className="space-y-1 mb-4">
        <div className="text-sm text-muted-foreground">
          <strong>{t('success.serviceLabel')}</strong> {selectedProcedureName ?? t('common.noData')}
        </div>
        <div className="text-sm text-muted-foreground">
          <strong>{t('success.dateLabel')}</strong> {terminLabel}
        </div>
        {pricing ? (
          <div className="text-sm text-muted-foreground">
            <strong>{t('success.priceLabel')}</strong>{' '}
            {pricing.discountPercent != null && pricing.finalPrice < pricing.originalPrice ? (
              <BookingPriceSummary
                originalPrice={pricing.originalPrice}
                finalPrice={pricing.finalPrice}
                percent={pricing.discountPercent}
                label={null}
                currency={t('common.currency')}
              />
            ) : (
              `${pricing.finalPrice} zł`
            )}
          </div>
        ) : (
          selectedProcedure?.price_pln && (
            <div className="text-sm text-muted-foreground">
              <strong>{t('success.priceLabel')}</strong> {selectedProcedure.price_pln} zł
            </div>
          )
        )}
      </div>
      
      {hasAddress && (
        <div className="mb-4 rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{t('success.addressLabel')}</strong><br />
            {tenantConfig.salonAddress && <>{tenantConfig.salonAddress}<br /></>}
            {tenantConfig.salonCity && <>{tenantConfig.salonCity}<br /></>}
            {tenantConfig.salonPhone && <>{tenantConfig.salonPhone}</>}
          </div>
        </div>
      )}
      
      <div className="text-emerald-700 dark:text-emerald-400 mb-4">{t('success.thankYou')}</div>
      
      <button
        type="button"
        onClick={onClose}
        className="btn btn-outline w-full"
      >
        {t('success.close')}
      </button>
    </div>
  )
}
