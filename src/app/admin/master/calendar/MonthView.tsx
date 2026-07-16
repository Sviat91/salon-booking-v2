"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns"
import { useTranslation } from "react-i18next"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Plus, PowerOff, X, ChevronDown, Clock } from "lucide-react"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import { pluralize } from "./calendar-utils"

interface MonthViewProps {
  currentDate: Date
  appointments: Appointment[]
  templates: Template[]
  overrides: Override[]
  isEditMode: boolean
  availableSlotColor: string
  dayOffColor: string
  apiPrefix?: string
  isAdminView?: boolean
  selectedMasterId?: string
  isMobile?: boolean
  onDayClick: (d: Date) => void
  onAppointmentClick: (a: Appointment) => void
  onDataChange: () => void
}

const DAY_OF_WEEK_KEYS = ["dates.mondayShort", "dates.tuesdayShort", "dates.wednesdayShort", "dates.thursdayShort", "dates.fridayShort", "dates.saturdayShort", "dates.sundayShort"]

interface ExpandedState {
  type: 'shifts' | 'appointments' | null
  dateStr: string | null
}

export default function MonthView({ currentDate, appointments, templates, overrides, isEditMode, availableSlotColor, dayOffColor, apiPrefix = "/api/master", selectedMasterId = "all", isMobile = false, onDayClick, onAppointmentClick, onDataChange }: MonthViewProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const locale = dateFnsLocale(language)
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ExpandedState>({ type: null, dateStr: null })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded({ type: null, dateStr: null })
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

  const updateServer = async (date: Date, isDayOff: boolean, intervals: Interval[]) => {
    const dateStr = format(date, "yyyy-MM-dd")
    setSavingDate(dateStr)
    try {
      await fetch(`${apiPrefix}/schedule/overrides/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [dateStr], isDayOff, intervals, masterId: selectedMasterId !== "all" ? selectedMasterId : undefined }),
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

  const toggleExpand = (type: 'shifts' | 'appointments', dateStr: string) => {
    if (expanded.type === type && expanded.dateStr === dateStr) {
      setExpanded({ type: null, dateStr: null })
    } else {
      setExpanded({ type, dateStr })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-200" ref={containerRef}>
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-muted/20">
        {DAY_OF_WEEK_KEYS.map(k => (
          <div key={k} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0">
            {t(k)}
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
          
          const isExpanded = expanded.dateStr === dateStr
          const shiftsCount = status.intervals.length
          const apptsCount = dayAppts.length

          return (
            <div
              key={i}
              onClick={() => {
                if (isMobile) { onDayClick(day); return }
                if (!isEditMode && !isPastDay && apptsCount === 0) onDayClick(day)
              }}
              className={`border-b border-r border-border p-1 flex flex-col transition-colors relative
                ${isMobile || (!isEditMode && !isPastDay) ? "cursor-pointer hover:bg-muted/10" : ""}
                ${!isCurrentMonth ? "bg-muted/30 opacity-50" : (shiftsCount > 0 || apptsCount > 0) ? "" : "bg-card"}
                ${isPastDay && isCurrentMonth && !isMobile ? "opacity-60 pointer-events-none" : ""}
              `}
              style={{ backgroundColor: status.isDayOff && isCurrentMonth ? dayOffColor + '40' : (!isPastDay && !status.isDayOff && shiftsCount > 0) ? availableSlotColor + '1A' : undefined }}
            >
              {isSaving && <div className="absolute inset-0 bg-background/50 z-10 animate-pulse pointer-events-none" />}

              <div className="flex justify-between items-start mb-1 h-6 shrink-0">
                <span className={`text-sm flex items-center justify-center h-6 w-6 rounded-full font-medium ${isCurrentDay ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                {status.isDayOff && !isMobile && (
                  <span className="text-[10px] uppercase font-bold text-destructive">{t('admin.calendar.offBadge')}</span>
                )}
              </div>

              {isMobile ? (
                apptsCount > 0 && (
                  <div className="mt-auto flex justify-center pb-1">
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                      {apptsCount}
                    </span>
                  </div>
                )
              ) : (
              <>
              {!isEditMode && apptsCount > 0 && (
                <div className="flex-1 relative">
                  {isExpanded && expanded.type === 'appointments' ? (
                    <div className="absolute left-0 right-0 top-0 bg-card border border-border rounded-lg shadow-xl p-2 space-y-1.5 animate-in fade-in-0 zoom-in-95 duration-200 z-40" onClick={(e) => e.stopPropagation()}>
                      {dayAppts.map(a => (
                        <div 
                          key={a.id} 
                          onClick={(e) => { e.stopPropagation(); onAppointmentClick(a); setExpanded({ type: null, dateStr: null }); }}
                          className="text-xs px-2 py-1.5 rounded text-foreground transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                          style={{ backgroundColor: (a.master?.masterProfile?.color || "#8B4A58") + "26", borderLeft: "3px solid " + (a.master?.masterProfile?.color || "#8B4A58") }}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{a.startTime}</span>
                          <span className="truncate">{a.client.name || t('admin.calendar.clientFallback')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand('appointments', dateStr); }}
                      className="w-full text-left transition-all duration-200"
                    >
                      <div
                        className="flex items-center gap-1 px-1.5 py-1 rounded transition-colors shadow-sm"
                        style={{ backgroundColor: (dayAppts[0]?.master?.masterProfile?.color || "#8B4A58") + "26", borderLeft: "3px solid " + (dayAppts[0]?.master?.masterProfile?.color || "#8B4A58") }}
                      >
                        <span className="text-[11px] truncate font-medium text-foreground">
                          {apptsCount} {pluralize(apptsCount, t('management.bookingOne'), t('management.bookingFew'), t('management.bookingMany'))}
                        </span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {isEditMode && !isPastDay && !status.isDayOff && shiftsCount > 0 && (
                <div className="flex-1 relative mt-1">
                  {isExpanded && expanded.type === 'shifts' ? (
                    <div className="absolute top-0 left-0 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-2 animate-in fade-in-0 zoom-in-95 duration-200 z-50 w-[240px]" onClick={(e) => e.stopPropagation()}>
                      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                        {format(day, "EEE, MMM d", { locale })}
                        <button onClick={(e) => { e.stopPropagation(); setExpanded({ type: null, dateStr: null }); }} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {status.intervals.map((inv, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <TimePickerDropdown 
                            value={inv.start}
                            onChange={val => updateShift(day, status, idx, 'start', val)}
                            step={30}
                            startHour={6}
                            endHour={22}
                          />
                          <span className="text-muted-foreground text-sm">-</span>
                          <TimePickerDropdown 
                            value={inv.end}
                            onChange={val => updateShift(day, status, idx, 'end', val)}
                            step={30}
                            startHour={6}
                            endHour={22}
                          />
                          <button 
                            className="text-destructive p-1 hover:bg-destructive/10 rounded shrink-0" 
                            onClick={e => { e.stopPropagation(); removeShift(day, status, idx); }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2 mt-2 border-t border-border/50">
                        <button 
                          onClick={e => { e.stopPropagation(); toggleOff(day, status); setExpanded({ type: null, dateStr: null }); }}
                          className="flex-1 flex items-center justify-center py-2 gap-1 text-xs rounded font-medium transition-colors bg-[var(--md-error-container)] text-[var(--md-on-error-container)] hover:brightness-95"
                        >
                          <PowerOff className="w-3.5 h-3.5" /> {t('admin.calendar.dayOffBtn')}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); addShift(day, status); }}
                          className="flex-1 flex items-center justify-center py-2 gap-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t('admin.calendar.addShiftBtn')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand('shifts', dateStr); }}
                      className="w-full text-left transition-all duration-200"
                    >
                      <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-[var(--md-success-container)] hover:brightness-95 transition-colors">
                        <span className="text-[11px] truncate font-medium text-[var(--md-on-success-container)]">
                          {shiftsCount} {pluralize(shiftsCount, t('admin.calendar.shiftOne'), t('admin.calendar.shiftFew'), t('admin.calendar.shiftMany'))}
                        </span>
                        <ChevronDown className="w-3 h-3 text-[var(--md-on-success-container)] shrink-0" />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {isEditMode && !isPastDay && status.isDayOff && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleOff(day, status); }}
                  className="mt-1 text-[10px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
                >
                  {t('admin.calendar.setWorkingBtn')}
                </button>
              )}

              {isEditMode && !isPastDay && !status.isDayOff && shiftsCount === 0 && (
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={e => { e.stopPropagation(); toggleOff(day, status); }}
                    className="flex-1 flex items-center justify-center py-1 gap-1 text-[10px] rounded font-medium transition-colors bg-[var(--md-error-container)] text-[var(--md-on-error-container)] hover:brightness-95"
                  >
                    <PowerOff className="w-3 h-3" /> {t('admin.calendar.offBadge')}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); addShift(day, status); }}
                    className="flex-1 flex items-center justify-center py-1 gap-1 text-[10px] bg-background border rounded hover:bg-muted font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" /> {t('admin.calendar.shiftBtn')}
                  </button>
                </div>
              )}
              </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
