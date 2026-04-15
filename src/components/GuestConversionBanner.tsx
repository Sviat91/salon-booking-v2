"use client"
import { useTranslation } from 'react-i18next'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'

interface GuestConversionBannerProps {
  /** Whether a booking was just successfully completed */
  show: boolean
}

export default function GuestConversionBanner({ show }: GuestConversionBannerProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()

  // Show only for unauthenticated visitors — authenticated CLIENTs already have a profile
  const isAuthenticated = session?.user?.role === 'CLIENT'
  const shouldRender = show && !isAuthenticated

  return (
    <AnimatePresence>
      {shouldRender && (
        <motion.div
          key="guest-conversion-banner"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0"
        >
          <div className="rounded-2xl border border-primary/25 bg-card dark:bg-dark-card p-5 shadow-sm">
            {/* Icon + heading row */}
            <div className="flex items-start gap-3 mb-3">
              <span
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg"
                aria-hidden="true"
              >
                ✨
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground dark:text-dark-text leading-snug">
                  {t('success.guestBannerTitle')}
                </p>
                <p className="text-xs text-neutral-500 dark:text-dark-muted mt-0.5 leading-relaxed">
                  {t('success.guestBannerDesc')}
                </p>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="/auth/register"
                className="btn btn-primary py-2 px-4 text-xs flex-1 text-center"
              >
                {t('success.guestBannerRegister')}
              </a>
              <a
                href="/auth/login?callbackUrl=/profile"
                className="btn btn-outline py-2 px-4 text-xs flex-1 text-center"
              >
                {t('success.guestBannerLogin')}
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
