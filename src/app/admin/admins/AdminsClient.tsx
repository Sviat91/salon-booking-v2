"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  async function handleDelete(id: string, name: string | null) {
    if (!confirm(t('admin.admins.deleteConfirm', { name: name ?? t('admin.admins.thisAdmin') }))) return
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t('admin.admins.accessEyebrow')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.admins.registeredCount', { count: admins.length })}
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button className="h-10 gap-2 px-5">
                <Plus className="h-4 w-4" />
                {t('admin.admins.addAdminTrigger')}
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('admin.admins.addAdminTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <AdminForm onSuccess={() => { setAddOpen(false); router.refresh() }} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {admins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.admins.noAdminsTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('admin.admins.noAdminsHint', { title: t('admin.admins.addAdminTitle') })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {admins.map((admin) => {
            const perms = parseAdminPermissions(admin.adminPermissions)
            return (
              <div
                key={admin.id}
                className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm"
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
                          <SheetTitle>{t('admin.admins.editAdminTitle')}</SheetTitle>
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
                  <PermBadge label={t('admin.admins.permClientsView')} granted={perms.clients.view} />
                  <PermBadge label={t('admin.admins.permClientsEdit')} granted={perms.clients.edit} />
                  <PermBadge label={t('admin.admins.permClientsDelete')} granted={perms.clients.delete} />
                  <PermBadge label={t('admin.admins.permGdprView')} granted={perms.gdpr.view} />
                  <PermBadge label={t('admin.admins.permGdprWithdraw')} granted={perms.gdpr.withdraw} />
                  <PermBadge label={t('admin.admins.permGdprErase')} granted={perms.gdpr.erase} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
