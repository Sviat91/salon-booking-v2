"use client"

import { useState, useCallback, useTransition } from "react"
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
import ServiceForm from "./ServiceForm"
import { deleteService } from "./actions"

type Service = {
  id: string
  name: string
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
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = useCallback((id: string) => {
    if (!confirm("Delete this service?")) return
    startTransition(() => {
      deleteService(id)
    })
  }, [])

  const masterNameByProfileId = new Map(
    masters.map((m) => [m.masterProfileId, m.name])
  )

  return (
    <div>
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Manage</p>
          <p className="mt-1 text-sm text-muted-foreground">Procedures, prices and durations</p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button className="h-10 gap-2 px-5">
                <Plus className="h-4 w-4" />
                Add service
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Add Service</SheetTitle>
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
          <p className="text-sm text-muted-foreground">No services yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &ldquo;Add Service&rdquo; to create the first one.
          </p>
        </div>
      ) : (
        <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Duration</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Price</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Special Prices</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((svc) => (
                <tr key={svc.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium">{svc.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {svc.duration} min
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {svc.price.toFixed(2)} zł
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {svc.masterServices && svc.masterServices.some((ms) => ms.priceOverride !== null) ? (
                      <div className="flex flex-wrap gap-1">
                        {svc.masterServices
                          .filter((ms) => ms.priceOverride !== null)
                          .map((ms) => (
                            <Badge key={ms.masterProfileId} variant="muted" className="text-[11px]">
                              {(masterNameByProfileId.get(ms.masterProfileId) ?? "Unknown master")}: {ms.priceOverride!.toFixed(2)} zł
                            </Badge>
                          ))}
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {/* Edit */}
                      <Sheet
                        open={editOpen && editTarget?.id === svc.id}
                        onOpenChange={(o) => {
                          setEditOpen(o)
                          if (!o) setEditTarget(null)
                        }}
                      >
                        <SheetTrigger
                          render={
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
                          }
                        />
                        <SheetContent side="right">
                          <SheetHeader>
                            <SheetTitle>Edit Service</SheetTitle>
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

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        onClick={() => handleDelete(svc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
