"use client"

import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import BlockRenderer from "./BlockRenderer"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import type { ContentResponse } from "./TopNavLine"

interface MasterFooterBlockProps {
  masterId: string
}

/** Reads the same `['content-nav', masterId]` query key as `TopNavLine` — costs no extra request. */
export default function MasterFooterBlock({ masterId }: MasterFooterBlockProps) {
  const prefersReducedMotion = useReducedMotion()
  const { data } = useQuery<ContentResponse>({
    queryKey: ["content-nav", masterId ?? "home"],
    queryFn: () => fetch(`/api/content?masterId=${masterId}`).then((r) => r.json() as Promise<ContentResponse>),
    staleTime: 60_000,
  })

  if (!data?.footerBlock) return null

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      // delay: let the avatar + calendar/booking box (delay 0.5s, duration 0.6s — settles ~1.1s) finish first.
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <BlockRenderer type={data.footerBlock.type} config={data.footerBlock.config} />
    </motion.div>
  )
}
