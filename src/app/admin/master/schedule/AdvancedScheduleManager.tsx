"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Clock, Ban, Trash2, Plus, Calendar } from "lucide-react"
import BulkSettingsModal from "./BulkSettingsModal"

type Interval = { start: string; end: string }

type Template = {
  dayOfWeek: number
  isDayOff: boolean
  intervals: Interval[]
}

type DateOverride = {
  id: string
  date: string // ISO
  isDayOff: boolean
  intervals: Interval[]
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function AdvancedScheduleManager({
  initialTemplates,
  initialOverrides
}: {
  initialTemplates: Template[]
  initialOverrides: DateOverride[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"TEMPLATE" | "OVERRIDES">("TEMPLATE")
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [savingTemplate, setSavingTemplate] = useState<number | null>(null)

  const handleTemplateChange = (dayOfWeek: number, field: keyof Template, value: any) => {
    setTemplates(prev => prev.map(t => t.dayOfWeek === dayOfWeek ? { ...t, [field]: value } : t))
  }

  const handleAddInterval = (dayOfWeek: number) => {
    setTemplates(prev => prev.map(t => {
      if (t.dayOfWeek === dayOfWeek) {
        return { ...t, intervals: [...t.intervals, { start: "12:00", end: "13:00" }] }
      }
      return t
    }))
  }

  const handleUpdateInterval = (dayOfWeek: number, index: number, field: 'start'|'end', val: string) => {
    setTemplates(prev => prev.map(t => {
      if (t.dayOfWeek === dayOfWeek) {
        const newInt = [...t.intervals]
        newInt[index] = { ...newInt[index], [field]: val }
        return { ...t, intervals: newInt }
      }
      return t
    }))
  }

  const handleRemoveInterval = (dayOfWeek: number, index: number) => {
    setTemplates(prev => prev.map(t => {
      if (t.dayOfWeek === dayOfWeek) {
        return { ...t, intervals: t.intervals.filter((_, i) => i !== index) }
      }
      return t
    }))
  }

  const saveTemplate = async (dayOfWeek: number) => {
    setSavingTemplate(dayOfWeek)
    const t = templates.find(t => t.dayOfWeek === dayOfWeek)
    if (!t) return

    try {
      const res = await fetch("/api/master/schedule/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      })
      if (!res.ok) throw new Error("Failed to save")
      router.refresh()
    } catch (e: any) {
      alert("Error saving: " + e.message)
    } finally {
      setSavingTemplate(null)
    }
  }

  const saveBulkOverrides = async (dates: string[], isDayOff: boolean, intervals: Interval[]) => {
    const res = await fetch("/api/master/schedule/overrides/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates, isDayOff, intervals }),
    })
    if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed bulk update")
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Custom Tabs Navigation */}
      <div className="flex border-b border-border">
        <button 
          onClick={() => setActiveTab("TEMPLATE")}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "TEMPLATE" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Recurring Weekly Schedule
        </button>
        <button 
          onClick={() => setActiveTab("OVERRIDES")}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "OVERRIDES" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Specific Dates & Overrides
        </button>
      </div>

      {/* Tab 1: Templates */}
      {activeTab === "TEMPLATE" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Define your standard working hours for each day of the week. You can add multiple shifts per day (e.g. Morning and Evening).</p>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(t => (
              <div key={t.dayOfWeek} className={`border rounded-xl p-4 flex flex-col ${t.isDayOff ? 'bg-muted/30 border-dashed' : 'bg-card shadow-sm'}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">{DAYS_OF_WEEK[t.dayOfWeek]}</h3>
                  
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`dayOff-${t.dayOfWeek}`}
                      checked={t.isDayOff}
                      onChange={(e) => handleTemplateChange(t.dayOfWeek, "isDayOff", e.target.checked)}
                      className="accent-primary"
                    />
                    <label htmlFor={`dayOff-${t.dayOfWeek}`} className="text-xs font-medium cursor-pointer">Day Off</label>
                  </div>
                </div>

                {!t.isDayOff ? (
                  <div className="flex-1 space-y-3">
                    {t.intervals.length === 0 && <p className="text-xs text-muted-foreground">No hours set.</p>}
                    {t.intervals.map((inv, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-background p-1.5 rounded border border-border">
                        <input 
                          type="time" 
                          value={inv.start}
                          onChange={(e) => handleUpdateInterval(t.dayOfWeek, idx, 'start', e.target.value)}
                          className="bg-transparent text-sm min-w-0 flex-1 px-1 outline-none"
                        />
                        <span className="text-muted-foreground">-</span>
                        <input 
                          type="time" 
                          value={inv.end}
                          onChange={(e) => handleUpdateInterval(t.dayOfWeek, idx, 'end', e.target.value)}
                          className="bg-transparent text-sm min-w-0 flex-1 px-1 outline-none"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive shrink-0"
                          onClick={() => handleRemoveInterval(t.dayOfWeek, idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-xs h-8 border-dashed" onClick={() => handleAddInterval(t.dayOfWeek)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Shift
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <Ban className="h-8 w-8 text-muted-foreground opacity-20" />
                  </div>
                )}

                <Button 
                  className="w-full mt-4" 
                  size="sm"
                  disabled={savingTemplate === t.dayOfWeek}
                  onClick={() => saveTemplate(t.dayOfWeek)}
                >
                  {savingTemplate === t.dayOfWeek ? "Saving..." : "Save " + DAYS_OF_WEEK[t.dayOfWeek]}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Overrides */}
      {activeTab === "OVERRIDES" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-sm text-muted-foreground">Manage specific dates that differ from your recurring schedule (e.g. vacations, extra working days).</p>
            </div>
            <Button onClick={() => setShowBulkModal(true)} className="gap-2">
              <Calendar className="h-4 w-4" /> Bulk Settings
            </Button>
          </div>

          <div className="space-y-3">
            {initialOverrides.length === 0 ? (
              <div className="text-center py-12 border rounded-xl border-dashed">
                <p className="text-muted-foreground">No specific date overrides found.</p>
                <Button variant="link" onClick={() => setShowBulkModal(true)}>Add your first override</Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {initialOverrides.map(o => (
                  <div key={o.id} className={`border rounded-lg p-3 ${o.isDayOff ? 'bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/40' : 'bg-card'}`}>
                    <div className="font-semibold mb-2">{format(new Date(o.date), "EEEE, MMM d, yyyy")}</div>
                    {o.isDayOff ? (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                            <Ban className="h-4 w-4" /> Day Off
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {o.intervals.map((inv, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    {inv.start} - {inv.end}
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Settings Modal */}
      {showBulkModal && (
        <BulkSettingsModal 
          onClose={() => setShowBulkModal(false)} 
          onSave={saveBulkOverrides}
        />
      )}
    </div>
  )
}
