"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Pencil, Trash2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import DataCard from "@/components/admin/DataCard"
import MasterServiceForm from "./MasterServiceForm"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

type Service = {
  id: string
  name: string
  duration: number
  price: number
  masterId: string | null
  masterServices?: { masterProfileId: string; priceOverride: number | null }[]
}

export default function MasterServicesClient({
  services,
  currentMasterId,
}: {
  services: Service[]
  currentMasterId: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.services.deleteCustomConfirm'))) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/master/services/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(t(apiErrorKey(errData.code)))
      }
      router.refresh()
    } catch (e: any) {
      alert(t('admin.services.errorPrefix', { message: e.message }))
    } finally {
      setDeletingId(null)
    }
  }

  // Split services
  const adminServices = services.filter(s => s.masterId === null)
  const myServices = services.filter(s => s.masterId === currentMasterId)

  // Plain trigger buttons — reused by both the desktop table and the mobile card list.
  // A single shared edit Sheet (below) is controlled by editTarget/editOpen so it only
  // ever mounts once, regardless of which layout is visible.
  const renderActions = (svc: Service) => (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" onClick={() => {
        setEditTarget(svc)
        setEditOpen(true)
      }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        className="hover:text-destructive"
        disabled={deletingId === svc.id}
        onClick={() => handleDelete(svc.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.nav.services')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.services.masterDesc')}
            </p>
          </div>

          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <SheetTrigger
              render={
                <Button className="h-10 gap-2 px-5">
                  <Plus className="h-4 w-4" />
                  {t('admin.services.addMyService')}
                </Button>
              }
            />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t('admin.services.addMyService')}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4 pt-6">
                <MasterServiceForm onSuccess={() => setAddOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('admin.services.myCustomServicesHeading')}</h2>
          {myServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center text-muted-foreground">
              <p className="text-sm">{t('admin.services.noCustomServices')}</p>
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
                      <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {myServices.map((svc) => (
                      <tr key={svc.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-medium">{svc.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{svc.duration} {t('booking.minutes')}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{svc.price.toFixed(2)} zł</td>
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
                {myServices.map((svc) => (
                  <DataCard
                    key={svc.id}
                    title={svc.name}
                    fields={[
                      { label: t('admin.services.colDuration'), value: `${svc.duration} ${t('booking.minutes')}` },
                      { label: t('admin.services.colPrice'), value: `${svc.price.toFixed(2)} zł` },
                    ]}
                    actions={renderActions(svc)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            {t('admin.services.salonServicesHeading')} <Lock className="w-4 h-4 text-muted-foreground" />
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            {t('admin.services.salonServicesDesc')}
          </p>
          {adminServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.services.noGlobalServices')}</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm opacity-90">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colName')}</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colDuration')}</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colPricing')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {adminServices.map((svc) => (
                      <tr key={svc.id} className="bg-muted/10">
                        <td className="px-4 py-3 font-medium text-muted-foreground">{svc.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{svc.duration} {t('booking.minutes')}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {(() => {
                            const overridePrice = svc.masterServices?.[0]?.priceOverride
                            if (overridePrice !== null && overridePrice !== undefined) {
                              return (
                                <div className="space-y-0.5">
                                  <div>{t('admin.services.yourRate', { price: overridePrice.toFixed(2) })}</div>
                                  <div className="text-xs opacity-80">{t('admin.services.defaultRate', { price: svc.price.toFixed(2) })}</div>
                                </div>
                              )
                            }
                            return <span>{svc.price.toFixed(2)} zł</span>
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 lg:hidden">
                {adminServices.map((svc) => {
                  const overridePrice = svc.masterServices?.[0]?.priceOverride
                  const pricing = overridePrice !== null && overridePrice !== undefined
                    ? (
                      <div className="space-y-0.5">
                        <div>{t('admin.services.yourRate', { price: overridePrice.toFixed(2) })}</div>
                        <div className="text-xs opacity-80">{t('admin.services.defaultRate', { price: svc.price.toFixed(2) })}</div>
                      </div>
                    )
                    : <span>{svc.price.toFixed(2)} zł</span>
                  return (
                    <DataCard
                      key={svc.id}
                      className="opacity-90"
                      title={svc.name}
                      fields={[
                        { label: t('admin.services.colDuration'), value: `${svc.duration} ${t('booking.minutes')}` },
                        { label: t('admin.services.colPricing'), value: pricing },
                      ]}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Single shared edit Sheet — controlled by editTarget/editOpen, not per-row */}
      <Sheet open={editOpen} onOpenChange={(o) => {
        setEditOpen(o)
        if (!o) setEditTarget(null)
      }}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t('admin.services.editMyServiceTitle')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 pt-6">
            {editTarget && (
              <MasterServiceForm
                service={editTarget}
                onSuccess={() => { setEditOpen(false); setEditTarget(null) }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
