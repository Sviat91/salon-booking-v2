"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { cn } from "@/lib/utils"
import type { NavPage } from "@/lib/content/pages-shared"
import type { BlockSlot } from "@/lib/content/blocks"

export interface ContentResponse {
  pages: NavPage[]
  footerBlock: BlockSlot | null
}

interface TopNavLineProps {
  masterId?: string
  className?: string
  /** Icon cluster (theme/language/user toggles) rendered at the right end of this same bar. */
  actions?: ReactNode
  /**
   * Real reserved empty space (Tailwind `pl-*`) before the tabs start, for a
   * corner logo. This is separate from the hairline's own fade-mask — the
   * hairline still spans and fades across the full bar width regardless, but
   * without this the tab *content* starts right at the edge with nothing
   * reserved above the fade. Applied identically on the homepage and every
   * master booking page (2026-07-25: user wants consistent tab position
   * across both, even though the master page has no logo yet).
   *
   * The mask breakpoint below (`black_12rem`) is hand-matched to this being
   * `pl-48` (12rem) at every call site (2026-07-28: moved left from the
   * original `pl-96`/`24rem`) — if a caller ever passes a different value,
   * update the mask stop to match, or the hairline's solid point will no
   * longer land exactly under the tabs.
   */
  leadingSpaceClassName?: string
}

/**
 * Nav line shared by the homepage and every master's booking page (AD-6).
 *
 * Per the 2026-07-25 correction to AD-7: this is now a permanent fixture —
 * it always renders (hairline + layout shell), even with zero tabs, so
 * toggling pages on/off never shifts the layout.
 *
 * This component owns the whole bar — tabs AND the caller's icon cluster
 * (`actions`) sit together as one row, ABOVE a hairline that runs along the
 * *bottom* edge of that row (not through its vertical middle). The hairline
 * spans the bar's full width so its left-fade lands in the empty space
 * reserved for a corner logo, staying solid underneath the tabs and icons
 * rather than cutting off abruptly right before them.
 */
export default function TopNavLine({ masterId, className, actions, leadingSpaceClassName }: TopNavLineProps) {
  const pathname = usePathname()
  const lang = useCurrentLanguage()
  const prefersReducedMotion = useReducedMotion()
  const { data } = useQuery<ContentResponse>({
    queryKey: ["content-nav", masterId ?? "home"],
    queryFn: () =>
      fetch(`/api/content${masterId ? `?masterId=${masterId}` : ""}`).then(
        (r) => r.json() as Promise<ContentResponse>
      ),
    staleTime: 60_000,
  })

  const tabs = (data?.pages ?? [])
    .map((p) => ({ ...p, title: resolveLocalized({ pl: p.title_pl, en: p.title_en, uk: p.title_uk }, lang) }))
    // Per C-3: a tab whose title resolves empty (no enabled locale filled) is skipped, not rendered blank.
    .filter((p) => p.title)

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center justify-between gap-3 pr-2 pb-0">
        <nav className={cn("min-w-0 flex-1 overflow-x-auto custom-scrollbar", leadingSpaceClassName)}>
          <motion.div layout={!prefersReducedMotion} className="flex w-max items-center gap-5 px-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href
              return (
                // Its own layout animation — a tab's width changes with the
                // active language's translation length, and this smooths that
                // resize (and the resulting shift of tabs after it) instead of
                // an instant jump.
                <motion.div key={tab.id} layout={!prefersReducedMotion} transition={{ duration: 0.25, ease: "easeOut" }}>
                  <Link
                    href={tab.href}
                    className={cn(
                      "block shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-0 text-sm font-medium tracking-tight transition-colors duration-200",
                      active
                        ? "border-primary text-foreground"
                        : "border-transparent text-foreground/60 hover:text-foreground"
                    )}
                  >
                    {tab.title}
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </nav>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* Fade stop is a fixed length, not a %, so it lines up with the pl-96
          reserved leading space exactly regardless of viewport width. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border",
          leadingSpaceClassName
            ? "[mask-image:linear-gradient(to_right,transparent,black_12rem,black_100%)]"
            : "[mask-image:linear-gradient(to_right,transparent,black_1rem,black_100%)]"
        )}
      />
    </div>
  )
}
