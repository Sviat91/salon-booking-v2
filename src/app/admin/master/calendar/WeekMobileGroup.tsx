"use client"

import { useTranslation } from "react-i18next"
import { Users } from "lucide-react"
import type { Appointment } from "./ModernCalendar"

interface WeekMobileGroupProps {
  group: Appointment[]
  top: number
  expanded: boolean
  onToggle: () => void
  onAppointmentClick: (a: Appointment) => void
}

const FALLBACK_COLOR = "#8B4A58"

export default function WeekMobileGroup({ group, top, expanded, onToggle, onAppointmentClick }: WeekMobileGroupProps) {
  const { t } = useTranslation()
  const color = group[0].master?.masterProfile?.color || FALLBACK_COLOR

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`absolute rounded-md cursor-pointer ${expanded ? 'z-30' : 'z-10'}`}
      style={{ top: `${top}px`, left: "2px", width: "calc(100% - 4px)" }}
    >
      {expanded ? (
        <div className="bg-card border border-border rounded-md shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
          {group.map(a => (
            <div
              key={a.id}
              onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}
              className="p-1 border-b last:border-b-0 border-border cursor-pointer"
              style={{ borderLeft: "3px solid " + (a.master?.masterProfile?.color || FALLBACK_COLOR) }}
            >
              <div className="text-[10px] font-semibold">{a.startTime}</div>
              <div className="text-[10px] leading-[1.15] break-words">{a.client.name || t('admin.calendar.clientFallback')}</div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="p-0.5 flex items-center gap-0.5 rounded-md backdrop-blur-sm text-foreground"
          style={{ backgroundColor: color + "26", borderLeft: "3px solid " + color }}
        >
          <Users className="w-3 h-3 shrink-0" />
          <span className="text-[10px] font-semibold">{group.length}</span>
        </div>
      )}
    </div>
  )
}
