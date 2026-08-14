import { useEffect } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface LightboxProps {
  photos: string[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

const SWIPE_THRESHOLD = 50

// Ported from the real content/Lightbox.tsx.
export default function Lightbox({ photos, index, onClose, onIndexChange }: LightboxProps) {
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onIndexChange((index - 1 + photos.length) % photos.length)
      else if (e.key === 'ArrowRight') onIndexChange((index + 1) % photos.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, photos.length, onClose, onIndexChange])

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onIndexChange((index - 1 + photos.length) % photos.length)
    else if (info.offset.x < -SWIPE_THRESHOLD) onIndexChange((index + 1) % photos.length)
  }

  if (photos.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60">
          <X className="h-5 w-5" />
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index - 1 + photos.length) % photos.length)
              }}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index + 1) % photos.length)
              }}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <motion.div
          key={index}
          className="relative h-[80vh] w-[90vw] max-w-3xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
        >
          <img src={photos[index]} alt="" className="h-full w-full object-contain" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
