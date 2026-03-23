"use client"

import { useRef, useState } from "react"
import { format, isToday } from "date-fns"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Clock, Phone, Scissors, User, Plus, PowerOff, X } from "lucide-react"

interface DayViewProps {
  currentDate: Date
  appointments: Appointment[]
  templates: Template[]
  overrides: Override[]
  step: number
  startHour: number
  endHour: number
  isEditMode: boolean
  onAddClick: (d: Date) => void
  onAppointmentClick: (a: Appointment) => void
  onDataChange: () => void
}

const HOURS = Array.from({ length: 24 }).map((_, i) => i)

export default function DayView({ currentDate, appointments, templates, overrides, step, startHour, endHour, isEditMode, onAddClick, onAppointmentClick, onDataChange }: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const totalHours = endHour - startHour
  const PIXELS_PER_MINUTE = 2 
  const containerHeight = totalHours * 60 * PIXELS_PER_MINUTE
  const [savingDate, setSavingDate] = useState<string | null>(null)

  const dateStr = format(currentDate, "yyyy-MM-dd")
  const jsDayOfWeek = currentDate.getDay()

  const getDayStatus = () => {
    const ovr = overrides.find(o => o.date.startsWith(dateStr))
    if (ovr) return { isDayOff: ovr.isDayOff, intervals: ovr.intervals }
    const tmpl = templates.find(t => t.dayOfWeek === jsDayOfWeek)
    if (tmpl) return { isDayOff: tmpl.isDayOff, intervals: tmpl.intervals }
    return { isDayOff: false, intervals: [] }
  }

  const status = getDayStatus()
  const dayAppts = appointments.filter(a => a.date.startsWith(dateStr))
  const isCurr = isToday(currentDate)
  const isPastDay = currentDate < new Date(new Date().setHours(0,0,0,0))

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number)
    return h * 60 + m
  }

  const updateServer = async (date: Date, isDayOff: boolean, intervals: Interval[]) => {
    const dStr = format(date, "yyyy-MM-dd")
    setSavingDate(dStr)
    try {
      await fetch("/api/master/schedule/overrides/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [dStr], isDayOff, intervals }),
      })
      onDataChange()
    } finally {
      setSavingDate(null)
    }
  }

  const toggleOff = () => updateServer(currentDate, !status.isDayOff, !status.isDayOff ? [] : [{ start: "09:00", end: "18:00" }])
  const addShift = () => updateServer(currentDate, false, [...status.intervals, { start: "12:00", end: "13:00" }])
  const removeShift = (idx: number) => updateServer(currentDate, status.isDayOff, status.intervals.filter((_, i) => i !== idx))
  const updateShift = (idx: number, field: 'start'|'end', val: string) => {
    const newIntervals = [...status.intervals]
    newIntervals[idx] = { ...newIntervals[idx], [field]: val }
    updateServer(currentDate, status.isDayOff, newIntervals)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex border-b border-border shrink-0 bg-card pr-2">
        <div className="w-16 shrink-0 border-r border-border" /> 
        <div className="flex-1 py-3 px-4 flex justify-between items-center relative">
          {savingDate && <div className="absolute inset-0 bg-background/50 z-10 animate-pulse pointer-events-none" />}
          
          <div className="flex flex-col items-start">
            <span className={`text-xs font-medium uppercase tracking-wider ${isCurr ? 'text-primary' : 'text-muted-foreground'}`}>
              {format(currentDate, "EEEE")}
            </span>
            <span className={`text-2xl font-bold rounded-full mt-1 ${isCurr ? 'text-primary' : ''}`}>
              {format(currentDate, "MMMM d")}
            </span>
          </div>

          {isEditMode && !isPastDay && (
            <div className="flex items-center gap-4 bg-muted/40 p-2 rounded-lg border border-border/50 shadow-inner">
              {!status.isDayOff && status.intervals.map((inv, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-background border rounded px-1.5 py-1">
                  <input type="time" value={inv.start} onChange={e => updateShift(idx, 'start', e.target.value)} className="bg-transparent text-sm outline-none" />
                  <span className="text-muted-foreground mx-1">-</span>
                  <input type="time" value={inv.end} onChange={e => updateShift(idx, 'end', e.target.value)} className="bg-transparent text-sm outline-none" />
                  <button className="text-destructive ml-2 hover:bg-destructive/10 p-0.5 rounded" onClick={() => removeShift(idx)}><X className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex gap-2 border-l border-border/50 pl-4">
                <button onClick={toggleOff} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium ${status.isDayOff ? 'bg-primary/20 text-primary' : 'bg-red-100 text-red-600'}`}>
                  <PowerOff className="w-4 h-4" /> {status.isDayOff ? 'Work' : 'Day Off'}
                </button>
                {!status.isDayOff && (
                  <button onClick={addShift} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-background border rounded hover:bg-muted font-medium">
                    <Plus className="w-4 h-4" /> Shift
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEditMode && !isPastDay && !status.isDayOff && (
            <button 
              onClick={() => onAddClick(currentDate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm ml-auto"
            >
              <Plus className="w-4 h-4" /> New Booking
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar flex bg-muted/40" ref={containerRef}>
        <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
          {HOURS.slice(startHour, endHour).map(hour => (
            <div 
              key={hour} 
              className="px-2 text-right text-sm text-muted-foreground font-medium relative -top-3"
              style={{ height: `${60 * PIXELS_PER_MINUTE}px`, top: `${(hour - startHour) * 60 * PIXELS_PER_MINUTE - 14}px`, position: 'absolute', width: '100%' }}
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="flex-1 relative" style={{ height: `${containerHeight}px` }}>
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

          {status.isDayOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40 z-0">
              <span className="text-2xl font-bold text-muted-foreground opacity-30 select-none uppercase tracking-widest">
                Day Off
              </span>
            </div>
          )}

          {!status.isDayOff && status.intervals.map((inv, idx) => {
            const s = parseTime(inv.start)
            const e = parseTime(inv.end)
            const top = (s - startHour * 60) * PIXELS_PER_MINUTE
            const height = (e - s) * PIXELS_PER_MINUTE
            if (top + height < 0 || top > containerHeight) return null
            return (
              <div 
                key={idx} 
                className="absolute w-full bg-background pointer-events-none z-0 border-l-[4px] border-primary shadow-sm" 
                style={{ top: `${Math.max(0, top)}px`, height: `${Math.min(height, containerHeight - Math.max(0, top))}px` }} 
              />
            )
          })}

          {isPastDay && (
            <div className="absolute inset-0 bg-background/50 z-[5] pointer-events-none" />
          )}
          
          {isCurr && (() => {
            const currentHourMinutes = new Date().getHours() * 60 + new Date().getMinutes()
            const currentPixels = (currentHourMinutes - startHour * 60) * PIXELS_PER_MINUTE
            if (currentPixels > 0 && currentPixels < containerHeight) {
              return (
                <>
                  <div className="absolute top-0 w-full bg-background/50 z-[5] pointer-events-none" style={{ height: `${currentPixels}px` }} />
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: `${currentPixels}px` }}>
                    <div className="h-3 w-3 bg-red-500 rounded-full absolute -left-1.5 -top-1.5" />
                    <div className="w-full border-t-2 border-red-500" />
                  </div>
                </>
              )
            }
          })()}

          {dayAppts.map(a => {
            const s = parseTime(a.startTime)
            const e = parseTime(a.endTime)
            const top = (s - startHour * 60) * PIXELS_PER_MINUTE
            const height = (e - s) * PIXELS_PER_MINUTE

            return (
              <div 
                key={a.id} 
                onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                className="absolute w-[calc(100%-20px)] left-2 rounded-lg bg-primary/10 text-card-foreground p-3 shadow-md border-l-4 border-primary overflow-hidden hover:z-20 hover:shadow-lg transition-all cursor-pointer z-10 flex gap-4 backdrop-blur-sm"
                style={{ top: `${top}px`, height: `${height}px` }}
              >
                <div className="flex flex-col gap-1 w-[150px] shrink-0 border-r border-primary/20 pr-4">
                  <div className="font-bold text-lg">{a.startTime}</div>
                  <div className="text-sm text-muted-foreground">{a.endTime}</div>
                  <div className="mt-auto text-xs font-semibold text-primary/80 uppercase tracking-wider">{a.status}</div>
                </div>
                
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <h3 className="font-semibold text-base truncate flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {a.client.name || 'Unknown Client'}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Scissors className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{a.service.name}</span>
                    </div>
                    {a.client.phone && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Phone className="w-3.5 h-3.5" />
                        {a.client.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
