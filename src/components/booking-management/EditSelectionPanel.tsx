"use client"
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { pl, enGB, uk } from 'date-fns/locale'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { resolveLocalized } from '@/lib/localized-content'
import type { BookingResult } from './types'

interface EditSelectionPanelProps {
  booking: BookingResult
  onChangeTime: () => void
  onBack: () => void
  onChangeProcedure: () => void
}

export default function EditSelectionPanel({
  booking,
  onChangeTime,
  onBack,
  onChangeProcedure,
}: EditSelectionPanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()

  const dateLocale = useMemo(() => {
    switch (language) {
      case 'uk': return uk
      case 'en': return enGB
      default: return pl
    }
  }, [language])

  const dateStr = format(booking.startTime, 'EEEE, d MMMM', { locale: dateLocale })
  const timeStr = `${format(booking.startTime, 'HH:mm')}–${format(booking.endTime, 'HH:mm')}`
  const procedureName = resolveLocalized({ pl: booking.procedureName, en: booking.procedureName_en, uk: booking.procedureName_uk }, language)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          {t('management.selectChangeType')}
        </h3>
      </div>

      {/* Booking info */}
      <div className="rounded-xl border border-border bg-muted/25 p-4">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{procedureName}</div>
          <div className="text-sm text-muted-foreground">
            {dateStr} • {timeStr}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onChangeTime}
          className="w-full rounded-lg border border-border bg-card p-4 text-left transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🕐</div>
            <div>
              <div className="font-medium text-foreground">
                {t('management.changeTerm')}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('management.selectOtherDateOrTime')}
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onChangeProcedure}
          className="w-full rounded-lg border border-border bg-card p-4 text-left transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">💆‍♀️</div>
            <div>
              <div className="font-medium text-foreground">
                {t('management.changeProcedureBtn')}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('management.selectNewProcedureOrBack')}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Back button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
        >
          {t('management.backToBookingList')}
        </button>
      </div>
    </div>
  )
}
