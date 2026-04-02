"use client"

import { useState, useCallback, useTransition } from "react"
import { Plus, Pencil, Trash2, Clock, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
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
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {services.length} service{services.length !== 1 ? "s" : ""} total
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Service
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No services yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &ldquo;Add Service&rdquo; to create the first one.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Duration
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" /> Price
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium">Special Prices</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((svc) => (
                <tr key={svc.id} className="bg-background hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{svc.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {svc.duration} min
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {svc.price.toFixed(2)} zł
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {svc.masterServices && svc.masterServices.some((ms) => ms.priceOverride !== null) ? (
                      <div className="space-y-1">
                        {svc.masterServices
                          .filter((ms) => ms.priceOverride !== null)
                          .map((ms) => (
                            <div key={ms.masterProfileId}>
                              {(masterNameByProfileId.get(ms.masterProfileId) ?? "Unknown master")}: {ms.priceOverride!.toFixed(2)} zł
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
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

      {/* Edit Sheet (controlled externally when clicking row) */}
    </div>
  )
}
