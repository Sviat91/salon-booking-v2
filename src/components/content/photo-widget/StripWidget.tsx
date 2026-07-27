"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface StripWidgetProps {
  photos: string[]
}

const HEIGHT = 140
const TILE_TOTAL_WIDTH = HEIGHT * 0.8 + 24 // tile width + gap-6 (24px)
const MIN_TOTAL_WIDTH = 4200 // px — comfortably covers ultra-wide screens
const MIN_COPIES = 3

function getRepeatCount(photoCount: number) {
  const setWidth = photoCount * TILE_TOTAL_WIDTH
  return Math.max(MIN_COPIES, Math.ceil(MIN_TOTAL_WIDTH / setWidth))
}

/**
 * Scrolling marquee — ported from `src/components/reviews/ReviewsMarquee.tsx`
 * (content tripled for a seamless loop), sourcing photos from block config
 * instead of `ReviewImage[]`.
 */
export default function StripWidget({ photos }: StripWidgetProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return (
      <div className="relative left-1/2 w-screen -ml-[50vw] overflow-x-auto custom-scrollbar py-4">
        <div className="flex w-fit items-center gap-6 px-4">
          {photos.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              style={{ height: HEIGHT, width: HEIGHT * 0.8 }}
            >
              <Image src={url} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const repeatCount = getRepeatCount(photos.length)
  const content = Array.from({ length: repeatCount }, () => photos).flat()

  return (
    <div className="relative left-1/2 w-screen -ml-[50vw] select-none overflow-hidden bg-transparent py-4">
      <motion.div
        className="flex items-center gap-6 px-4"
        animate={{ x: ["0%", `-${100 / repeatCount}%`] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: Math.max(60, photos.length * 8),
            ease: "linear",
          },
        }}
        whileHover={{ animationPlayState: "paused" }}
        style={{ width: "fit-content" }}
      >
        {content.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            style={{ height: HEIGHT, width: HEIGHT * 0.8 }}
          >
            <Image src={url} alt="" fill className="object-cover" quality={90} draggable={false} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}
