import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getServerT } from "@/lib/i18n-server"
import MasterGoogleCalendarClient from "./MasterGoogleCalendarClient"

export default async function MasterGoogleCalendarPage() {
  const t = getServerT()
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t("admin.settings.configurationEyebrow")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.settings.googleCalendar.masterPageDesc")}
        </p>
      </div>
      <MasterGoogleCalendarClient />
    </div>
  )
}
