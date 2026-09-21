"use client"

import { useEffect, useMemo, useRef } from "react"
import { format, isToday } from "date-fns"
import { useTranslation } from "react-i18next"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import type { Appointment } from "./ModernCalendar"

interface AgendaViewProps {
  currentDate: Date
  appointments: Appointment[]
  isAdminView?: boolean
  selectedMasterId?: string
  onAppointmentClick: (a: Appointment) => void
}

export default function AgendaView({ currentDate, appointments, isAdminView = false, selectedMasterId = "all", onAppointmentClick }: AgendaViewProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const locale = dateFnsLocale(language)
  const containerRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const monthKey = format(currentDate, "yyyy-MM")

  const groups = useMemo(() => {
    const inMonth = appointments
      .filter(a => a.date.slice(0, 7) === monthKey)
      .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.startTime.localeCompare(b.startTime))
    const map = new Map<string, Appointment[]>()
    for (const a of inMonth) {
      const key = a.date.slice(0, 10)
      const list = map.get(key)
      if (list) list.push(a)
      else map.set(key, [a])
    }
    return Array.from(map.entries())
  }, [appointments, monthKey])

  // Keyed on hasGroups (not groups.length) so a polled/edited booking that changes
  // the number of day groups never yanks the user's scroll position back to today —
  // it only re-scrolls on a month change or the empty → non-empty transition.
  const hasGroups = groups.length > 0
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const todayStr = format(new Date(), "yyyy-MM-dd")
    const target = groups.find(([date]) => date >= todayStr)
    const el = target ? groupRefs.current[target[0]] : null
    // Container is `relative`, so el.offsetTop is already relative to it. No upcoming
    // group (past month) → back to the top, not the previous month's scroll offset.
    container.scrollTop = el ? el.offsetTop : 0
  }, [monthKey, hasGroups])

  if (groups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background px-3 py-2 animate-in fade-in duration-200">
        <p className="text-sm text-muted-foreground">{t('admin.calendar.agendaEmpty')}</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto custom-scrollbar bg-background px-3 py-2 animate-in fade-in duration-200">
      {groups.map(([dateStr, appts]) => {
        const day = new Date(`${dateStr}T00:00:00`)
        const today = isToday(day)
        return (
          <div key={dateStr} ref={el => { groupRefs.current[dateStr] = el }} className="flex gap-2 py-1">
            <div className="w-14 shrink-0 flex flex-col items-center">
              <span className={`text-[11px] uppercase ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                {format(day, "EEE", { locale })}
              </span>
              <span className={`text-lg font-medium h-8 w-8 flex items-center justify-center rounded-full ${today ? 'bg-primary text-primary-foreground' : ''}`}>
                {format(day, "d")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {appts.map(a => {
                const color = a.master?.masterProfile?.color || "#8B4A58"
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAppointmentClick(a)}
                    className="block w-full text-left rounded-md p-2 mb-2 text-foreground"
                    style={{ backgroundColor: color + "26", borderLeft: "3px solid " + color }}
                  >
                    <div className="font-semibold">{a.startTime} – {a.endTime}</div>
                    <div className="truncate">{a.client.name || t('admin.calendar.clientFallback')}</div>
                    <div className="text-xs opacity-80 truncate">{resolveLocalized({ pl: a.service.name_pl, en: a.service.name_en, uk: a.service.name_uk }, language)}</div>
                    {isAdminView && selectedMasterId === "all" && a.master?.name && (
                      <div className="text-xs opacity-80 truncate">{a.master.name}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
