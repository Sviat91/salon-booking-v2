"use client"
import { useQueryClient } from '@tanstack/react-query'
import MasterSelector from '@/components/MasterSelector'
import ReviewsMarquee from '@/components/reviews/ReviewsMarquee'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import Image from 'next/image'
import Link from 'next/link'
import { ReviewImage } from '@/lib/reviews'

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
}

interface HomeClientProps {
  initialReviews: ReviewImage[]
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

export default function HomeClient({ initialReviews, config, isPreview }: HomeClientProps) {
  useQueryClient()

  const showLogo = shouldShowLogo(config.logoPages, "home") && !isPreview
  const logoSrc = config.logoUrl || "/head_logo.png"
  const darkLogoSrc = config.darkLogoUrl || config.logoUrl || "/head_logo_night.png"
  const brandName = config.brandName || "Logo"

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
      {/* Desktop: all three icons together on the right — unchanged from before */}
      <div className="hidden lg:flex absolute top-4 right-4 z-20 items-center gap-2">
        <UserDropdown />
        <LanguageToggle />
        <ThemeToggle />
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
          <Image
            src={logoSrc}
            alt={brandName}
            width={width}
            height={height}
            className="h-auto dark:hidden"
            priority
          />
          <Image
            src={darkLogoSrc}
            alt={brandName}
            width={width}
            height={height}
            className="h-auto hidden dark:block"
            priority
          />
        </div>
      )}

      <div className="block lg:hidden pt-6 pb-2 px-4 text-center">
        {config.logoUrl && (
          <>
            <Image
              src={logoSrc}
              alt={brandName}
              width={160}
              height={64}
              className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto dark:hidden"
              priority
            />
            <Image
              src={darkLogoSrc}
              alt={brandName}
              width={160}
              height={64}
              className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto hidden dark:block"
              priority
            />
          </>
        )}
      </div>

      <div className="flex justify-center px-4 pt-8 lg:pt-24">
        <MasterSelector />
      </div>

      <div className="hidden lg:block mt-auto pt-12 w-full">
        <ReviewsMarquee initialReviews={initialReviews} />
      </div>
    </main>
  )
}
