import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getTenantConfig } from "@/lib/tenant"
import ModernCalendar from "../calendar/ModernCalendar"

export default async function MasterSchedulePage() {
  const session = await auth()
  const config = await getTenantConfig()
  
  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-6rem)] min-h-[600px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule & Calendar</h1>
        <p className="text-muted-foreground mt-2 text-sm">Manage your appointments, working hours, and set day-offs right from the calendar.</p>
      </div>
      
      <div className="flex-1 bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col relative min-h-[500px]">
        <ModernCalendar 
          masterId={session.user.id} 
          availableSlotColor={(config as any).availableSlotColor as string || "#22c55e"} 
          dayOffColor={(config as any).dayOffColor as string || "#ef4444"} 
        />
      </div>
    </div>
  )
}
