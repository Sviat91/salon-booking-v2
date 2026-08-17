import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

// Admin uses a plain ghost icon button (Sun/Moon), distinct from the public
// site's branded barber-pole ThemeToggle — matches the real admin's
// ui/theme-toggle.tsx, a generic icon button, not brand-specific artwork.
export default function AdminThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
