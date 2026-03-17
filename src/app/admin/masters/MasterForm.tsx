"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createMaster, updateMaster, type MasterFormState } from "./actions"

type Master = {
  id: string
  name: string | null
  email: string | null
  masterProfile: { bio: string | null } | null
}

interface MasterFormProps {
  master?: Master
  onSuccess: () => void
}

const initialState: MasterFormState = {}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? "Saving…" : label}
    </Button>
  )
}

export default function MasterForm({ master, onSuccess }: MasterFormProps) {
  const action = master
    ? updateMaster.bind(null, master.id)
    : createMaster

  const [state, formAction] = useFormState(action, initialState)
  const [copied, setCopied] = useState(false)

  // Only close on success if it's an edit (create shows the password first)
  useEffect(() => {
    if (state.success && master) onSuccess()
  }, [state.success, master, onSuccess])

  function copyPassword() {
    if (!state.generatedPassword) return
    navigator.clipboard.writeText(state.generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // After create: show the generated password
  if (state.success && state.generatedPassword) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Master created successfully!
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save this password — it won&apos;t be shown again.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>Generated Password</Label>
          <div className="flex gap-2">
            <Input readOnly value={state.generatedPassword} className="font-mono" />
            <Button type="button" variant="outline" size="icon" onClick={copyPassword}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Button onClick={onSuccess}>Done</Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={master?.name ?? ""}
          placeholder="e.g. Anna Kowalska"
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      {!master && (
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="master@salon.com"
            required
          />
          {state.fieldErrors?.email && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.email[0]}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A password will be auto-generated.
          </p>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={master?.masterProfile?.bio ?? ""}
          placeholder="Short description of specialties…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
        />
        {state.fieldErrors?.bio && (
          <p className="text-xs text-destructive">{state.fieldErrors.bio[0]}</p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <SubmitButton label={master ? "Update Master" : "Create Master"} />
    </form>
  )
}
