"use client"

import { useState, useEffect, useCallback } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, addDays, getDay, isToday } from "date-fns"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Info } from "lucide-react"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"

type Interval = { start: string; end: string }
type Override = { date: string; isDayOff: boolean; intervals: Interval[] }
type Template = { dayOfWeek: number; isDayOff: boolean; intervals: Interval[] }

interface BulkSettingsModalProps {
  onClose: () => void
  onSave: (dates: string[], isDayOff: boolean, intervals: Interval[], masterIds?: string[]) => Promise<void>
  templates?: Template[]
  apiPrefix?: string
  isAdminView?: boolean
  selectedMasterId?: string
  adminMastersList?: {id: string, name: string}[]
}

/**
 * BulkSettingsModal fetches its OWN overrides for the displayed month,
 * so it always shows correct day-off / scheduled indicators regardless
 * of what the parent calendar is currently viewing.
 */
export default function BulkSettingsModal({ onClose, onSave, templates = [], apiPrefix = "/api/master", isAdminView = false, selectedMasterId, adminMastersList = [] }: BulkSettingsModalProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())

  const [isDayOff, setIsDayOff] = useState(false)
  const [intervals, setIntervals] = useState<Interval[]>([{ start: "09:00", end: "18:00" }])
  const [saving, setSaving] = useState(false)

  const initialMasters = (isAdminView && selectedMasterId !== "all") ? [selectedMasterId as string] : []
  const [targetMasterIds, setTargetMasterIds] = useState<Set<string>>(new Set(initialMasters))

  // Self-fetched overrides for the currently displayed month
  const [monthOverrides, setMonthOverrides] = useState<Override[]>([])

  const fetchMonthOverrides = useCallback(async (month: Date) => {
    // Cannot accurately show calendar overlaps for "ALL" masters here, so if "all", we skip rendering working/off dots
    if (isAdminView && selectedMasterId === "all") {
       setMonthOverrides([])
       return
    }
    const from = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")
    const to = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")
    try {
      const q = isAdminView && selectedMasterId ? `&masterId=${selectedMasterId}` : ''
      const res = await fetch(`${apiPrefix}/schedule/overrides?from=${from}&to=${to}${q}`)
      const data = await res.json()
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
  }, [apiPrefix, isAdminView, selectedMasterId])

  useEffect(() => {
    fetchMonthOverrides(currentMonth)
  }, [currentMonth, fetchMonthOverrides])

  const toggleMaster = (id: string) => {
    const newSet = new Set(targetMasterIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setTargetMasterIds(newSet)
  }

  const allSelected = adminMastersList.length > 0 && targetMasterIds.size === adminMastersList.length

  const toggleAllMasters = () => {
    if (allSelected) {
      setTargetMasterIds(new Set())
    } else {
      setTargetMasterIds(new Set(adminMastersList.map(m => m.id)))
    }
  }

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

    const days: Date[] = []
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
          const isPast = d < new Date(new Date().setHours(0, 0, 0, 0))
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
    if (isAdminView && targetMasterIds.size === 0) {
      alert("Please select at least one master to apply changes to.")
      return
    }
    setSaving(true)
    try {
      await onSave(Array.from(selectedDates), isDayOff, isDayOff ? [] : intervals, isAdminView ? Array.from(targetMasterIds) : undefined)
      onClose()
    } catch (e: any) {
      alert("Error saving: " + e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card text-card-foreground border border-border/50 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col md:flex-row max-h-[90vh]">

        {/* Left: Calendar Picker */}
        <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border/50 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="font-semibold text-lg flex items-center gap-2">Select Dates</h3>
            {selectedDates.size > 0 ? (
              <div className="text-sm font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-full animate-in zoom-in shadow-sm">
                {selectedDates.size} picked
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/50">
                0 picked
              </div>
            )}
          </div>

          <div className="bg-muted/40 rounded-xl p-4 border border-border/50 shadow-sm mt-2">
            <div className="flex items-center justify-between mb-4 px-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="h-8 w-8 hover:bg-muted text-card-foreground border border-transparent hover:border-border/50">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-[15px]">{format(currentMonth, "MMMM yyyy")}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="h-8 w-8 hover:bg-muted text-card-foreground border border-transparent hover:border-border/50">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {renderCalendar()}
          </div>

          <div className="mt-auto pt-6 shrink-0">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Info className="w-24 h-24" />
              </div>
              <h4 className="font-bold text-primary text-sm flex items-center gap-2 mb-3 relative z-10">
                <Info className="w-4 h-4" /> Action Overview
              </h4>
              <div className="space-y-2.5 text-sm text-card-foreground relative z-10">
                <div className="flex justify-between items-center p-2.5 bg-muted/40 rounded-lg shadow-sm border border-border/30">
                  <span className="text-muted-foreground font-medium">Selected Dates:</span>
                  <span className="font-bold text-primary">{selectedDates.size}</span>
                </div>
                {isAdminView && (
                  <div className="flex justify-between items-center p-2.5 bg-muted/40 rounded-lg shadow-sm border border-border/30">
                    <span className="text-muted-foreground font-medium">Target Masters:</span>
                    <span className="font-bold text-foreground">
                      {targetMasterIds.size === adminMastersList.length && targetMasterIds.size > 0
                        ? "All Masters"
                        : targetMasterIds.size}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center p-2.5 bg-muted/40 rounded-lg shadow-sm border border-border/30">
                  <span className="text-muted-foreground font-medium">Configuration:</span>
                  <span className="font-bold text-foreground">
                    {isDayOff ? (
                      <span className="text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Day Off</span>
                    ) : (
                      <span className="text-green-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {intervals.length} Shift{intervals.length !== 1 ? 's' : ''}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Settings */}
        <div className="w-full md:w-[320px] p-6 flex flex-col relative overflow-visible">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">Configure</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">

            {isAdminView && (
              <div className="space-y-3">
                <span className="text-sm font-semibold flex items-center gap-2">
                  🏢 Apply To Masters
                </span>
                <div className="bg-muted/40 border border-border/50 rounded-xl p-4 shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-muted rounded-lg transition-colors border border-transparent shadow-sm hover:border-border/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                      checked={allSelected}
                      onChange={toggleAllMasters}
                    />
                    <span className="font-semibold text-foreground">Apply to All Masters</span>
                  </label>

                  <div className="mt-3 bg-card rounded-lg border border-border/50 shadow-inner p-2 max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                    {adminMastersList.map(m => (
                      <label key={m.id} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/60 p-2.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary rounded cursor-pointer"
                          checked={targetMasterIds.has(m.id)}
                          onChange={() => toggleMaster(m.id)}
                        />
                        <span>👤 {m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <span className="text-sm font-semibold flex items-center gap-2">
                🕒 Schedule Configuration
              </span>
              <div className="bg-muted/40 border border-border/50 rounded-xl p-4 shadow-sm">
                <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-muted rounded-lg transition-colors border border-transparent shadow-sm hover:border-border/50 mb-2">
                  <input
                    type="checkbox"
                    id="bulkDayOff"
                    checked={isDayOff}
                    onChange={(e) => setIsDayOff(e.target.checked)}
                    className="h-4 w-4 accent-primary rounded cursor-pointer"
                  />
                  <span className="font-semibold text-red-500">Mark as Day Off</span>
                </label>

                {!isDayOff && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3 pl-2">
                      <span className="text-sm font-medium text-muted-foreground">Working Intervals</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs bg-transparent hover:bg-muted shadow-sm border-border"
                        onClick={() => setIntervals([...intervals, { start: "12:00", end: "13:00" }])}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Interval
                      </Button>
                    </div>

                    {intervals.length === 0 && <p className="text-xs text-muted-foreground pl-2 mb-2">No intervals added.</p>}

                    <div className="bg-card rounded-xl border border-border/50 shadow-inner p-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                      <div className="space-y-2 pr-1">
                        {intervals.map((inv, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/50 shadow-sm group hover:border-border transition-colors">
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
                            <span className="text-muted-foreground/60 font-medium">-</span>
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
                              className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                              onClick={() => setIntervals(intervals.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border shrink-0">
            <Button className="w-full font-semibold shadow-md" size="lg" disabled={saving || selectedDates.size === 0 || (isAdminView && targetMasterIds.size === 0)} onClick={handleSave}>
              {saving ? "Saving..." : "Apply Settings"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
