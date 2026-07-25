"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface StripWidgetProps {
  photos: string[]
}

const HEIGHT = 140

/**
 * Scrolling marquee — ported from `src/components/reviews/ReviewsMarquee.tsx`
 * (content tripled for a seamless loop), sourcing photos from block config
 * instead of `ReviewImage[]`.
 */
export default function StripWidget({ photos }: StripWidgetProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return (
      <div className="w-full overflow-x-auto custom-scrollbar py-4">
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

  const content = [...photos, ...photos, ...photos]

  return (
    <div className="w-full select-none overflow-hidden bg-transparent py-4">
      <motion.div
        className="flex items-center gap-6 px-4"
        animate={{ x: ["0%", "-33.33%"] }}
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
