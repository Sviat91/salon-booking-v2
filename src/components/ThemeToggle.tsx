"use client"
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

type ThemeToggleConfig = {
  themeToggleIconUrl: string | null
  darkThemeToggleIconUrl: string | null
  themeToggleIconSize: number | null
}

export default function ThemeToggle() {
  const { t } = useTranslation()
  const [isDark, setIsDark] = useState(false)
  const { data: config } = useQuery<ThemeToggleConfig>({
    queryKey: ['tenant-config'],
    queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<ThemeToggleConfig>),
    staleTime: 60 * 60 * 1000,
  })

  // Синхронизируем состояние с уже установленной темой
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    
    // Сохраняем в localStorage
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
    
    // Применяем к document
    if (newTheme) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark')
  const customIcon = isDark ? config?.darkThemeToggleIconUrl : config?.themeToggleIconUrl
  const size = config?.themeToggleIconSize ?? 48
  const clampedSize = Math.min(64, Math.max(32, size))
  const pad = (64 - clampedSize) / 2

  return (
    <button
      onClick={toggleTheme}
      className="hover:opacity-80 transition-opacity duration-300"
      style={{ padding: pad }}
      aria-label={label}
    >
      {customIcon ? (
        <img
          src={customIcon}
          alt={label}
          width={clampedSize}
          height={clampedSize}
          style={{ width: clampedSize, height: clampedSize }}
          className="object-contain"
        />
      ) : (
        <Image
          src={isDark ? '/dark.png' : '/light.png'}
          alt={label}
          width={clampedSize}
          height={clampedSize}
          style={{ width: clampedSize, height: clampedSize }}
        />
      )}
    </button>
  )
}
