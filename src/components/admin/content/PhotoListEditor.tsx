"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { GripVertical, Trash2, Upload } from "lucide-react"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"
import { derivePhotoIds, reorderPhotosByIds } from "@/lib/content/photo-ids"
import { cn } from "@/lib/utils"
import SortableList from "./SortableList"

interface PhotoListEditorProps {
  photos: string[]
  onChange: (photos: string[]) => void
}

/** `/api/upload` takes one file per request and buffers it whole in memory, so a big
 *  selection is uploaded in small parallel batches instead of all at once. */
const UPLOAD_CONCURRENCY = 3

/**
 * Shared thumbnail-grid photo list editor for `photoWidget`/`photoGallery`
 * config editors. Uploads go through the unmodified `/api/upload` endpoint
 * (same call shape as `MasterForm.tsx`'s avatar upload) — no client-side
 * size/type re-validation, the endpoint owns that. A multi-file selection is
 * uploaded one request per file in `UPLOAD_CONCURRENCY`-sized batches;
 * per-file failures are collected instead of aborting the batch. Ordering is
 * drag-and-drop via `SortableList` (no arrow buttons).
 */
export default function PhotoListEditor({ photos, onChange }: PhotoListEditorProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const uploading = progress !== null

  // Latest committed `photos`: a batch upload is async and the prop can change
  // mid-flight (a delete or a drag-reorder), so the final append must not be
  // computed from a stale render closure.
  const photosRef = useRef(photos)
  useEffect(() => { photosRef.current = photos }, [photos])

  const ids = useMemo(() => derivePhotoIds(photos), [photos])

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed'))
    return json.url as string
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])   // read BEFORE clearing the input
    e.target.value = ""
    if (files.length === 0) return
    setErrors([])
    setProgress({ done: 0, total: files.length })
    const urls: string[] = []
    const failed: string[] = []
    for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
      const chunk = files.slice(i, i + UPLOAD_CONCURRENCY)
      const settled = await Promise.allSettled(chunk.map(uploadOne))
      settled.forEach((result, j) => {
        if (result.status === 'fulfilled') urls.push(result.value)
        else failed.push(`${chunk[j].name}: ${result.reason instanceof Error ? result.reason.message : t('admin.masters.uploadFailed')}`)
      })
      setProgress({ done: i + chunk.length, total: files.length })
    }
    if (urls.length > 0) onChange([...photosRef.current, ...urls])
    setErrors(failed)
    setProgress(null)
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SortableList
            ids={ids}
            strategy="grid"
            onReorder={(orderedIds) => onChange(reorderPhotosByIds(photos, ids, orderedIds))}
          >
            {(id, handle) => {
              const index = ids.indexOf(id)
              if (index === -1) return null
              return (
                <div
                  ref={handle.setNodeRef}
                  style={handle.style}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30",
                    handle.isDragging && "z-10 shadow-lg"
                  )}
                >
                  <Image src={photos[index]} alt="" fill className="object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1">
                    <button
                      type="button"
                      {...handle.attributes}
                      {...handle.listeners}
                      aria-label={t('admin.pages.dragHandleLabel')}
                      title={t('admin.pages.dragHandleLabel')}
                      className="cursor-grab touch-none rounded p-1 text-white hover:bg-white/20 active:cursor-grabbing"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={t('admin.pages.removePhoto')}
                      className="rounded p-1 text-white hover:bg-white/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            }}
          </SortableList>
        </div>
      )}

      <label className="cursor-pointer self-start">
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors">
          <Upload className="h-4 w-4" />
          {progress
            ? progress.total > 1
              ? `${t('admin.masters.uploading')} ${progress.done}/${progress.total}`
              : t('admin.masters.uploading')
            : t('admin.pages.addPhoto')}
        </div>
      </label>
      {errors.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {errors.map((msg, i) => <li key={`${msg}-${i}`} className="text-xs text-destructive">{msg}</li>)}
        </ul>
      )}
    </div>
  )
}
