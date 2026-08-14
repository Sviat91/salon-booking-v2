import { useState } from 'react'
import Lightbox from './Lightbox'

interface PhotoGalleryRendererProps {
  photos: string[]
}

// Ported from the real content/PhotoGalleryRenderer.tsx — full-bleed
// responsive grid + lightbox. The real version also caps visible tiles at
// 11 with a "+N" overflow tile; not reached here (6 photos).
export default function PhotoGalleryRenderer({ photos }: PhotoGalleryRendererProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}
    </>
  )
}
