"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import AppointmentStatusBadge from "@/components/admin/AppointmentStatusBadge"
import { Clock, Phone, User as UserIcon } from "lucide-react"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { useConfirm } from "@/components/ConfirmDialogProvider"
import { toast } from "sonner"

type AppointmentProps = {
  id: string
  startTime: string
  endTime: string
  status: string
  client: { name: string | null; phone: string | null }
  service: { name_pl: string; name_en: string | null; name_uk: string | null; duration: number }
}

export default function AppointmentsList({ appointments }: { appointments: AppointmentProps[] }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const router = useRouter()
  const language = useCurrentLanguage()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const handleCancel = async (id: string) => {
    if (!(await confirm(t('admin.appointments.confirmCancel')))) return

    setCancellingId(id)
    try {
      const res = await fetch(`/api/master/appointments/${id}`, {
        method: "PATCH",
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.code ? t(apiErrorKey(errorData.code)) : t('admin.appointments.cancelFailed'))
      }
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCancellingId(null)
    }
  }

  if (appointments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-8 text-center border border-dashed rounded-lg bg-muted/20">
        {t('admin.appointments.noneToday')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {appointments.map((app) => {
        const cancellable = app.status === "PENDING" || app.status === "CONFIRMED"
        
        return (
          <Card key={app.id}>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <AppointmentStatusBadge status={app.status} />
                  <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {app.startTime} - {app.endTime} ({app.service.duration} min)
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-base">{resolveLocalized({ pl: app.service.name_pl, en: app.service.name_en, uk: app.service.name_uk }, language)}</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UserIcon className="w-4 h-4 shrink-0" />
                      <span>{app.client.name || t('admin.appointments.unknownClient')}</span>
                    </div>
                    {app.client.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        <a href={`tel:${app.client.phone}`} className="hover:underline">{app.client.phone}</a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {cancellable && (
                <div className="shrink-0">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleCancel(app.id)}
                    disabled={cancellingId === app.id}
                  >
                    {cancellingId === app.id ? t('management.cancelling') : t('management.cancelBtn')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
