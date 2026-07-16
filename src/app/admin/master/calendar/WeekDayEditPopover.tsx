"use client"

import type { Locale } from "date-fns"
import { format } from "date-fns"
import { useTranslation } from "react-i18next"
import { Plus, PowerOff, X } from "lucide-react"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"
import type { Interval } from "./ModernCalendar"

interface WeekDayEditPopoverProps {
  day: Date
  status: { isDayOff: boolean, intervals: Interval[] }
  locale: Locale
  panelRef: React.RefObject<HTMLDivElement>
  style: React.CSSProperties
  onClose: () => void
  onToggleOff: () => void
  onAddShift: () => void
  onRemoveShift: (idx: number) => void
  onUpdateShift: (idx: number, field: 'start' | 'end', val: string) => void
}

/**
 * The day-column edit popover in WeekView's header cell (shift-editor for a single day).
 * Pure move out of WeekView.tsx to respect the 500-line file limit. Positioned by the
 * parent via fixed viewport coordinates (`style`, computed from the trigger button's
 * getBoundingClientRect()) and portaled to document.body — CSS `position: absolute`
 * relative to its narrow, horizontally-scrolled day-column trigger caused it to render
 * off-screen on mobile instead of under the tapped date.
 */
export default function WeekDayEditPopover({ day, status, locale, panelRef, style, onClose, onToggleOff, onAddShift, onRemoveShift, onUpdateShift }: WeekDayEditPopoverProps) {
  const { t } = useTranslation()

  return (
    <div
      ref={panelRef}
      style={style}
      className="bg-card border border-border rounded-xl shadow-2xl p-4 space-y-3 animate-in fade-in-0 zoom-in-95 duration-200 cursor-default"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
        {format(day, "EEEE, MMM d", { locale })}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {status.intervals.length > 0 && (
        <div className="space-y-2">
          {status.intervals.map((inv, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TimePickerDropdown
                value={inv.start}
                onChange={val => onUpdateShift(idx, 'start', val)}
                step={30}
                startHour={6}
                endHour={22}
              />
              <span className="text-muted-foreground">-</span>
              <TimePickerDropdown
                value={inv.end}
                onChange={val => onUpdateShift(idx, 'end', val)}
                step={30}
                startHour={6}
                endHour={22}
              />
              <button
                className="text-destructive p-1 hover:bg-destructive/10 rounded shrink-0"
                onClick={() => onRemoveShift(idx)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button
          onClick={onToggleOff}
          className={`flex-1 flex items-center justify-center py-2 gap-1 text-xs rounded font-medium transition-colors ${
            status.isDayOff
              ? 'bg-primary/20 text-primary'
              : 'bg-[var(--md-error-container)] text-[var(--md-on-error-container)] hover:brightness-95'
          }`}
        >
          <PowerOff className="w-3.5 h-3.5" /> {status.isDayOff ? t('admin.calendar.workingBtn') : t('admin.calendar.dayOffBtn')}
        </button>
        {!status.isDayOff && (
          <button
            onClick={onAddShift}
            className="flex-1 flex items-center justify-center py-2 gap-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t('admin.calendar.addShiftBtn')}
          </button>
        )}
      </div>
    </div>
  )
}
