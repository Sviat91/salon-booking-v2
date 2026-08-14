import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { masters } from '../data'
import { useAppNavigation } from '../context/AppContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { t } from '../lib/i18n'

export default function MasterSelector() {
  const { navigateToMaster } = useAppNavigation()
  const prefersReducedMotion = useReducedMotion()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

  const scrollLeft = () => scrollContainerRef.current?.scrollBy({ left: -240, behavior: 'smooth' })
  const scrollRight = () => scrollContainerRef.current?.scrollBy({ left: 240, behavior: 'smooth' })

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl relative z-10">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
        className="text-center mb-6"
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">{t('master.selectTitle')}</h1>
        <p className="text-base sm:text-lg text-muted-foreground">{t('master.selectSubtitle')}</p>
      </motion.div>

      <div className="relative w-full group/slider flex items-center justify-center mt-4">
        {canScrollLeft && (
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Scroll left"
            className="hidden lg:flex absolute -left-12 xl:-left-16 z-20 w-14 h-14 bg-background/60 hover:bg-secondary backdrop-blur-md rounded-full shadow-md items-center justify-center text-foreground transition-all duration-300 opacity-0 group-hover/slider:opacity-100 hover:scale-105"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex gap-4 sm:gap-6 w-full overflow-x-auto snap-x snap-mandatory px-4 pb-8 pt-4 before:m-auto after:m-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {masters.map((master, index) => (
            <div key={master.id} className="flex flex-col items-center shrink-0 snap-center w-[160px] sm:w-[200px]">
              <motion.button
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.2, type: 'spring', stiffness: 100 }
                }
                whileHover={prefersReducedMotion ? {} : { scale: 1.05, transition: { duration: 0.2 } }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                onClick={() => navigateToMaster(master.id)}
                aria-label={`Book a visit with ${master.name}`}
                className="group relative w-full h-[160px] sm:h-[200px] rounded-3xl overflow-hidden focus:outline-none hover:ring-4 hover:ring-secondary/50 transition-all duration-300"
              >
                <motion.div
                  layoutId={prefersReducedMotion ? undefined : `master-photo-${master.id}`}
                  className="relative w-full h-full bg-muted"
                  transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 25, duration: 1.2 }}
                >
                  {master.avatar ? (
                    <img
                      src={master.avatar}
                      alt={`${master.name} - Beauty Master`}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-foreground text-6xl font-bold">
                      {master.avatarInitial}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />

                <motion.div className="absolute bottom-0 left-0 right-0 px-2 pb-2 text-center" transition={{ duration: 0.5, ease: 'easeOut' }}>
                  <h2 className="text-xl sm:text-2xl font-bold text-white/90 mb-0.5 leading-tight line-clamp-2 transform group-hover:translate-y-[-2px] transition-transform duration-300">
                    {master.name}
                  </h2>
                  <div className="hidden items-center justify-center gap-1.5 text-white/90 group-hover:flex">
                    <span className="text-xs sm:text-sm font-medium">{t('master.bookVisit')}</span>
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:translate-x-1 transition-transform duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute inset-0 rounded-3xl ring-2 ring-white/10 pointer-events-none"
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </motion.button>
              {/* Real component shows the master's full bio here; user
                  wants the short role/title on the home grid instead, with
                  the fuller bio reserved for the booking page below. */}
              <p className="mt-2 w-full text-center text-xs sm:text-sm text-muted-foreground line-clamp-2 px-1">{master.title}</p>
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Scroll right"
            className="hidden lg:flex absolute -right-12 xl:-right-16 z-20 w-14 h-14 bg-background/60 hover:bg-secondary backdrop-blur-md rounded-full shadow-md items-center justify-center text-foreground transition-all duration-300 opacity-0 group-hover/slider:opacity-100 hover:scale-105"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}
      </div>
    </div>
  )
}
