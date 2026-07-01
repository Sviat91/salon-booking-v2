"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { X, Calendar as CalIcon, User, MapPin, Plus, Trash2 } from "lucide-react"
import { DatePickerDropdown } from "@/components/DatePickerDropdown"
import { TimePickerDropdown } from "@/components/TimePickerDropdown"

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

type Service = { id: string; name: string; duration: number }
type Client = { id: string; name: string | null; phone: string | null }
type Entry = { id: string; date: string; startTime: string; duration: number }

export default function AppointmentModal({ date, initialAppointment, mode, apiPrefix = "/api/master", isAdminView = false, selectedMasterId, onClose, onSuccess }: AppointmentModalProps) {
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
        duration: initialAppointment.service?.duration || 60
      }]
    }
    return [{
      id: Math.random().toString(),
      date: format(date || new Date(), "yyyy-MM-dd"),
      startTime: "10:00",
      duration: 60
    }]
  })

  useEffect(() => {
    async function init() {
      try {
        const fetches = [
          fetch(`${apiPrefix}/services`),
          fetch(`${apiPrefix}/clients`)
        ]
        if (isAdminView) {
           fetches.push(fetch(`${apiPrefix}/masters`))
        }

        const resArr = await Promise.all(fetches)
        const srvData = await resArr[0].json()
        const cliData = await resArr[1].json()
        
        setServices(srvData.services || [])
        setClients(cliData.clients || [])

        if (isAdminView) {
           const mstData = await resArr[2].json()
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

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload = {
        entries: entries.map(e => ({ date: e.date, startTime: e.startTime, duration: e.duration })),
        serviceId: serviceId !== "custom" ? serviceId : undefined,
        serviceName: serviceId === "custom" ? customServiceName : undefined,
        clientId: clientId !== "custom" ? clientId : undefined,
        clientName: clientId === "custom" ? customClientName : undefined,
        clientPhone: clientId === "custom" ? customClientPhone : undefined,
        notes,
        masterId: isAdminView ? formMasterId : undefined
      }

      const url = mode === "edit" && initialAppointment ? `${apiPrefix}/appointments/${initialAppointment.id}` : `${apiPrefix}/appointments`
      const method = mode === "edit" ? "PUT" : "POST"

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to create appointment")
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
      duration: entries[0]?.duration || 60
    }])
  }

  const updateEntry = (id: string, field: keyof Entry, val: string | number) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: val } : e))
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
    if (serviceId === "custom" && !customServiceName) return false
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
                <h2 className="text-xl font-bold leading-tight">New Booking</h2>
                <p className="text-sm text-muted-foreground font-medium">Create a single or series booking</p>
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
                  <label className="text-sm font-medium mb-1.5 block">Select Master <span className="text-destructive">*</span></label>
                  <Select
                    value={formMasterId}
                    onValueChange={(v) => setFormMasterId(v ?? "")}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue>
                        {(v: string) => v ? (masters.find(m => m.id === v)?.name ?? v) : "-- Choose Master --"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=""><SelectItemText>-- Choose Master --</SelectItemText></SelectItem>
                      {masters.map(m => <SelectItem key={m.id} value={m.id}><SelectItemText>{m.name}</SelectItemText></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Row 1: Service & Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Service Column */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <MapPin className="h-4 w-4 text-primary" /> Service Details
                  </h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Select Service</label>
                    <Select value={serviceId} onValueChange={(v) => setServiceId(v ?? "custom")}>
                      <SelectTrigger className="h-10">
                        <SelectValue>
                          {(v: string) => {
                            if (v === "custom") return "-- Custom Service --"
                            const s = services.find(sv => sv.id === v)
                            return s ? `${s.name} (${s.duration}m)` : v
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom"><SelectItemText>-- Custom Service --</SelectItemText></SelectItem>
                        {services.map(s => <SelectItem key={s.id} value={s.id}><SelectItemText>{s.name} ({s.duration}m)</SelectItemText></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {serviceId === "custom" && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                      <label className="text-sm font-medium">Custom Service Name <span className="text-destructive">*</span></label>
                      <input 
                        type="text" 
                        value={customServiceName}
                        onChange={e => setCustomServiceName(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="E.g., Special Haircut"
                      />
                    </div>
                  )}
                </div>

                {/* Client Column */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <User className="h-4 w-4 text-primary" /> Client Details
                  </h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Select Existing Client</label>
                    <Select value={clientId} onValueChange={(v) => setClientId(v ?? "custom")}>
                      <SelectTrigger className="h-10">
                        <SelectValue>
                          {(v: string) => {
                            if (v === "custom") return "-- New Client / Guest --"
                            const c = clients.find(cl => cl.id === v)
                            return c ? `${c.name ?? ''}${c.phone ? ` (${c.phone})` : ''}` : v
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom"><SelectItemText>-- New Client / Guest --</SelectItemText></SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}><SelectItemText>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItemText></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {clientId === "custom" && (
                     <div className="space-y-3 animate-in slide-in-from-top-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Client Name <span className="text-destructive">*</span></label>
                        <input 
                          type="text" 
                          value={customClientName}
                          onChange={e => setCustomClientName(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
                          placeholder="Guest Name" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Phone Number</label>
                        <input 
                          type="text" 
                          value={customClientPhone}
                          onChange={e => setCustomClientPhone(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
                          placeholder="+1 234 567 8900" 
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
                    <CalIcon className="h-4 w-4 text-primary" /> Schedule & Time
                  </h3>
                  {mode !== "edit" && (
                    <Button variant="outline" size="sm" onClick={addEntry} className="h-8 gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Date (Series)
                    </Button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {entries.map((ent) => (
                    <div key={ent.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-muted/30 p-4 rounded-lg border border-border">
                      <div className="space-y-1 w-full sm:flex-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground">Date</label>
                        <DatePickerDropdown 
                          date={ent.date} 
                          onChange={(val) => updateEntry(ent.id, 'date', val)} 
                        />
                      </div>
                      <div className="space-y-1 w-full sm:flex-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                        <TimePickerDropdown 
                          value={ent.startTime}
                          onChange={(val) => updateEntry(ent.id, 'startTime', val)}
                          step={15}
                        />
                      </div>
                      <div className="space-y-1 w-full sm:flex-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
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
                  ))}
                </div>
              </div>

              {/* Row 3: Notes */}
              <div>
                 <div className="space-y-1.5">
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="min-h-[80px] resize-none"
                      placeholder="Special requests or comments about this booking..."
                    />
                  </div>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-border bg-muted/20 flex justify-end items-center rounded-b-xl shrink-0 gap-3 sticky bottom-0 z-20">
           <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
           <Button onClick={handleSave} disabled={loading || fetching || !isValid()}>
             {loading ? "Saving..." : mode === "edit" ? "Save Changes" : entries.length > 1 ? `Create ${entries.length} Appointments` : "Create Appointment"}
           </Button>
        </div>

      </div>
    </div>
    </div>
  )
}
