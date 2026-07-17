"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { format, startOfWeek, endOfWeek, addDays, isToday } from "date-fns"
import { useTranslation } from "react-i18next"
import { useDayPopoverPosition } from "./useDayPopoverPosition"
import type { Appointment, Template, Override, Interval } from "./ModernCalendar"
import { Clock, ChevronDown, Users } from "lucide-react"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import { groupOverlappingAppointments, pluralize, parseTime } from "./calendar-utils"
import WeekDayEditPopover from "./WeekDayEditPopover"

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
  dayOffColor: string
  apiPrefix?: string
  isAdminView?: boolean
  selectedMasterId?: string
  isMobile?: boolean
  onDayClick: (d: Date) => void
  onAppointmentClick: (a: Appointment) => void
  onDataChange: () => void
}

const HOURS = Array.from({ length: 24 }).map((_, i) => i)
// Mobile: fixed per-day column width inside the horizontally-scrollable week grid.
const MOBILE_DAY_COL_WIDTH = 110

interface ExpandedState {
  dateStr: string | null
  groupIdx: number | null
}

interface EditingDayState {
  dateStr: string | null
}

export default function WeekView({ currentDate, appointments, templates, overrides, step, startHour, endHour, isEditMode, availableSlotColor, dayOffColor, apiPrefix = "/api/master", selectedMasterId = "all", isMobile = false, onDayClick, onAppointmentClick, onDataChange }: WeekViewProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const locale = dateFnsLocale(language)
  const containerRef = useRef<HTMLDivElement>(null)
  // Separate ref for the scrollable grid-body wrapper — must NOT share `containerRef`
  // (a ref object attached to two DOM elements at once is invalid; `containerRef` alone
  // drives the "click outside to close" effect below and must point only at the outer
  // component wrapper).
  const bodyContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  // The day-edit popover is portaled to document.body and positioned via fixed viewport
  // coordinates (mirrors TimePickerDropdown.tsx / MasterSelectDropdown.tsx) rather than
  // CSS `position: absolute` relative to its narrow (110px on mobile) day-column trigger
  // — absolute positioning inside that narrow, horizontally-scrolled column caused the
  // popover to render off-screen instead of under the tapped date.
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editPopoverRef = useRef<HTMLDivElement>(null)
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
      const target = e.target as Node
      // The edit popover is portaled outside this component's DOM subtree, so
      // containerRef.contains() alone would treat any click inside it as "outside" —
      // exempt it explicitly (mirrors MasterSelectDropdown's dual trigger+panel check).
      const insidePopover = editPopoverRef.current && editPopoverRef.current.contains(target)
      if (containerRef.current && !containerRef.current.contains(target) && !insidePopover) {
        setExpanded({ dateStr: null, groupIdx: null })
        setEditingDay({ dateStr: null })
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fixed-viewport-coordinate positioning for the day-edit popover, computed from its
  // trigger button (see useDayPopoverPosition.ts) — the popover is portaled to
  // document.body since CSS `position: absolute` relative to its narrow, horizontally-
  // scrolled day-column trigger caused it to render off-screen on mobile.
  const editPopoverStyle = useDayPopoverPosition(editButtonRef, editingDay.dateStr)

  // Mobile: keep the day-name header row and the grid body scrolling horizontally as one
  // synced unit, while the hours gutter (a separate sibling column in each) stays pinned.
  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
  }
  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
  }

  // Reset horizontal scroll whenever the displayed week changes, so a scrolled position
  // from a prior week doesn't carry over on navigation. If the displayed week contains
  // today, scroll to today's column instead of Monday (Google-Calendar-mobile style).
  // Keyed on a formatted string (not the `startDate` Date object, which is a new
  // reference on every render) so this only fires when the week actually changes.
  const weekKey = format(startDate, "yyyy-MM-dd")
  useEffect(() => {
    let scrollLeft = 0
    for (let i = 0; i < 7; i++) {
      if (isToday(addDays(startDate, i))) {
        scrollLeft = i * MOBILE_DAY_COL_WIDTH
        break
      }
    }
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = scrollLeft
    if (bodyScrollRef.current) bodyScrollRef.current.scrollLeft = scrollLeft
  }, [weekKey])

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

  const toggleExpand = (dateStr: string, groupIdx: number) => {
    if (expanded.dateStr === dateStr && expanded.groupIdx === groupIdx) {
      setExpanded({ dateStr: null, groupIdx: null })
    } else {
      setExpanded({ dateStr, groupIdx })
    }
  }

  // Shared between the desktop grid-cols-7 header row and the mobile fixed-width scroller.
  const renderDayHeaderCell = (day: Date, i: number, widthClass = "") => {
    const isCurr = isToday(day)
    const isPastDay = day < new Date(new Date().setHours(0,0,0,0))
    const status = getDayStatus(day)
    const dateStr = format(day, "yyyy-MM-dd")
    const isSaving = savingDate === dateStr

    return (
      <div key={i} className={`${widthClass ? widthClass + ' ' : ''}pt-2 pb-1 px-1 flex flex-col items-center border-r last:border-r-0 border-border relative`}>
        {isSaving && <div className="absolute inset-0 bg-background/50 z-10 animate-pulse" />}
        <span className={`text-[11px] font-medium uppercase tracking-wider ${isCurr ? 'text-primary' : 'text-muted-foreground'}`}>
          {format(day, "EEE", { locale })}
        </span>
        <span className={`text-lg font-medium h-8 w-8 flex items-center justify-center rounded-full mt-0.5 ${isCurr ? 'bg-primary text-primary-foreground' : ''}`}>
          {format(day, "d")}
        </span>

        {isEditMode && !isPastDay && (
          <button
            ref={editingDay.dateStr === dateStr ? editButtonRef : undefined}
            onClick={() => setEditingDay({ dateStr })}
            className={`mt-2 w-full text-[10px] px-2 py-1 rounded font-medium transition-colors touch-manipulation ${
              status.isDayOff
                ? 'bg-[var(--md-error-container)] text-[var(--md-on-error-container)]'
                : status.intervals.length > 0
                  ? 'bg-[var(--md-success-container)] text-[var(--md-on-success-container)]'
                  : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {status.isDayOff
              ? t('admin.calendar.dayOffBtn')
              : status.intervals.length > 0
                ? `${status.intervals.length} ${pluralize(status.intervals.length, t('admin.calendar.shiftOne'), t('admin.calendar.shiftFew'), t('admin.calendar.shiftMany'))}`
                : t('admin.calendar.editBtn')}
          </button>
        )}
      </div>
    )
  }

  // Rendered once (regardless of mobile/desktop branch) — portals the currently-open
  // day-edit popover to document.body, positioned via editPopoverStyle (see the
  // useLayoutEffect above). Not tied to any specific day cell's render.
  const renderEditPopoverPortal = () => {
    if (!editingDay.dateStr) return null
    const day = days.find(d => format(d, "yyyy-MM-dd") === editingDay.dateStr)
    if (!day) return null
    const isPastDay = day < new Date(new Date().setHours(0, 0, 0, 0))
    if (isPastDay) return null
    const status = getDayStatus(day)
    return createPortal(
      <WeekDayEditPopover
        panelRef={editPopoverRef}
        style={editPopoverStyle}
        day={day}
        status={status}
        locale={locale}
        onClose={() => setEditingDay({ dateStr: null })}
        onToggleOff={() => toggleOff(day, status)}
        onAddShift={() => addShift(day, status)}
        onRemoveShift={(idx) => removeShift(day, status, idx)}
        onUpdateShift={(idx, field, val) => updateShift(day, status, idx, field, val)}
      />,
      document.body
    )
  }

  // Shared between the desktop grid-cols-7 body and the mobile fixed-width scroller.
  const renderDayColumn = (day: Date, i: number, widthClass = "") => {
    const dateStr = format(day, "yyyy-MM-dd")
    const status = getDayStatus(day)
    const dayAppts = appointments.filter(a => a.date.startsWith(dateStr))
    const isPastDay = day < new Date(new Date().setHours(0,0,0,0))
    const isTodayDay = isToday(day)
    const currentHourMinutes = new Date().getHours() * 60 + new Date().getMinutes()
    const currentPixels = (currentHourMinutes - startHour * 60) * PIXELS_PER_MINUTE

    const groups = groupOverlappingAppointments(dayAppts)

    return (
      <div key={i} className={`${widthClass ? widthClass + ' ' : ''}relative border-r last:border-r-0 border-border/80 ${status.isDayOff ? 'bg-muted/40' : 'bg-transparent'}`}>

        {!status.isDayOff && status.intervals.map((inv, idx) => {
          const s = parseTime(inv.start)
          const e = parseTime(inv.end)
          const top = (s - startHour * 60) * PIXELS_PER_MINUTE
          const height = (e - s) * PIXELS_PER_MINUTE
          if (top + height < 0 || top > containerHeight) return null
          return (
            <div
              key={idx}
              className="absolute w-[calc(100%-2px)] pointer-events-none shadow-sm border-l-[3px]"
              style={{ left: "1px", top: `${Math.max(0, top)}px`, height: `${Math.min(height, containerHeight - Math.max(0, top))}px`, backgroundColor: availableSlotColor + '1A', borderLeftColor: availableSlotColor }}
            />
          )
        })}

        {!isEditMode && !isPastDay && !status.isDayOff && (
          <div className="absolute inset-0 z-[1] cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => onDayClick(day)} />
        )}

        {status.isDayOff && (
          <>
            <div className="absolute inset-0 z-[0] pointer-events-none" style={{ backgroundColor: dayOffColor + '40' }} />
            <div className="absolute inset-0 flex items-center justify-center flex-col opacity-80 select-none z-[1]" style={{ color: dayOffColor }}>
              <span className="text-sm font-semibold uppercase tracking-widest rotate-[-90deg]">{t('admin.calendar.dayOffBtn')}</span>
            </div>
          </>
        )}

        {isPastDay && (
          <div className="absolute inset-0 bg-background/50 z-[5] pointer-events-none" />
        )}
        {isTodayDay && currentPixels > 0 && currentPixels < containerHeight && (
          <>
            <div className="absolute w-full bg-background/50 z-[5] pointer-events-none" style={{ top: 0, height: `${currentPixels}px` }} />
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
                className="absolute w-[calc(100%-8px)] rounded-md p-1 text-xs overflow-hidden hover:z-30 hover:shadow-md hover:ring-2 ring-primary/40 transition-all cursor-pointer backdrop-blur-sm text-foreground"
                style={{ top: `${top}px`, minHeight: `${Math.max(height, 24)}px`, left: "4px", zIndex: 10, backgroundColor: (a.master?.masterProfile?.color || "#8B4A58") + "26", borderLeft: "3px solid " + (a.master?.masterProfile?.color || "#8B4A58") }}
              >
                <div className="font-semibold leading-tight truncate">{a.client.name || t('admin.calendar.clientFallback')}</div>
                <div className="opacity-90 leading-tight truncate mt-0.5">{a.service.name_pl}</div>
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
                      style={{ borderLeft: `4px solid ${a.master?.masterProfile?.color || "#8B4A58"}` }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">{a.startTime}</span>
                        <span className="text-sm truncate">{a.client.name || t('admin.calendar.clientFallback')}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">{a.service.name_pl}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="backdrop-blur-sm text-foreground rounded-md p-1.5 shadow-md"
                  style={{ backgroundColor: (group[0].master?.masterProfile?.color || "#8B4A58") + "26", borderLeft: "3px solid " + (group[0].master?.masterProfile?.color || "#8B4A58") }}
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-semibold text-sm">{group.length}</span>
                    <span className="text-xs opacity-90">{pluralize(group.length, t('management.bookingOne'), t('management.bookingFew'), t('management.bookingMany'))}</span>
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
  }

  const timeLines = () => Array.from({ length: totalHours * Math.floor(60 / step) + 1 }).map((_, i) => {
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
  })

  if (isMobile) {
    const gridWidth = MOBILE_DAY_COL_WIDTH * days.length
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background animate-in fade-in duration-200" ref={containerRef}>
        <div className="flex border-b border-border shrink-0 bg-card">
          <div className="w-16 shrink-0 border-r border-border" />
          <div className="flex-1 overflow-x-auto custom-scrollbar" ref={headerScrollRef} onScroll={handleHeaderScroll}>
            <div className="flex" style={{ width: `${gridWidth}px` }}>
              {days.map((day, i) => renderDayHeaderCell(day, i, "w-[110px] shrink-0"))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-background" ref={bodyContainerRef}>
          <div className="flex" style={{ height: `${containerHeight + 40}px` }}>
            <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
              {HOURS.slice(startHour, endHour + 1).map(hour => (
                <div
                  key={hour}
                  className="absolute px-2 text-right text-xs text-muted-foreground font-medium w-full"
                  style={{ top: `${(hour - startHour) * 60 * PIXELS_PER_MINUTE + 12}px` }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>

            <div className="flex-1 relative overflow-x-auto custom-scrollbar" ref={bodyScrollRef} onScroll={handleBodyScroll}>
              <div className="relative" style={{ width: `${gridWidth}px`, top: '20px', height: `${containerHeight}px` }}>
                {timeLines()}
                <div className="flex h-full">
                  {days.map((day, i) => renderDayColumn(day, i, "w-[110px] shrink-0"))}
                </div>
              </div>
            </div>
          </div>
        </div>
        {renderEditPopoverPortal()}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background animate-in fade-in duration-200" ref={containerRef}>
      <div className="flex border-b border-border shrink-0 bg-card pr-2">
        <div className="w-16 shrink-0 border-r border-border" />
        <div className="flex-1 grid grid-cols-7">
          {days.map((day, i) => renderDayHeaderCell(day, i))}
        </div>
      </div>

      {/* Scrollable grid area */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-background" ref={bodyContainerRef}>
        {/* Single inner block whose height = grid + top/bottom padding (20px each) */}
        <div className="flex" style={{ height: `${containerHeight + 40}px` }}>

          {/* ── Hours column ── */}
          <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
            {HOURS.slice(startHour, endHour + 1).map(hour => (
              <div
                key={hour}
                className="absolute px-2 text-right text-xs text-muted-foreground font-medium w-full"
                style={{ top: `${(hour - startHour) * 60 * PIXELS_PER_MINUTE + 12}px` }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* ── Grid columns ── */}
          <div className="flex-1 relative">
            {/* Inner wrapper sized exactly to the grid — no more, no less */}
            <div
              className="absolute left-0 right-0 grid grid-cols-7"
              style={{ top: '20px', height: `${containerHeight}px` }}
            >
              {/* Horizontal time-lines */}
              {timeLines()}

              {/* Day columns */}
              {days.map((day, i) => renderDayColumn(day, i))}
            </div>
          </div>
        </div>
      </div>
      {renderEditPopoverPortal()}
    </div>
  )
}
