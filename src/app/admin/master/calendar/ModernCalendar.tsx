"use client"

import { useState, useEffect, useMemo } from "react"
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight, Edit3, Save, Calendar, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

import MonthView from "./MonthView"
import WeekView from "./WeekView"
import DayView from "./DayView"
import BulkSettingsModal from "./BulkSettingsModal"
import AppointmentModal from "./AppointmentModal"
import ViewAppointmentModal from "./ViewAppointmentModal"

export type ViewType = "Month" | "Week" | "Day"

export type Interval = { start: string; end: string }
export type Appointment = {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  service: { id: string, name: string, duration: number, price: number }
  client: { id: string, name: string | null, phone: string | null, email: string | null }
}
export type Template = { dayOfWeek: number; isDayOff: boolean; intervals: Interval[] }
export type Override = { date: string; isDayOff: boolean; intervals: Interval[] }

export default function ModernCalendar({ masterId }: { masterId: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const [view, setView] = useState<ViewType>("Week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [step, setStep] = useState(15) // Minutes grid step
  const [isEditMode, setIsEditMode] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  
  // Appointment Booking State
  const [bookingDate, setBookingDate] = useState<Date | null>(null)
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<{ appt: Appointment, mode: "edit" | "copy" } | null>(null)
  
  // Grid Hours
  const startHour = 8
  const endHour = 21

  // Data
  const [loading, setLoading] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])

  useEffect(() => {
    setIsMounted(true)
    const savedView = localStorage.getItem("calendar_view")
    const savedDate = localStorage.getItem("calendar_date")
    const savedStep = localStorage.getItem("calendar_step")
    if (savedView) setView(savedView as ViewType)
    if (savedDate) setCurrentDate(new Date(savedDate))
    if (savedStep) setStep(Number(savedStep))
  }, [])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("calendar_view", view)
      localStorage.setItem("calendar_date", currentDate.toISOString())
      localStorage.setItem("calendar_step", step.toString())
    }
  }, [view, currentDate, step, isMounted])

  const dateRange = useMemo(() => {
    let from, to
    if (view === "Month") {
      from = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      to = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    } else if (view === "Week") {
      from = startOfWeek(currentDate, { weekStartsOn: 1 })
      to = endOfWeek(currentDate, { weekStartsOn: 1 })
    } else {
      from = currentDate
      to = currentDate
    }
    return {
      from: format(from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd")
    }
  }, [currentDate, view])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [apptsRes, tmplRes, ovrRes] = await Promise.all([
        fetch(`/api/master/appointments?from=${dateRange.from}&to=${dateRange.to}`),
        fetch(`/api/master/schedule/template`),
        fetch(`/api/master/schedule/overrides?from=${dateRange.from}&to=${dateRange.to}`)
      ])

      const apptsData = await apptsRes.json()
      const tmplData = await tmplRes.json()
      const ovrData = await ovrRes.json()

      setAppointments(apptsData.appointments || [])
      setTemplates((tmplData.templates || []).map((t: any) => ({ ...t, intervals: JSON.parse(t.intervals) })))
      setOverrides((ovrData.overrides || []).map((o: any) => ({ ...o, intervals: JSON.parse(o.intervals) })))
    } catch (err) {
      console.error("Failed to fetch calendar data", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isMounted) fetchData()
  }, [dateRange, isMounted])

  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date())
      return
    }
    const modifier = direction === "next" ? 1 : -1
    if (view === "Month") setCurrentDate(d => addMonths(d, modifier))
    else if (view === "Week") setCurrentDate(d => addWeeks(d, modifier))
    else setCurrentDate(d => addDays(d, modifier))
  }

  const headerDisplay = useMemo(() => {
    if (view === "Month") return format(currentDate, "MMMM yyyy")
    if (view === "Week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      if (start.getMonth() !== end.getMonth()) {
        return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
      }
      return `${format(start, "MMMM yyyy")}`
    }
    return format(currentDate, "EEEE, MMMM d, yyyy")
  }, [currentDate, view])

  // Bulk save handler
  const saveBulkOverrides = async (dates: string[], isDayOff: boolean, intervals: Interval[]) => {
    const res = await fetch("/api/master/schedule/overrides/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates, isDayOff, intervals }),
    })
    if (!res.ok) throw new Error("Failed bulk update")
    fetchData()
  }

  if (!isMounted) return <div className="animate-pulse bg-muted rounded-xl h-full w-full" />

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="min-h-[4rem] py-2 border-b flex flex-wrap gap-y-3 gap-x-4 items-center justify-between px-4 shrink-0 bg-background z-10 transition-colors">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("today")}>Today</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("prev")}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("next")}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-xl font-semibold min-w-[200px]">{headerDisplay}</h2>
          {loading && <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin ml-2"></div>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view !== "Month" && (
            <div className="relative">
              <select
                value={step}
                onChange={(e) => setStep(Number(e.target.value))}
                className="appearance-none bg-muted text-foreground border border-input rounded-md px-3 py-1.5 pr-8 text-sm font-medium shadow-sm outline-none focus:ring-1 focus:ring-primary hover:bg-muted/80 cursor-pointer transition-colors"
              >
                {[5, 10, 15, 30, 60].map(s => (
                  <option key={s} value={s} className="bg-background text-foreground">{s} min</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ChevronRight className="w-3 h-3 rotate-90" />
              </div>
            </div>
          )}

          <div className="h-6 w-px bg-border mx-1" />

          <Button 
            variant={isEditMode ? "default" : "outline"} 
            size="sm" 
            onClick={() => setIsEditMode(!isEditMode)} 
            className={`gap-2 transition-all ${isEditMode ? 'bg-primary text-primary-foreground shadow shadow-primary/20' : ''}`}
          >
            {isEditMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isEditMode ? 'Done Editing' : 'Редактор графика'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowBulkModal(true)} className="gap-2 shrink-0">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Bulk Settings</span>
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="bg-muted p-1 rounded-md flex">
            {(["Month", "Week", "Day"] as ViewType[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-sm rounded ${view === v ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {view === "Month" && (
          <MonthView 
            currentDate={currentDate} 
            appointments={appointments} 
            templates={templates} 
            overrides={overrides}
            isEditMode={isEditMode}
            onDayClick={(d) => { setView("Day"); setCurrentDate(d); }}
            onAppointmentClick={(a) => setViewingAppointment(a)}
            onDataChange={fetchData}
          />
        )}
        {view === "Week" && (
          <WeekView 
            currentDate={currentDate} 
            appointments={appointments} 
            templates={templates} 
            overrides={overrides}
            step={step}
            startHour={startHour}
            endHour={endHour}
            isEditMode={isEditMode}
            onDayClick={(d) => { setView("Day"); setCurrentDate(d); }}
            onAppointmentClick={(a) => setViewingAppointment(a)}
            onDataChange={fetchData}
          />
        )}
        {view === "Day" && (
          <DayView 
            currentDate={currentDate} 
            appointments={appointments} 
            templates={templates} 
            overrides={overrides}
            step={step}
            startHour={startHour}
            endHour={endHour}
            isEditMode={isEditMode}
            onAddClick={(d) => setBookingDate(d)}
            onAppointmentClick={(a) => setViewingAppointment(a)}
            onDataChange={fetchData}
          />
        )}
      </div>

      {showBulkModal && (
        <BulkSettingsModal onClose={() => setShowBulkModal(false)} onSave={saveBulkOverrides} />
      )}

      {(bookingDate || editingAppointment) && (
        <AppointmentModal 
          date={bookingDate || undefined} 
          initialAppointment={editingAppointment?.appt}
          mode={editingAppointment?.mode}
          onClose={() => { setBookingDate(null); setEditingAppointment(null); }} 
          onSuccess={() => { setBookingDate(null); setEditingAppointment(null); fetchData(); }} 
        />
      )}

      {viewingAppointment && (
        <ViewAppointmentModal
          appointment={viewingAppointment}
          onClose={() => setViewingAppointment(null)}
          onEdit={() => {
            setEditingAppointment({ appt: viewingAppointment, mode: "edit" })
            setViewingAppointment(null)
          }}
          onDuplicate={() => {
            setEditingAppointment({ appt: viewingAppointment, mode: "copy" })
            setViewingAppointment(null)
          }}
          onDelete={async (id) => {
             const res = await fetch(`/api/master/appointments/${id}`, { method: 'DELETE' })
             if(!res.ok) throw new Error("Delete failed")
             setViewingAppointment(null)
             fetchData()
          }}
        />
      )}
    </div>
  )
}
