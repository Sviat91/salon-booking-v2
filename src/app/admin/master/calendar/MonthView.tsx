"use client"

import { useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Plus, PowerOff, X } from "lucide-react"

interface MonthViewProps {
  currentDate: Date
  appointments: Appointment[]
  templates: Template[]
  overrides: Override[]
  isEditMode: boolean
  onDayClick: (d: Date) => void
  onAppointmentClick: (a: Appointment) => void
  onDataChange: () => void
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function MonthView({ currentDate, appointments, templates, overrides, isEditMode, onDayClick, onAppointmentClick, onDataChange }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const [savingDate, setSavingDate] = useState<string | null>(null)

  const days = useMemo(() => {
    const d = []
    let day = startDate
    while (day <= endDate) {
      d.push(day)
      day = addDays(day, 1)
    }
    return d
  }, [startDate, endDate])

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    const jsDayOfWeek = date.getDay()
    const ovr = overrides.find(o => o.date.startsWith(dateStr))
    if (ovr) return { isDayOff: ovr.isDayOff, intervals: ovr.intervals }
    const tmpl = templates.find(t => t.dayOfWeek === jsDayOfWeek)
    if (tmpl) return { isDayOff: tmpl.isDayOff, intervals: tmpl.intervals }
    return { isDayOff: false, intervals: [] }
  }

  const updateServer = async (date: Date, isDayOff: boolean, intervals: Interval[]) => {
    const dateStr = format(date, "yyyy-MM-dd")
    setSavingDate(dateStr)
    try {
      await fetch("/api/master/schedule/overrides/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [dateStr], isDayOff, intervals }),
      })
      onDataChange()
    } finally {
      setSavingDate(null)
    }
  }

  const toggleOff = (e: React.MouseEvent, day: Date, status: {isDayOff: boolean, intervals: Interval[]}) => {
    e.stopPropagation()
    updateServer(day, !status.isDayOff, !status.isDayOff ? [] : [{ start: "09:00", end: "18:00" }])
  }

  const addShift = (e: React.MouseEvent, day: Date, status: {isDayOff: boolean, intervals: Interval[]}) => {
    e.stopPropagation()
    updateServer(day, false, [...status.intervals, { start: "12:00", end: "13:00" }])
  }

  const removeShift = (e: React.MouseEvent, day: Date, status: {isDayOff: boolean, intervals: Interval[]}, idx: number) => {
    e.stopPropagation()
    const newIntervals = status.intervals.filter((_, i) => i !== idx)
    // If no shifts are left, mark as day off? Or leave empty intervals? Let's leave empty.
    updateServer(day, status.isDayOff, newIntervals)
  }

  const updateShift = (day: Date, status: {isDayOff: boolean, intervals: Interval[]}, idx: number, field: 'start'|'end', val: string) => {
    const newIntervals = [...status.intervals]
    newIntervals[idx] = { ...newIntervals[idx], [field]: val }
    updateServer(day, status.isDayOff, newIntervals)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-muted/20">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto min-h-0 bg-muted/10 auto-rows-fr">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd")
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isCurrentDay = isToday(day)
          const isPastDay = day < new Date(new Date().setHours(0,0,0,0))
          const status = getDayStatus(day)
          const dayAppts = appointments.filter(a => a.date.startsWith(dateStr))
          const isSaving = savingDate === dateStr

          return (
            <div 
              key={i} 
              onClick={() => {
                if (!isEditMode && !isPastDay) onDayClick(day)
              }}
              className={`border-b border-r border-border p-1.5 flex flex-col transition-colors relative
                ${!isEditMode && !isPastDay ? "cursor-pointer hover:bg-muted/10" : ""}
                ${!isCurrentMonth ? "bg-muted/30 opacity-50" : status.isDayOff ? "bg-red-50/10 dark:bg-red-950/20" : status.intervals.length > 0 ? "bg-green-500/5 hover:bg-green-500/10" : "bg-card"}
                ${isPastDay && isCurrentMonth ? "opacity-60 pointer-events-none" : ""}
              `}
            >
              {isSaving && <div className="absolute inset-0 bg-background/50 z-10 animate-pulse pointer-events-none" />}

              <div className="flex justify-between items-start mb-1 h-6 shrink-0">
                <span className={`text-sm flex items-center justify-center h-6 w-6 rounded-full font-medium ${isCurrentDay ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                {status.isDayOff && (
                  <span className="text-[10px] uppercase font-bold text-red-400">Off</span>
                )}
              </div>

              {/* Show appointments if not editing */}
              {!isEditMode && (
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {dayAppts.map(a => (
                    <div 
                      key={a.id} 
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                      className="text-[11px] truncate px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {a.startTime} {a.client.name || 'Client'}
                    </div>
                  ))}
                </div>
              )}

              {/* Show Editor if editing and not past day */}
              {isEditMode && !isPastDay && (
                <div className="mt-auto space-y-1.5 p-1 bg-muted/40 rounded-md border border-border/50 shadow-inner">
                  {!status.isDayOff && status.intervals.map((inv, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px]">
                      <input 
                        type="time" 
                        value={inv.start} 
                        onChange={e => updateShift(day, status, idx, 'start', e.target.value)}
                        className="w-full bg-background border px-0.5 py-0.5 rounded outline-none" 
                      />
                      <span className="text-muted-foreground">-</span>
                      <input 
                        type="time" 
                        value={inv.end} 
                        onChange={e => updateShift(day, status, idx, 'end', e.target.value)}
                        className="w-full bg-background border px-0.5 py-0.5 rounded outline-none" 
                      />
                      <button 
                        className="text-destructive p-0.5 hover:bg-destructive/10 rounded" 
                        onClick={e => removeShift(e, day, status, idx)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-1 pt-1 mt-1 border-t border-border/50">
                    <button 
                      onClick={e => toggleOff(e, day, status)}
                      className={`flex-1 flex items-center justify-center py-1 gap-1 text-[10px] rounded font-medium transition-colors ${status.isDayOff ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400'}`}
                    >
                      <PowerOff className="w-3 h-3" /> {status.isDayOff ? 'Work' : 'Off'}
                    </button>
                    {!status.isDayOff && (
                      <button 
                        onClick={e => addShift(e, day, status)}
                        className="flex-1 flex items-center justify-center py-1 gap-1 text-[10px] bg-background border rounded hover:bg-muted font-medium transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Shift
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
