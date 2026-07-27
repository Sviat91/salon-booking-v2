"use client"

import { useState } from "react"
import Image from "next/image"
import Lightbox from "./Lightbox"
import type { PhotoGalleryConfig } from "@/lib/content/blocks"

interface PhotoGalleryRendererProps {
  config: PhotoGalleryConfig
}

/** Full-bleed responsive grid + lightbox. Distinct from `PhotoWidgetRenderer` — no style variants. */
export default function PhotoGalleryRenderer({ config }: PhotoGalleryRendererProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const photos = config.photos ?? []

  if (photos.length === 0) return null

  const MAX_VISIBLE = 11

  const hasOverflow = photos.length > MAX_VISIBLE + 1 // only cap past 12 total
  const visible = hasOverflow ? photos.slice(0, MAX_VISIBLE) : photos
  const hiddenCount = photos.length - visible.length

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:scale-[1.02]"
          >
            <Image src={url} alt="" fill className="object-cover" />
          </button>
        ))}

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setLightboxIndex(visible.length)}
            className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:scale-[1.02]"
          >
            <Image src={photos[visible.length]} alt="" fill className="object-cover brightness-50" />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white">
              +{hiddenCount}
            </span>
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </>
  )
}
