import { useState, useEffect } from 'react'

/**
 * Hook to detect whether the viewport is below the admin dashboard's mobile
 * breakpoint (`lg`, 1024px — see src/app/admin/AGENTS.md). SSR-safe: defaults
 * to `false` (desktop) until mounted, then syncs with matchMedia.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023.98px)')
    setIsMobile(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [])

  return isMobile
}
