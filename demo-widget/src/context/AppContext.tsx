import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { masters } from '../data'
import type { Master } from '../types'
import type { NavTab } from '../components/TopNavLine'

type View =
  | { name: 'home' }
  | { name: 'booking'; masterId: string }
  | { name: 'about' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'support' }
  | { name: 'admin' }

interface AppContextValue {
  view: View
  navigateHome: () => void
  navigateToMaster: (masterId: string) => void
  navigateToAbout: () => void
  navigateToPrivacy: () => void
  navigateToTerms: () => void
  navigateToSupport: () => void
  navigateToAdmin: () => void
  selectedMasterId: string | null
  selectedMaster: Master | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: 'home' })

  const navigateHome = useCallback(() => setView({ name: 'home' }), [])
  const navigateToMaster = useCallback((masterId: string) => setView({ name: 'booking', masterId }), [])
  const navigateToAbout = useCallback(() => setView({ name: 'about' }), [])
  const navigateToPrivacy = useCallback(() => setView({ name: 'privacy' }), [])
  const navigateToTerms = useCallback(() => setView({ name: 'terms' }), [])
  const navigateToSupport = useCallback(() => setView({ name: 'support' }), [])
  const navigateToAdmin = useCallback(() => setView({ name: 'admin' }), [])

  const selectedMasterId = view.name === 'booking' ? view.masterId : null
  const selectedMaster = useMemo(() => masters.find((m) => m.id === selectedMasterId) ?? null, [selectedMasterId])

  const value: AppContextValue = {
    view,
    navigateHome,
    navigateToMaster,
    navigateToAbout,
    navigateToPrivacy,
    navigateToTerms,
    navigateToSupport,
    navigateToAdmin,
    selectedMasterId,
    selectedMaster,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

export function useSelectedMasterId() {
  return useAppContext().selectedMasterId
}

export function useSelectedMaster() {
  return useAppContext().selectedMaster
}

export function useAppNavigation() {
  const {
    view,
    navigateHome,
    navigateToMaster,
    navigateToAbout,
    navigateToPrivacy,
    navigateToTerms,
    navigateToSupport,
    navigateToAdmin,
  } = useAppContext()
  return { view, navigateHome, navigateToMaster, navigateToAbout, navigateToPrivacy, navigateToTerms, navigateToSupport, navigateToAdmin }
}

/** The single "About Us" tab shown in every page's TopNavLine. */
export function useAboutTab(): NavTab[] {
  const { view, navigateToAbout } = useAppContext()
  return [{ id: 'about', title: 'About Us', active: view.name === 'about', onClick: navigateToAbout }]
}
