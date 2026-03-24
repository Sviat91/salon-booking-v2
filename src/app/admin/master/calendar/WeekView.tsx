"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { format, startOfWeek, endOfWeek, addDays, isToday } from "date-fns"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Clock, Plus, PowerOff, X, ChevronDown, Users } from "lucide-react"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"

interface WeekViewProps {
  currentDate: Date
  appointments: Appointment[]
  templates: Template[]
  overrides: Override[]
  step: number
  startHour: number
  endHour: number
  isEditMode: boolean
  availableSlotColor: string
  onDayClick: (d: Date) => void
  onAppointmentClick: (a: Appointment) => void
  onDataChange: () => void
}

const HOURS = Array.from({ length: 24 }).map((_, i) => i)

function groupOverlappingAppointments(appointments: Appointment[]): Appointment[][] {
  if (appointments.length === 0) return []
  
  const sorted = [...appointments].sort((a, b) => {
    const aStart = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1])
    const bStart = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1])
    return aStart - bStart
  })
  
  const groups: Appointment[][] = []
  let currentGroup: Appointment[] = [sorted[0]]
  let groupEnd = parseInt(sorted[0].endTime.split(':')[0]) * 60 + parseInt(sorted[0].endTime.split(':')[1])
  
  for (let i = 1; i < sorted.length; i++) {
    const appt = sorted[i]
    const apptStart = parseInt(appt.startTime.split(':')[0]) * 60 + parseInt(appt.startTime.split(':')[1])
    
    if (apptStart < groupEnd) {
      currentGroup.push(appt)
      const apptEnd = parseInt(appt.endTime.split(':')[0]) * 60 + parseInt(appt.endTime.split(':')[1])
      groupEnd = Math.max(groupEnd, apptEnd)
    } else {
      groups.push(currentGroup)
      currentGroup = [appt]
      groupEnd = parseInt(appt.endTime.split(':')[0]) * 60 + parseInt(appt.endTime.split(':')[1])
    }
  }
  groups.push(currentGroup)
  
  return groups
}

interface ExpandedState {
  dateStr: string | null
  groupIdx: number | null
}

interface EditingDayState {
  dateStr: string | null
}

export default function WeekView({ currentDate, appointments, templates, overrides, step, startHour, endHour, isEditMode, availableSlotColor, onDayClick, onAppointmentClick, onDataChange }: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const totalHours = endHour - startHour
  const PIXELS_PER_MINUTE = 1.5 
  const containerHeight = totalHours * 60 * PIXELS_PER_MINUTE

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
  const endDate = endOfWeek(currentDate, { weekStartsOn: 1 })

  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ExpandedState>({ dateStr: null, groupIdx: null })
  const [editingDay, setEditingDay] = useState<EditingDayState>({ dateStr: null })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded({ dateStr: null, groupIdx: null })
        setEditingDay({ dateStr: null })
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  const toggleExpand = (dateStr: string, groupIdx: number) => {
    if (expanded.dateStr === dateStr && expanded.groupIdx === groupIdx) {
      setExpanded({ dateStr: null, groupIdx: null })
    } else {
      setExpanded({ dateStr, groupIdx })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background" ref={containerRef}>
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
                  <button
                    onClick={() => setEditingDay({ dateStr })}
                    className={`mt-2 w-full text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                      status.isDayOff 
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' 
                        : status.intervals.length > 0
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {status.isDayOff ? 'Day Off' : status.intervals.length > 0 ? `${status.intervals.length} shift${status.intervals.length > 1 ? 's' : ''}` : 'Edit'}
                  </button>
                )}

                {editingDay.dateStr === dateStr && isEditMode && !isPastDay && (
                  <div className="absolute top-[105%] left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-2xl p-4 space-y-3 animate-in fade-in-0 zoom-in-95 duration-200 z-50 w-[260px] cursor-default" onClick={(e) => e.stopPropagation()}>
                    <div className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                      {format(day, "EEEE, MMM d")}
                      <button onClick={() => setEditingDay({ dateStr: null })} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {status.intervals.length > 0 && (
                      <div className="space-y-2">
                        {status.intervals.map((inv, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <TimePickerDropdown 
                              value={inv.start}
                              onChange={val => updateShift(day, status, idx, 'start', val)}
                              step={30}
                              startHour={6}
                              endHour={22}
                            />
                            <span className="text-muted-foreground">-</span>
                            <TimePickerDropdown 
                              value={inv.end}
                              onChange={val => updateShift(day, status, idx, 'end', val)}
                              step={30}
                              startHour={6}
                              endHour={22}
                            />
                            <button 
                              className="text-destructive p-1 hover:bg-destructive/10 rounded shrink-0" 
                              onClick={() => removeShift(day, status, idx)}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <button 
                        onClick={() => { toggleOff(day, status); }}
                        className={`flex-1 flex items-center justify-center py-2 gap-1 text-xs rounded font-medium transition-colors ${
                          status.isDayOff 
                            ? 'bg-primary/20 text-primary' 
                            : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400'
                        }`}
                      >
                        <PowerOff className="w-3.5 h-3.5" /> {status.isDayOff ? 'Working' : 'Day Off'}
                      </button>
                      {!status.isDayOff && (
                        <button 
                          onClick={() => addShift(day, status)}
                          className="flex-1 flex items-center justify-center py-2 gap-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Shift
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

        <div className="flex-1 grid grid-cols-7 relative bg-background" style={{ height: `${containerHeight}px` }}>
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

            const groups = groupOverlappingAppointments(dayAppts)

            return (
              <div key={i} className={`relative border-r last:border-r-0 border-border/80 ${status.isDayOff ? 'bg-muted/40' : 'bg-transparent'}`}>
                
                {!status.isDayOff && status.intervals.map((inv, idx) => {
                  const s = parseTime(inv.start)
                  const e = parseTime(inv.end)
                  const top = (s - startHour * 60) * PIXELS_PER_MINUTE
                  const height = (e - s) * PIXELS_PER_MINUTE
                  if (top + height < 0 || top > containerHeight) return null
                  return (
                    <div 
                      key={idx} 
                      className="absolute w-[calc(100%-2px)] bg-green-500/10 pointer-events-none shadow-sm border-l-4 border-green-500" 
                      style={{ left: "1px", top: `${Math.max(0, top)}px`, height: `${Math.min(height, containerHeight - Math.max(0, top))}px` }} 
                    />
                  )
                })}

                {!isEditMode && !isPastDay && !status.isDayOff && (
                  <div className="absolute inset-0 z-[1] cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => onDayClick(day)} />
                )}

                {status.isDayOff && (
                  <div className="absolute inset-0 flex items-center justify-center flex-col opacity-30 select-none text-muted-foreground z-[1]">
                    <span className="text-sm font-semibold uppercase tracking-widest rotate-[-90deg]">Day Off</span>
                  </div>
                )}

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

                {!isEditMode && groups.map((group, groupIdx) => {
                  if (group.length === 0) return null
                  
                  const firstAppt = group[0]
                  const lastAppt = group[group.length - 1]
                  const groupStart = parseTime(firstAppt.startTime)
                  const groupEnd = Math.max(...group.map(a => parseTime(a.endTime)))
                  const top = (groupStart - startHour * 60) * PIXELS_PER_MINUTE
                  const height = (groupEnd - groupStart) * PIXELS_PER_MINUTE
                  
                  const isExpanded = expanded.dateStr === dateStr && expanded.groupIdx === groupIdx

                  if (group.length === 1) {
                    const a = group[0]
                    return (
                      <div 
                        key={a.id} 
                        onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                        className="absolute w-[calc(100%-8px)] rounded-md p-1 text-xs overflow-hidden hover:z-30 hover:shadow-md hover:ring-2 ring-green-500/50 transition-all cursor-pointer backdrop-blur-sm text-white"
                        style={{ top: `${top}px`, minHeight: `${Math.max(height, 24)}px`, left: "4px", zIndex: 10, backgroundColor: (a.master?.masterProfile?.color || "#166534") + "CC", borderColor: (a.master?.masterProfile?.color || "#166534") + "80", borderWidth: '1px' }}
                      >
                        <div className="font-semibold leading-tight truncate">{a.client.name || 'Client'}</div>
                        <div className="opacity-90 leading-tight truncate mt-0.5">{a.service.name}</div>
                        <div className="opacity-75 leading-tight text-[10px] mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {a.startTime}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div 
                      key={`group-${groupIdx}`}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(dateStr, groupIdx); }}
                      className={`absolute rounded-md transition-all cursor-pointer ${isExpanded ? 'z-30' : 'z-10'}`}
                      style={{ top: `${top}px`, left: "4px", width: "calc(100% - 8px)" }}
                    >
                      {isExpanded ? (
                        <div className="bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
                          {group.map(a => (
                            <div 
                              key={a.id}
                              onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                              className="p-2 border-b last:border-b-0 border-border hover:bg-muted/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm">{a.startTime}</span>
                                <span className="text-sm truncate">{a.client.name || 'Client'}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">{a.service.name}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="backdrop-blur-sm text-white rounded-md p-1.5 shadow-md"
                          style={{ backgroundColor: (group[0].master?.masterProfile?.color || "#166534") + "CC", borderColor: (group[0].master?.masterProfile?.color || "#166534") + "80", borderWidth: '1px' }}
                        >
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span className="font-semibold text-sm">{group.length}</span>
                            <span className="text-xs opacity-90">bookings</span>
                            <ChevronDown className="w-3 h-3 ml-auto" />
                          </div>
                          <div className="text-[10px] opacity-75 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {firstAppt.startTime} - {lastAppt.endTime}
                          </div>
                        </div>
                      )}
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
