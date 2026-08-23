"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Upload, X, ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"
import { resizeImageIfNeeded } from "@/lib/image-resize"

type BgConfig = {
  bgType: string
  bgImageUrl: string | null
  bgGradientFrom: string
  bgGradientTo: string
  bgGradientAngle: number
  secondaryColor: string
  bgApplyToDark: boolean
}

export default function BackgroundSection({ config, onBgImageUpload, prefix = '' }: {
  config: BgConfig
  onBgImageUpload: (url: string) => void
  prefix?: string
}) {
  const { t } = useTranslation()
  // Helper: prefix='' → 'bgType', prefix='dark' → 'darkBgType'
  const n = (field: string) =>
    prefix ? `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` : field

  const [bgType, setBgType] = useState(config.bgType || 'solid')
  const [solidColor, setSolidColor] = useState(config.secondaryColor)
  const [bgImageUrl, setBgImageUrl] = useState(config.bgImageUrl || '')
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(config.bgImageUrl || null)
  const [bgGradientFrom, setBgGradientFrom] = useState(config.bgGradientFrom)
  const [bgGradientTo, setBgGradientTo] = useState(config.bgGradientTo)
  const [bgGradientAngle, setBgGradientAngle] = useState(config.bgGradientAngle)
  const [bgApplyToDark, setBgApplyToDark] = useState(config.bgApplyToDark ?? true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const tabs = [
    { id: 'solid', labelKey: 'admin.settings.general.solidTab' },
    { id: 'gradient', labelKey: 'admin.settings.general.gradientTab' },
    { id: 'picture', labelKey: 'admin.settings.general.pictureTab' },
  ]

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    const fd = new FormData()
    fd.append('file', await resizeImageIfNeeded(file))
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed'))
      setBgImageUrl(json.url)
      setBgImagePreview(json.url)
      onBgImageUpload(json.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('admin.masters.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <Label>{t('admin.settings.general.pageBackgroundLabel')}</Label>

      {/* Hidden inputs — always submitted regardless of bgType */}
      <input type="hidden" name={n('bgType')} value={bgType} />
      <input type="hidden" name={n('bgImageUrl')} value={bgImageUrl} />
      <input type="hidden" name={n('bgGradientFrom')} value={bgGradientFrom} />
      <input type="hidden" name={n('bgGradientTo')} value={bgGradientTo} />
      <input type="hidden" name={n('bgGradientAngle')} value={bgGradientAngle} />
      {/* secondaryColor and bgApplyToDark are light-theme-only */}
      {!prefix && <input type="hidden" name="secondaryColor" value={solidColor} />}
      {!prefix && <input type="hidden" name="bgApplyToDark" value={String(bgApplyToDark)} />}

      {/* 3-way toggle */}
      <div className="inline-flex bg-card border border-border rounded-lg p-0.5 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBgType(tab.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all outline-none border-0 ${
              bgType === tab.id
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {!prefix && bgType === 'solid' && (
        <div className="grid gap-1.5">
          <Label className="text-sm">{t('admin.settings.general.backgroundColorLabel')}</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={solidColor}
              onChange={(e) => setSolidColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0"
            />
            <Input
              value={solidColor}
              pattern="^#[0-9A-Fa-f]{6}$"
              placeholder="#000000"
              className="font-mono text-sm"
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setSolidColor(e.target.value)
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('admin.settings.general.backgroundColorHint')}</p>
        </div>
      )}

      {bgType === 'gradient' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 flex-wrap">
            <div className="grid gap-1.5">
              <Label className="text-xs">{t('admin.settings.general.fromLabel')}</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={bgGradientFrom} onChange={(e) => setBgGradientFrom(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0" />
                <Input value={bgGradientFrom} pattern="^#[0-9A-Fa-f]{6}$" className="font-mono text-sm w-28"
                  onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setBgGradientFrom(e.target.value) }} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t('admin.settings.general.toLabel')}</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={bgGradientTo} onChange={(e) => setBgGradientTo(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5 shrink-0" />
                <Input value={bgGradientTo} pattern="^#[0-9A-Fa-f]{6}$" className="font-mono text-sm w-28"
                  onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setBgGradientTo(e.target.value) }} />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('admin.settings.general.angleLabel')}</Label>
              <span className="text-xs font-mono">{bgGradientAngle}°</span>
            </div>
            <input type="range" min={0} max={360} value={bgGradientAngle}
              onChange={(e) => setBgGradientAngle(parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
          </div>
          <div className="h-12 rounded-lg border border-border"
            style={{ background: `linear-gradient(${bgGradientAngle}deg, ${bgGradientFrom}, ${bgGradientTo})` }} />
        </div>
      )}

      {bgType === 'picture' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            {bgImagePreview ? (
              <div className="relative h-16 w-28">
                <div className="h-16 w-28 rounded-lg border border-border overflow-hidden">
                  <img src={bgImagePreview} alt="Background" className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <button type="button" onClick={() => { setBgImagePreview(null); setBgImageUrl('') }}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                {t('admin.settings.general.noneLabel')}
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={handleImageUpload} disabled={uploading} />
              <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? t('admin.masters.uploading') : t('admin.settings.general.uploadLabel')}
              </div>
            </label>
          </div>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          <p className="text-xs text-muted-foreground">{t('admin.settings.general.pictureHint')}</p>
        </div>
      )}

      {!prefix && bgType !== 'solid' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={bgApplyToDark}
            onChange={(e) => setBgApplyToDark(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-sm">{t('admin.settings.general.applyToDarkLabel')}</span>
        </label>
      )}
    </div>
  )
}
