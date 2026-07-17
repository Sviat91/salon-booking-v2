"use client"

import { useState, useCallback, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import DataCard from "@/components/admin/DataCard"
import ServiceForm from "./ServiceForm"
import { deleteService } from "./actions"

type Service = {
  id: string
  name_pl: string
  duration: number
  price: number
  masterServices?: { masterProfileId: string; priceOverride: number | null }[]
}

type MasterOption = { masterProfileId: string; name: string }

export default function ServicesClient({
  services,
  masters,
}: {
  services: Service[]
  masters: MasterOption[]
}) {
  const { t } = useTranslation()
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = useCallback((id: string) => {
    if (!confirm(t('admin.services.deleteConfirm'))) return
    startTransition(() => {
      deleteService(id)
    })
  }, [t])

  const masterNameByProfileId = new Map(
    masters.map((m) => [m.masterProfileId, m.name])
  )

  // Plain trigger buttons — reused by both the desktop table and the mobile card list.
  // A single shared edit Sheet (below) is controlled by editTarget/editOpen so it only
  // ever mounts once, regardless of which layout is visible.
  const renderActions = (svc: Service) => (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setEditTarget(svc)
          setEditOpen(true)
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        className="hover:text-destructive"
        onClick={() => handleDelete(svc.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  const specialPrices = (svc: Service) =>
    svc.masterServices && svc.masterServices.some((ms) => ms.priceOverride !== null) ? (
      <div className="flex flex-wrap gap-1">
        {svc.masterServices
          .filter((ms) => ms.priceOverride !== null)
          .map((ms) => (
            <Badge key={ms.masterProfileId} variant="muted" className="text-[11px]">
              {(masterNameByProfileId.get(ms.masterProfileId) ?? t('admin.services.unknownMaster'))}: {ms.priceOverride!.toFixed(2)} zł
            </Badge>
          ))}
      </div>
    ) : (
      <span>—</span>
    )

  return (
    <div>
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.services.manageEyebrow')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('admin.services.manageDesc')}</p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button className="h-10 gap-2 px-5">
                <Plus className="h-4 w-4" />
                {t('admin.services.addServiceTrigger')}
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('admin.services.addServiceTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <ServiceForm masters={masters} onSuccess={() => setAddOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Table */}
      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.services.noServicesTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('admin.services.noServicesHint', { title: t('admin.services.addServiceTitle') })}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colName')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colDuration')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colPrice')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colSpecialPrices')}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {services.map((svc) => (
                  <tr key={svc.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{svc.name_pl}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {svc.duration} {t('booking.minutes')}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {svc.price.toFixed(2)} zł
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {specialPrices(svc)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {renderActions(svc)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {services.map((svc) => (
              <DataCard
                key={svc.id}
                title={svc.name_pl}
                fields={[
                  { label: t('admin.services.colDuration'), value: `${svc.duration} ${t('booking.minutes')}` },
                  { label: t('admin.services.colPrice'), value: `${svc.price.toFixed(2)} zł` },
                  { label: t('admin.services.colSpecialPrices'), value: specialPrices(svc) },
                ]}
                actions={renderActions(svc)}
              />
            ))}
          </div>
        </>
      )}

      {/* Single shared edit Sheet — controlled by editTarget/editOpen, not per-row */}
      <Sheet
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditTarget(null)
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t('admin.services.editServiceTitle')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {editTarget && (
              <ServiceForm
                service={editTarget}
                masters={masters}
                onSuccess={() => {
                  setEditOpen(false)
                  setEditTarget(null)
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
