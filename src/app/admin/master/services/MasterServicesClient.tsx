"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Clock, DollarSign, Lock } from "lucide-react"
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
            <h1 className="text-2xl font-bold tracking-tight">Services</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your personal services or view general salon ones.
            </p>
          </div>

          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <SheetTrigger>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add My Service
              </Button>
            </SheetTrigger>
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
              <p className="text-sm">You haven&apos;t added any custom services.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Duration</th>
                    <th className="px-4 py-3 text-left font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myServices.map((svc) => (
                    <tr key={svc.id} className="bg-background hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{svc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{svc.duration} min</td>
                      <td className="px-4 py-3 text-muted-foreground">{svc.price.toFixed(2)} zł</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Sheet open={editOpen && editTarget?.id === svc.id} onOpenChange={(o) => {
                            setEditOpen(o)
                            if (!o) setEditTarget(null)
                          }}>
                            <SheetTrigger>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditTarget(svc)
                                setEditOpen(true)
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </SheetTrigger>
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
                            size="icon"
                            className="hover:text-destructive"
                            disabled={deletingId === svc.id}
                            onClick={() => handleDelete(svc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm opacity-90">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Duration</th>
                    <th className="px-4 py-3 text-left font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {adminServices.map((svc) => (
                    <tr key={svc.id} className="bg-muted/10">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{svc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{svc.duration} min</td>
                      <td className="px-4 py-3 text-muted-foreground">{svc.price.toFixed(2)} zł</td>
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
