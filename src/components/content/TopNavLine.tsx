"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Menu, Check } from "lucide-react"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { resolveLocalized } from "@/lib/localized-content"
import { cn } from "@/lib/utils"
import type { NavPage } from "@/lib/content/pages-shared"
import type { BlockSlot } from "@/lib/content/blocks"
import PageBackLink from "@/components/PageBackLink"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

export interface ContentResponse {
  pages: NavPage[]
  footerBlock: BlockSlot | null
}

interface TopNavLineProps {
  masterId?: string
  className?: string
  /** Icon cluster (theme/language/user toggles) rendered at the right end of this same bar. */
  actions?: ReactNode
  /** If omitted, no Back control is rendered — the true homepage has nothing to go back to. */
  backHref?: string
  /**
   * Real reserved empty space (Tailwind `pl-*`) before the DESKTOP tab strip
   * starts, for a corner logo — `lg:` and up only (2026-08-06 correction).
   * Below `lg`, tabs collapse into a burger menu instead (see render below),
   * and this class is NOT applied to that burger/Back container: Back+burger
   * must always stay visible/clickable, unlike the desktop tab strip which
   * can scroll (`overflow-x-auto`) past the padding safely. Applying this
   * same padding to the mobile burger container once (fixed same day)
   * collapsed the whole row into a ~90px-or-less sliver on mobile (outer
   * `pl-28 sm:pl-32` from the caller, plus this `pl-48`, could exceed the
   * viewport width) — don't reintroduce that.
   *
   * The mask breakpoint below (`black_12rem`) is hand-matched to this being
   * `pl-48` (12rem) at every call site — if a caller ever passes a different
   * value, update the mask stop to match, or the hairline's solid point will
   * no longer land exactly under the tabs.
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
export default function TopNavLine({ masterId, className, actions, backHref, leadingSpaceClassName }: TopNavLineProps) {
  const pathname = usePathname()
  const lang = useCurrentLanguage()
  const { t } = useTranslation()
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {backHref && <PageBackLink href={backHref} />}
          {/* Narrow screens only: unbounded tab count doesn't fit a horizontal
              strip next to Back/actions, so it collapses into a burger. */}
          {tabs.length > 0 && (
            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex items-center justify-center rounded-full border border-border bg-card p-2 text-card-foreground shadow-lg hover:brightness-105 transition-all duration-200 shrink-0"
                  aria-label={t('common.pagesMenu')}
                >
                  <Menu className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {tabs.map((tab) => {
                    const active = pathname === tab.href
                    return (
                      <DropdownMenuItem key={tab.id} render={<Link href={tab.href} />}>
                        {tab.title}
                        {active && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {/* `lg:` and up: the original horizontal scrolling tab strip — plenty
              of width there for it, so no need to hide it behind a burger. */}
          <nav className={cn("hidden min-w-0 flex-1 overflow-x-auto custom-scrollbar lg:block", leadingSpaceClassName)}>
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
        </div>
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
