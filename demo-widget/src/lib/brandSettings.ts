export type BrandSettings = {
  name: string
  lightAccent: string
  darkAccent: string
}

const KEY = 'ordiset-demo-brand'

export const DEFAULT_BRAND: BrandSettings = {
  name: 'Loom & Blade',
  lightAccent: '#b35c37',
  darkAccent: '#d0764d',
}

export function getBrandSettings(): BrandSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_BRAND, ...JSON.parse(raw) } : DEFAULT_BRAND
  } catch {
    return DEFAULT_BRAND
  }
}

export function saveBrandSettings(settings: BrandSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

/** Applies the accent color for whichever theme is currently active — call
 * again whenever the `dark` class on <html> changes. */
export function applyBrandColors(settings: BrandSettings) {
  const isDark = document.documentElement.classList.contains('dark')
  const accent = isDark ? settings.darkAccent : settings.lightAccent
  document.documentElement.style.setProperty('--primary', accent)
  document.documentElement.style.setProperty('--ring', accent)
}
