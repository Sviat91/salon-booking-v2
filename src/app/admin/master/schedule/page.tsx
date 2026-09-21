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
    <div className="flex -mx-4 -my-4 h-[calc(100dvh-4rem)] overflow-hidden bg-card lg:mx-0 lg:my-0 lg:h-[calc(100vh-8rem)] lg:min-h-[600px] lg:border lg:border-border lg:rounded-[20px] lg:shadow-sm">
      <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
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
