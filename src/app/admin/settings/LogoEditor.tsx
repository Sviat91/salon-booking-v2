"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { Upload, X, ImageIcon, Maximize2, Minimize2 } from "lucide-react"
import HomepagePreview from "./HomepagePreview"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

type LogoConfig = {
  logoUrl: string | null
  darkLogoUrl: string | null
  logoPositionX: number
  logoPositionY: number
  logoWidth: number
  logoHeight: number
  logoPages: string
  logoLayer: string
  logoFullscreen: boolean
}

type LogoEditorProps = {
  config: LogoConfig
  homepageWidgetBlock?: string | null
  onLogoUpload: (url: string) => void
  onDarkLogoUpload: (url: string) => void
  onPositionChange: (x: number, y: number) => void
  onSizeChange: (width: number, height: number) => void
  onPagesChange: (pages: string) => void
  onLayerChange: (layer: string) => void
  logoFullscreen: boolean
  onFullscreenChange: (v: boolean) => void
  onRemoveLogo: () => void
  onRemoveDarkLogo: () => void
  logoUploading: boolean
  darkLogoUploading: boolean
  logoError: string | null
  darkLogoError: string | null
  onLogoUploadStart: () => void
  onDarkLogoUploadStart: () => void
}

const AVAILABLE_PAGES = [
  { id: "home", labelKey: "admin.settings.general.homePageLabel" },
  { id: "booking", labelKey: "admin.settings.general.bookingPageLabel" },
  { id: "master", labelKey: "admin.settings.general.masterProfileLabel" },
]

async function uploadImage(
  file: File,
  onSuccess: (url: string) => void,
  onError: (error: string) => void,
  onStart: () => void,
  resolveMessage: (code?: string) => string
) {
  onStart()
  const fd = new FormData()
  fd.append("file", file)
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(resolveMessage(json.code))
    onSuccess(json.url)
  } catch (err) {
    onError(err instanceof Error ? err.message : resolveMessage())
  }
}


export default function LogoEditor({
  config,
  homepageWidgetBlock,
  onLogoUpload,
  onDarkLogoUpload,
  onPositionChange,
  onSizeChange,
  onPagesChange,
  onRemoveLogo,
  onRemoveDarkLogo,
  logoUploading,
  darkLogoUploading,
  logoError,
  darkLogoError,
  onLogoUploadStart,
  onDarkLogoUploadStart,
  onLayerChange,
  logoFullscreen,
  onFullscreenChange,
}: LogoEditorProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const pages: string[] = (() => {
    try {
      return JSON.parse(config.logoPages || "[]")
    } catch {
      return []
    }
  })()

  const handlePageToggle = (pageId: string, checked: boolean) => {
    const newPages = checked
      ? [...pages, pageId]
      : pages.filter((p) => p !== pageId)
    onPagesChange(JSON.stringify(newPages))
  }

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !previewRef.current) return

      const rect = previewRef.current.getBoundingClientRect()
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      // Calculate percentage position within the preview area
      const x = Math.max(0, Math.min(90, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(90, ((clientY - rect.top) / rect.height) * 100))

      onPositionChange(Math.round(x), Math.round(y))
    },
    [isDragging, onPositionChange]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    window.addEventListener("mousemove", handleDragMove)
    window.addEventListener("mouseup", handleDragEnd)
    window.addEventListener("touchmove", handleDragMove)
    window.addEventListener("touchend", handleDragEnd)
    return () => {
      window.removeEventListener("mousemove", handleDragMove)
      window.removeEventListener("mouseup", handleDragEnd)
      window.removeEventListener("touchmove", handleDragMove)
      window.removeEventListener("touchend", handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [])

  return (
    <>
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="font-semibold">{t('admin.settings.general.logoPositionEditorTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('admin.settings.general.logoPositionEditorHint')}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Layer switch in fullscreen */}
              <div className="flex bg-muted rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => onLayerChange("above")}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${config.logoLayer !== "below" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t('admin.settings.general.aboveLabel')}
                </button>
                <button
                  type="button"
                  onClick={() => onLayerChange("below")}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${config.logoLayer === "below" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t('admin.settings.general.belowLabel')}
                </button>
              </div>
              {/* Fullscreen toggle in fullscreen editor */}
              {config.logoLayer === 'below' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logoFullscreen}
                    onChange={(e) => onFullscreenChange(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="text-xs">{t('admin.settings.general.fullScreenLabel')}</span>
                </label>
              )}
              {/* Size controls in fullscreen */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('admin.settings.general.sizeWithColon')}</span>
                <input
                  type="range" min={50} max={800} value={config.logoWidth}
                  onChange={(e) => onSizeChange(parseInt(e.target.value), config.logoHeight)}
                  className="w-24 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono w-10">{config.logoWidth}px</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-4">
            <HomepagePreview
              logoUrl={config.logoUrl}
              posX={config.logoPositionX}
              posY={config.logoPositionY}
              logoWidth={config.logoWidth}
              logoHeight={config.logoHeight}
              logoLayer={config.logoLayer}
              onDragStart={handleDragStart}
              previewRef={previewRef}
              containerHeight={0}
              homepageWidgetBlock={homepageWidgetBlock}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-base font-semibold">{t('admin.settings.general.logoLabelTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('admin.settings.general.logoSectionDesc')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="grid gap-2">
              <Label>{t('admin.settings.general.lightThemeLogoLabel')}</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                {t('admin.settings.general.lightThemeLogoHint')}
              </p>
              <input type="hidden" name="logoUrl" value={config.logoUrl || ""} />
              <div className="flex items-start gap-4">
                {config.logoUrl ? (
                  <div className="relative flex h-16 w-32 items-center justify-center rounded-lg border border-border bg-muted/30 p-2">
                    <Image src={config.logoUrl} alt="Logo" fill className="object-contain p-1" />
                    <button
                      type="button"
                      onClick={onRemoveLogo}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 gap-1.5 text-xs text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    {t('admin.settings.general.noneLabel')}
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        uploadImage(file, onLogoUpload, () => {}, onLogoUploadStart, (code) => code ? t(apiErrorKey(code)) : t('admin.masters.uploadFailed'))
                      }
                    }}
                    disabled={logoUploading}
                  />
                  <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    {logoUploading ? t('admin.masters.uploading') : t('admin.settings.general.uploadLabel')}
                  </div>
                </label>
              </div>
              {logoError && <p className="text-xs text-destructive">{logoError}</p>}
            </div>

            <div className="grid gap-2">
              <Label>{t('admin.settings.general.darkThemeLogoLabel')}</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                {t('admin.settings.general.darkThemeLogoHint')}
              </p>
              <input type="hidden" name="darkLogoUrl" value={config.darkLogoUrl || ""} />
              <div className="flex items-start gap-4">
                {config.darkLogoUrl ? (
                  <div className="relative flex h-16 w-32 items-center justify-center rounded-lg border border-border bg-zinc-800 p-2">
                    <Image src={config.darkLogoUrl} alt="Dark Logo" fill className="object-contain p-1" />
                    <button
                      type="button"
                      onClick={onRemoveDarkLogo}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-900 gap-1.5 text-xs text-zinc-400">
                    <ImageIcon className="h-4 w-4" />
                    {t('admin.settings.general.usesLightLabel')}
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        uploadImage(file, onDarkLogoUpload, () => {}, onDarkLogoUploadStart, (code) => code ? t(apiErrorKey(code)) : t('admin.masters.uploadFailed'))
                      }
                    }}
                    disabled={darkLogoUploading}
                  />
                  <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    {darkLogoUploading ? t('admin.masters.uploading') : t('admin.settings.general.uploadLabel')}
                  </div>
                </label>
              </div>
              {darkLogoError && <p className="text-xs text-destructive">{darkLogoError}</p>}
            </div>

            <div className="grid gap-3">
              <Label>{t('admin.settings.general.logoSizeLabel')}</Label>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('admin.settings.general.sizeLabel')}</span>
                  <span className="text-xs font-mono">{config.logoWidth}px</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={800}
                  value={config.logoWidth}
                  onChange={(e) => onSizeChange(parseInt(e.target.value), config.logoHeight)}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
              <input type="hidden" name="logoWidth" value={config.logoWidth} />
              <input type="hidden" name="logoHeight" value={config.logoHeight} />
            </div>

            <div className="grid gap-2">
              <Label>{t('admin.settings.general.overlapSettingLabel')}</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="logoLayer"
                    value="above"
                    checked={config.logoLayer === "above" || !config.logoLayer}
                    onChange={(e) => onLayerChange(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t('admin.settings.general.showAboveContent')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="logoLayer"
                    value="below"
                    checked={config.logoLayer === "below"}
                    onChange={(e) => onLayerChange(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t('admin.settings.general.showBelowContent')}</span>
                </label>
                {config.logoLayer === 'below' && (
                  <label className="flex items-center gap-2 cursor-pointer ml-5">
                    <input
                      type="checkbox"
                      checked={logoFullscreen}
                      onChange={(e) => onFullscreenChange(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{t('admin.settings.general.stretchFullScreen')}</span>
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.general.belowContentHint')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label>{t('admin.settings.general.showOnPagesLabel')}</Label>
              <div className="flex flex-wrap gap-4">
                {AVAILABLE_PAGES.map((page) => (
                  <label key={page.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={pages.includes(page.id)}
                      onCheckedChange={(checked: boolean) => handlePageToggle(page.id, checked)}
                    />
                    <span className="text-sm">{t(page.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.settings.general.positionPreviewLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('admin.settings.general.positionPreviewHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title={t('admin.settings.general.fullscreenEditorTitle')}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <HomepagePreview
              logoUrl={config.logoUrl}
              posX={config.logoPositionX}
              posY={config.logoPositionY}
              logoWidth={config.logoWidth}
              logoHeight={config.logoHeight}
              logoLayer={config.logoLayer}
              onDragStart={handleDragStart}
              previewRef={previewRef}
              containerHeight={256}
              homepageWidgetBlock={homepageWidgetBlock}
            />

            <input type="hidden" name="logoPositionX" value={config.logoPositionX} />
            <input type="hidden" name="logoPositionY" value={config.logoPositionY} />
            <input type="hidden" name="logoPages" value={config.logoPages} />
          </div>
        </div>
      </div>
    </>
  )
}
