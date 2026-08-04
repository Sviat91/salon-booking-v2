"use client"
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSelectedMaster, useSelectedMasterId } from '@/contexts/MasterContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface BrandHeaderProps {
  onLogoClick?: () => void
}

type LogoConfig = {
  logoUrl: string | null
  darkLogoUrl: string | null
  brandName: string
}

export default function BrandHeader({ onLogoClick }: BrandHeaderProps) {
  const { t } = useTranslation()
  const selectedMaster = useSelectedMaster()
  const selectedMasterId = useSelectedMasterId()
  const logoClickable = typeof onLogoClick === 'function'
  const prefersReducedMotion = useReducedMotion()
  const { data: config } = useQuery<LogoConfig>({
    queryKey: ['tenant-config'],
    queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<LogoConfig>),
    staleTime: 60 * 60 * 1000,
  })
  const logoSrc = config?.logoUrl || null
  const darkLogoSrc = config?.darkLogoUrl || config?.logoUrl || null
  
  // Use selectedMasterId directly for the layoutId instead of selectedMaster?.id
  // because selectedMaster is updated asynchronously and would break the Framer Motion cross-route flight animation
  const masterPhotoId = selectedMaster?.id || selectedMasterId || 'unknown'

  return (
    <header className="flex flex-col items-center gap-3 py-4 lg:py-6">
      <motion.div
        layoutId={prefersReducedMotion ? undefined : `master-photo-${masterPhotoId}`}
        className={`h-20 w-20 rounded-full overflow-hidden ring-2 ring-accent/70 shadow-sm bg-card${
          logoClickable ? ' cursor-pointer' : ''
        }`}
        onClick={onLogoClick}
        transition={prefersReducedMotion ? { duration: 0 } : { 
          type: "spring", 
          stiffness: 200, 
          damping: 25,
          duration: 1.2
        }}
      >
        {selectedMaster?.avatar ? (
          <Image
            src={selectedMaster.avatar}
            alt={`${selectedMaster?.name || 'Master'} - Beauty Master`}
            width={80}
            height={80}
            className="h-20 w-20 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center bg-muted text-foreground text-2xl font-bold">
            {selectedMaster?.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </motion.div>
      
      {/* Логотип показывается только на мобильных устройствах */}
      {(logoSrc || darkLogoSrc) && (
        <div
          className={`block lg:hidden mt-3 mb-2 px-4${logoClickable ? ' cursor-pointer' : ''}`}
          onClick={onLogoClick}
        >
          {/* Светлая тема */}
          {logoSrc && (
            <Image
              src={logoSrc}
              alt={config?.brandName || ''}
              width={200}
              height={80}
              className="h-auto max-w-[180px] sm:max-w-[200px] mx-auto dark:hidden"
            />
          )}
          {/* Темная тема */}
          {darkLogoSrc && (
            <Image
              src={darkLogoSrc}
              alt={config?.brandName || ''}
              width={200}
              height={80}
              className="h-auto max-w-[180px] sm:max-w-[200px] mx-auto hidden dark:block"
            />
          )}
        </div>
      )}

      <h1
        className={`text-3xl font-normal tracking-tight${logoClickable ? ' cursor-pointer' : ''}`}
        onClick={onLogoClick}
      >
        {t('booking.bookVisit')}
      </h1>
    </header>
  )
}
