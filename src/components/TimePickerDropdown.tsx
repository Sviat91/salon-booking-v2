"use client"

import { useState, useRef, useEffect } from "react"
import { Clock } from "lucide-react"

interface TimePickerDropdownProps {
  value: string
  onChange: (time: string) => void
  step?: number
  startHour?: number
  endHour?: number
}

export function TimePickerDropdown({ 
  value, 
  onChange, 
  step = 15, 
  startHour = 0, 
  endHour = 24 
}: TimePickerDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]')
      if (selected) {
        selected.scrollIntoView({ block: 'center' })
      }
    }
  }, [open])

  const times: string[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += step) {
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)}
        className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm text-left flex items-center justify-between focus-visible:ring-2 focus-visible:ring-primary outline-none"
      >
        {value || "Select time"}
        <Clock className="w-4 h-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-12 left-0 z-50 bg-card border border-border shadow-xl rounded-lg w-[140px] overflow-hidden">
          <div 
            ref={listRef}
            className="max-h-[200px] overflow-y-auto"
          >
            {times.map(t => (
              <button
                key={t}
                type="button"
                data-selected={value === t}
                onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${value === t ? 'bg-primary/10 text-primary font-medium' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
