"use client"

import { useState } from "react"
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
import MasterServiceForm from "./MasterServiceForm"

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
  const router = useRouter()
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete your custom service?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/master/services/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      router.refresh()
    } catch (e: any) {
      alert("Error: " + e.message)
    } finally {
      setDeletingId(null)
    }
  }

  // Split services
  const adminServices = services.filter(s => s.masterId === null)
  const myServices = services.filter(s => s.masterId === currentMasterId)

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Services</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your personal services or view general salon ones.
            </p>
          </div>

          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <SheetTrigger
              render={
                <Button className="h-10 gap-2 px-5">
                  <Plus className="h-4 w-4" />
                  Add My Service
                </Button>
              }
            />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Add My Service</SheetTitle>
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
          <h2 className="text-lg font-semibold mb-3">My Custom Services</h2>
          {myServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center text-muted-foreground">
              <p className="text-sm">You haven&apos;t added any custom services.</p>
            </div>
          ) : (
            <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Duration</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium">{svc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{svc.duration} min</td>
                      <td className="px-4 py-3 font-medium text-foreground">{svc.price.toFixed(2)} zł</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Sheet open={editOpen && editTarget?.id === svc.id} onOpenChange={(o) => {
                            setEditOpen(o)
                            if (!o) setEditTarget(null)
                          }}>
                            <SheetTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" onClick={() => {
                                  setEditTarget(svc)
                                  setEditOpen(true)
                                }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <SheetContent side="right">
                              <SheetHeader>
                                <SheetTitle>Edit My Service</SheetTitle>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            Salon Services <Lock className="w-4 h-4 text-muted-foreground" />
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            These services are managed by the salon administrator and cannot be edited.
          </p>
          {adminServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No global salon services available.</p>
          ) : (
            <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm opacity-90">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Duration</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pricing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {adminServices.map((svc) => (
                    <tr key={svc.id} className="bg-muted/10">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{svc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{svc.duration} min</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(() => {
                          const overridePrice = svc.masterServices?.[0]?.priceOverride
                          if (overridePrice !== null && overridePrice !== undefined) {
                            return (
                              <div className="space-y-0.5">
                                <div>Your rate: {overridePrice.toFixed(2)} zł</div>
                                <div className="text-xs opacity-80">Default: {svc.price.toFixed(2)} zł</div>
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
          )}
        </div>
      </div>
    </div>
  )
}
