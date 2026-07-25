"use client"

import { useState } from "react"
import Image from "next/image"
import Lightbox from "../Lightbox"

interface StackWidgetProps {
  photos: string[]
}

const MAX_VISIBLE = 5
const ROTATIONS = [-6, 4, -3, 5, -5, 3, -4, 6]

/** Mac-Photos-style stacked thumbnail — click expands via the shared Lightbox. */
export default function StackWidget({ photos }: StackWidgetProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  const visible = photos.slice(0, MAX_VISIBLE)

  return (
    <>
      <div className="relative mx-auto h-40 w-32">
        {visible.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="absolute inset-0 overflow-hidden rounded-xl border border-border bg-card shadow-md transition-transform hover:z-10 hover:scale-105"
            style={{
              transform: `rotate(${ROTATIONS[i % ROTATIONS.length]}deg) translate(${((i % 3) - 1) * 4}px, ${(i % 2) * 3}px)`,
              zIndex: i,
            }}
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
