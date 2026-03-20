"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, addDays, startOfDay, getDay } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Clock, Ban } from "lucide-react"

type Appt = {
  id: string
  date: Date
  startTime: string
  endTime: string
  status: string
  service: { name: string }
  client: { name: string | null }
}

type Sched = {
  dayOfWeek: number
  isDayOff: boolean
}

type DayOff = {
  date: Date
}

interface ScheduleManagerProps {
  appointments: Appt[]
  recurringSchedule: Sched[]
  dayOffs: DayOff[]
}

export default function ScheduleManager({ appointments, recurringSchedule, dayOffs }: ScheduleManagerProps) {
  const router = useRouter()
  const [togglingDate, setTogglingDate] = useState<string | null>(null)

  const today = startOfDay(new Date())
  const days = Array.from({ length: 21 }).map((_, i) => addDays(today, i))

  const handleToggleDayOff = async (dateStr: string) => {
    setTogglingDate(dateStr)
    try {
      const res = await fetch("/api/master/day-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr })
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to toggle")
      }
      router.refresh()
    } catch (e: any) {
      alert("Error: " + e.message)
    } finally {
      setTogglingDate(null)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {days.map(day => {
        const dateStr = format(day, "yyyy-MM-dd")
        const displayDate = format(day, "EEEE, MMM d")
        const jsDayOfWeek = getDay(day)
        
        // Find if recurring is day off
        const recurrence = recurringSchedule.find(s => s.dayOfWeek === jsDayOfWeek)
        const isRecurringOff = recurrence?.isDayOff ?? false
        
        // Find if specific day off exists
        const specificOff = dayOffs.find(d => format(new Date(d.date), "yyyy-MM-dd") === dateStr)
        const isSpecificOff = !!specificOff

        const isOff = isRecurringOff || isSpecificOff

        const dayAppointments = appointments.filter(a => format(new Date(a.date), "yyyy-MM-dd") === dateStr)

        return (
          <Card key={dateStr} className={isOff ? "bg-muted/30 border-dashed opacity-80" : ""}>
            <CardHeader className="pb-3 border-b px-4 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                {displayDate}
              </CardTitle>
              {isOff && <Ban className="w-4 h-4 text-red-500" />}
            </CardHeader>
            <CardContent className="p-4 flex flex-col justify-between" style={{ minHeight: "140px" }}>
              <div className="space-y-2 mb-4">
                {isRecurringOff ? (
                  <p className="text-sm font-medium text-red-500">Regular Day Off</p>
                ) : isSpecificOff ? (
                  <p className="text-sm font-medium text-red-500">Specific Day Off</p>
                ) : dayAppointments.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {dayAppointments.length} Appointments
                    </p>
                    {dayAppointments.slice(0, 3).map(a => (
                      <div key={a.id} className="text-sm flex items-center justify-between">
                        <span className="truncate pr-2 font-medium">{a.client.name || "Client"}</span>
                        <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                          {a.startTime}
                        </span>
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + {dayAppointments.length - 3} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">No appointments booked.</p>
                )}
              </div>

              <div className="mt-auto">
                <Button 
                  variant={isSpecificOff ? "outline" : "secondary"} 
                  className="w-full text-xs" 
                  size="sm"
                  disabled={togglingDate === dateStr || isRecurringOff}
                  onClick={() => handleToggleDayOff(dateStr)}
                >
                  {togglingDate === dateStr 
                    ? "Saving..." 
                    : isRecurringOff 
                    ? "Cannot unmark regular day off" 
                    : isSpecificOff 
                    ? "Cancel Day Off" 
                    : "Take Day Off"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
