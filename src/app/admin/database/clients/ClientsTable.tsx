"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Pencil, Trash2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AdminPermissions } from "@/lib/admin-permissions"

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
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save")
      }
      setEditTarget(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string | null) {
    if (!confirm(`Delete client "${name ?? "this client"}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/database/clients/${id}`, { method: "DELETE" })
    if (res.ok) {
      router.refresh()
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {initialClients.length} client{initialClients.length !== 1 ? "s" : ""} total
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search by name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No clients found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Registered</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                {(permissions.clients.edit || permissions.clients.delete) && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((client, i) => (
                <tr
                  key={client.id}
                  className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}
                >
                  <td className="px-4 py-3 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {client.name ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">{client.phone ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">{client.email ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(client.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {client.isGuest ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Guest</span>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Registered</span>
                    )}
                  </td>
                  {(permissions.clients.edit || permissions.clients.delete) && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
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
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={handleEdit} className="flex flex-col gap-4 pt-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editTarget.phone}
                  onChange={(e) => setEditTarget({ ...editTarget, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editTarget.email}
                  onChange={(e) => setEditTarget({ ...editTarget, email: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
