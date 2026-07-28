"use client"
import { useTranslation } from 'react-i18next'
import { TimePickerDropdown } from '@/components/TimePickerDropdown'

const DAY_KEYS = ['day0', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6'] as const

/**
 * `windowEnabled` checkbox + 7 day checkboxes (`day_0`…`day_6`) + two
 * `type="time"` inputs (`windowStart`/`windowEnd`). A window is only honoured
 * server-side when both days and hours are non-empty (AD-1) — this UI keeps
 * that pairing implicit by only rendering/submitting the day/time fields
 * while `windowEnabled` is checked.
 */
export default function DiscountWindowFields({
  enabled,
  onEnabledChange,
  days,
  onToggleDay,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  days: Set<number>
  onToggleDay: (d: number) => void
  start: string
  end: string
  onStartChange: (v: string) => void
  onEndChange: (v: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="windowEnabled"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {t('admin.discounts.windowEnabled')}
      </label>

      {enabled && (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('admin.discounts.windowDays')}</p>
            <div className="flex flex-wrap gap-2">
              {DAY_KEYS.map((key, d) => (
                <label key={d} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    name={`day_${d}`}
                    checked={days.has(d)}
                    onChange={() => onToggleDay(d)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {t(`admin.discounts.${key}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('admin.discounts.windowFrom')}</label>
              <TimePickerDropdown value={start} onChange={onStartChange} />
              <input type="hidden" name="windowStart" value={start} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('admin.discounts.windowTo')}</label>
              <TimePickerDropdown value={end} onChange={onEndChange} />
              <input type="hidden" name="windowEnd" value={end} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
