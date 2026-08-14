import { useEffect, useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { enUS } from 'date-fns/locale'
import { format } from 'date-fns'
import 'react-day-picker/dist/style.css'
import { t } from '../lib/i18n'

function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Real component fetches availability from /api/availability. This demo has
// no backend, so weekdays (Mon-Fri) within the next 90 days are mocked as
// available — same shape (a Set of ISO dates) the real `daysMap` produces.
function mockAvailableDays(from: Date, until: Date): Set<string> {
  const set = new Set<string>()
  const cursor = new Date(from)
  while (cursor <= until) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) set.add(toISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return set
}

export default function DayCalendar({ procedureId, onChange }: { procedureId?: string; onChange?: (d: Date | undefined) => void }) {
  const [selected, setSelected] = useState<Date | undefined>(undefined)
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const initialMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const [month, setMonth] = useState<Date>(initialMonth)
  const [isLoadingDays, setIsLoadingDays] = useState(false)

  const rangeUntil = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 90)
    return d
  }, [today])

  const available = useMemo(() => mockAvailableDays(today, rangeUntil), [today, rangeUntil])

  // Same brief "searching" flash as the real fetch-backed calendar — reset
  // whenever the selected procedure changes.
  useEffect(() => {
    if (!procedureId) return
    setIsLoadingDays(true)
    const timer = setTimeout(() => setIsLoadingDays(false), 350)
    return () => clearTimeout(timer)
  }, [procedureId])

  const isDisabled = (day: Date) => {
    if (day < today) return true
    if (!procedureId) return true
    return !available.has(toISO(day))
  }

  function handleMonthChange(next: Date) {
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
  }

  function handleContainerClick() {
    if (selected !== undefined) setSelected(undefined)
    onChange?.(undefined)
  }

  const buttonBase =
    'flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition-all duration-200 hover:bg-muted hover:border-muted-foreground hover:scale-110 hover:shadow-lg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:scale-100 disabled:hover:shadow-none'

  return (
    <div className="relative overflow-visible w-full max-w-full box-border" onClick={handleContainerClick}>
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          aria-label={t('calendar.prevMonth')}
          onClick={(event) => {
            event.stopPropagation()
            const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1)
            const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            if (prevMonth >= minMonth) handleMonthChange(prevMonth)
          }}
          disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)}
          className={buttonBase}
        >
          ‹
        </button>
        <div className="relative flex-1 text-center">
          <div className="h-6 overflow-hidden">
            <span className="inline-block text-base font-medium text-foreground">
              {capitalizeFirst(month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label={t('calendar.nextMonth')}
          onClick={(event) => {
            event.stopPropagation()
            handleMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }}
          className={buttonBase}
        >
          ›
        </button>
      </div>
      <div className="overflow-x-hidden w-full max-w-full box-border">
        <DayPicker
          mode="single"
          month={month}
          locale={enUS}
          weekStartsOn={1}
          selected={selected}
          onSelect={(d) => {
            setSelected(d || undefined)
            onChange?.(d || undefined)
          }}
          onDayClick={(_, __, event) => {
            event.stopPropagation()
          }}
          fromDate={today}
          toDate={rangeUntil}
          disabled={isDisabled}
          modifiers={{ available: Array.from(available.values()).map((s) => new Date(s + 'T00:00:00')) }}
          modifiersClassNames={{
            // v9's DayFlag/SelectionState classes land on the grid cell
            // (.rdp-day), not the clickable circle (.rdp-day_button) — the
            // actual color/hover treatment for these is in index.css,
            // targeting `.rdp-<state> .rdp-day_button`.
            available: 'rdp-available',
          }}
          classNames={{
            month: 'space-y-2',
            month_grid: 'w-full table-fixed border-collapse',
            weekday: 'w-10 text-center font-normal text-xs text-muted-foreground overflow-hidden',
            day: 'w-10 text-center p-0',
            day_button: 'rdp-day_button',
          }}
          formatters={{
            formatWeekdayName: (date) => capitalizeFirst(format(date, 'EEEEEE', { locale: enUS })),
          }}
          onMonthChange={handleMonthChange}
          className="w-full max-w-full"
        />
      </div>
      {isLoadingDays && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      )}
    </div>
  )
}
