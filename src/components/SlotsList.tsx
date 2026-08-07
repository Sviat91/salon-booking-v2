"use client"
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { formatTimeRange } from '@/lib/utils/date-formatters'
import { useSelectedMasterId } from '@/contexts/MasterContext'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { localeFor } from '@/lib/i18n-shared'

// Availability now resolves against the local DB (no Google Calendar round-trip),
// so a same-day query can resolve in a few ms — the loading spinner below would
// barely flash before the times just popped in, which read as an abrupt glitch
// rather than a deliberate load (2026-08-07). This floors every fetch at a
// minimum perceived duration so the spinner is always visible briefly, then the
// times animate in — same idea as `MasterSelector.tsx`'s staggered fade-in.
const MIN_FETCH_MS = 400

function withMinDelay<T>(promise: Promise<T>): Promise<T> {
  return Promise.all([promise, new Promise((resolve) => setTimeout(resolve, MIN_FETCH_MS))]).then(([result]) => result)
}

function toISO(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function SlotsList({ date, procedureId, selected, onPick }: { date?: Date; procedureId?: string; selected?: { startISO: string; endISO: string } | null; onPick?: (slot: { startISO: string; endISO: string }) => void }) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const masterId = useSelectedMasterId()
  const prefersReducedMotion = useReducedMotion()
  const dateISO = date ? toISO(date) : null

  const { data, isFetching, error } = useQuery({
    queryKey: ['day-slots', masterId, dateISO, procedureId],
    enabled: !!dateISO && !!procedureId,
    queryFn: async () => {
      if (!dateISO) return { slots: [] }
      const qs = new URLSearchParams()
      if (procedureId) qs.set('procedureId', procedureId)
      if (masterId) qs.set('masterId', masterId)
      return withMinDelay(
        (async () => {
          const res = await fetch(`/api/day/${dateISO}?${qs.toString()}`)
          if (!res.ok) throw new Error(`Failed: ${res.status}`)
          return res.json()
        })()
      )
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - slots can change frequently
  })

  const slots = useMemo(() => (data?.slots ?? []) as { startISO: string; endISO: string }[], [data])

  const ready = !!procedureId && !!dateISO
  const panelState = ready
    ? 'mt-3 max-h-[24rem] opacity-100 overflow-hidden overflow-y-auto'
    : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'

  return (
    <div>
      {procedureId && !dateISO && <div className="text-sm text-muted-foreground">{t('booking.selectDate')}</div>}
      <div className={`relative overflow-x-hidden transition-[max-height,opacity] duration-300 ease-out ${panelState}`}>
        <div className={`relative rounded-2xl border border-border bg-card text-card-foreground p-4 ${ready ? 'max-h-[24rem]' : ''}`}>
          {ready && (
            <>
              {isFetching && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">{t('slots.searching', 'Wyszukujemy wolne godziny…')}</p>
                </div>
              )}
              {error && <div className="text-sm text-red-600 dark:text-red-400">{t('slots.loadError', 'Błąd ładowania terminów')}</div>}
              {!error && slots.length === 0 && !isFetching && (
                <div className="text-sm text-muted-foreground">{t('slots.noAvailable', 'Brak dostępnych terminów')}</div>
              )}
              {!error && slots.length > 0 && (
                <div className="grid max-h-[18rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {slots.map((s, index) => {
                    const label = formatTimeRange(new Date(s.startISO), new Date(s.endISO), localeFor(language))
                    const isSelected = selected?.startISO === s.startISO && selected?.endISO === s.endISO
                    const cls = isSelected ? 'btn btn-primary' : 'btn btn-outline'
                    return (
                      <motion.button
                        key={s.startISO}
                        initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={prefersReducedMotion ? { duration: 0 } : {
                          duration: 0.25,
                          delay: Math.min(index, 12) * 0.03,
                          ease: 'easeOut',
                        }}
                        className={cls}
                        aria-pressed={isSelected}
                        onClick={() => onPick?.(s)}
                      >
                        {label}
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
