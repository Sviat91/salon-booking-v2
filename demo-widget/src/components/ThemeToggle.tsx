import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'

// Real component swaps in a tenant-configurable icon image (size clamped
// 32-64px, default 48). No custom icon uploaded in this demo, so a plain
// sun/moon glyph substitutes for the image — the 64px hit-area/padding math
// is ported exactly since that's what determines the header row's height.
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark')
  const size = 36
  const clampedSize = Math.min(64, Math.max(32, size))
  const pad = (64 - clampedSize) / 2

  return (
    <button onClick={toggleTheme} className="hover:opacity-80 transition-opacity duration-300" style={{ padding: pad }} aria-label={label}>
      {isDark ? (
        <svg width={clampedSize} height={clampedSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-foreground">
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path
            strokeLinecap="round"
            strokeWidth={2}
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ) : (
        <svg width={clampedSize} height={clampedSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-foreground">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}
