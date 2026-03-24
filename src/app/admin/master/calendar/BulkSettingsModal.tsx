"use client"

import { useState, useEffect, useCallback } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, addDays, getDay, isToday } from "date-fns"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, Plus, Trash2 } from "lucide-react"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"

type Interval = { start: string; end: string }
type Override = { date: string; isDayOff: boolean; intervals: Interval[] }
type Template = { dayOfWeek: number; isDayOff: boolean; intervals: Interval[] }

interface BulkSettingsModalProps {
  onClose: () => void
  onSave: (dates: string[], isDayOff: boolean, intervals: Interval[]) => Promise<void>
  templates?: Template[]
}

/**
 * BulkSettingsModal fetches its OWN overrides for the displayed month,
 * so it always shows correct day-off / scheduled indicators regardless
 * of what the parent calendar is currently viewing.
 */
export default function BulkSettingsModal({ onClose, onSave, templates = [] }: BulkSettingsModalProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  
  const [isDayOff, setIsDayOff] = useState(false)
  const [intervals, setIntervals] = useState<Interval[]>([{ start: "09:00", end: "18:00" }])
  const [saving, setSaving] = useState(false)

  // Self-fetched overrides for the currently displayed month
  const [monthOverrides, setMonthOverrides] = useState<Override[]>([])

  const fetchMonthOverrides = useCallback(async (month: Date) => {
    const from = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")
    const to = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")
    try {
      const res = await fetch(`/api/master/schedule/overrides?from=${from}&to=${to}`)
      const data = await res.json()
      // Normalize: date from API is an ISO string like "2026-03-25T00:00:00.000Z"
      // Convert to "yyyy-MM-dd" so comparisons are simple
      setMonthOverrides(
        (data.overrides || []).map((o: any) => ({
          ...o, 
          date: typeof o.date === 'string' ? o.date.substring(0, 10) : format(new Date(o.date), 'yyyy-MM-dd'),
          intervals: JSON.parse(o.intervals)
        }))
      )
    } catch {
      setMonthOverrides([])
    }
  }, [])

  useEffect(() => {
    fetchMonthOverrides(currentMonth)
  }, [currentMonth, fetchMonthOverrides])

  const toggleDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    const newSet = new Set(selectedDates)
    if (newSet.has(dateStr)) {
      newSet.delete(dateStr)
    } else {
      newSet.add(dateStr)
    }
    setSelectedDates(newSet)
  }

  // Determine if a day is marked as day-off in the calendar (override > template)
  // Note: API returns o.date as ISO string like "2026-03-25T00:00:00.000Z"
  const isCalendarDayOff = (d: Date): boolean => {
    const dateStr = format(d, "yyyy-MM-dd")
    const dayOfWeek = getDay(d)
    const override = monthOverrides.find(o => o.date === dateStr)
    if (override) return override.isDayOff
    const tmpl = templates.find(t => t.dayOfWeek === dayOfWeek)
    if (tmpl) return tmpl.isDayOff
    return false
  }

  // Determine if a day has a schedule override set (working or day-off)
  const hasScheduleSet = (d: Date): boolean => {
    const dateStr = format(d, "yyyy-MM-dd")
    return monthOverrides.some(o => o.date === dateStr)
  }

  // Determine if a day has a working template (not day-off)
  const hasWorkingTemplate = (d: Date): boolean => {
    const dayOfWeek = getDay(d)
    const tmpl = templates.find(t => t.dayOfWeek === dayOfWeek)
    return tmpl ? !tmpl.isDayOff : false
  }

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    // Pad to exactly 42 days (6 weeks) so the height never jumps
    while (days.length < 42) {
      days.push(day)
      day = addDays(day, 1)
    }

    return (
      <div className="grid grid-cols-7 gap-1 mt-4">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold pb-2 text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d, idx) => {
          const dateStr = format(d, "yyyy-MM-dd")
          const isSelected = selectedDates.has(dateStr)
          const isCurrentMonth = isSameMonth(d, monthStart)
          const isTdy = isToday(d)
          const isPast = d < new Date(new Date().setHours(0,0,0,0))
          const isDayOffDay = isCalendarDayOff(d)
          const hasOverride = hasScheduleSet(d)
          const hasTemplate = hasWorkingTemplate(d)
          const hasSchedule = hasOverride || hasTemplate
          
          const isDisabled = isPast || !isCurrentMonth

          return (
            <button
              key={idx}
              type="button"
              disabled={isDisabled}
              onClick={() => toggleDate(d)}
              className={`relative h-10 w-full rounded-md flex items-center justify-center text-sm transition-colors border border-transparent
                ${isDisabled ? "text-muted-foreground opacity-30 cursor-not-allowed" : ""}
                ${!isDisabled && isDayOffDay && !isSelected ? "text-red-500 bg-red-500/10 hover:bg-red-500/15 border-red-500/30" : ""}
                ${!isDisabled && isTdy && !isSelected ? "ring-2 ring-primary bg-primary/10 font-bold" : ""}
                ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-md" : !isDisabled ? "hover:bg-muted" : ""}
              `}
            >
              <span className={isTdy ? 'font-bold' : ''}>{format(d, "d")}</span>
              
              {/* Green dot = schedule exists for this day (override or template) */}
              {!isDisabled && hasSchedule && !isDayOffDay && (
                <div className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-green-500'}`} />
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const handleSave = async () => {
    if (selectedDates.size === 0) {
      alert("Please select at least one date.")
      return
    }
    setSaving(true)
    try {
      await onSave(Array.from(selectedDates), isDayOff, isDayOff ? [] : intervals)
      onClose()
    } catch (e: any) {
      alert("Error saving: " + e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left: Calendar Picker */}
        <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Select Dates</h3>
            <div className="text-sm font-medium bg-muted px-2 py-1 rounded-md">
              {selectedDates.size} selected
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {renderCalendar()}
        </div>

        {/* Right: Settings — NO overflow-scroll, dropdown will naturally overflow */}
        <div className="w-full md:w-[320px] p-6 bg-muted/10 flex flex-col relative overflow-visible">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">Configure</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="flex items-center gap-2 border bg-background p-3 rounded-lg shadow-sm">
              <input 
                type="checkbox" 
                id="bulkDayOff" 
                checked={isDayOff}
                onChange={(e) => setIsDayOff(e.target.checked)}
                className="h-4 w-4 accent-primary" 
              />
              <label htmlFor="bulkDayOff" className="text-sm font-medium cursor-pointer">
                Mark as Day Off
              </label>
            </div>

            {!isDayOff && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Working Intervals</span>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={() => setIntervals([...intervals, { start: "12:00", end: "13:00" }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Interval
                  </Button>
                </div>
                
                {intervals.length === 0 && <p className="text-xs text-muted-foreground">No intervals added.</p>}
                
                {intervals.map((inv, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-background p-2 rounded-md border shadow-sm">
                    <div className="flex-1 min-w-0">
                      <TimePickerDropdown 
                        value={inv.start}
                        onChange={(val) => {
                          const newInt = [...intervals]
                          newInt[idx].start = val
                          setIntervals(newInt)
                        }}
                      />
                    </div>
                    <span className="text-muted-foreground">-</span>
                    <div className="flex-1 min-w-0">
                      <TimePickerDropdown 
                        value={inv.end}
                        onChange={(val) => {
                          const newInt = [...intervals]
                          newInt[idx].end = val
                          setIntervals(newInt)
                        }}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => setIntervals(intervals.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <Button className="w-full" disabled={saving || selectedDates.size === 0} onClick={handleSave}>
              {saving ? "Saving..." : `Apply to ${selectedDates.size} date${selectedDates.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
