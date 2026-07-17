"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import { Copy, Check, Upload, X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createMaster, updateMaster, resetMasterPassword, getMasterPassword, type MasterFormState } from "./actions"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

type Master = {
  id: string
  name: string | null
  email: string | null
  masterProfile: { bio_pl: string | null; avatarUrl: string | null; showOnHomepage: boolean; color: string | null } | null
}

interface MasterFormProps {
  master?: Master
  onSuccess: () => void
}

const initialState: MasterFormState = {}

function SubmitButton({ label }: { label: string }) {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? t('common.saving') : label}
    </Button>
  )
}

export default function MasterForm({ master, onSuccess }: MasterFormProps) {
  const { t } = useTranslation()
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

  const [resetPasswordState, setResetPasswordState] = useState<{ password?: string, success?: boolean, error?: string, copied?: boolean }>({})
  const [isResetting, setIsResetting] = useState(false)
  const [customPassword, setCustomPassword] = useState("")

  const [shownPassword, setShownPassword] = useState<string | null>(null)
  const [showError, setShowError] = useState<string | null>(null)
  const [isLoadingPassword, setIsLoadingPassword] = useState(false)
  const [shownCopied, setShownCopied] = useState(false)

  async function handleShowPassword() {
    if (!master) return
    setIsLoadingPassword(true)
    setShowError(null)
    const res = await getMasterPassword(master.id)
    if (res.password) setShownPassword(res.password)
    else setShowError(res.error ?? t('admin.masters.loadPasswordFailed'))
    setIsLoadingPassword(false)
  }

  async function handleResetPassword() {
    if (!master) return
    setIsResetting(true)
    setResetPasswordState({})
    const res = await resetMasterPassword(master.id, customPassword || undefined)
    if (res.success) {
      setResetPasswordState({ success: true, password: res.newPassword })
      setCustomPassword("")
    } else {
      setResetPasswordState({ error: res.error })
    }
    setIsResetting(false)
  }

  function handleGenerateCustom() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    const generated = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    setCustomPassword(generated)
  }

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
      if (!res.ok) throw new Error(json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed'))
      setAvatarPreview(json.url)
      setAvatarUrl(json.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('admin.masters.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  // After create — show generated password
  if (state.success && state.generatedPassword) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-[var(--md-success-container)] p-4">
          <p className="text-sm font-medium text-[var(--md-on-success-container)]">
            {t('admin.masters.masterCreatedSuccess')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('admin.masters.savePasswordHint')}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>{t('admin.masters.generatedPassword')}</Label>
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
        <Button onClick={onSuccess}>{t('admin.masters.done')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-4">

      {/* Avatar upload */}
      <div className="grid gap-1.5">
        <Label>{t('admin.masters.masterPhoto')}</Label>
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
              {uploading ? t('admin.masters.uploading') : t('admin.masters.uploadPhoto')}
            </div>
          </label>
        </div>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </div>

      {/* Name */}
      <div className="grid gap-1.5">
        <Label htmlFor="name">{t('admin.masters.fullName')}</Label>
        <Input
          id="name"
          name="name"
          defaultValue={master?.name ?? ""}
          placeholder={t('admin.masters.fullNamePlaceholder')}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Email (create only) */}
      {!master && (
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('admin.masters.emailLabel')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t('admin.masters.emailPlaceholder')}
            required
          />
          {state.fieldErrors?.email && (
            <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('admin.masters.passwordAutoGenerated')}
          </p>
        </div>
      )}

      {/* Bio */}
      <div className="grid gap-1.5">
        <Label htmlFor="bio_pl">{t('admin.masters.bio')}</Label>
        <Textarea
          id="bio_pl"
          name="bio_pl"
          rows={3}
          defaultValue={master?.masterProfile?.bio_pl ?? ""}
          placeholder={t('admin.masters.bioPlaceholder')}
          className="resize-none"
        />
      </div>

      {/* Color */}
      <div className="grid gap-1.5">
        <Label htmlFor="color">{t('admin.masters.appointmentColor')}</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            id="color"
            name="color"
            defaultValue={master?.masterProfile?.color ?? "#166534"}
            className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5 shrink-0"
          />
          <span className="text-xs text-muted-foreground">{t('admin.masters.colorHint')}</span>
        </div>
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
            {t('admin.masters.showOnHomepage')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('admin.masters.showOnHomepageHint')}
          </p>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && master && <div className="rounded bg-[var(--md-success-container)] p-2 text-center text-xs font-medium text-[var(--md-on-success-container)]">{t('admin.masters.settingsSaved')}</div>}

      <SubmitButton label={master ? t('admin.masters.saveChangesBtn') : t('admin.masters.createMasterBtn')} />
    </form>

    {master && (
      <div className="flex flex-col gap-4 pt-6 border-t border-border">
        <div>
          <h3 className="text-lg font-semibold">{t('admin.masters.accessRecovery')}</h3>
          <p className="text-sm text-muted-foreground">{t('admin.masters.accessRecoveryDesc')}</p>
        </div>

        <div className="grid gap-2 max-w-sm">
          <Label>{t('admin.masters.currentPasswordLabel')}</Label>
          <Button
            type="button"
            variant="outline"
            onClick={handleShowPassword}
            disabled={isLoadingPassword}
            className="w-fit"
          >
            {isLoadingPassword ? t('common.loading') : t('admin.masters.showCurrentPassword')}
          </Button>

          {shownPassword && (
            <div className="mt-2 flex gap-2">
              <Input readOnly value={shownPassword} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(shownPassword)
                  setShownCopied(true)
                  setTimeout(() => setShownCopied(false), 2000)
                }}
              >
                {shownCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {showError && <p className="text-sm text-destructive">{showError}</p>}
        </div>

        <div className="grid gap-2 max-w-sm">
          <Label htmlFor="newPassword">{t('admin.masters.currentOrNewPassword')}</Label>
          <div className="flex gap-2">
            <Input
              id="newPassword"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder={t('admin.masters.newPasswordPlaceholder')}
            />
            <Button type="button" variant="outline" onClick={handleGenerateCustom}>
              {t('admin.masters.generate')}
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleResetPassword}
            disabled={isResetting || (!customPassword && !resetPasswordState.success)}
            className="mt-2 w-full sm:w-auto"
            variant="secondary"
          >
            {isResetting ? t('common.saving') : (customPassword ? t('admin.masters.saveNewPassword') : t('admin.masters.autoGenerateAndSave'))}
          </Button>

          {resetPasswordState.success && (
            <div className="mt-4 rounded-lg bg-[var(--md-success-container)] p-4">
              <p className="text-sm font-medium text-[var(--md-on-success-container)]">
                {t('admin.masters.passwordUpdated')}
              </p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={resetPasswordState.password} className="font-mono bg-background" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(resetPasswordState.password!)
                    setResetPasswordState(prev => ({ ...prev, copied: true }))
                    setTimeout(() => setResetPasswordState(prev => ({ ...prev, copied: false })), 2000)
                  }}
                >
                  {resetPasswordState.copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
          {resetPasswordState.error && <p className="text-sm text-destructive">{resetPasswordState.error}</p>}
        </div>
      </div>
    )}
  </div>
  )
}
