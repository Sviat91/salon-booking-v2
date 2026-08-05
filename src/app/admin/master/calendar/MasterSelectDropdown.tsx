"use client"

import { useState, useRef, useLayoutEffect, useEffect } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { ChevronRight, Globe, User } from "lucide-react"
import type { AdminMasterListItem } from "./ModernCalendar"

interface MasterSelectDropdownProps {
  selectedMasterId: string
  adminMastersList: AdminMasterListItem[]
  onMasterChange: (id: string) => void
}

/**
 * Admin master-selector: trigger button + createPortal panel with fixed-position
 * viewport-clamped placement. Pure move out of ModernCalendar.tsx — preserves the
 * positioning-effect timing, stopPropagation, and clamping math exactly.
 */
export default function MasterSelectDropdown({ selectedMasterId, adminMastersList, onMasterChange }: MasterSelectDropdownProps) {
  const { t } = useTranslation()
  const [showMasterSelect, setShowMasterSelect] = useState(false)
  const masterSelectBtnRef = useRef<HTMLButtonElement>(null)
  const masterSelectDropdownRef = useRef<HTMLDivElement>(null)
  const [masterSelectDropdownStyle, setMasterSelectDropdownStyle] = useState<React.CSSProperties>({})

  // Position the master-selector dropdown using fixed coordinates from the button.
  // useLayoutEffect (not useEffect) so the correct position is committed before the
  // browser paints — otherwise the dropdown briefly renders unpositioned, causing a
  // visible flash/jump. Mirrors TimePickerDropdown.tsx's proven pattern.
  useLayoutEffect(() => {
    if (showMasterSelect && masterSelectBtnRef.current) {
      const rect = masterSelectBtnRef.current.getBoundingClientRect()
      const dropdownWidth = 256 // w-64
      const dropdownHeight = 300 // max-h-[300px]
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const left = Math.max(8, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 8))

      if (spaceBelow >= dropdownHeight) {
        setMasterSelectDropdownStyle({
          position: 'fixed',
          top: `${rect.bottom + 8}px`,
          left: `${left}px`,
          width: `${dropdownWidth}px`,
          zIndex: 9999,
        })
      } else {
        setMasterSelectDropdownStyle({
          position: 'fixed',
          bottom: `${window.innerHeight - rect.top + 8}px`,
          left: `${left}px`,
          width: `${dropdownWidth}px`,
          zIndex: 9999,
        })
      }
    }
  }, [showMasterSelect])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const insideTrigger = masterSelectBtnRef.current && masterSelectBtnRef.current.contains(target)
      const insideDropdown = masterSelectDropdownRef.current && masterSelectDropdownRef.current.contains(target)
      if (!insideTrigger && !insideDropdown) {
        setShowMasterSelect(false)
      }
    }
    if (showMasterSelect) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMasterSelect])

  return (
    <div className="relative">
      <button
        ref={masterSelectBtnRef}
        onClick={() => setShowMasterSelect(!showMasterSelect)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-transparent hover:bg-muted rounded-md transition-colors border border-border"
      >
         {selectedMasterId === "all" ? (
           <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /><span className="inline-block min-w-[22ch] text-center">{t('admin.calendar.allMasters')}</span></span>
         ) : (
           <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{adminMastersList.find(m => m.id === selectedMasterId)?.name || t('admin.calendar.selectMasterFallback')}</span>
         )}
         <ChevronRight className={`w-3.5 h-3.5 opacity-50 transition-transform ${showMasterSelect ? "rotate-[270deg]" : "rotate-90"}`} />
      </button>
      {showMasterSelect && createPortal(
        <div
          ref={masterSelectDropdownRef}
          style={masterSelectDropdownStyle}
          // Portaled outside any ancestor container, so its own mousedown must not
          // bubble to document — otherwise the click-outside listener above sees it
          // as an outside click and closes the panel before onClick can fire.
          onMouseDown={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <button
               className={`w-full text-left px-4 py-3 text-sm hover:bg-primary hover:text-primary-foreground transition-colors ${selectedMasterId === "all" ? 'bg-primary/20 text-primary font-medium' : ''}`}
               onClick={() => { onMasterChange("all"); setShowMasterSelect(false); }}
            >
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{t('admin.calendar.allMastersCombined')}</span>
            </button>
            <div className="h-px bg-border/60 w-full" />
            {adminMastersList.map(m => (
              <button
                 key={m.id}
                 className={`w-full text-left px-4 py-3 text-sm hover:bg-primary hover:text-primary-foreground transition-colors border-b border-border/40 last:border-0 ${selectedMasterId === m.id ? 'bg-primary/20 text-primary font-medium' : ''}`}
                 onClick={() => { onMasterChange(m.id); setShowMasterSelect(false); }}
              >
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{m.name}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
