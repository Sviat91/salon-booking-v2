"use client"

import { useState, useEffect, useMemo } from "react"
import { format, addMonths, addWeeks, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { useTranslation } from "react-i18next"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import { useIsMobile } from "@/hooks/useIsMobile"

import CalendarToolbar from "./CalendarToolbar"
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
  service: { id: string, name_pl: string, name_en?: string | null, name_uk?: string | null, duration: number, price: number }
  client: { id: string, name: string | null, phone: string | null, email: string | null }
  master?: { id: string, name: string | null, masterProfile?: { color?: string | null } }
  originalPrice?: number | null
  discount?: { label: string; percent: number } | null
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
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const isMobile = useIsMobile()
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
    const savedStep = localStorage.getItem("calendar_step")
    if (savedView) setView(savedView as ViewType)
    if (savedStep) setStep(Number(savedStep))
  }, [])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("calendar_view", view)
      localStorage.setItem("calendar_step", step.toString())
    }
  }, [view, step, isMounted])

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

  // Polls for out-of-band changes (e.g. bookings made via the Telegram bot,
  // or another admin's tab) while this page stays mounted and in focus.
  useEffect(() => {
    if (!isMounted) return
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
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
    const locale = dateFnsLocale(language)
    if (view === "Month") return format(currentDate, "MMMM yyyy", { locale })
    if (view === "Week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `${format(start, "MMM d", { locale })} - ${format(end, "MMM d, yyyy", { locale })}`
    }
    return format(currentDate, "EEEE, MMMM d, yyyy", { locale })
  }, [currentDate, view, language])

  const todayDisplay = useMemo(() => {
    return format(new Date(), "d MMM", { locale: dateFnsLocale(language) })
  }, [language])

  // Bulk save handler
  const saveBulkOverrides = async (dates: string[], isDayOff: boolean, intervals: Interval[], masterIds?: string[]) => {
    const res = await fetch(`${apiPrefix}/schedule/overrides/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates, isDayOff, intervals, masterIds, masterId: selectedMasterId !== "all" ? selectedMasterId : undefined }),
    })
    if (!res.ok) throw new Error(t('admin.calendar.bulkUpdateFailed'))
    fetchData()
  }

  if (!isMounted) return <div className="animate-pulse bg-muted rounded-xl h-full w-full" />

  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground overflow-hidden relative">
      <CalendarToolbar
        view={view}
        setView={setView}
        step={step}
        setStep={setStep}
        navigate={navigate}
        headerDisplay={headerDisplay}
        todayDisplay={todayDisplay}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        setShowBulkModal={setShowBulkModal}
        loading={loading}
        isMobile={isMobile}
        isAdminView={isAdminView}
        selectedMasterId={selectedMasterId}
        adminMastersList={adminMastersList}
        onMasterChange={onMasterChange}
      />

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
            apiPrefix={apiPrefix}
            isAdminView={isAdminView}
            selectedMasterId={selectedMasterId}
            isMobile={isMobile}
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
            apiPrefix={apiPrefix}
            isAdminView={isAdminView}
            selectedMasterId={selectedMasterId}
            isMobile={isMobile}
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
            apiPrefix={apiPrefix}
            isAdminView={isAdminView}
            selectedMasterId={selectedMasterId}
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
             if(!res.ok) throw new Error(t('admin.calendar.deleteFailed'))
             setViewingAppointment(null)
             fetchData()
          }}
        />
      )}
    </div>
  )
}
