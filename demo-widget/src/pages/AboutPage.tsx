import { motion, type Variants } from 'framer-motion'
import TopNavLine from '../components/TopNavLine'
import ThemeToggle from '../components/ThemeToggle'
import PhotoGalleryRenderer from '../components/content/PhotoGalleryRenderer'
import { useAppNavigation, useAboutTab } from '../context/AppContext'
import { useReducedMotion } from '../hooks/useReducedMotion'

const INTRO =
  "Our space is more than just an urban salon; it's a modern loft crafted for those who value time, true craftsmanship, and uncompromising quality. We seamlessly merge traditional barbering artistry with advanced hairstyling and color techniques. Operating exclusively with curated premium products, we designed a space where an industrial aesthetic—raw concrete accented by warm copper lighting—meets ultimate privacy and comfort."

const PHOTOS = [6, 5, 4, 3, 2, 1].map((i) => `/about/interior-${i}.png`)

// Ported from the real src/app/pages/[slug]/page.tsx + PageRenderer.tsx —
// this demo has exactly one fixed content page ("About Us") instead of the
// real admin-configurable Page/Block system, so the intro text and gallery
// are rendered directly rather than through the generic BlockRenderer
// indirection (there's nothing dynamic to route between).
export default function AboutPage() {
  const { navigateHome } = useAppNavigation()
  const tabs = useAboutTab()
  const prefersReducedMotion = useReducedMotion()

  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: prefersReducedMotion ? { duration: 0 } : { staggerChildren: 0.08, delayChildren: 0.15 } },
  }
  const itemVariants: Variants = {
    hidden: prefersReducedMotion ? {} : { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' } },
  }

  return (
    <main className="relative flex-1 px-3 py-4 sm:p-6">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        className="absolute top-2 left-0 right-0 z-20 pl-3 lg:pl-28 xl:pl-32"
      >
        <TopNavLine onBack={navigateHome} leadingSpaceClassName="pl-48" actions={<ThemeToggle />} tabs={tabs} />
      </motion.div>

      <div className="mx-auto w-full max-w-5xl px-4 pt-12">
        <motion.div className="flex flex-col gap-8 pt-8 pb-12" variants={containerVariants} initial="hidden" animate="visible">
          <motion.p variants={itemVariants} className="whitespace-pre-line leading-relaxed text-foreground">
            {INTRO}
          </motion.p>
          <motion.div variants={itemVariants}>
            <PhotoGalleryRenderer photos={PHOTOS} />
          </motion.div>
        </motion.div>
      </div>
    </main>
  )
}
