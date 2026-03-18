"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { Upload, X, ImageIcon, Move, Maximize2, Minimize2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

type LogoConfig = {
  logoUrl: string | null
  darkLogoUrl: string | null
  logoPositionX: number
  logoPositionY: number
  logoWidth: number
  logoHeight: number
  logoPages: string
}

type LogoEditorProps = {
  config: LogoConfig
  onLogoUpload: (url: string) => void
  onDarkLogoUpload: (url: string) => void
  onPositionChange: (x: number, y: number) => void
  onSizeChange: (width: number, height: number) => void
  onPagesChange: (pages: string) => void
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
  { id: "home", label: "Home Page" },
  { id: "booking", label: "Booking Page" },
  { id: "master", label: "Master Profile" },
]

async function uploadImage(
  file: File,
  onSuccess: (url: string) => void,
  onError: (error: string) => void,
  onStart: () => void
) {
  onStart()
  const fd = new FormData()
  fd.append("file", file)
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Upload failed")
    onSuccess(json.url)
  } catch (err) {
    onError(err instanceof Error ? err.message : "Upload failed")
  }
}

function PagePreviewMiniature({
  logoUrl,
  posX,
  posY,
  width,
  height,
}: {
  logoUrl: string | null
  posX: number
  posY: number
  width: number
  height: number
}) {
  const scale = 0.15
  const scaledWidth = Math.round(width * scale)
  const scaledHeight = Math.round(height * scale)

  return (
    <div className="relative w-full h-full bg-secondary/50 overflow-hidden rounded">
      <div className="absolute top-[8%] right-[8%] flex gap-1">
        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
      </div>
      
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-muted-foreground/20 border border-muted-foreground/30" />
        <div className="w-32 h-3 rounded bg-muted-foreground/20" />
      </div>

      <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[60%]">
        <div className="h-6 rounded-lg bg-muted-foreground/15 border border-muted-foreground/20" />
      </div>

      {logoUrl && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Image
            src={logoUrl}
            alt="Logo"
            width={scaledWidth}
            height={scaledHeight}
            className="object-contain"
          />
        </div>
      )}
    </div>
  )
}

function PagePreviewFull({
  logoUrl,
  posX,
  posY,
  width,
  height,
  onDragStart,
  previewRef,
}: {
  logoUrl: string | null
  posX: number
  posY: number
  width: number
  height: number
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void
  previewRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div
      ref={previewRef}
      className="relative w-full h-full bg-secondary/50 overflow-hidden cursor-crosshair"
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
    >
      <div className="absolute top-4 right-4 flex gap-2">
        <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />
        <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />
        <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />
      </div>

      <div className="absolute left-1/2 top-[35%] -translate-x-1/2 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-muted-foreground/20 border-2 border-muted-foreground/30" />
        <div className="w-48 h-4 rounded bg-muted-foreground/20" />
      </div>

      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[80%] max-w-sm">
        <div className="h-16 rounded-lg bg-muted-foreground/15 border border-muted-foreground/20 flex items-center justify-center">
          <span className="text-muted-foreground/40 text-sm">Master Selector</span>
        </div>
      </div>

      {logoUrl ? (
        <div
          className="absolute"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Image
            src={logoUrl}
            alt="Logo position"
            width={width}
            height={height}
            className="object-contain"
          />
        </div>
      ) : (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="h-12 w-20 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center gap-1 px-2">
            <Move className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/50">Logo</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded border">
        Position: X {posX}% / Y {posY}%
      </div>
    </div>
  )
}

export default function LogoEditor({
  config,
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
}: LogoEditorProps) {
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

      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

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
              <h3 className="font-semibold">Logo Position Editor</h3>
              <p className="text-xs text-muted-foreground">Click or drag to position the logo</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 p-4">
            <PagePreviewFull
              logoUrl={config.logoUrl}
              posX={config.logoPositionX}
              posY={config.logoPositionY}
              width={config.logoWidth}
              height={config.logoHeight}
              onDragStart={handleDragStart}
              previewRef={previewRef}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-base font-semibold">Logo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload logo, set position and visibility
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label>Light Theme Logo</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                PNG with transparent background recommended
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
                    None
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
                        uploadImage(file, onLogoUpload, () => {}, onLogoUploadStart)
                      }
                    }}
                    disabled={logoUploading}
                  />
                  <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    {logoUploading ? "Uploading…" : "Upload"}
                  </div>
                </label>
              </div>
              {logoError && <p className="text-xs text-destructive">{logoError}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Dark Theme Logo</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Optional separate logo for dark mode
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
                    Uses light
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
                        uploadImage(file, onDarkLogoUpload, () => {}, onDarkLogoUploadStart)
                      }
                    }}
                    disabled={darkLogoUploading}
                  />
                  <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    {darkLogoUploading ? "Uploading…" : "Upload"}
                  </div>
                </label>
              </div>
              {darkLogoError && <p className="text-xs text-destructive">{darkLogoError}</p>}
            </div>

            <div className="grid gap-3">
              <Label>Logo Size</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Width</span>
                    <span className="text-xs font-mono">{config.logoWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={400}
                    value={config.logoWidth}
                    onChange={(e) => onSizeChange(parseInt(e.target.value), config.logoHeight)}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Height</span>
                    <span className="text-xs font-mono">{config.logoHeight}px</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={150}
                    value={config.logoHeight}
                    onChange={(e) => onSizeChange(config.logoWidth, parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
              <input type="hidden" name="logoWidth" value={config.logoWidth} />
              <input type="hidden" name="logoHeight" value={config.logoHeight} />
            </div>

            <div className="grid gap-2">
              <Label>Show on Pages</Label>
              <div className="flex flex-wrap gap-4">
                {AVAILABLE_PAGES.map((page) => (
                  <label key={page.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={pages.includes(page.id)}
                      onCheckedChange={(checked: boolean) => handlePageToggle(page.id, checked)}
                    />
                    <span className="text-sm">{page.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Position Preview</Label>
                <p className="text-xs text-muted-foreground">Click or drag on the page layout</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Fullscreen editor"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={previewRef}
              className="relative h-64 w-full rounded-lg border border-border overflow-hidden cursor-crosshair"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <PagePreviewMiniature
                logoUrl={config.logoUrl}
                posX={config.logoPositionX}
                posY={config.logoPositionY}
                width={config.logoWidth}
                height={config.logoHeight}
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              Position: X {config.logoPositionX}% / Y {config.logoPositionY}%
            </div>

            <input type="hidden" name="logoPositionX" value={config.logoPositionX} />
            <input type="hidden" name="logoPositionY" value={config.logoPositionY} />
            <input type="hidden" name="logoPages" value={config.logoPages} />
          </div>
        </div>
      </div>
    </>
  )
}
