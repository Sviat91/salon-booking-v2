"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Upload, X, ImageIcon } from "lucide-react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ColorRow({
  field,
  defaultValue,
}: {
  field: { name: string; label: string; description: string }
  defaultValue: string
}) {
  const [color, setColor] = useState(defaultValue)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={field.name}>{field.label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={color}
          className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0"
          onChange={(e) => setColor(e.target.value)}
        />
        <Input
          id={field.name}
          name={field.name}
          value={color}
          pattern="^#[0-9A-Fa-f]{6}$"
          placeholder="#000000"
          className="font-mono text-sm"
          onChange={(e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setColor(e.target.value)
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{field.description}</p>
    </div>
  )
}

export function ImageUploadField({
  label,
  hint,
  preview,
  fieldName,
  fieldValue,
  onUpload,
  onRemove,
  uploading,
  uploadError,
  previewTone = "light",
}: {
  label: string
  hint: string
  preview: string | null
  fieldName: string
  fieldValue: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  uploading: boolean
  uploadError: string | null
  previewTone?: "light" | "dark"
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2 max-w-sm">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
      <input type="hidden" name={fieldName} value={fieldValue} />
      <div className="flex items-start gap-4">
        {preview ? (
          <div className={`relative flex h-16 w-32 items-center justify-center rounded-lg border border-border p-2 ${previewTone === "dark" ? "bg-zinc-800" : "bg-muted/30"}`}>
            <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-contain p-1" />
            <button
              type="button"
              onClick={onRemove}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className={`flex h-16 w-32 items-center justify-center rounded-lg border border-dashed gap-1.5 text-xs ${previewTone === "dark" ? "border-zinc-600 bg-zinc-900 text-zinc-400" : "border-border bg-muted/20 text-muted-foreground"}`}>
            <ImageIcon className="h-4 w-4" />
            {t('admin.settings.general.noneLabel')}
          </div>
        )}
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
          <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
            <Upload className="h-4 w-4" />
            {uploading ? t('admin.masters.uploading') : t('admin.settings.general.uploadLabel')}
          </div>
        </label>
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-border bg-muted/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </section>
  )
}

export function SubmitButton() {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t('common.saving') : t('admin.nav.saveSettings')}
    </Button>
  )
}
