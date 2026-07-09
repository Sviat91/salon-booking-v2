"use client"

import { useRef, useState, useEffect } from "react"
import { format, isToday } from "date-fns"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Clock, Phone, Scissors, User, Plus, PowerOff, X, ChevronDown, Users } from "lucide-react"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"

interface DayViewProps {
  currentDate: Date
  appointments: Appointment[]
  templates: Template[]
  overrides: Override[]
  step: number
  startHour: number
  endHour: number
  isEditMode: boolean
  availableSlotColor: string
  dayOffColor: string
  apiPrefix?: string
  isAdminView?: boolean
  selectedMasterId?: string
  onAddClick: (d: Date) => void
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

export default function DayView({ currentDate, appointments, templates, overrides, step, startHour, endHour, isEditMode, availableSlotColor, dayOffColor, apiPrefix = "/api/master", selectedMasterId = "all", onAddClick, onAppointmentClick, onDataChange }: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const totalHours = endHour - startHour
  const PIXELS_PER_MINUTE = 2 
  const containerHeight = totalHours * 60 * PIXELS_PER_MINUTE
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandedGroup(null)
        setIsEditingSchedule(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
      await fetch(`${apiPrefix}/schedule/overrides/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [dStr], isDayOff, intervals, masterId: selectedMasterId !== "all" ? selectedMasterId : undefined }),
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

  const groups = groupOverlappingAppointments(dayAppts)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background animate-in fade-in duration-200" ref={containerRef}>
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
            <div className="flex flex-wrap items-center gap-4 bg-muted/40 p-2 rounded-lg border border-border/50 shadow-inner ml-auto mr-4">
              {status.isDayOff ? (
                <div className="text-sm font-medium text-destructive flex items-center gap-2 px-2">
                  <PowerOff className="w-4 h-4" /> Day Off
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {status.intervals.map((inv, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-background p-1 rounded border shadow-sm">
                      <TimePickerDropdown 
                        value={inv.start}
                        onChange={val => updateShift(idx, 'start', val)}
                        step={30}
                        startHour={6}
                        endHour={22}
                      />
                      <span className="text-muted-foreground font-medium">-</span>
                      <TimePickerDropdown 
                        value={inv.end}
                        onChange={val => updateShift(idx, 'end', val)}
                        step={30}
                        startHour={6}
                        endHour={22}
                      />
                      <button 
                        className="text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors shrink-0" 
                        onClick={() => removeShift(idx)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-2 border-l border-border/50 pl-4 h-full">
                <button 
                  onClick={toggleOff} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                    status.isDayOff ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-[var(--md-error-container)] text-[var(--md-on-error-container)] hover:brightness-95'
                  }`}
                >
                  <PowerOff className="w-3.5 h-3.5" /> {status.isDayOff ? 'Work' : 'Day Off'}
                </button>
                {!status.isDayOff && (
                  <button 
                    onClick={addShift} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-background border rounded-md hover:bg-muted font-medium transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Shift
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEditMode && !isPastDay && !status.isDayOff && (
            <button 
              onClick={() => onAddClick(currentDate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm ml-auto"
            >
              <Plus className="w-4 h-4" /> New Booking
            </button>
          )}
        </div>
      </div>
      {/* Scrollable grid area */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-background" ref={containerRef}>
        <div className="flex" style={{ height: `${containerHeight + 40}px` }}>

          {/* ── Hours column ── */}
          <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
            {HOURS.slice(startHour, endHour + 1).map(hour => (
              <div
                key={hour}
                className="absolute px-2 text-right text-sm text-muted-foreground font-medium w-full"
                style={{ top: `${(hour - startHour) * 60 * PIXELS_PER_MINUTE + 12}px` }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* ── Grid area ── */}
          <div className="flex-1 relative">
            <div
              className="absolute left-0 right-0"
              style={{ top: '20px', height: `${containerHeight}px` }}
            >
              {/* Horizontal time-lines */}
              {Array.from({ length: totalHours * Math.floor(60 / step) + 1 }).map((_, i) => {
                const currentMin = i * step
                const top = currentMin * PIXELS_PER_MINUTE
                const isHourLine = currentMin % 60 === 0
                return (
                  <div
                    key={`line-${i}`}
                    className={`absolute w-full border-t pointer-events-none z-[5] ${isHourLine ? 'border-border/60' : 'border-border/20 border-dashed'}`}
                    style={{ top: `${top}px` }}
                  />
                )
              })}

              {status.isDayOff && (
                <div className="absolute inset-0 flex items-center justify-center z-0" style={{ backgroundColor: dayOffColor + '40' }}>
                  <span className="text-2xl font-bold opacity-80 select-none uppercase tracking-widest" style={{ color: dayOffColor }}>
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
                    className="absolute w-full pointer-events-none z-0 border-l-[4px] shadow-sm" 
                    style={{ top: `${Math.max(0, top)}px`, height: `${Math.min(height, containerHeight - Math.max(0, top))}px`, backgroundColor: availableSlotColor + '1A', borderLeftColor: availableSlotColor }} 
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

              {groups.map((group, groupIdx) => {
                if (group.length === 0) return null
                
                const firstAppt = group[0]
                const groupStart = parseTime(firstAppt.startTime)
                const groupEnd = Math.max(...group.map(a => parseTime(a.endTime)))
                const top = (groupStart - startHour * 60) * PIXELS_PER_MINUTE
                const height = (groupEnd - groupStart) * PIXELS_PER_MINUTE
                
                const isExpanded = expandedGroup === groupIdx

                if (group.length === 1) {
                  const a = group[0]
                  return (
                    <div 
                      key={a.id} 
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                      className="absolute w-[calc(100%-30px)] rounded-lg text-foreground p-3 shadow-md border-l-[3px] overflow-hidden hover:z-30 hover:shadow-xl transition-all cursor-pointer flex gap-4 backdrop-blur-sm"
                      style={{ top: `${top}px`, minHeight: `${Math.max(height, 60)}px`, left: "8px", zIndex: 10, backgroundColor: (a.master?.masterProfile?.color || "#8B4A58") + "26", borderLeftColor: a.master?.masterProfile?.color || "#8B4A58" }}
                    >
                      <div className="flex flex-col gap-1 w-[150px] shrink-0 border-r border-foreground/10 pr-4">
                        <div className="font-bold text-lg">{a.startTime}</div>
                        <div className="text-sm opacity-70">{a.endTime}</div>
                        <div className="mt-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider">{a.status}</div>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <h3 className="font-semibold text-base truncate flex items-center gap-2">
                          <User className="w-4 h-4 opacity-70" />
                          {a.client.name || 'Unknown Client'}
                        </h3>
                        
                        <div className="flex items-center gap-4 text-sm opacity-90">
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
                }

                return (
                  <div 
                    key={`group-${groupIdx}`}
                    onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : groupIdx); }}
                    className={`absolute rounded-lg transition-all cursor-pointer ${isExpanded ? 'z-30' : 'z-10'}`}
                    style={{ top: `${top}px`, left: "8px", width: "calc(100% - 30px)" }}
                  >
                    {isExpanded ? (
                      <div className="bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
                        {group.map(a => (
                          <div 
                            key={a.id}
                            onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); }}
                            className="p-3 border-b last:border-b-0 border-border hover:bg-muted/50 transition-colors cursor-pointer flex gap-4"
                            style={{ borderLeft: `6px solid ${a.master?.masterProfile?.color || "#8B4A58"}` }}
                          >
                            <div className="flex flex-col gap-1 w-[100px] shrink-0">
                              <div className="font-bold text-lg">{a.startTime}</div>
                              <div className="text-sm text-muted-foreground">{a.endTime}</div>
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
                        ))}
                      </div>
                    ) : (
                      <div 
                        className="backdrop-blur-sm text-foreground rounded-lg p-3 shadow-md"
                        style={{ minHeight: `${Math.max(height, 60)}px`, backgroundColor: (group[0].master?.masterProfile?.color || "#8B4A58") + "26", borderLeft: "3px solid " + (group[0].master?.masterProfile?.color || "#8B4A58") }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4" />
                          <span className="font-semibold text-lg">{group.length}</span>
                          <span className="text-sm opacity-90">bookings at this time</span>
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        </div>
                        <div className="text-xs opacity-75 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {firstAppt.startTime} - {group[group.length - 1].endTime}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
