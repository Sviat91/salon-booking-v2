import { useEffect, useRef, useState } from 'react'

// Ported from the real LanguageToggle.tsx markup. The real component
// returns null outright when a tenant only has one language enabled — this
// demo shows it anyway (user request, 2026-08-14) to demonstrate the
// capability, with English as the only option for now.
export default function LanguageToggle() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="px-3 py-2 rounded-full border border-border bg-transparent hover:bg-primary/10 hover:border-primary/40 transition-colors flex items-center gap-1"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-sm font-medium text-foreground">EN</span>
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg p-1 min-w-[120px] z-50" role="listbox">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full px-3 py-2 flex items-center justify-between rounded-md transition-colors bg-primary/15 text-primary font-medium"
            role="option"
            aria-selected="true"
          >
            <span className="text-sm">English</span>
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
