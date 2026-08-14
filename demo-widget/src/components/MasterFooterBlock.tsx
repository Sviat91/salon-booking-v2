import { motion } from 'framer-motion'
import { useSelectedMaster } from '../context/AppContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
import ReviewStrip from './ReviewStrip'

// Ported wrapper/timing from the real MasterFooterBlock.tsx (renders whatever
// Page/Block content is configured for this master — a bio text block or a
// photo/review strip block). Marek's page is configured with a bio+
// achievements block; Anna's with a review-strip block — demonstrating that
// this is genuinely per-master configurable content, not a fixed template.
export default function MasterFooterBlock() {
  const master = useSelectedMaster()
  const prefersReducedMotion = useReducedMotion()

  if (!master) return null

  return (
    <motion.div
      className="mt-8"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {master.profileDisplay === 'bio' ? (
        <div className="space-y-2">
          <p className="text-sm text-foreground">{master.bio}</p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Achievements & Certifications</p>
            {master.achievements.map((a) => (
              <p key={a} className="text-sm text-muted-foreground">
                {a}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <ReviewStrip />
      )}
    </motion.div>
  )
}
