"use client"

import { useState } from "react"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

interface PhotoListEditorProps {
  photos: string[]
  onChange: (photos: string[]) => void
}

/**
 * Shared thumbnail-grid photo list editor for `photoWidget`/`photoGallery`
 * config editors. Uploads go through the unmodified `/api/upload` endpoint
 * (same call shape as `MasterForm.tsx`'s avatar upload) — no client-side
 * size/type re-validation, the endpoint owns that.
 */
export default function PhotoListEditor({ photos, onChange }: PhotoListEditorProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError(null)
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed'))
      onChange([...photos, json.url])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.masters.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= photos.length) return
    const next = [...photos]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30"
            >
              <Image src={url} alt="" fill className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={t('admin.pages.movePhotoLeft')}
                  className="rounded p-1 text-white disabled:opacity-30 hover:bg-white/20"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={t('admin.pages.removePhoto')}
                  className="rounded p-1 text-white hover:bg-white/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === photos.length - 1}
                  aria-label={t('admin.pages.movePhotoRight')}
                  className="rounded p-1 text-white disabled:opacity-30 hover:bg-white/20"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="cursor-pointer self-start">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
          <Upload className="h-4 w-4" />
          {uploading ? t('admin.masters.uploading') : t('admin.pages.addPhoto')}
        </div>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
