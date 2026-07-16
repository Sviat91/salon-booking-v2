"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

type Status = { ok: boolean; message: string } | null

function CredentialForm({
  title,
  fields,
  onSubmit,
}: {
  title: string
  fields: { id: string; label: string; type: string; name: string; placeholder?: string }[]
  onSubmit: (data: Record<string, string>) => Promise<void>
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const data: Record<string, string> = {}
    for (const field of fields) data[field.name] = form.get(field.name) as string
    try {
      await onSubmit(data)
      setStatus({ ok: true, message: t('admin.settings.general.savedSuccessfully') })
      e.currentTarget.reset()
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : t('common.error') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-[20px] border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {fields.map((f) => (
          <div key={f.id} className="grid gap-1.5">
            <Label htmlFor={f.id}>{f.label}</Label>
            <Input id={f.id} name={f.name} type={f.type} placeholder={f.placeholder} required />
          </div>
        ))}
        {status && (
          <p className={`text-sm ${status.ok ? "text-[var(--md-success)]" : "text-destructive"}`}>
            {status.message}
          </p>
        )}
        <Button type="submit" disabled={loading} className="self-start">
          {loading ? t('common.saving') : t('common.save')}
        </Button>
      </form>
    </div>
  )
}

async function patchCredentials(body: Record<string, string>, t: (key: string) => string) {
  const res = await fetch("/api/admin/superadmin/credentials", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.code ? t(apiErrorKey(data.code)) : t('admin.settings.general.requestFailed'))
}

export default function SuperAdminCredentials() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t('admin.settings.general.securityTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('admin.settings.general.securityDesc')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CredentialForm
          title={t('profile.changePassword')}
          fields={[
            { id: "cur-pass", name: "currentPassword", label: t('admin.masters.currentPasswordLabel'), type: "password" },
            { id: "new-pass", name: "newPassword", label: t('admin.settings.general.newPasswordField'), type: "password", placeholder: t('admin.settings.general.newPasswordPlaceholder') },
          ]}
          onSubmit={(data) =>
            patchCredentials({ action: "password", currentPassword: data.currentPassword, newPassword: data.newPassword }, t)
          }
        />

        <CredentialForm
          title={t('admin.settings.general.changeEmailTitle')}
          fields={[
            { id: "cur-pass-email", name: "currentPassword", label: t('admin.masters.currentPasswordLabel'), type: "password" },
            { id: "new-email", name: "newEmail", label: t('admin.settings.general.newEmailField'), type: "email", placeholder: t('admin.settings.general.newEmailPlaceholder') },
          ]}
          onSubmit={(data) =>
            patchCredentials({ action: "email", currentPassword: data.currentPassword, newEmail: data.newEmail }, t)
          }
        />
      </div>
    </div>
  )
}
