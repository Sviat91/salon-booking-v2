"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
      setStatus({ ok: true, message: "Saved successfully." })
      e.currentTarget.reset()
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Error" })
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
          {loading ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  )
}

async function patchCredentials(body: Record<string, string>) {
  const res = await fetch("/api/admin/superadmin/credentials", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Request failed")
}

export default function SuperAdminCredentials() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Change your login email or password. Current password is required for both actions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CredentialForm
          title="Change Password"
          fields={[
            { id: "cur-pass", name: "currentPassword", label: "Current password", type: "password" },
            { id: "new-pass", name: "newPassword", label: "New password", type: "password", placeholder: "Min. 6 characters" },
          ]}
          onSubmit={(data) =>
            patchCredentials({ action: "password", currentPassword: data.currentPassword, newPassword: data.newPassword })
          }
        />

        <CredentialForm
          title="Change Login Email"
          fields={[
            { id: "cur-pass-email", name: "currentPassword", label: "Current password", type: "password" },
            { id: "new-email", name: "newEmail", label: "New email", type: "email", placeholder: "new@example.com" },
          ]}
          onSubmit={(data) =>
            patchCredentials({ action: "email", currentPassword: data.currentPassword, newEmail: data.newEmail })
          }
        />
      </div>
    </div>
  )
}
