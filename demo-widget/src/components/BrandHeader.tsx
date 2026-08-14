import { motion } from 'framer-motion'
import { useSelectedMaster } from '../context/AppContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { t } from '../lib/i18n'

export default function BrandHeader({ onLogoClick }: { onLogoClick?: () => void }) {
  const selectedMaster = useSelectedMaster()
  const logoClickable = typeof onLogoClick === 'function'
  const prefersReducedMotion = useReducedMotion()
  const masterPhotoId = selectedMaster?.id || 'unknown'

  return (
    <header className="flex flex-col items-center gap-3 py-4 lg:py-6">
      <motion.div
        layoutId={prefersReducedMotion ? undefined : `master-photo-${masterPhotoId}`}
        className={`h-20 w-20 rounded-full overflow-hidden ring-2 ring-accent/70 shadow-sm bg-card${
          logoClickable ? ' cursor-pointer' : ''
        }`}
        onClick={onLogoClick}
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 25, duration: 1.2 }}
      >
        {selectedMaster?.avatar ? (
          <img src={selectedMaster.avatar} alt={`${selectedMaster.name} - Beauty Master`} className="h-20 w-20 object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center bg-muted text-foreground text-2xl font-bold">
            {selectedMaster?.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </motion.div>

      <h1
        className={`text-3xl font-normal tracking-tight${logoClickable ? ' cursor-pointer' : ''}`}
        onClick={onLogoClick}
      >
        {t('booking.bookVisit')}
      </h1>
    </header>
  )
}
