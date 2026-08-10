"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import { ImageUploadField } from "./FormFields"
import { resizeImageIfNeeded } from "@/lib/image-resize"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

async function uploadIcon(
  file: File,
  setUrl: (v: string) => void,
  setUploading: (v: boolean) => void,
  setError: (v: string | null) => void,
  onChange: () => void,
  resolveMessage: (code?: string) => string
) {
  setError(null)
  setUploading(true)
  const processedFile = file.type !== "image/svg+xml" ? await resizeImageIfNeeded(file, 512) : file
  const fd = new FormData()
  fd.append("file", processedFile)
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(resolveMessage(json.code))
    setUrl(json.url)
    onChange()
  } catch (err) {
    setError(err instanceof Error ? err.message : resolveMessage())
  } finally {
    setUploading(false)
  }
}

export default function ThemeToggleIconsSection({
  themeToggleIconUrl,
  darkThemeToggleIconUrl,
  themeToggleIconSize,
  onChange,
}: {
  themeToggleIconUrl: string | null
  darkThemeToggleIconUrl: string | null
  themeToggleIconSize: number
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [lightUrl, setLightUrl] = useState<string>(themeToggleIconUrl ?? "")
  const [darkUrl, setDarkUrl] = useState<string>(darkThemeToggleIconUrl ?? "")
  const [lightUploading, setLightUploading] = useState(false)
  const [darkUploading, setDarkUploading] = useState(false)
  const [lightError, setLightError] = useState<string | null>(null)
  const [darkError, setDarkError] = useState<string | null>(null)
  const [iconSize, setIconSize] = useState(themeToggleIconSize)

  const resolveMessage = (code?: string) => (code ? t(apiErrorKey(code)) : t('admin.masters.uploadFailed'))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">{t('admin.settings.general.themeToggleIconsTitle')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('admin.settings.general.themeToggleIconsDesc')}
        </p>
      </div>

      <div className="grid gap-3">
        <Label>{t('admin.settings.general.themeToggleIconSizeLabel')}</Label>
        <div className="grid gap-1.5 max-w-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('admin.settings.general.themeToggleIconSizeHint')}</span>
            <span className="text-xs font-mono">{iconSize}px</span>
          </div>
          <input
            type="range"
            min={32}
            max={64}
            step={2}
            value={iconSize}
            onChange={(e) => { setIconSize(parseInt(e.target.value)); onChange() }}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
        <input type="hidden" name="themeToggleIconSize" value={iconSize} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImageUploadField
          label={t('admin.settings.general.themeToggleIconLabel')}
          hint={t('admin.settings.general.themeToggleIconHint')}
          preview={lightUrl || null}
          fieldName="themeToggleIconUrl"
          fieldValue={lightUrl}
          onUpload={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadIcon(file, setLightUrl, setLightUploading, setLightError, onChange, resolveMessage)
          }}
          onRemove={() => { setLightUrl(""); onChange() }}
          uploading={lightUploading}
          uploadError={lightError}
        />

        <ImageUploadField
          label={t('admin.settings.general.darkThemeToggleIconLabel')}
          hint={t('admin.settings.general.darkThemeToggleIconHint')}
          preview={darkUrl || null}
          fieldName="darkThemeToggleIconUrl"
          fieldValue={darkUrl}
          onUpload={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadIcon(file, setDarkUrl, setDarkUploading, setDarkError, onChange, resolveMessage)
          }}
          onRemove={() => { setDarkUrl(""); onChange() }}
          uploading={darkUploading}
          uploadError={darkError}
          previewTone="dark"
        />
      </div>
    </div>
  )
}
