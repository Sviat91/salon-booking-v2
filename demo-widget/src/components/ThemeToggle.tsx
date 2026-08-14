import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'

// Real component swaps in a tenant-configurable icon image, clamped 32-64px
// in the live app to keep the header row bounded. This demo intentionally
// breaks past that ceiling (user request, 2026-08-14: 2x bigger, no padding
// around it — a 3x/padded first pass pushed the nav bar's hairline down
// visibly) — the barber-pole artwork is meant to read as a real signage
// element, not a small toolbar icon.
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
  const size = 72

  return (
    <button onClick={toggleTheme} className="hover:opacity-80 transition-opacity duration-300" aria-label={label}>
      <img
        src={isDark ? '/dark.png' : '/light.png'}
        alt={label}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
      />
    </button>
  )
}
