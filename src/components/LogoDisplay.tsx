"use client"

import Image from "next/image"
import { useQuery } from "@tanstack/react-query"

type LogoConfig = {
  logoUrl: string | null
  darkLogoUrl: string | null
  logoPositionX: number
  logoPositionY: number
  logoWidth: number
  logoHeight: number
  logoPages: string
  brandName: string
  logoLayer: string
  logoFullscreen: boolean
}

function shouldShowLogo(logoPages: string, page: string): boolean {
  try {
    const pages = JSON.parse(logoPages || "[]")
    return pages.includes(page)
  } catch {
    return false
  }
}

export default function LogoDisplay({ page }: { page: "home" | "booking" | "master" }) {
  // Same 'tenant-config' query key as Footer.tsx — shares react-query's cache
  // across page mounts, so client-side navigation between pages doesn't
  // re-fetch and flash an empty placeholder before the logo pops in.
  const { data: config } = useQuery<LogoConfig>({
    queryKey: ['tenant-config'],
    queryFn: () => fetch("/api/tenant-config").then((res) => res.json()),
    staleTime: 60 * 60 * 1000,
  })

  if (!config) {
    return (
      <div className="absolute left-4 top-4 z-10 hidden lg:block">
        <div className="w-[242px] h-[97px]" />
      </div>
    )
  }

  const showLogo = shouldShowLogo(config.logoPages, page)
  if (!showLogo) return null

  const logoSrc = config.logoUrl
  const darkLogoSrc = config.darkLogoUrl || config.logoUrl

  if (config.logoUrl || config.darkLogoUrl) {
    if (config.logoLayer === 'below' && config.logoFullscreen) {
      return (
        <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <div className="relative w-full h-full dark:hidden">
            {logoSrc && <Image src={logoSrc} alt={config.brandName} fill className="object-contain" />}
          </div>
          <div className="relative w-full h-full hidden dark:block">
            {darkLogoSrc && <Image src={darkLogoSrc} alt={config.brandName} fill className="object-contain" />}
          </div>
        </div>
      )
    }

    const zClass = config.logoLayer === 'below' ? 'z-[0]' : 'z-10'
    return (
      <div
        className={`hidden lg:block cursor-pointer ${zClass}`}
        style={{
          position: "absolute",
          left: `${config.logoPositionX}%`,
          top: `${config.logoPositionY}%`,
        }}
      >
        {logoSrc && (
          <Image
            src={logoSrc}
            alt={config.brandName}
            width={config.logoWidth}
            height={config.logoHeight}
            className="h-auto dark:hidden"
          />
        )}
        {darkLogoSrc && (
          <Image
            src={darkLogoSrc}
            alt={config.brandName}
            width={config.logoWidth}
            height={config.logoHeight}
            className="h-auto hidden dark:block"
          />
        )}
      </div>
    )
  }

  return null
}
