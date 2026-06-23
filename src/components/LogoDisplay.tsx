"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

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
  const [config, setConfig] = useState<LogoConfig | null>(null)

  useEffect(() => {
    fetch("/api/tenant-config")
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {})
  }, [])

  if (!config) {
    return (
      <div className="absolute left-4 top-4 z-10 hidden lg:block">
        <div className="w-[242px] h-[97px]" />
      </div>
    )
  }

  const showLogo = shouldShowLogo(config.logoPages, page)
  if (!showLogo) return null

  const logoSrc = config.logoUrl || "/head_logo.png"
  const darkLogoSrc = config.darkLogoUrl || config.logoUrl || "/head_logo_night.png"

  if (config.logoUrl || config.darkLogoUrl) {
    if (config.logoLayer === 'below' && config.logoFullscreen) {
      return (
        <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <div className="relative w-full h-full dark:hidden">
            <Image src={logoSrc} alt={config.brandName} fill className="object-contain" />
          </div>
          <div className="relative w-full h-full hidden dark:block">
            <Image src={darkLogoSrc} alt={config.brandName} fill className="object-contain" />
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
        <Image
          src={logoSrc}
          alt={config.brandName}
          width={config.logoWidth}
          height={config.logoHeight}
          className="h-auto dark:hidden"
        />
        <Image
          src={darkLogoSrc}
          alt={config.brandName}
          width={config.logoWidth}
          height={config.logoHeight}
          className="h-auto hidden dark:block"
        />
      </div>
    )
  }

  return (
    <div className="absolute left-4 top-4 z-10 hidden lg:block">
      <Image
        src="/head_logo.png"
        alt="Logo"
        width={242}
        height={97}
        className="h-auto cursor-pointer dark:hidden"
      />
      <Image
        src="/head_logo_night.png"
        alt="Logo"
        width={242}
        height={97}
        className="h-auto cursor-pointer hidden dark:block"
      />
    </div>
  )
}
