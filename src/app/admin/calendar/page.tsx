"use client"

import { useState, useEffect } from "react"
import ModernCalendar, { type AdminMasterListItem } from "@/app/admin/master/calendar/ModernCalendar"

export default function AdminCalendarPage() {
  const [masters, setMasters] = useState<AdminMasterListItem[]>([])
  const [selectedMasterId, setSelectedMasterId] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMasters() {
      try {
        const res = await fetch("/api/admin/calendar/masters")
        const data = await res.json()
        setMasters(data.masters || [])
      } catch (err) {
        console.error("Failed to fetch masters", err)
      } finally {
        setLoading(false)
      }
    }
    fetchMasters()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] min-h-[600px] items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden bg-card border border-border rounded-[20px] shadow-sm">
      <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
        <ModernCalendar 
          masterId={selectedMasterId === "all" ? undefined : selectedMasterId}
          selectedMasterId={selectedMasterId}
          onMasterChange={setSelectedMasterId}
          adminMastersList={masters}
          isAdminView={true}
          apiPrefix="/api/admin/calendar"
          availableSlotColor="#21A67A"
          dayOffColor="#BA1A1A"
          workingHourStart={8}
          workingHourEnd={21}
        />
      </div>
    </div>
  )
}
