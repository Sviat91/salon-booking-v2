import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { mockSlotTimes } from '../data'
import { t } from '../lib/i18n'

// Real component fetches /api/day/:date and floors the request at 400ms so
// the loading spinner is never an imperceptible flash before slots pop in
// (same MIN_FETCH_MS idea as the real SlotsList.tsx).
const MIN_FETCH_MS = 400

export type Slot = { startISO: string; endISO: string }

function buildSlots(date: Date, durationMin: number): Slot[] {
  return mockSlotTimes.map((time) => {
    const [h, m] = time.split(':').map(Number)
    const start = new Date(date)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + durationMin * 60_000)
    return { startISO: start.toISOString(), endISO: end.toISOString() }
  })
}

function formatTimeRange(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${fmt(start)}–${fmt(end)}`
}

export default function SlotsList({
  date,
  durationMin,
  selected,
  onPick,
}: {
  date?: Date
  durationMin: number
  selected?: Slot | null
  onPick?: (slot: Slot) => void
}) {
  const prefersReducedMotion = useReducedMotion()
  const [isFetching, setIsFetching] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])

  const dateKey = date ? date.toDateString() : null

  useEffect(() => {
    if (!date) {
      setSlots([])
      return
    }
    setIsFetching(true)
    const timer = setTimeout(() => {
      setSlots(buildSlots(date, durationMin))
      setIsFetching(false)
    }, MIN_FETCH_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, durationMin])

  const ready = !!date
  // `overflow-hidden` only, not `overflow-y-auto` — this wrapper's own
  // `max-h-[24rem]` is animating during the transition, and content never
  // actually needs to scroll here (the slots grid below has its own
  // `overflow-y-auto` at a fixed height for that). Auto-scroll on an
  // animating max-height flashed a scrollbar mid-transition even though the
  // settled state never needs one.
  const panelState = ready
    ? 'mt-3 max-h-[24rem] opacity-100 overflow-hidden'
    : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'

  const rendered = useMemo(() => slots, [slots])

  return (
    <div>
      {!date && <div className="text-sm text-muted-foreground">{t('booking.selectDate')}</div>}
      <div className={`relative overflow-x-hidden transition-[max-height,opacity] duration-300 ease-out ${panelState}`}>
        <div className={`relative rounded-2xl border border-border bg-card text-card-foreground p-4 ${ready ? 'max-h-[24rem]' : ''}`}>
          {ready && (
            <>
              {isFetching && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">{t('slots.searching')}</p>
                </div>
              )}
              {!isFetching && rendered.length === 0 && <div className="text-sm text-muted-foreground">{t('slots.noAvailable')}</div>}
              {!isFetching && rendered.length > 0 && (
                <div className="grid max-h-[18rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {rendered.map((s, index) => {
                    const label = formatTimeRange(new Date(s.startISO), new Date(s.endISO))
                    const isSelected = selected?.startISO === s.startISO && selected?.endISO === s.endISO
                    const cls = isSelected ? 'btn btn-primary' : 'btn btn-outline'
                    return (
                      <motion.button
                        key={s.startISO}
                        initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, delay: Math.min(index, 12) * 0.03, ease: 'easeOut' }}
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
