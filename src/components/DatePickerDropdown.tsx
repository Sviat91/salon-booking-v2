"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"

interface DatePickerDropdownProps {
  date: string
  onChange: (d: string) => void
  disabledDates?: Set<string>
  onVisibleMonthChange?: (fromISO: string, untilISO: string) => void
}

export function DatePickerDropdown({ date, onChange, disabledDates, onVisibleMonthChange }: DatePickerDropdownProps) {
  const [open, setOpen] = useState(false)

  // Parse date or use today
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (!date) return new Date()
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return new Date()
  })

  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const insideTrigger = ref.current && ref.current.contains(target)
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target)
      if (!insideTrigger && !insideDropdown) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Position the dropdown using fixed coordinates from the button.
  // useLayoutEffect (not useEffect) so the correct position is committed
  // before the browser paints — otherwise the dropdown briefly renders
  // unpositioned in normal document flow, causing a visible flash/jump.
  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const dropdownHeight = 340
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const left = Math.min(Math.max(rect.left, 8), window.innerWidth - 288)

      if (spaceBelow >= dropdownHeight) {
        // Open below
        setDropdownStyle({
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${left}px`,
          zIndex: 9999,
        })
      } else {
        // Open above
        setDropdownStyle({
          position: 'fixed',
          bottom: `${window.innerHeight - rect.top + 4}px`,
          left: `${left}px`,
          zIndex: 9999,
        })
      }
    }
  }, [open])

  useEffect(() => {
    onVisibleMonthChange?.(format(startOfMonth(currentMonth), 'yyyy-MM-dd'), format(endOfMonth(currentMonth), 'yyyy-MM-dd'))
  }, [currentMonth])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm text-left flex items-center justify-between focus-visible:ring-2 focus-visible:ring-primary outline-none"
      >
        {date ? format(new Date(date + "T12:00:00"), "MMM d, yyyy") : "Select date"}
        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          // Portaled outside any ancestor container, so its own mousedown must not
          // bubble to document — otherwise ancestor "click outside" listeners (e.g.
          // the modal card this picker lives in) see it as an outside click and
          // close the panel before the day's onClick can fire.
          onMouseDown={(e) => e.stopPropagation()}
          className="p-3 bg-card border border-border shadow-xl rounded-lg w-[280px]"
        >
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
              const isDisabled = disabledDates?.has(dateStr) ?? false
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { if (isDisabled) return; onChange(dateStr); setOpen(false); }}
                  className={`h-8 w-8 rounded-md flex items-center justify-center text-sm transition-colors ${isDisabled ? 'text-muted-foreground opacity-40 cursor-not-allowed' : isSelected ? 'bg-primary text-primary-foreground font-bold hover:bg-primary/90' : 'hover:bg-muted text-card-foreground'}`}
                >
                  {format(d, "d")}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
