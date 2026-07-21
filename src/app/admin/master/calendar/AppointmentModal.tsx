"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { X, Calendar as CalIcon, User, MapPin, Plus, Trash2 } from "lucide-react"
import AppointmentTimeSelect from "./AppointmentTimeSelect"
import AppointmentDateSelect from "./AppointmentDateSelect"
import AppointmentServiceSelect from "./AppointmentServiceSelect"
import { useCurrentLanguage } from "@/contexts/LanguageContext"

interface AppointmentModalProps {
  date?: Date
  initialAppointment?: any
  mode?: "edit" | "copy"
  apiPrefix?: string
  isAdminView?: boolean
  selectedMasterId?: string
  onClose: () => void
  onSuccess: () => void
}

type Service = { id: string; name_pl: string; name_en?: string | null; name_uk?: string | null; duration: number }
type Client = { id: string; name: string | null; phone: string | null }
type Entry = { id: string; date: string; startTime: string; duration: number; serviceId: string; customServiceName: string }

export default function AppointmentModal({ date, initialAppointment, mode, apiPrefix = "/api/master", isAdminView = false, selectedMasterId, onClose, onSuccess }: AppointmentModalProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [masters, setMasters] = useState<{id: string, name: string}[]>([])

  const [formMasterId, setFormMasterId] = useState<string>(
    initialAppointment ? (initialAppointment.masterId || initialAppointment.master?.id || "") : (selectedMasterId === "all" ? "" : (selectedMasterId || ""))
  )

  const [serviceId, setServiceId] = useState<string>(initialAppointment ? (initialAppointment.service?.id || "custom") : "custom")
  const [customServiceName, setCustomServiceName] = useState("")
  
  const [clientId, setClientId] = useState<string>(initialAppointment ? (initialAppointment.client?.id || "custom") : "custom")
  const [customClientName, setCustomClientName] = useState("")
  const [customClientPhone, setCustomClientPhone] = useState("")
  
  const [notes, setNotes] = useState(initialAppointment?.notes || "")

  const [entries, setEntries] = useState<Entry[]>(() => {
    if (initialAppointment) {
      return [{
        id: Math.random().toString(),
        date: initialAppointment.date.split("T")[0],
        startTime: initialAppointment.startTime,
        duration: initialAppointment.service?.duration || 60,
        serviceId: initialAppointment.service?.id || "custom",
        customServiceName: ""
      }]
    }
    return [{
      id: Math.random().toString(),
      date: format(date || new Date(), "yyyy-MM-dd"),
      startTime: "10:00",
      duration: 60,
      serviceId: "custom",
      customServiceName: ""
    }]
  })

  // Original master (edit mode only) — used to detect an actual reassignment (AD-A2).
  const originalMasterId = initialAppointment ? (initialAppointment.masterId || initialAppointment.master?.id || "") : ""

  useEffect(() => {
    async function init() {
      try {
        const fetches = [
          fetch(`${apiPrefix}/clients`)
        ]
        if (isAdminView) {
           fetches.push(fetch(`${apiPrefix}/masters`))
        }

        const resArr = await Promise.all(fetches)
        const cliData = await resArr[0].json()

        setClients(cliData.clients || [])

        if (isAdminView) {
           const mstData = await resArr[1].json()
           setMasters(mstData.masters || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setFetching(false)
      }
    }
    init()
  }, [])

  // Fetch services scoped to the selected master (AD-A2); master view sends no masterId param (self-scoped server-side).
  useEffect(() => {
    if (isAdminView && !formMasterId) {
      setServices([])
      return
    }
    let cancelled = false
    fetch(`${apiPrefix}/services${formMasterId ? `?masterId=${formMasterId}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setServices(data.services || [])
      })
      .catch(() => {
        if (cancelled) return
        setServices([])
      })

    return () => {
      cancelled = true
    }
  }, [apiPrefix, isAdminView, formMasterId])

  // EDIT: clear the shared service only on an actual master reassignment, never on initial open (AD-A2).
  useEffect(() => {
    if (mode !== "edit" || formMasterId === originalMasterId) return
    if (serviceId !== "custom" && !services.find(s => s.id === serviceId)) {
      setServiceId("custom")
      setCustomServiceName("")
    }
  }, [services, formMasterId])

  // CREATE: clear any entry's service selection no longer offered by the master.
  useEffect(() => {
    if (mode === "edit") return
    setEntries(prev => prev.map(e => (e.serviceId !== "custom" && !services.find(s => s.id === e.serviceId))
      ? { ...e, serviceId: "custom", customServiceName: "" }
      : e))
  }, [services])

  // EDIT display safety: keep the current service selectable while the master is unchanged (mirrors the time-slot safety re-add).
  const serviceOptions = (mode === "edit" && formMasterId === originalMasterId && initialAppointment?.service?.id && !services.find(s => s.id === initialAppointment.service.id))
    ? [...services, initialAppointment.service as Service]
    : services

  const handleSave = async () => {
    setLoading(true)
    try {
      const baseFields = {
        clientId: clientId !== "custom" ? clientId : undefined,
        clientName: clientId === "custom" ? customClientName : undefined,
        clientPhone: clientId === "custom" ? customClientPhone : undefined,
        notes,
        masterId: isAdminView ? formMasterId : undefined
      }
      // EDIT keeps the top-level shared serviceId/serviceName (PUT); CREATE sends per-entry serviceId/serviceName (POST resolves per entry, AD-B3).
      const payload = mode === "edit"
        ? {
            entries: entries.map(e => ({ date: e.date, startTime: e.startTime, duration: e.duration })),
            serviceId: serviceId !== "custom" ? serviceId : undefined,
            serviceName: serviceId === "custom" ? customServiceName : undefined,
            ...baseFields
          }
        : {
            entries: entries.map(e => ({
              date: e.date,
              startTime: e.startTime,
              duration: e.duration,
              serviceId: e.serviceId !== "custom" ? e.serviceId : undefined,
              serviceName: e.serviceId === "custom" ? e.customServiceName : undefined,
            })),
            ...baseFields
          }

      const url = mode === "edit" && initialAppointment ? `${apiPrefix}/appointments/${initialAppointment.id}` : `${apiPrefix}/appointments`
      const method = mode === "edit" ? "PUT" : "POST"

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(t('admin.calendar.slotConflictError'))
        }
        throw new Error(t('admin.calendar.createAppointmentFailed'))
      }
      onSuccess()
    } catch (err: any) {
      alert(err.message)
      setLoading(false)
    }
  }

  const addEntry = () => {
    setEntries([...entries, {
      id: Math.random().toString(),
      date: format(date || new Date(), "yyyy-MM-dd"),
      startTime: "10:00",
      duration: entries[0]?.duration || 60,
      serviceId: entries[0]?.serviceId || "custom",
      customServiceName: entries[0]?.customServiceName || ""
    }])
  }

  const updateEntry = (id: string, field: keyof Entry, val: string | number) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  // Per-entry service (create mode): a real service also auto-fills that entry's duration (AD-B4).
  const updateEntryService = (id: string, newServiceId: string) => {
    setEntries(entries.map(e => {
      if (e.id !== id) return e
      const s = newServiceId !== "custom" ? services.find(sv => sv.id === newServiceId) : undefined
      return s ? { ...e, serviceId: newServiceId, duration: s.duration } : { ...e, serviceId: newServiceId }
    }))
  }

  // Original values of the appointment being edited, used to keep its own
  // current time slot selectable even if it falls outside the freshly
  // computed availability options (AD2 safety re-add).
  const originalDate = initialAppointment ? initialAppointment.date.split("T")[0] : undefined
  const originalStartTime = initialAppointment ? initialAppointment.startTime : undefined
  const originalDuration = initialAppointment ? (initialAppointment.service?.duration || 60) : undefined

  const handleTimeOptionsResolved = (entryId: string, times: string[]) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e
      if (!e.startTime || times.includes(e.startTime)) return e
      const isUnchangedOriginal = mode === "edit" && initialAppointment &&
        e.date === originalDate && e.duration === originalDuration && e.startTime === originalStartTime
      if (isUnchangedOriginal) return e
      return { ...e, startTime: "" }
    }))
  }

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id))
    }
  }

  // Pre-fill duration if known service selected
  useEffect(() => {
    if (serviceId !== "custom") {
      const s = services.find(x => x.id === serviceId)
      if (s) {
        setEntries(prev => prev.map(e => ({ ...e, duration: s.duration })))
      }
    }
  }, [serviceId, services])

  const isValid = () => {
    if (isAdminView && !formMasterId) return false
    if (mode === "edit") {
      if (serviceId === "custom" && !customServiceName) return false
    } else {
      if (entries.some(e => e.serviceId === "custom" && !e.customServiceName)) return false
    }
    if (clientId === "custom" && !customClientName) return false
    if (entries.some(e => !e.date || !e.startTime || !e.duration)) return false
    return true
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 overflow-y-auto p-4 animate-in fade-in">
      <div className="min-h-full flex items-center justify-center py-8">
        <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl flex flex-col relative overflow-visible">
          
          <div className="flex justify-between items-center p-5 border-b border-border bg-card rounded-t-xl shrink-0 z-10">
            <div className="flex gap-4 items-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CalIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">{t('admin.calendar.newBookingTitle')}</h2>
                <p className="text-sm text-muted-foreground font-medium">{t('admin.calendar.newBookingSubtitle')}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>

          <div className="p-6 space-y-8">
          {fetching ? (
            <div className="flex items-center justify-center p-12">
               <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {isAdminView && (
                <div className="bg-muted/50 p-4 rounded-lg border border-border mb-4">
                  <label className="text-sm font-medium mb-1.5 block">{t('admin.calendar.selectMasterLabel')} <span className="text-destructive">*</span></label>
                  <Select
                    value={formMasterId}
                    onValueChange={(v) => setFormMasterId(v ?? "")}
                    disabled={mode === "edit" && !isAdminView}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue>
                        {(v: string) => v ? (masters.find(m => m.id === v)?.name ?? v) : t('admin.calendar.chooseMasterPlaceholder')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=""><SelectItemText>{t('admin.calendar.chooseMasterPlaceholder')}</SelectItemText></SelectItem>
                      {masters.map(m => <SelectItem key={m.id} value={m.id}><SelectItemText>{m.name}</SelectItemText></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Row 1: Service & Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Service Column (edit mode only — create mode moves the picker into each entry row) */}
                {mode === "edit" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                      <MapPin className="h-4 w-4 text-primary" /> {t('admin.calendar.serviceDetailsTitle')}
                    </h3>

                    <AppointmentServiceSelect
                      services={serviceOptions}
                      language={language}
                      value={serviceId}
                      onChange={setServiceId}
                      customServiceName={customServiceName}
                      onCustomServiceNameChange={setCustomServiceName}
                    />
                  </div>
                )}

                {/* Client Column */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <User className="h-4 w-4 text-primary" /> {t('admin.calendar.clientDetailsTitle')}
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('admin.calendar.selectExistingClientLabel')}</label>
                    <Select value={clientId} onValueChange={(v) => setClientId(v ?? "custom")}>
                      <SelectTrigger className="h-10">
                        <SelectValue>
                          {(v: string) => {
                            if (v === "custom") return t('admin.calendar.newClientGuestOption')
                            const c = clients.find(cl => cl.id === v)
                            return c ? `${c.name ?? ''}${c.phone ? ` (${c.phone})` : ''}` : v
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom"><SelectItemText>{t('admin.calendar.newClientGuestOption')}</SelectItemText></SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}><SelectItemText>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItemText></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {clientId === "custom" && (
                     <div className="space-y-3 animate-in slide-in-from-top-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">{t('admin.calendar.clientNameLabel')} <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          value={customClientName}
                          onChange={e => setCustomClientName(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          placeholder={t('admin.calendar.guestNamePlaceholder')}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">{t('admin.calendar.phoneNumberLabel')}</label>
                        <input
                          type="text"
                          value={customClientPhone}
                          onChange={e => setCustomClientPhone(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          placeholder={t('admin.calendar.phonePlaceholderExample')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Dates and Times */}
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CalIcon className="h-4 w-4 text-primary" /> {t('admin.calendar.scheduleTimeTitle')}
                  </h3>
                  {mode !== "edit" && (
                    <Button variant="outline" size="sm" onClick={addEntry} className="h-8 gap-1">
                      <Plus className="w-3.5 h-3.5" /> {t('admin.calendar.addDateSeriesBtn')}
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {entries.map((ent) => (
                    <div key={ent.id} className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border">
                      {mode !== "edit" && (
                        <AppointmentServiceSelect
                          services={services}
                          language={language}
                          value={ent.serviceId}
                          onChange={(v) => updateEntryService(ent.id, v)}
                          customServiceName={ent.customServiceName}
                          onCustomServiceNameChange={(v) => updateEntry(ent.id, 'customServiceName', v)}
                        />
                      )}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                      <div className="space-y-1 w-full sm:flex-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground">{t('admin.calendar.dateLabel')}</label>
                        <AppointmentDateSelect
                          apiPrefix={apiPrefix}
                          isAdminView={isAdminView}
                          masterId={formMasterId}
                          durationMin={ent.duration}
                          value={ent.date}
                          onChange={(val) => updateEntry(ent.id, 'date', val)}
                          excludeOriginalDate={mode === "edit" ? originalDate : undefined}
                        />
                      </div>
                      <div className="space-y-1 w-full sm:flex-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground">{t('admin.calendar.startTimeLabel')}</label>
                        <AppointmentTimeSelect
                          apiPrefix={apiPrefix}
                          isAdminView={isAdminView}
                          masterId={formMasterId}
                          date={ent.date}
                          durationMin={ent.duration}
                          value={ent.startTime}
                          onChange={(val) => updateEntry(ent.id, 'startTime', val)}
                          onOptionsResolved={(times) => handleTimeOptionsResolved(ent.id, times)}
                          excludeAppointmentId={mode === "edit" ? initialAppointment?.id : undefined}
                        />
                      </div>
                      <div className="space-y-1 w-full sm:flex-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground">{t('admin.calendar.durationMinLabel')}</label>
                        <input
                          type="number" 
                          value={ent.duration}
                          min={5}
                          onChange={e => updateEntry(ent.id, 'duration', Number(e.target.value))}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                        />
                      </div>
                      
                      <div className="ml-auto mt-5 sm:mt-0 pt-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeEntry(ent.id)}
                          disabled={entries.length === 1}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: Notes */}
              <div>
                 <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('admin.calendar.notesOptionalLabel')}</label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="min-h-[80px] resize-none"
                      placeholder={t('admin.calendar.notesPlaceholder')}
                    />
                  </div>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-border bg-card flex justify-end items-center rounded-b-xl shrink-0 gap-3 sticky bottom-0 z-20">
           <Button variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
           <Button onClick={handleSave} disabled={loading || fetching || !isValid()}>
             {loading ? t('common.saving') : mode === "edit" ? t('admin.masters.saveChangesBtn') : entries.length > 1 ? t('admin.calendar.createNAppointmentsBtn', { count: entries.length }) : t('admin.calendar.createAppointmentBtn')}
           </Button>
        </div>

      </div>
    </div>
    </div>
  )
}
