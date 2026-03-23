"use client"

import { useState, useRef, useEffect } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"

export function DatePickerDropdown({ date, onChange }: { date: string, onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false)
  
  // Parse date or use today
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (!date) return new Date()
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return new Date()
  })
  
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)}
        className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm text-left flex items-center justify-between focus-visible:ring-2 focus-visible:ring-primary outline-none"
      >
        {date ? format(new Date(date + "T12:00:00"), "MMM d, yyyy") : "Select date"}
        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-12 left-0 z-50 p-3 bg-card border border-border shadow-xl rounded-lg w-[280px]">
          <div className="flex justify-between items-center mb-4">
            <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-muted rounded"><ChevronLeft className="w-4 h-4"/></button>
            <div className="font-medium text-sm">{format(currentMonth, "MMMM yyyy")}</div>
            <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-muted rounded"><ChevronRight className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(d => {
              const dateStr = format(d, "yyyy-MM-dd")
              const isSelected = date === dateStr
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  className={`h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors ${isSelected ? 'bg-primary text-primary-foreground font-bold hover:bg-primary/90' : 'hover:bg-muted text-card-foreground'}`}
                >
                  {format(d, "d")}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
