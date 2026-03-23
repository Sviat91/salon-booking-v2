"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { X, Calendar as CalIcon, User, Search, MapPin, Plus, Trash2 } from "lucide-react"
import { DatePickerDropdown } from "@/components/DatePickerDropdown"

interface AppointmentModalProps {
  date: Date
  onClose: () => void
  onSuccess: () => void
}

type Service = { id: string; name: string; duration: number }
type Client = { id: string; name: string | null; phone: string | null }
type Entry = { id: string; date: string; startTime: string; duration: number }

export default function AppointmentModal({ date, onClose, onSuccess }: AppointmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])

  const [serviceId, setServiceId] = useState<string>("custom")
  const [customServiceName, setCustomServiceName] = useState("")
  
  const [clientId, setClientId] = useState<string>("custom")
  const [customClientName, setCustomClientName] = useState("")
  const [customClientPhone, setCustomClientPhone] = useState("")
  
  const [notes, setNotes] = useState("")

  const [entries, setEntries] = useState<Entry[]>([{
    id: Math.random().toString(),
    date: format(date, "yyyy-MM-dd"),
    startTime: "10:00",
    duration: 60
  }])

  useEffect(() => {
    async function init() {
      try {
        const [srvRes, cliRes] = await Promise.all([
          fetch("/api/master/services"),
          fetch("/api/master/clients")
        ])
        const srvData = await srvRes.json()
        const cliData = await cliRes.json()
        
        const allServices = srvData.services || []
        setServices(allServices)
        setClients(cliData.clients || [])
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
        notes
      }

      const res = await fetch("/api/master/appointments", {
        method: "POST",
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
      date: format(date, "yyyy-MM-dd"),
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
              {/* Row 1: Service & Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Service Column */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <MapPin className="h-4 w-4 text-primary" /> Service Details
                  </h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Select Service</label>
                    <select 
                      value={serviceId} 
                      onChange={e => setServiceId(e.target.value)}
                      className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="custom">-- Custom Service --</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}m)</option>)}
                    </select>
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
                    <div className="relative">
                      <select 
                        value={clientId}
                        onChange={e => setClientId(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary appearance-none"
                      >
                        <option value="custom">-- New Client / Guest --</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                      </select>
                    </div>
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
                  <Button variant="outline" size="sm" onClick={addEntry} className="h-8 gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Date (Series)
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {entries.map((ent, idx) => (
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
                        <select 
                          value={ent.startTime}
                          onChange={e => updateEntry(ent.id, 'startTime', e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                        >
                          {Array.from({ length: 24 * 4 }).map((_, i) => {
                            const h = Math.floor(i / 4)
                            const m = (i % 4) * 15
                            const val = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                            return <option key={val} value={val}>{val}</option>
                          })}
                        </select>
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
                    <textarea 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none" 
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
             {loading ? "Saving..." : entries.length > 1 ? `Create ${entries.length} Appointments` : "Create Appointment"}
           </Button>
        </div>

      </div>
    </div>
    </div>
  )
}
