"use client"

import { motion, type Variants } from "framer-motion"
import BlockRenderer from "./BlockRenderer"
import TopNavLine from "./TopNavLine"
import LanguageToggle from "@/components/LanguageToggle"
import ThemeToggle from "@/components/ThemeToggle"
import { useReducedMotion } from "@/hooks/useReducedMotion"

type PageRendererBlock = {
  id: string
  type: string
  config: string
}

interface PageRendererProps {
  blocks: PageRendererBlock[]
  masterId?: string
  backHref?: string
}

/**
 * Renders a content page: the top nav line, then the ordered blocks. The
 * page title isn't repeated here — it's already shown as the active tab in
 * the nav line above (2026-07-26). Nav bar + layout container match the
 * homepage/master booking page (AD-6) — same reserved leading space, same
 * icon cluster. Expects to be mounted directly inside a `relative`-positioned
 * parent (the page route's `<main>`), same as `[masterId]/page.tsx`.
 */
export default function PageRenderer({ blocks, masterId, backHref }: PageRendererProps) {
  const prefersReducedMotion = useReducedMotion()

  // Explicit `Variants` annotation (not inferred) — without it, `ease: "easeOut"`
  // widens to plain `string` and fails framer-motion's stricter `Easing` type
  // only under `tsc`'s full check (production `next build`), not the dev server.
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: prefersReducedMotion ? { duration: 0 } : { staggerChildren: 0.08, delayChildren: 0.15 },
    },
  }
  const itemVariants: Variants = {
    hidden: prefersReducedMotion ? {} : { opacity: 0, y: 20 },
    visible: {
      opacity: 1, y: 0,
      transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" },
    },
  }

  return (
    <>
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        className="absolute top-2 left-0 right-0 z-20 pl-3 lg:pl-28 xl:pl-32"
      >
        <TopNavLine
          masterId={masterId}
          backHref={backHref}
          leadingSpaceClassName="pl-48"
          actions={
            <>
              <LanguageToggle />
              <ThemeToggle />
            </>
          }
        />
      </motion.div>
      <div className="mx-auto w-full max-w-5xl px-4 pt-12">
        <motion.div
          className="flex flex-col gap-8 pt-8 pb-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {blocks.map((block) => (
            <motion.div key={block.id} variants={itemVariants}>
              <BlockRenderer type={block.type} config={block.config} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </>
  )
}
