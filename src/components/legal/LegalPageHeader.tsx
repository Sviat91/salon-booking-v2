"use client"

import TopNavLine from "@/components/content/TopNavLine"
import LanguageToggle from "@/components/LanguageToggle"
import ThemeToggle from "@/components/ThemeToggle"

/**
 * Shared by /privacy, /terms, /support (2026-08-06): same fixed nav bar +
 * hairline as the homepage/master booking page, instead of the in-flow
 * `PageToolbar` these pages used before — that left them visually
 * inconsistent (no hairline) and let the header row shift with page content.
 *
 * No `LogoDisplay` here (2026-08-07 decision): it briefly reused the "home"
 * logo bucket, but that bucket's position/size is tuned for the homepage's
 * layout and collided with these pages' denser text content. Adding a
 * separate admin-configurable bucket for three low-traffic static pages
 * wasn't worth the new admin UI surface, so the decorative logo is simply
 * omitted here — these pages stay text/nav-only.
 *
 * In normal document flow, not `position: absolute` (2026-08-07 fix): the
 * previous absolute overlay paired with a fixed `pt-12` on the content div
 * below assumed a single-line nav bar. At desktop widths narrow enough for
 * the tab strip/actions to wrap, the bar grew taller than that guess and the
 * page title overlapped it. In-flow layout can't have that failure mode —
 * content always starts after the bar's real rendered height, whatever it
 * is. Safe to do here because, with no logo, nothing needs to sit behind or
 * beside this bar.
 */
export default function LegalPageHeader() {
  return (
    <div className="pt-2 pl-3 lg:pl-28 xl:pl-32">
      <TopNavLine
        backHref="/"
        leadingSpaceClassName="pl-48"
        actions={
          <>
            <LanguageToggle />
            <ThemeToggle />
          </>
        }
      />
    </div>
  )
}
