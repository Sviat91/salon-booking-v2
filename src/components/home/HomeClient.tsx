"use client"
import { useQueryClient } from '@tanstack/react-query'
import MasterSelector from '@/components/MasterSelector'
import ReviewsMarquee from '@/components/reviews/ReviewsMarquee'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import Image from 'next/image'
import Link from 'next/link'
import { ReviewImage } from '@/lib/reviews'

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
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Link 
          href="/admin" 
          className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors duration-300"
          title="Login"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground/80 hover:text-foreground"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
        <LanguageToggle />
        <ThemeToggle />
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

      {showLogo && !(config.logoUrl || config.darkLogoUrl) && (
        <div className="absolute left-4 top-4 z-10 hidden lg:block">
          <Image
            src="/head_logo.png"
            alt="Logo"
            width={242}
            height={97}
            className="h-auto dark:hidden"
            priority
          />
          <Image
            src="/head_logo_night.png"
            alt="Logo"
            width={242}
            height={97}
            className="h-auto hidden dark:block"
            priority
          />
        </div>
      )}

      <div className="block lg:hidden pt-6 pb-2 px-4 text-center">
        {config.logoUrl ? (
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
        ) : (
          <>
            <Image
              src="/head_logo.png"
              alt="Logo"
              width={200}
              height={80}
              className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto dark:hidden"
              priority
            />
            <Image
              src="/head_logo_night.png"
              alt="Logo"
              width={200}
              height={80}
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
