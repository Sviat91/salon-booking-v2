"use client"
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getAllMasters, type MasterId } from '@/config/masters'
import { useMaster } from '@/contexts/MasterContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type DbMaster = { id: string; name: string; avatar: string | null; bio: string | null }

/**
 * Master Selector Component
 * Fetches masters from DB (showOnHomepage = true) and falls back to hardcoded config.
 * For hardcoded masters ('olga', 'yuliia') → navigates to /{id}
 * For DB-only masters → navigates to /{userId}
 */
export default function MasterSelector() {
  const router = useRouter()
  const { t } = useTranslation()
  const { setMaster } = useMaster()
  const prefersReducedMotion = useReducedMotion()

  const [dbMasters, setDbMasters] = useState<DbMaster[] | null>(null)

  useEffect(() => {
    fetch('/api/masters')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.masters) && data.masters.length > 0) {
          setDbMasters(data.masters)
        }
      })
      .catch(() => { /* fall back to hardcoded */ })
  }, [])

  // Use DB masters when available, fall back to hardcoded config
  const hardcodedMasters = getAllMasters()
  const masters: DbMaster[] = dbMasters ?? hardcodedMasters.map((m) => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    bio: null,
  }))

  const handleMasterSelect = (master: DbMaster) => {
    const isHardcoded = hardcodedMasters.some((hm) => hm.id === master.id)
    if (isHardcoded) {
      flushSync(() => { setMaster(master.id as MasterId) })
    }
    router.push(`/${master.id}`)
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl relative z-10">
      {/* Title */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        className="text-center mb-6"
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          {t('master.selectTitle')}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          {t('master.selectSubtitle', 'Zarezerwuj wizytę u wybranego specjalisty')}
        </p>
      </motion.div>

      {/* Master Cards */}
      <div className="flex flex-col portrait:flex-col landscape:flex-row gap-5 w-full max-w-3xl justify-center items-center">
        {masters.map((master, index) => (
          <motion.button
            key={master.id}
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : {
              duration: 0.5,
              delay: index * 0.2,
              type: "spring",
              stiffness: 100
            }}
            whileHover={prefersReducedMotion ? {} : {
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
            onClick={() => handleMasterSelect(master)}
            aria-label={t('master.bookWith', { name: master.name })}
            className="group relative w-full max-w-[260px] aspect-square rounded-3xl overflow-hidden shadow-2xl focus:outline-none focus:ring-4 focus:ring-accent/50 transition-all duration-300"
          >
            {/* Master Photo */}
            <motion.div
              layoutId={prefersReducedMotion ? undefined : `master-photo-${master.id}`}
              className="relative w-full h-full bg-muted"
              transition={prefersReducedMotion ? { duration: 0 } : {
                type: "spring",
                stiffness: 200,
                damping: 25,
                duration: 1.2
              }}
            >
              {master.avatar ? (
                <Image
                  src={master.avatar}
                  alt={`${master.name} - Beauty Master`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                // Placeholder when no photo
                <div className="flex h-full w-full items-center justify-center bg-muted text-foreground text-6xl font-bold">
                  {master.name[0]?.toUpperCase()}
                </div>
              )}
            </motion.div>

            {/* Gradient Overlay */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />

            {/* Master Name */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 px-3 pb-1 text-center"
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-white/80 mb-1 transform group-hover:translate-y-[-4px] transition-transform duration-300">
                {master.name}
              </h2>
              <div className="flex items-center justify-center gap-2 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-sm font-medium">{t('master.bookVisit', 'Zarezerwuj wizytę')}</span>
                <svg
                  className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.div>

            {/* Decorative Border */}
            <motion.div
              className="absolute inset-0 rounded-3xl ring-2 ring-white/10 pointer-events-none"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </motion.button>
        ))}
      </div>

      {/* Subtle hint text */}
      <motion.p
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={prefersReducedMotion ? {} : { opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut", delay: 0 }}
        className="mt-4 text-xs sm:text-sm text-muted-foreground text-center max-w-md px-4"
      >
        {t('master.choiceRemembered', 'Twój wybór zostanie zapamiętany dla wygodniejszego korzystania z systemu rezerwacji')}
      </motion.p>
    </div>
  )
}
