"use client"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Toaster } from "sonner"

/**
 * The app's single sonner mount. Without it every `toast.*()` call is a silent no-op.
 * Theme follows the manual `.dark` class on <html> (ThemeToggle.tsx / ui/theme-toggle.tsx
 * both toggle it and persist to localStorage) — sonner's `theme="system"` reads
 * matchMedia and would ignore that override, so we watch the class instead.
 */
export default function AppToaster() {
  const { t } = useTranslation()
  // Start light so the first client render matches SSR; sync after hydration.
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const el = document.documentElement
    const sync = () => setIsDark(el.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return (
    <Toaster
      theme={isDark ? 'dark' : 'light'}
      position="top-right"
      richColors
      containerAriaLabel={t('common.notifications')}
    />
  )
}
