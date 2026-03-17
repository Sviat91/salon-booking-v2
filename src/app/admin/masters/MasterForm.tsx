"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import Image from "next/image"
import { Copy, Check, Upload, X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createMaster, updateMaster, type MasterFormState } from "./actions"

type Master = {
  id: string
  name: string | null
  email: string | null
  masterProfile: { bio: string | null; avatarUrl: string | null; showOnHomepage: boolean } | null
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    master?.masterProfile?.avatarUrl ?? null
  )
  const [avatarUrl, setAvatarUrl] = useState<string>(
    master?.masterProfile?.avatarUrl ?? ""
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (state.success && master) onSuccess()
  }, [state.success, master, onSuccess])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Upload failed")
      setAvatarPreview(json.url)
      setAvatarUrl(json.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  // After create — show generated password
  if (state.success && state.generatedPassword) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Master created successfully!
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save this password — it will not be shown again.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>Generated Password</Label>
          <div className="flex gap-2">
            <Input readOnly value={state.generatedPassword} className="font-mono" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(state.generatedPassword!)
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
    <form action={formAction} className="flex flex-col gap-4">

      {/* Avatar upload */}
      <div className="grid gap-1.5">
        <Label>Master Photo</Label>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center shrink-0">
            {avatarPreview ? (
              <>
                <Image src={avatarPreview} alt="Avatar" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => { setAvatarPreview(null); setAvatarUrl("") }}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </>
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload photo"}
            </div>
          </label>
        </div>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </div>

      {/* Name */}
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

      {/* Email (create only) */}
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
            <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
          )}
          <p className="text-xs text-muted-foreground">
            A password will be auto-generated.
          </p>
        </div>
      )}

      {/* Bio */}
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
      </div>

      {/* Show on homepage */}
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <input
          id="showOnHomepage"
          name="showOnHomepage"
          type="checkbox"
          defaultChecked={master?.masterProfile?.showOnHomepage ?? true}
          className="h-4 w-4 accent-primary shrink-0"
        />
        <div>
          <Label htmlFor="showOnHomepage" className="cursor-pointer text-sm font-medium">
            Show on homepage
          </Label>
          <p className="text-xs text-muted-foreground">
            The master&apos;s card will be visible to clients on the site
          </p>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton label={master ? "Save Changes" : "Create Master"} />
    </form>
  )
}
