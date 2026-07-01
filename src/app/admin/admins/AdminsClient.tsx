"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import AdminForm from "./AdminForm"
import { parseAdminPermissions } from "@/lib/admin-permissions"

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  adminPermissions: string | null
  createdAt: Date
}

interface Props {
  admins: AdminUser[]
}

function PermBadge({ label, granted }: { label: string; granted: boolean }) {
  return (
    <Badge variant={granted ? "success" : "muted"} className="text-[10px]">
      {label}
    </Badge>
  )
}

export default function AdminsClient({ admins }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  async function handleDelete(id: string, name: string | null) {
    if (!confirm(`Delete admin "${name ?? "this admin"}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admins</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {admins.length} admin{admins.length !== 1 ? "s" : ""} registered
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Admin
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Add Admin</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <AdminForm onSuccess={() => { setAddOpen(false); router.refresh() }} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {admins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No admins yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &ldquo;Add Admin&rdquo; to create the first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {admins.map((admin) => {
            const perms = parseAdminPermissions(admin.adminPermissions)
            return (
              <div
                key={admin.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{admin.name ?? "—"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      {admin.email}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Sheet
                      open={editOpen && editTarget?.id === admin.id}
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
                            onClick={() => { setEditTarget(admin); setEditOpen(true) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <SheetContent side="right">
                        <SheetHeader>
                          <SheetTitle>Edit Admin</SheetTitle>
                        </SheetHeader>
                        <div className="px-4 pb-4">
                          {editTarget && (
                            <AdminForm
                              admin={editTarget}
                              onSuccess={() => { setEditOpen(false); setEditTarget(null); router.refresh() }}
                            />
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-destructive"
                      onClick={() => handleDelete(admin.id, admin.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border pt-2 flex flex-wrap gap-1">
                  <PermBadge label="Clients: View" granted={perms.clients.view} />
                  <PermBadge label="Clients: Edit" granted={perms.clients.edit} />
                  <PermBadge label="Clients: Delete" granted={perms.clients.delete} />
                  <PermBadge label="GDPR: View" granted={perms.gdpr.view} />
                  <PermBadge label="GDPR: Withdraw" granted={perms.gdpr.withdraw} />
                  <PermBadge label="GDPR: Erase" granted={perms.gdpr.erase} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
