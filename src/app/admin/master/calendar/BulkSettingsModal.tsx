"use client"

import { useState } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, getDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { CalendarIcon, ChevronLeft, ChevronRight, X, Plus, Trash2 } from "lucide-react"

type Interval = { start: string; end: string }

interface BulkSettingsModalProps {
  onClose: () => void
  onSave: (dates: string[], isDayOff: boolean, intervals: Interval[]) => Promise<void>
}

export default function BulkSettingsModal({ onClose, onSave }: BulkSettingsModalProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  
  const [isDayOff, setIsDayOff] = useState(false)
  const [intervals, setIntervals] = useState<Interval[]>([{ start: "09:00", end: "18:00" }])
  const [saving, setSaving] = useState(false)

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

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }

    return (
      <div className="grid grid-cols-7 gap-1 mt-4">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground pb-2">
            {d}
          </div>
        ))}
        {days.map((d, idx) => {
          const dateStr = format(d, "yyyy-MM-dd")
          const isSelected = selectedDates.has(dateStr)
          const isCurrentMonth = isSameMonth(d, monthStart)
          
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDate(d)}
              className={`h-9 w-full rounded-md flex items-center justify-center text-sm transition-colors
                ${!isCurrentMonth ? "text-muted-foreground opacity-50" : ""}
                ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted"}
              `}
            >
              {format(d, "d")}
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
      <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
        
        {/* Left: Calendar Picker */}
        <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
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

        {/* Right: Settings and Save */}
        <div className="w-full md:w-[320px] p-6 bg-muted/10 flex flex-col overflow-y-auto">
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
                    <input 
                      type="time" 
                      value={inv.start} 
                      className="flex-1 min-w-0 bg-transparent text-sm p-1 outline-none"
                      onChange={(e) => {
                        const newInt = [...intervals]
                        newInt[idx].start = e.target.value
                        setIntervals(newInt)
                      }}
                    />
                    <span className="text-muted-foreground">-</span>
                    <input 
                      type="time" 
                      value={inv.end} 
                      className="flex-1 min-w-0 bg-transparent text-sm p-1 outline-none"
                      onChange={(e) => {
                        const newInt = [...intervals]
                        newInt[idx].end = e.target.value
                        setIntervals(newInt)
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => setIntervals(intervals.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3 w-3" />
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
