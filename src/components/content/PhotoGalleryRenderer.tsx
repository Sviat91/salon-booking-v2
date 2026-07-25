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

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:scale-[1.02]"
          >
            <Image src={url} alt="" fill className="object-cover" />
          </button>
        ))}
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
