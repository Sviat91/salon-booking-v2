"use client"
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  Language,
  DEFAULT_LANGUAGE,
  isValidLanguage,
  LANGUAGE_NAMES,
} from '@/lib/i18n'
import { parseEnabledLocales } from '@/lib/localized-content'
import { clientLog } from '@/lib/client-logger'

const STORAGE_KEY = 'selected-language'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  languageName: string
  supportedLanguages: readonly Language[]
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function getStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isValidLanguage(stored)) {
      return stored
    }
  } catch (error) {
    clientLog.warn('Failed to read language from localStorage:', error)
  }
  
  return null
}

function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch (error) {
    clientLog.warn('Failed to save language to localStorage:', error)
  }
}

// Mirrors the language into a cookie so Server Components can read it via
// `next/headers` cookies() (see src/lib/i18n-server.ts).
function setLanguageCookie(lang: Language): void {
  if (typeof document === 'undefined') return
  document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`
}

export const LanguageProvider: React.FC<{ children: ReactNode; enabledLocales?: string }> = ({ children, enabledLocales }) => {
  const { i18n } = useTranslation()
  const router = useRouter()

  const enabledLanguages = useMemo(() => parseEnabledLocales(enabledLocales), [enabledLocales])

  // Always start with default language to avoid hydration mismatch
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)

  // Sync language from localStorage AFTER hydration is complete. A stored
  // language that is no longer enabled (tenant disabled it) falls back to
  // the first enabled language.
  useEffect(() => {
    const storedLang = getStoredLanguage()
    const effective = storedLang && enabledLanguages.includes(storedLang) ? storedLang : enabledLanguages[0]

    i18n.changeLanguage(effective)
    setLanguageState(effective)
    setLanguageCookie(effective)

    if (storedLang && storedLang !== effective) {
      setStoredLanguage(effective)
      router.refresh()
    }
  }, [i18n, enabledLanguages, router])

  const setLanguage = useCallback((lang: Language) => {
    if (!isValidLanguage(lang)) {
      clientLog.error('Invalid language:', lang)
      return
    }

    if (!enabledLanguages.includes(lang)) {
      clientLog.error('Language not enabled:', lang)
      return
    }

    if (lang === language) {
      return
    }

    clientLog.info('Changing language to:', lang)
    
    // Update i18next
    i18n.changeLanguage(lang)
    
    // Update state
    setLanguageState(lang)
    
    // Save to localStorage
    setStoredLanguage(lang)

    // Mirror to a cookie for server-rendered pages (see src/lib/i18n-server.ts)
    setLanguageCookie(lang)

    // Refresh Server Component content (e.g. admin pages using getServerT())
    // so it picks up the new language immediately.
    router.refresh()

    clientLog.info('Language changed successfully to:', lang)
  }, [language, i18n, router, enabledLanguages])

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEY &&
        e.newValue &&
        isValidLanguage(e.newValue) &&
        enabledLanguages.includes(e.newValue)
      ) {
        const newLang = e.newValue as Language
        i18n.changeLanguage(newLang)
        setLanguageState(newLang)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [i18n, enabledLanguages])

  const value: LanguageContextType = {
    language,
    setLanguage,
    languageName: LANGUAGE_NAMES[language],
    supportedLanguages: enabledLanguages,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export function useCurrentLanguage(): Language {
  const { language } = useLanguage()
  return language
}
