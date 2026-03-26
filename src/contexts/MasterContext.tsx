"use client"
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clientLog } from '@/lib/client-logger'

const STORAGE_KEY = 'selected-master'

/**
 * Master info — minimal data stored in context.
 * Works with both hardcoded and DB-generated master IDs.
 */
export interface MasterInfo {
  id: string
  name: string
  avatar: string | null
}

/**
 * Master Context type definition
 */
interface MasterContextType {
  /** Currently selected master ID */
  selectedMasterId: string
  /** Currently selected master info (if available) */
  selectedMaster: MasterInfo | null
  /** Change the selected master */
  setMaster: (masterId: string) => void
  /** Check if a specific master is selected */
  isMasterSelected: (masterId: string) => boolean
  /** Reset to default master */
  resetMaster: () => void
}

const MasterContext = createContext<MasterContextType | undefined>(undefined)

/**
 * Read master ID from localStorage
 */
function getStoredMasterId(): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored.length > 0) {
      return stored
    }
  } catch (error) {
    clientLog.warn('Failed to read master from localStorage:', error)
  }
  
  return null
}

/**
 * Save master ID to localStorage
 */
function setStoredMasterId(masterId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, masterId)
  } catch (error) {
    clientLog.warn('Failed to save master to localStorage:', error)
  }
}

/**
 * Master Context Provider
 * Manages selected master state with localStorage persistence.
 * Supports arbitrary master IDs (both hardcoded and DB-generated cuids).
 */
export const MasterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  
  // Initialize state from localStorage or empty
  const [selectedMasterId, setSelectedMasterId] = useState<string>(() => {
    return getStoredMasterId() ?? ''
  })
  const selectedMasterIdRef = useRef<string>(selectedMasterId)

  // Cache master info fetched from API
  const [masterInfo, setMasterInfo] = useState<MasterInfo | null>(null)
  
  useEffect(() => {
    selectedMasterIdRef.current = selectedMasterId
  }, [selectedMasterId])

  // Fetch master info when masterId changes
  useEffect(() => {
    if (!selectedMasterId) {
      setMasterInfo(null)
      return
    }
    
    // Try to get master info from /api/masters cache
    fetch('/api/masters')
      .then(r => r.json())
      .then(data => {
        const masters = data.masters || []
        const found = masters.find((m: MasterInfo) => m.id === selectedMasterId)
        if (found) {
          setMasterInfo({
            id: found.id,
            name: found.name || 'Master',
            avatar: found.avatar || null,
          })
        }
      })
      .catch(() => {
        // Silently fail — info will be null
      })
  }, [selectedMasterId])

  /**
   * Change the selected master
   */
  const setMaster = useCallback((masterId: string) => {
    if (!masterId) {
      clientLog.error('Empty master ID')
      return
    }

    // Skip if already selected
    if (masterId === selectedMasterIdRef.current) {
      return
    }

    clientLog.info('Changing master to:', masterId)
    
    selectedMasterIdRef.current = masterId
    setSelectedMasterId(masterId)
    setStoredMasterId(masterId)
  }, [])

  /**
   * Check if a specific master is currently selected
   */
  const isMasterSelected = useCallback((masterId: string) => {
    return selectedMasterId === masterId
  }, [selectedMasterId])

  /**
   * Reset to default master — clears selection
   */
  const resetMaster = useCallback(() => {
    setSelectedMasterId('')
    setMasterInfo(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Sync with localStorage on mount
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        selectedMasterIdRef.current = e.newValue
        setSelectedMasterId(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const value: MasterContextType = {
    selectedMaster: masterInfo,
    selectedMasterId,
    setMaster,
    isMasterSelected,
    resetMaster,
  }

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>
}

/**
 * Hook to access master context
 * @throws Error if used outside MasterProvider
 */
export function useMaster(): MasterContextType {
  const context = useContext(MasterContext)
  if (context === undefined) {
    throw new Error('useMaster must be used within a MasterProvider')
  }
  return context
}

/**
 * Hook to get only the selected master info (convenience hook)
 */
export function useSelectedMaster(): MasterInfo | null {
  const { selectedMaster } = useMaster()
  return selectedMaster
}

/**
 * Hook to get only the selected master ID (convenience hook)
 */
export function useSelectedMasterId(): string {
  const { selectedMasterId } = useMaster()
  return selectedMasterId
}
