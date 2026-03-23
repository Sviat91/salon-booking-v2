"use client"

import { useMemo, useRef, useState } from "react"
import { format, startOfWeek, endOfWeek, addDays, isToday } from "date-fns"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Clock, Plus, PowerOff, X } from "lucide-react"

interface WeekViewProps {
  currentDate: Date
  appointments: Appointment[]
  templates: Template[]
  overrides: Override[]
  step: number
  startHour: number
  endHour: number
  isEditMode: boolean
  onDayClick: (d: Date) => void
  onAppointmentClick: (a: Appointment) => void
  onDataChange: () => void
}

const HOURS = Array.from({ length: 24 }).map((_, i) => i)

export default function WeekView({ currentDate, appointments, templates, overrides, step, startHour, endHour, isEditMode, onDayClick, onAppointmentClick, onDataChange }: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const totalHours = endHour - startHour
  const PIXELS_PER_MINUTE = 1.5 
  const containerHeight = totalHours * 60 * PIXELS_PER_MINUTE

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
  const endDate = endOfWeek(currentDate, { weekStartsOn: 1 })

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

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number)
    return h * 60 + m
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

  const toggleOff = (day: Date, status: {isDayOff: boolean, intervals: Interval[]}) => {
    updateServer(day, !status.isDayOff, !status.isDayOff ? [] : [{ start: "09:00", end: "18:00" }])
  }

  const addShift = (day: Date, status: {isDayOff: boolean, intervals: Interval[]}) => {
    updateServer(day, false, [...status.intervals, { start: "12:00", end: "13:00" }])
  }

  const removeShift = (day: Date, status: {isDayOff: boolean, intervals: Interval[]}, idx: number) => {
    const newIntervals = status.intervals.filter((_, i) => i !== idx)
    updateServer(day, status.isDayOff, newIntervals)
  }

  const updateShift = (day: Date, status: {isDayOff: boolean, intervals: Interval[]}, idx: number, field: 'start'|'end', val: string) => {
    const newIntervals = [...status.intervals]
    newIntervals[idx] = { ...newIntervals[idx], [field]: val }
    updateServer(day, status.isDayOff, newIntervals)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex border-b border-border shrink-0 bg-card pr-2">
        <div className="w-16 shrink-0 border-r border-border" /> 
        <div className="flex-1 grid grid-cols-7">
          {days.map((day, i) => {
            const isCurr = isToday(day)
            const isPastDay = day < new Date(new Date().setHours(0,0,0,0))
            const status = getDayStatus(day)
            const dateStr = format(day, "yyyy-MM-dd")
            const isSaving = savingDate === dateStr

            return (
              <div key={i} className="pt-2 pb-1 px-1 flex flex-col items-center border-r last:border-r-0 border-border relative">
                {isSaving && <div className="absolute inset-0 bg-background/50 z-10 animate-pulse" />}
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isCurr ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(day, "EEE")}
                </span>
                <span className={`text-lg font-medium h-8 w-8 flex items-center justify-center rounded-full mt-0.5 ${isCurr ? 'bg-primary text-primary-foreground' : ''}`}>
                  {format(day, "d")}
                </span>

                {isEditMode && !isPastDay && (
                  <div className="mt-2 w-full space-y-1">
                    {!status.isDayOff && status.intervals.map((inv, idx) => (
                      <div key={idx} className="flex items-center gap-0.5 text-[9px] bg-muted/50 rounded px-1 py-0.5">
                        <input type="time" value={inv.start} onChange={e => updateShift(day, status, idx, 'start', e.target.value)} className="w-[45%] bg-transparent outline-none" />
                        <span>-</span>
                        <input type="time" value={inv.end} onChange={e => updateShift(day, status, idx, 'end', e.target.value)} className="w-[45%] bg-transparent outline-none" />
                        <button className="text-destructive ms-auto" onClick={() => removeShift(day, status, idx)}><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <div className="flex gap-1">
                      <button onClick={() => toggleOff(day, status)} className={`flex-1 flex justify-center py-1 text-[9px] rounded font-medium ${status.isDayOff ? 'bg-primary/20 text-primary' : 'bg-red-100 text-red-600 dark:bg-red-900/40'}`}>
                        <PowerOff className="w-3 h-3" />
                      </button>
                      {!status.isDayOff && (
                        <button onClick={() => addShift(day, status)} className="flex-1 flex justify-center py-1 text-[9px] bg-muted rounded hover:bg-muted/80 font-medium">
                          <Plus className="w-3 h-3" />
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

      <div className="flex-1 overflow-y-auto relative custom-scrollbar flex" ref={containerRef}>
        <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
          {HOURS.slice(startHour, endHour).map(hour => (
            <div 
              key={hour} 
              className="px-2 text-right text-xs text-muted-foreground font-medium relative -top-3"
              style={{ height: `${60 * PIXELS_PER_MINUTE}px`, top: `${(hour - startHour) * 60 * PIXELS_PER_MINUTE - 10}px`, position: 'absolute', width: '100%' }}
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 relative bg-muted/30" style={{ height: `${containerHeight}px` }}>
          {Array.from({ length: totalHours * Math.floor(60 / step) }).map((_, i) => {
            const currentMin = i * step
            const top = currentMin * PIXELS_PER_MINUTE
            const isHourLine = currentMin % 60 === 0
            return (
              <div 
                key={i} 
                className={`absolute w-full border-t pointer-events-none z-[5] ${isHourLine ? 'border-border/60' : 'border-border/20 border-dashed'}`}
                style={{ top: `${top}px` }}
              />
            )
          })}

          {days.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const status = getDayStatus(day)
            const dayAppts = appointments.filter(a => a.date.startsWith(dateStr))
            const isPastDay = day < new Date(new Date().setHours(0,0,0,0))
            const isTodayDay = isToday(day)
            const currentHourMinutes = new Date().getHours() * 60 + new Date().getMinutes()
            const currentPixels = (currentHourMinutes - startHour * 60) * PIXELS_PER_MINUTE

            return (
              <div key={i} className={`relative border-r last:border-r-0 border-border/80 ${status.isDayOff ? 'bg-muted/40' : 'bg-transparent'}`}>
                
                {/* Working intervals highlighted background */}
                {!status.isDayOff && status.intervals.map((inv, idx) => {
                  const s = parseTime(inv.start)
                  const e = parseTime(inv.end)
                  const top = (s - startHour * 60) * PIXELS_PER_MINUTE
                  const height = (e - s) * PIXELS_PER_MINUTE
                  if (top + height < 0 || top > containerHeight) return null
                  return (
                    <div 
                      key={idx} 
                      className="absolute w-[calc(100%-2px)] bg-background pointer-events-none shadow-sm border-l-4 border-primary/50" 
                      style={{ left: "1px", top: `${Math.max(0, top)}px`, height: `${Math.min(height, containerHeight - Math.max(0, top))}px` }} 
                    />
                  )
                })}

                {/* Grid Overlay to allow clicking for booking */}
                {!isEditMode && !isPastDay && !status.isDayOff && (
                  <div className="absolute inset-0 z-[1] cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => onDayClick(day)} />
                )}

                {/* Day Off Overhead */}
                {status.isDayOff && (
                  <div className="absolute inset-0 flex items-center justify-center flex-col opacity-30 select-none text-muted-foreground z-[1]">
                    <span className="text-sm font-semibold uppercase tracking-widest rotate-[-90deg]">Day Off</span>
                  </div>
                )}

                {/* Dimming and Now line */}
                {isPastDay && (
                  <div className="absolute inset-0 bg-background/50 z-[5] pointer-events-none" />
                )}
                {isTodayDay && currentPixels > 0 && currentPixels < containerHeight && (
                  <>
                    <div className="absolute top-0 w-full bg-background/50 z-[5] pointer-events-none" style={{ height: `${currentPixels}px` }} />
                    <div className="absolute w-full z-20 pointer-events-none" style={{ top: `${currentPixels}px` }}>
                      <div className="h-2 w-2 bg-red-500 rounded-full absolute -left-1 -top-1" />
                      <div className="w-full border-t-[2px] border-red-500" />
                    </div>
                  </>
                )}

                {dayAppts.map(a => {
                  const s = parseTime(a.startTime)
                  const e = parseTime(a.endTime)
                  const top = (s - startHour * 60) * PIXELS_PER_MINUTE
                  const height = (e - s) * PIXELS_PER_MINUTE

                  return (
                    <div 
                      key={a.id} 
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                      className="absolute w-[calc(100%-4px)] left-[2px] rounded-md bg-primary text-primary-foreground p-1 shadow-sm text-xs overflow-hidden hover:z-20 hover:shadow-md hover:ring-2 ring-primary/50 transition-all cursor-pointer group z-10"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="font-semibold leading-tight truncate">{a.client.name || 'Client'}</div>
                      <div className="opacity-90 leading-tight truncate mt-0.5">{a.service.name}</div>
                      <div className="opacity-75 leading-tight text-[10px] mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {a.startTime}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
