import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getBrandSettings, saveBrandSettings, applyBrandColors, type BrandSettings } from '../lib/brandSettings'

interface BrandContextValue {
  brand: BrandSettings
  updateBrand: (next: Partial<BrandSettings>) => void
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings>(() => getBrandSettings())

  useEffect(() => {
    applyBrandColors(brand)
    // Accent depends on which theme is active — re-apply whenever the
    // `dark` class toggles, from either ThemeToggle (public) or
    // AdminThemeToggle (admin), without those needing to know about brand
    // colors at all.
    const observer = new MutationObserver(() => applyBrandColors(brand))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [brand])

  function updateBrand(next: Partial<BrandSettings>) {
    setBrand((prev) => {
      const merged = { ...prev, ...next }
      saveBrandSettings(merged)
      return merged
    })
  }

  return <BrandContext.Provider value={{ brand, updateBrand }}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used within BrandProvider')
  return ctx
}
