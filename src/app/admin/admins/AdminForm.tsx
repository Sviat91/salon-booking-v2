"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseAdminPermissions, type AdminPermissions } from "@/lib/admin-permissions"

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  adminPermissions: string | null
}

interface Props {
  admin?: AdminUser
  onSuccess: () => void
}

type PermKey = keyof AdminPermissions
type ClientKey = keyof AdminPermissions["clients"]
type GdprKey = keyof AdminPermissions["gdpr"]

export default function AdminForm({ admin, onSuccess }: Props) {
  const existing = parseAdminPermissions(admin?.adminPermissions)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [perms, setPerms] = useState<AdminPermissions>(existing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function toggle(group: PermKey, key: string) {
    setPerms((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: !prev[group][key as never] },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (admin) {
      // Edit mode: update permissions only
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPermissions: perms }),
      })
      setSaving(false)
      if (res.ok) {
        onSuccess()
      } else {
        const d = await res.json()
        setError(d.error ?? "Failed to save")
      }
    } else {
      // Create mode
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, adminPermissions: perms }),
      })
      setSaving(false)
      if (res.ok) {
        setCreated({ password })
      } else {
        const d = await res.json()
        setError(typeof d.error === "string" ? d.error : "Failed to create admin")
      }
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-[var(--md-success-container)] p-4">
          <p className="text-sm font-medium text-[var(--md-on-success-container)]">
            Admin created successfully!
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save this password — it will not be shown again.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>Password</Label>
          <div className="flex gap-2">
            <Input readOnly value={created.password} className="font-mono" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(created.password)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Button onClick={onSuccess}>Done</Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!admin && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-name">Full Name</Label>
            <Input
              id="adm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jan Kowalski"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-email">Email</Label>
            <Input
              id="adm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@salon.com"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-password">Password</Label>
            <Input
              id="adm-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
          </div>
        </>
      )}

      <div className="grid gap-2">
        <p className="text-sm font-medium">Clients</p>
        {(["view", "edit", "delete"] as ClientKey[]).map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={perms.clients[key]}
              onChange={() => toggle("clients", key)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm capitalize">{key}</span>
          </label>
        ))}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">GDPR</p>
        {(["view", "withdraw", "erase"] as GdprKey[]).map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={perms.gdpr[key]}
              onChange={() => toggle("gdpr", key)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm capitalize">{key}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : admin ? "Save Permissions" : "Create Admin"}
      </Button>
    </form>
  )
}
