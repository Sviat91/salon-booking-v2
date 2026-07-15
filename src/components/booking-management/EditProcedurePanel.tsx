"use client"
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { localeFor } from '@/lib/i18n'
import type { BookingResult, ProcedureOption, ExtensionCheckStatus, ExtensionCheckResult, SlotSelection } from './types'

interface EditProcedurePanelProps {
  booking: BookingResult
  selectedProcedure: ProcedureOption | null
  procedures: ProcedureOption[]
  onSelectProcedure: (procedure: ProcedureOption | null) => void
  onBack: () => void
  onConfirmSameTime: () => void
  onRequestNewTime: () => void
  onCheckAvailability: () => void
  isSubmitting?: boolean
  // Новые пропсы для проверки доступности
  extensionCheckStatus?: ExtensionCheckStatus
  extensionCheckResult?: ExtensionCheckResult | null
  selectedAlternativeSlot?: SlotSelection | null
  onSelectAlternativeSlot?: (slot: SlotSelection) => void
  onConfirmAlternativeSlot?: () => void
}

export default function EditProcedurePanel({
  booking,
  selectedProcedure,
  procedures,
  onSelectProcedure,
  onBack,
  onConfirmSameTime,
  onRequestNewTime,
  onCheckAvailability,
  isSubmitting = false,
  extensionCheckStatus = null,
  extensionCheckResult = null,
  selectedAlternativeSlot = null,
  onSelectAlternativeSlot,
  onConfirmAlternativeSlot,
}: EditProcedurePanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const dateLocale = localeFor(language)
  const [isOpen, setIsOpen] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const currentDuration = booking.procedureDurationMin
  const newDuration = selectedProcedure?.duration_min ?? currentDuration
  const durationDiff = newDuration - currentDuration
  const isSameOrShorter = durationDiff <= 0
  const isChecking = extensionCheckStatus === 'checking'
  const canExtend = extensionCheckStatus === 'can_extend'
  const canShiftBack = extensionCheckStatus === 'can_shift_back'
  const noAvailability = extensionCheckStatus === 'no_availability'

  // Format time helper
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat(dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent" role="dialog" aria-label={t('management.changeProcedureBtn')}>
      <div className="text-sm text-muted-foreground">
        {t('management.selectNewProcedure')}
      </div>

      <div className="space-y-2">
        {/* Current procedure info */}
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground mb-1">{t('management.currentProcedure')}</div>
          <div className="text-sm font-medium text-foreground">
            {booking.procedureName}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {currentDuration} min • {booking.price}zł
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {new Intl.DateTimeFormat(dateLocale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(booking.startTime)}
          </div>
        </div>

        {/* Dropdown selector - like ProcedureSelect */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(o => !o)}
            className="relative w-full rounded-xl border border-border bg-transparent text-foreground px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {selectedProcedure ? (
              <span className="block whitespace-normal break-words text-sm">
                {selectedProcedure.name_pl} • {selectedProcedure.duration_min} min • {selectedProcedure.price_pln}zł
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">{t('management.selectNewProcedurePlaceholder')}</span>
            )}
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? 'max-h-60 opacity-100 mt-2' : 'max-h-0 opacity-0'} bg-card text-card-foreground border border-border rounded-xl`}
          >
            <ul className="max-h-60 overflow-auto p-1">
              {procedures.map((procedure) => {
                const isCurrent = procedure.name_pl === booking.procedureName
                const isSelected = selectedProcedure?.id === procedure.id
                return (
                  <li key={procedure.id}>
                    <button
                      type="button"
                      disabled={isCurrent}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors whitespace-normal break-words text-foreground ${
                        isCurrent
                          ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed dark:bg-muted dark:text-muted-foreground'
                          : isSelected
                            ? 'bg-primary/20 text-primary'
                            : 'hover:bg-primary/10 focus:bg-primary/10 focus:outline-none'
                      }`}
                      onClick={() => {
                        if (!isCurrent) {
                          onSelectProcedure(isSelected ? null : procedure)
                          setIsOpen(false)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{procedure.name_pl}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {procedure.duration_min} min • {procedure.price_pln}zł{isCurrent ? ` ${t('management.current')}` : ''}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      {selectedProcedure ? (
        <div className="space-y-3">
          {/* Info message about duration */}
          {isSameOrShorter ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-400/50 dark:bg-green-400/10">
              <div className="text-sm text-green-700 dark:text-green-400">
                ✓ {durationDiff === 0 ? t('management.sameDuration') : t('management.shorterBy', { min: Math.abs(durationDiff) })}
              </div>
              <div className="text-xs text-green-600 dark:text-green-300">
                {t('management.canKeepCurrentTerm')}
              </div>
            </div>
          ) : (
            <>
              {/* Сценарий A: Время доступно (can_extend) */}
              {canExtend && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-400/50 dark:bg-green-400/10">
                  <div className="text-sm text-green-700 dark:text-green-400">
                    ✓ {t('management.timeAvailable')}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                    {extensionCheckResult?.message}
                  </div>
                </div>
              )}
              
              {/* Сценарий B: Можно сдвинуть раньше (can_shift_back) */}
              {canShiftBack && extensionCheckResult && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/50 dark:bg-amber-400/10">
                  <div className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-2">
                    ⚠ {t('management.cannotExtendTime')}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-300 mb-3">
                    {extensionCheckResult.reasonCode === 'NEXT_BOOKING_CONFLICT'
                      ? `→ ${t('management.nextBookingConflict')}`
                      : `→ ${t('management.outsideWorkingHours')}`
                    }
                  </div>
                  <div className="border-t border-amber-300/30 dark:border-amber-500/30 pt-2 mt-2">
                    <div className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-1">
                      💡 {t('management.canShiftEarlier', { min: extensionCheckResult.shiftMinutes })}
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-300">
                      <span className="font-semibold">
                        {extensionCheckResult.suggestedStartISO && formatTime(extensionCheckResult.suggestedStartISO)}
                        {' - '}
                        {extensionCheckResult.suggestedEndISO && formatTime(extensionCheckResult.suggestedEndISO)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Раскрывающийся список альтернативных слотов */}
                  {extensionCheckResult.alternativeSlots && extensionCheckResult.alternativeSlots.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowAlternatives(!showAlternatives)}
                        className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <span>{showAlternatives ? '▼' : '▶'}</span>
                        {t('management.otherAvailableTimes', { count: extensionCheckResult.alternativeSlots.length })}
                      </button>
                      
                      {showAlternatives && (
                        <div className="mt-2 space-y-1">
                          {extensionCheckResult.alternativeSlots.map((slot, idx) => {
                            const isSelected = selectedAlternativeSlot?.startISO === slot.startISO
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => onSelectAlternativeSlot?.(slot)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isSelected
                                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-600/30 dark:text-amber-200'
                                    : 'bg-card/60 text-amber-800 hover:bg-amber-100 dark:text-amber-300'
                                }`}
                              >
                                {formatTime(slot.startISO)} - {formatTime(slot.endISO)}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Сценарий C: Нет доступности (no_availability) */}
              {noAvailability && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-400/50 dark:bg-red-400/10">
                  <div className="text-sm text-red-700 dark:text-red-400">
                    ✗ {t('management.noAvailableTime')}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-300 mt-1">
                    {t('management.selectNewTermFromCalendar')}
                  </div>
                </div>
              )}
              
              {/* Начальное сообщение перед проверкой */}
              {!canExtend && !canShiftBack && !noAvailability && !isChecking && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/50 dark:bg-amber-400/10">
                  <div className="text-sm text-amber-700 dark:text-amber-400">
                    ⚠ {t('management.longerBy', { min: durationDiff })}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-300">
                    {t('management.willCheckAvailability')}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action buttons - two main buttons in a row */}
          <div className="flex gap-2">
            {isSameOrShorter ? (
              <>
                <button 
                  type="button" 
                  onClick={onConfirmSameTime}
                  disabled={isSubmitting || !selectedProcedure}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('management.saving')}
                    </>
                  ) : (
                    t('management.confirmSameTime')
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={onRequestNewTime} 
                  className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
                >
                  {t('management.selectNewTerm')}
                </button>
              </>
            ) : (
              <>
                {/* Сценарий A: can_extend - зеленая кнопка подтверждения */}
                {canExtend ? (
                  <>
                    <button 
                      type="button" 
                      onClick={onConfirmSameTime}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-green-700 hover:shadow-md dark:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('management.saving')}
                        </>
                      ) : (
                        t('management.confirmSameTime')
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={onRequestNewTime} 
                      className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
                    >
                      {t('management.selectNewTerm')}
                    </button>
                  </>
                ) : canShiftBack ? (
                  /* Сценарий B: can_shift_back - желтая кнопка подтверждения на предложенное или выбранное время */
                  <>
                    <button 
                      type="button" 
                      onClick={onConfirmAlternativeSlot}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-amber-600 hover:shadow-md dark:bg-amber-600 dark:hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('management.saving')}
                        </>
                      ) : (
                        selectedAlternativeSlot 
                          ? `${t('management.confirmAt')} ${formatTime(selectedAlternativeSlot.startISO)}`
                          : `${t('management.confirmAt')} ${extensionCheckResult?.suggestedStartISO ? formatTime(extensionCheckResult.suggestedStartISO) : ''}`
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={onRequestNewTime} 
                      className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
                    >
                      {t('management.orSelectOtherTerm')}
                    </button>
                  </>
                ) : noAvailability ? (
                  /* Сценарий C: no_availability - увеличенная кнопка выбора нового термина */
                  <button 
                    type="button" 
                    onClick={onRequestNewTime} 
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md"
                  >
                    {t('management.selectNewTerm')}
                  </button>
                ) : (
                  /* Начальное состояние - кнопка проверки */
                  <>
                    <button 
                      type="button" 
                      onClick={onCheckAvailability}
                      disabled={isChecking}
                      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isChecking ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('management.checking')}
                        </>
                      ) : (
                        t('management.checkAvailability')
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={onRequestNewTime} 
                      className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
                    >
                      {t('management.selectNewTerm')}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Back button - full width below */}
          <button 
            type="button" 
            onClick={onBack} 
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:shadow-sm"
          >
            {t('management.back')}
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-2">
          {t('management.selectProcedureFromList')}
        </div>
      )}
    </div>
  )
}
