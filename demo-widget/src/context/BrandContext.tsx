import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getBrandSettings, saveBrandSettings, applyThemeColors, type BrandSettings } from '../lib/brandSettings'

interface BrandContextValue {
  brand: BrandSettings
  draft: BrandSettings
  isDirty: boolean
  updateDraft: (next: Partial<BrandSettings>) => void
  saveDraft: () => void
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings>(() => getBrandSettings())
  const [draft, setDraft] = useState<BrandSettings>(brand)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    applyThemeColors(brand)
    // Colors depend on which theme is active — re-apply whenever the
    // `dark` class toggles, from either ThemeToggle (public) or
    // AdminThemeToggle (admin), without those needing to know about brand
    // colors at all.
    const observer = new MutationObserver(() => applyThemeColors(brand))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [brand])

  function updateDraft(next: Partial<BrandSettings>) {
    setDraft((prev) => ({ ...prev, ...next }))
    setIsDirty(true)
  }

  function saveDraft() {
    setBrand(draft)
    saveBrandSettings(draft)
    setIsDirty(false)
  }

  return (
    <BrandContext.Provider value={{ brand, draft, isDirty, updateDraft, saveDraft }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used within BrandProvider')
  return ctx
}
