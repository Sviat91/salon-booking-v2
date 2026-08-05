"use client"

import { format } from "date-fns"
import { MAX_TARGET_MASTERS } from "./calendar-utils"

export type DayMark = { id: string; name: string; color: string | null; state: "working" | "dayoff" }

interface BulkDayCellProps {
  date: Date
  isSelected: boolean
  isDisabled: boolean
  isToday: boolean
  selfMark?: DayMark
  workingMarks: DayMark[]
  offMarks: DayMark[]
  title?: string
  onToggle: () => void
}

export default function BulkDayCell({ date, isSelected, isDisabled, isToday: isTdy, selfMark, workingMarks, offMarks, title, onToggle }: BulkDayCellProps) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onToggle}
      title={title}
      className={`relative h-10 w-full rounded-md flex items-center justify-center text-sm transition-colors border border-transparent
        ${isDisabled ? "text-muted-foreground opacity-30 cursor-not-allowed" : ""}
        ${!isDisabled && selfMark?.state === 'dayoff' && !isSelected ? "text-[var(--md-on-error-container)] bg-[var(--md-error-container)] hover:brightness-95" : ""}
        ${!isDisabled && isTdy && !isSelected ? "ring-2 ring-primary bg-primary/10 font-bold" : ""}
        ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-md" : !isDisabled ? "hover:bg-muted" : ""}
      `}
    >
      <span className={isTdy ? 'font-bold' : ''}>{format(date, "d")}</span>

      {/* Master's-own-view dot = schedule exists for this day (override or template), self path only */}
      {!isDisabled && selfMark?.state === 'working' && (
        <div className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-[var(--md-success)]'}`} />
      )}

      {/* Admin view: one dot per checked master WORKING that day, in that master's colour */}
      {!isDisabled && workingMarks.length > 0 && (
        <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center gap-[2px] px-0.5">
          {workingMarks.slice(0, MAX_TARGET_MASTERS).map(m => (
            <span
              key={m.id}
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'ring-1 ring-primary-foreground/70' : ''}`}
              style={{ backgroundColor: m.color ?? undefined }}
            />
          ))}
        </div>
      )}

      {/* Admin view: DAY OFF = one thin full-width line per off master, stacked top-to-bottom */}
      {!isDisabled && offMarks.length > 0 && (
        <div className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 flex flex-col gap-[2px] ${isSelected ? 'rounded-[3px] bg-primary-foreground/85 p-[1px]' : ''}`}>
          {offMarks.map(m => (
            <span key={m.id} className="h-[2px] rounded-full" style={{ backgroundColor: m.color ?? undefined }} />
          ))}
        </div>
      )}
    </button>
  )
}
