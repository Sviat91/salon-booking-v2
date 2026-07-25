"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
          <div className="flex w-max items-center gap-1.5 px-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-3 py-0.5 text-sm font-medium tracking-tight transition-colors duration-200",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/70 bg-card/50 text-foreground/75 hover:border-primary/30 hover:bg-card hover:text-foreground"
                  )}
                >
                  {tab.title}
                </Link>
              )
            })}
          </div>
        </nav>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border [mask-image:linear-gradient(to_right,transparent,black_17%,black_100%)]" />
    </div>
  )
}
