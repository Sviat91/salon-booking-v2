"use client"

import { useState, useEffect, useMemo } from "react"
import { format, addMonths, addWeeks, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight, Edit3, Save, Calendar, Globe, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"

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
  notes: string | null
  service: { id: string, name: string, duration: number, price: number }
  client: { id: string, name: string | null, phone: string | null, email: string | null }
  master?: { masterProfile?: { color?: string | null } }
}
export type Template = { dayOfWeek: number; isDayOff: boolean; intervals: Interval[] }
export type Override = { date: string; isDayOff: boolean; intervals: Interval[] }

export default function ModernCalendar({ 
  masterId: _masterId, 
  availableSlotColor = "#21A67A",
  dayOffColor = "#BA1A1A",
  workingHourStart = 8,
  workingHourEnd = 21,
  apiPrefix = "/api/master",
  isAdminView = false,
  selectedMasterId = "all",
  adminMastersList,
  onMasterChange
}: { 
  masterId?: string; 
  availableSlotColor?: string; 
  dayOffColor?: string; 
  workingHourStart?: number; 
  workingHourEnd?: number; 
  apiPrefix?: string; 
  isAdminView?: boolean; 
  selectedMasterId?: string;
  adminMastersList?: {id:string, name:string}[];
  onMasterChange?: (id:string) => void;
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [view, setView] = useState<ViewType>("Week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [step, setStep] = useState(15) // Minutes grid step
  const [isEditMode, setIsEditMode] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showMasterSelect, setShowMasterSelect] = useState(false)
  
  // Appointment Booking State
  const [bookingDate, setBookingDate] = useState<Date | null>(null)
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<{ appt: Appointment, mode: "edit" | "copy" } | null>(null)
  
  // Grid Hours
  const startHour = workingHourStart
  const endHour = workingHourEnd

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
      const querySuffix = isAdminView && selectedMasterId ? `&masterId=${selectedMasterId}` : ''
      const querySuffixQ = isAdminView && selectedMasterId ? `?masterId=${selectedMasterId}` : ''

      const [apptsRes, tmplRes, ovrRes] = await Promise.all([
        fetch(`${apiPrefix}/appointments?from=${dateRange.from}&to=${dateRange.to}${querySuffix}`),
        fetch(`${apiPrefix}/schedule/template${querySuffixQ}`),
        fetch(`${apiPrefix}/schedule/overrides?from=${dateRange.from}&to=${dateRange.to}${querySuffix}`)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, isMounted, selectedMasterId])

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
  const saveBulkOverrides = async (dates: string[], isDayOff: boolean, intervals: Interval[], masterIds?: string[]) => {
    const res = await fetch(`${apiPrefix}/schedule/overrides/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates, isDayOff, intervals, masterIds, masterId: selectedMasterId !== "all" ? selectedMasterId : undefined }),
    })
    if (!res.ok) throw new Error("Failed bulk update")
    fetchData()
  }

  if (!isMounted) return <div className="animate-pulse bg-muted rounded-xl h-full w-full" />

  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground overflow-hidden relative">
      <div className="min-h-[4rem] py-2 border-b border-border/60 flex flex-wrap gap-y-3 gap-x-4 items-center justify-between px-4 shrink-0 z-10 transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("today")} className="bg-transparent border-border hover:bg-muted">Today</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("prev")} className="hover:bg-muted"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("next")} className="hover:bg-muted"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-xl font-semibold min-w-[150px]">{headerDisplay}</h2>
          
          {loading && <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin ml-2"></div>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(step)} onValueChange={(v) => setStep(Number(v ?? step))} disabled={view === "Month"}>
            <SelectTrigger className="h-auto w-auto bg-transparent hover:bg-muted px-3 py-1.5 text-sm font-medium shadow-sm">
              <SelectValue>{(v: string) => `${v} min`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 30, 60].map(s => (
                <SelectItem key={s} value={String(s)}><SelectItemText>{s} min</SelectItemText></SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Always show Bulk Settings and Edit Tools, Bulk handles 'all' context naturally */}
          <Button 
            variant={isEditMode ? "default" : "outline"} 
            size="sm" 
            onClick={() => setIsEditMode(!isEditMode)} 
            disabled={isAdminView && selectedMasterId === "all"} // Disable inline edit for 'all' mode
            className={`gap-2 transition-all ${isEditMode ? 'bg-primary text-primary-foreground shadow shadow-primary/20' : 'bg-transparent border-border hover:bg-muted'}`}
          >
            {isEditMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isEditMode ? 'Done Editing' : 'Редактор графика'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowBulkModal(true)} className="gap-2 shrink-0 bg-transparent border-border hover:bg-muted">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Bulk Settings</span>
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="flex rounded-full border border-border bg-transparent p-0.5 gap-0.5">
            {(["Month", "Week", "Day"] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-full ${
                  view === v
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {isAdminView && adminMastersList && onMasterChange && (
            <div className="relative ml-2">
              <button 
                onClick={() => setShowMasterSelect(!showMasterSelect)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-transparent hover:bg-muted rounded-md transition-colors border border-border"
              >
                 {selectedMasterId === "all" ? (
                   <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />All Masters</span>
                 ) : (
                   <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{adminMastersList.find(m => m.id === selectedMasterId)?.name || 'Select'}</span>
                 )}
                 <ChevronRight className={`w-3.5 h-3.5 opacity-50 transition-transform ${showMasterSelect ? "rotate-[270deg]" : "rotate-90"}`} />
              </button>
              {showMasterSelect && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMasterSelect(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      <button 
                         className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors ${selectedMasterId === "all" ? 'bg-primary/20 text-primary font-medium' : ''}`}
                         onClick={() => { onMasterChange("all"); setShowMasterSelect(false); }}
                      >
                        <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />All Masters (Combined)</span>
                      </button>
                      <div className="h-px bg-border/60 w-full" />
                      {adminMastersList.map(m => (
                        <button 
                           key={m.id}
                           className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors border-b border-border/40 last:border-0 ${selectedMasterId === m.id ? 'bg-primary/20 text-primary font-medium' : ''}`}
                           onClick={() => { onMasterChange(m.id); setShowMasterSelect(false); }}
                        >
                          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

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
            availableSlotColor={availableSlotColor}
            dayOffColor={dayOffColor}
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
            availableSlotColor={availableSlotColor}
            dayOffColor={dayOffColor}
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
            availableSlotColor={availableSlotColor}
            dayOffColor={dayOffColor}
            onAddClick={(d) => setBookingDate(d)}
            onAppointmentClick={(a) => setViewingAppointment(a)}
            onDataChange={fetchData}
          />
        )}
      </div>

      {showBulkModal && (
        <BulkSettingsModal 
          onClose={() => setShowBulkModal(false)} 
          onSave={saveBulkOverrides} 
          templates={templates}
          apiPrefix={apiPrefix}
          isAdminView={isAdminView}
          selectedMasterId={selectedMasterId}
          adminMastersList={adminMastersList}
        />
      )}

      {(bookingDate || editingAppointment) && (
        <AppointmentModal 
          date={bookingDate || undefined} 
          initialAppointment={editingAppointment?.appt}
          mode={editingAppointment?.mode}
          apiPrefix={apiPrefix}
          isAdminView={isAdminView}
          selectedMasterId={selectedMasterId}
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
             const queryPart = isAdminView && selectedMasterId ? `?masterId=${selectedMasterId}` : ''
             const res = await fetch(`${apiPrefix}/appointments/${id}${queryPart}`, { method: 'DELETE' })
             if(!res.ok) throw new Error("Delete failed")
             setViewingAppointment(null)
             fetchData()
          }}
        />
      )}
    </div>
  )
}
