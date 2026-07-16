import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getTenantConfig } from "@/lib/tenant"
import ModernCalendar from "../calendar/ModernCalendar"
import { getServerT } from "@/lib/i18n-server"

export default async function MasterSchedulePage() {
  const t = getServerT()
  const session = await auth()
  const config = await getTenantConfig()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)] min-h-[600px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.calendar.scheduleAndCalendarTitle')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('admin.calendar.scheduleAndCalendarDesc')}</p>
      </div>
      
      <div className="flex-1 bg-card border rounded-[20px] shadow-sm overflow-hidden flex flex-col relative min-h-[500px]">
        <ModernCalendar 
          masterId={session.user.id} 
          availableSlotColor={(config as any).availableSlotColor as string || "#21A67A"}
          dayOffColor={(config as any).dayOffColor as string || "#BA1A1A"}
          workingHourStart={(config as any).workingHourStart as number ?? 8}
          workingHourEnd={(config as any).workingHourEnd as number ?? 21}
        />
      </div>
    </div>
  )
}
