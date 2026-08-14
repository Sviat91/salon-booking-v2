import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { masters } from '../data'
import type { Master } from '../types'

type View = { name: 'home' } | { name: 'booking'; masterId: string }

interface AppContextValue {
  view: View
  navigateHome: () => void
  navigateToMaster: (masterId: string) => void
  selectedMasterId: string | null
  selectedMaster: Master | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: 'home' })

  const navigateHome = useCallback(() => setView({ name: 'home' }), [])
  const navigateToMaster = useCallback((masterId: string) => setView({ name: 'booking', masterId }), [])

  const selectedMasterId = view.name === 'booking' ? view.masterId : null
  const selectedMaster = useMemo(() => masters.find((m) => m.id === selectedMasterId) ?? null, [selectedMasterId])

  const value: AppContextValue = { view, navigateHome, navigateToMaster, selectedMasterId, selectedMaster }

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
  const { view, navigateHome, navigateToMaster } = useAppContext()
  return { view, navigateHome, navigateToMaster }
}
