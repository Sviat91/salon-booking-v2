"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseAdminPermissions, type AdminPermissions } from "@/lib/admin-permissions"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

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
  const { t } = useTranslation()
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
        const d = await res.json().catch(() => ({}))
        setError(d.code ? t(apiErrorKey(d.code)) : t('admin.admins.saveFailed'))
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
        const d = await res.json().catch(() => ({}))
        setError(d.code ? t(apiErrorKey(d.code)) : t('admin.admins.createFailed'))
      }
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-[var(--md-success-container)] p-4">
          <p className="text-sm font-medium text-[var(--md-on-success-container)]">
            {t('admin.admins.adminCreatedSuccess')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('admin.masters.savePasswordHint')}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>{t('form.password')}</Label>
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
        <Button onClick={onSuccess}>{t('admin.masters.done')}</Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!admin && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-name">{t('admin.masters.fullName')}</Label>
            <Input
              id="adm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.admins.adminNamePlaceholder')}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-email">{t('admin.masters.emailLabel')}</Label>
            <Input
              id="adm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('admin.admins.adminEmailPlaceholder')}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-password">{t('form.password')}</Label>
            <Input
              id="adm-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('admin.admins.passwordPlaceholder')}
              minLength={6}
              required
            />
          </div>
        </>
      )}

      <div className="grid gap-2">
        <p className="text-sm font-medium">{t('admin.admins.clientsSection')}</p>
        {(["view", "edit", "delete"] as ClientKey[]).map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={perms.clients[key]}
              onChange={() => toggle("clients", key)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm capitalize">{t(`admin.admins.perm${key.charAt(0).toUpperCase()}${key.slice(1)}Word`)}</span>
          </label>
        ))}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">{t('admin.admins.gdprSection')}</p>
        {(["view", "withdraw", "erase"] as GdprKey[]).map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={perms.gdpr[key]}
              onChange={() => toggle("gdpr", key)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm capitalize">{t(`admin.admins.perm${key.charAt(0).toUpperCase()}${key.slice(1)}Word`)}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? t('common.saving') : admin ? t('admin.admins.savePermissions') : t('admin.admins.createAdminBtn')}
      </Button>
    </form>
  )
}
