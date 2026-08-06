"use client"

import TopNavLine from "@/components/content/TopNavLine"
import LogoDisplay from "@/components/LogoDisplay"
import LanguageToggle from "@/components/LanguageToggle"
import ThemeToggle from "@/components/ThemeToggle"

/**
 * Shared by /privacy, /terms, /support (2026-08-06): same fixed nav bar +
 * hairline + corner logo as the homepage/master booking page, instead of the
 * in-flow `PageToolbar` these pages used before — that left them visually
 * inconsistent (no hairline) and let the header row shift with page content.
 * Reuses the "home" logo bucket (`LogoDisplay page="home"`) rather than
 * adding a new admin-configurable page bucket for three low-traffic pages.
 */
export default function LegalPageHeader() {
  return (
    <>
      <div className="absolute top-2 left-0 right-0 z-20 pl-3 lg:pl-28 xl:pl-32">
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
      <LogoDisplay page="home" />
    </>
  )
}
