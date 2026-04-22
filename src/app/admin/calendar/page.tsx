"use client"

import { useState, useEffect } from "react"
import ModernCalendar from "@/app/admin/master/calendar/ModernCalendar"

export default function AdminCalendarPage() {
  const [masters, setMasters] = useState<{id: string, name: string}[]>([])
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
      <div className="flex h-[calc(100vh-6rem)] min-h-[600px] items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[600px] overflow-hidden -mx-4 -mt-4 bg-background">
      <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full border-t border-border">
        <ModernCalendar 
          masterId={selectedMasterId === "all" ? undefined : selectedMasterId}
          selectedMasterId={selectedMasterId}
          onMasterChange={setSelectedMasterId}
          adminMastersList={masters}
          isAdminView={true}
          apiPrefix="/api/admin/calendar"
          availableSlotColor="#22c55e"
          dayOffColor="#ef4444"
          workingHourStart={8}
          workingHourEnd={21}
        />
      </div>
    </div>
  )
}
