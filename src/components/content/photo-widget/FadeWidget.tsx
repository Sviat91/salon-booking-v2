"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface FadeWidgetProps {
  photos: string[]
}

const SLOT_COUNT = 5
const CYCLE_MS = 6000
const TILE_HEIGHT = 240 // deliberately bigger than StripWidget's 140 — reads as its own gallery block, not a paused marquee
const TILE_WIDTH = TILE_HEIGHT * 0.8

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
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      style={{ height: TILE_HEIGHT, width: TILE_WIDTH }}
    >
      <AnimatePresence>
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
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

  if (prefersReducedMotion) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        {Array.from({ length: SLOT_COUNT }, (_, i) => i).map((i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            style={{ height: TILE_HEIGHT, width: TILE_WIDTH }}
          >
            <Image src={photos[i % photos.length]} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {Array.from({ length: SLOT_COUNT }, (_, i) => i).map((slotIndex) => (
        <FadeSlot key={slotIndex} photos={photos} startIndex={slotIndex} />
      ))}
    </div>
  )
}
