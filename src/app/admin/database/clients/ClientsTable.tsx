"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Search, Pencil, Trash2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AdminPermissions } from "@/lib/admin-permissions"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { localeFor } from "@/lib/i18n"
import DataCard from "@/components/admin/DataCard"

type ClientRow = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  createdAt: Date
  isGuest: boolean
}

interface Props {
  clients: ClientRow[]
  permissions: AdminPermissions
}

interface EditState {
  id: string
  name: string
  phone: string
  email: string
}

export default function ClientsTable({ clients: initialClients, permissions }: Props) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [editTarget, setEditTarget] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = initialClients.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  })

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/database/clients/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTarget.name || undefined,
          phone: editTarget.phone || undefined,
          email: editTarget.email || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.code ? t(apiErrorKey(d.code)) : t('admin.database.saveFailed'))
      }
      setEditTarget(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.database.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string | null) {
    if (!confirm(t('admin.database.deleteConfirm', { name: name ?? t('admin.database.thisClient') }))) return
    const res = await fetch(`/api/admin/database/clients/${id}`, { method: "DELETE" })
    if (res.ok) {
      router.refresh()
    }
  }

  const renderActions = (client: ClientRow) => (
    <>
      {permissions.clients.edit && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            setEditTarget({
              id: client.id,
              name: client.name ?? "",
              phone: client.phone ?? "",
              email: client.email ?? "",
            })
          }
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {permissions.clients.delete && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:text-destructive"
          onClick={() => handleDelete(client.id, client.name)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  )

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('admin.database.totalClients', { count: initialClients.length })}
      </p>

      <div className="mb-4 flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder={t('admin.database.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.database.noClientsFound')}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.database.nameLabel')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('form.phone')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.masters.emailLabel')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.database.colRegistered')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.database.colType')}</th>
                  {(permissions.clients.edit || permissions.clients.delete) && (
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colActions')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {client.name ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">{client.phone ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">{client.email ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(client.createdAt).toLocaleDateString(localeFor(language))}
                    </td>
                    <td className="px-4 py-3">
                      {client.isGuest ? (
                        <Badge variant="muted">{t('admin.database.guestBadge')}</Badge>
                      ) : (
                        <Badge variant="success">{t('admin.database.registeredBadge')}</Badge>
                      )}
                    </td>
                    {(permissions.clients.edit || permissions.clients.delete) && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {renderActions(client)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((client) => (
              <DataCard
                key={client.id}
                title={client.name ?? <span className="text-muted-foreground">—</span>}
                fields={[
                  { label: t('form.phone'), value: client.phone ?? "—" },
                  { label: t('admin.masters.emailLabel'), value: client.email ?? "—" },
                  { label: t('admin.database.colRegistered'), value: new Date(client.createdAt).toLocaleDateString(localeFor(language)) },
                  {
                    label: t('admin.database.colType'),
                    value: client.isGuest ? (
                      <Badge variant="muted">{t('admin.database.guestBadge')}</Badge>
                    ) : (
                      <Badge variant="success">{t('admin.database.registeredBadge')}</Badge>
                    ),
                  },
                ]}
                actions={(permissions.clients.edit || permissions.clients.delete) ? renderActions(client) : undefined}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.database.editClientTitle')}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={handleEdit} className="flex flex-col gap-4 pt-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name">{t('admin.database.nameLabel')}</Label>
                <Input
                  id="edit-name"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-phone">{t('form.phone')}</Label>
                <Input
                  id="edit-phone"
                  value={editTarget.phone}
                  onChange={(e) => setEditTarget({ ...editTarget, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-email">{t('admin.masters.emailLabel')}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editTarget.email}
                  onChange={(e) => setEditTarget({ ...editTarget, email: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('admin.masters.saveChangesBtn')}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
