"use client"

import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import AppointmentStatusBadge from "@/components/admin/AppointmentStatusBadge"
import DataCard from "@/components/admin/DataCard"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { resolveAppointmentPrice } from "@/lib/discounts/shared"

type Appointment = {
  id: string
  startTime: string
  status: string
  client: { name: string | null }
  service: { name_pl: string; name_en: string | null; name_uk: string | null; price: number }
  master: { name: string | null }
  finalPrice: number | null
}

export default function TodaysAppointmentsTable({
  appointments,
}: {
  appointments: Appointment[]
}) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const serviceName = (svc: Appointment["service"]) =>
    resolveLocalized({ pl: svc.name_pl, en: svc.name_en, uk: svc.name_uk }, language)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-base font-medium">{t('admin.appointments.todaysTitle')}</span>
        <span className="text-sm text-muted-foreground">{t('admin.appointments.total', { count: appointments.length })}</span>
      </div>

      {appointments.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {t('admin.appointments.noneToday')}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden lg:table w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('admin.appointments.colTime')}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('admin.appointments.colClient')}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('admin.appointments.colService')}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('admin.appointments.colMaster')}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('admin.appointments.colPrice')}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t('admin.appointments.colStatus')}
                </th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((app) => (
                <tr key={app.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium">{app.startTime}</td>
                  <td className="px-4 py-3">{app.client.name || t('admin.appointments.unknownClient')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{serviceName(app.service)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="accent">{app.master.name || "—"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{resolveAppointmentPrice(app.finalPrice, app.service.price)} zł</td>
                  <td className="px-4 py-3">
                    <AppointmentStatusBadge status={app.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 p-4 lg:hidden">
            {appointments.map((app) => (
              <DataCard
                key={app.id}
                title={`${app.startTime} · ${app.client.name || t('admin.appointments.unknownClient')}`}
                fields={[
                  { label: t('admin.appointments.colService'), value: serviceName(app.service) },
                  { label: t('admin.appointments.colMaster'), value: <Badge variant="accent">{app.master.name || "—"}</Badge> },
                  { label: t('admin.appointments.colPrice'), value: `${resolveAppointmentPrice(app.finalPrice, app.service.price)} zł` },
                  { label: t('admin.appointments.colStatus'), value: <AppointmentStatusBadge status={app.status} /> },
                ]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
