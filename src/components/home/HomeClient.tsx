"use client"
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import MasterSelector from '@/components/MasterSelector'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import Image from 'next/image'
import Link from 'next/link'
import TopNavLine from '@/components/content/TopNavLine'
import BlockRenderer from '@/components/content/BlockRenderer'
import { parseBlockSlot } from '@/lib/content/blocks'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'

import UserDropdown from '@/components/auth/UserDropdown'

type LogoConfig = {
  logoUrl?: string | null
  darkLogoUrl?: string | null
  logoPositionX?: number
  logoPositionY?: number
  logoWidth?: number
  logoHeight?: number
  logoPages?: string
  logoLayer?: string
  brandName?: string
  homepageWidgetBlock?: string | null
}

interface HomeClientProps {
  config: LogoConfig
  isPreview?: boolean
}

function shouldShowLogo(logoPages: string | undefined, page: string): boolean {
  try {
    const pages = JSON.parse(logoPages || "[]")
    return pages.includes(page)
  } catch {
    return false
  }
}

export default function HomeClient({ config, isPreview }: HomeClientProps) {
  useQueryClient()
  const prefersReducedMotion = useReducedMotion()
  const [isNavigatingAway, setIsNavigatingAway] = useState(false)

  const homepageWidgetSlot = parseBlockSlot(config.homepageWidgetBlock ?? null)

  const showLogo = shouldShowLogo(config.logoPages, "home") && !isPreview
  const logoSrc = config.logoUrl
  const darkLogoSrc = config.darkLogoUrl || config.logoUrl
  const brandName = config.brandName || DEFAULT_BRAND_NAME

  const posX = config.logoPositionX ?? 0
  const posY = config.logoPositionY ?? 0
  const width = config.logoWidth ?? 200
  const height = config.logoHeight ?? 80

  const logoStyle = {
    position: "absolute" as const,
    left: `${posX}%`,
    top: `${posY}%`,
    zIndex: config.logoLayer === "below" ? 0 : 30,
  }

  return (
    <main className="flex-1 flex flex-col relative pb-4">
      {/* Desktop: nav line owns the whole bar, tabs + icon cluster together.
          Outer offset (pl-28 sm:pl-32) matches the master booking page and
          content pages exactly, so tabs land at the same x position on every
          route and don't jump when navigating between them. */}
      <div className="hidden lg:block absolute top-2 left-0 right-0 z-20 pl-28 sm:pl-32">
        <TopNavLine
          leadingSpaceClassName="pl-48"
          actions={
            <>
              <UserDropdown />
              <LanguageToggle />
              <ThemeToggle />
            </>
          }
        />
      </div>

      {/* Mobile: nav line on its own row — icon clusters below stay independent */}
      <div className="absolute top-4 left-0 right-0 z-10 pl-20 pr-20 lg:hidden">
        <TopNavLine />
      </div>

      {/* Mobile: split so nothing crowds the centered logo below — theme toggle stays top-right */}
      <div className="flex lg:hidden absolute top-4 right-4 z-20 items-center">
        <ThemeToggle />
      </div>

      {/* Mobile: account + language move to top-left */}
      <div className="flex lg:hidden absolute top-4 left-4 z-20 items-center gap-2">
        <UserDropdown />
        <LanguageToggle />
      </div>

      {showLogo && (config.logoUrl || config.darkLogoUrl) && (
        <div className="hidden lg:block z-10" style={logoStyle}>
          {logoSrc && (
            <Image
              src={logoSrc}
              alt={brandName}
              width={width}
              height={height}
              className="h-auto dark:hidden"
              priority
            />
          )}
          {darkLogoSrc && (
            <Image
              src={darkLogoSrc}
              alt={brandName}
              width={width}
              height={height}
              className="h-auto hidden dark:block"
              priority
            />
          )}
        </div>
      )}

      <div className="block lg:hidden pt-6 pb-2 px-4 text-center">
        {(config.logoUrl || config.darkLogoUrl) && (
          <>
            {logoSrc && (
              <Image
                src={logoSrc}
                alt={brandName}
                width={160}
                height={64}
                className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto dark:hidden"
                priority
              />
            )}
            {darkLogoSrc && (
              <Image
                src={darkLogoSrc}
                alt={brandName}
                width={160}
                height={64}
                className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto hidden dark:block"
                priority
              />
            )}
          </>
        )}
      </div>

      <div className="flex justify-center px-4 pt-8 lg:pt-24">
        <MasterSelector onNavigateAway={() => setIsNavigatingAway(true)} />
      </div>

      <div className="mt-auto pt-12 w-full">
        {homepageWidgetSlot && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: isNavigatingAway ? 0 : 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    duration: isNavigatingAway ? 0.25 : 0.6,
                    // Entrance only: let the title + master cards (last card settles ~0.9s) finish first.
                    // No delay on exit — that fade should start immediately on click.
                    delay: isNavigatingAway ? 0 : 1.3,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
          >
            <BlockRenderer type={homepageWidgetSlot.type} config={homepageWidgetSlot.config} />
          </motion.div>
        )}
      </div>
    </main>
  )
}
