"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface FadeWidgetProps {
  photos: string[]
}

const SLOT_COUNT_MAX = 5
const CYCLE_MS = 3000

function FadeSlot({ photos, startIndex }: { photos: string[]; startIndex: number }) {
  const [index, setIndex] = useState(startIndex % photos.length)

  useEffect(() => {
    if (photos.length <= 1) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length)
    }, CYCLE_MS)
    return () => clearInterval(id)
  }, [photos.length])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <Image src={photos[index]} alt="" fill className="object-cover" />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Photos cross-fading in/out at different positions — several independently-cycling slots. */
export default function FadeWidget({ photos }: FadeWidgetProps) {
  const prefersReducedMotion = useReducedMotion()

  if (photos.length === 0) return null

  const slotCount = Math.min(SLOT_COUNT_MAX, photos.length)

  if (prefersReducedMotion) {
    return (
      <div className="grid h-40 gap-3" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
        {photos.slice(0, slotCount).map((url, i) => (
          <div key={`${url}-${i}`} className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Image src={url} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid h-40 gap-3" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
      {Array.from({ length: slotCount }, (_, i) => i).map((slotIndex) => (
        <FadeSlot key={slotIndex} photos={photos} startIndex={slotIndex} />
      ))}
    </div>
  )
}
