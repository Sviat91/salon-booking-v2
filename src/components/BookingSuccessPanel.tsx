"use client"
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fullDateFormatter, formatTimeRange } from '@/lib/utils/date-formatters'
import { useSelectedMasterId } from '@/contexts/MasterContext'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { translateProcedureName } from '@/lib/procedure-translator'

type Procedure = { id: string; name_pl: string; price_pln?: number }
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
  onClose: () => void
}

export default function BookingSuccessPanel({ slot, procedureId, onClose }: BookingSuccessPanelProps) {
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
    return translateProcedureName(selectedProcedure.name_pl, language)
  }, [selectedProcedure, language])

  const startDate = useMemo(() => new Date(slot.startISO), [slot.startISO])
  const endDate = useMemo(() => new Date(slot.endISO), [slot.endISO])
  const label = formatTimeRange(startDate, endDate)
  const terminLabel = `${fullDateFormatter.format(startDate)}, ${label}`

  const hasAddress = tenantConfig?.salonAddress || tenantConfig?.salonCity || tenantConfig?.salonPhone

  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-3 dark:text-dark-text">{t('success.title')}</div>
      
      <div className="space-y-1 mb-4">
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong>{t('success.serviceLabel')}</strong> {selectedProcedureName ?? t('common.noData')}
        </div>
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong>{t('success.dateLabel')}</strong> {terminLabel}
        </div>
        {selectedProcedure?.price_pln && (
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong>{t('success.priceLabel')}</strong> {selectedProcedure.price_pln} zł
          </div>
        )}
      </div>
      
      {hasAddress && (
        <div className="mb-4 rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong className="text-text dark:text-dark-text">{t('success.addressLabel')}</strong><br />
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
        className="w-full rounded-lg bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-900 hover:shadow-md dark:bg-neutral-700 dark:hover:bg-neutral-600"
      >
        {t('success.close')}
      </button>
    </div>
  )
}
