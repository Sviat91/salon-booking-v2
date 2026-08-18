export type BrandSettings = {
  name: string
  secondaryColor: string
  primaryColor: string
  cardColor: string
  accentColor: string
  textColor: string
  mutedColor: string
  borderColor: string
  darkBgColor: string
  darkPrimaryColor: string
  darkCardColor: string
  darkAccentColor: string
  darkTextColor: string
  darkMutedColor: string
  darkBorderColor: string
}

const KEY = 'ordiset-demo-brand'

export const DEFAULT_BRAND: BrandSettings = {
  name: 'Loom & Blade',
  secondaryColor: '#F8F9FA',
  primaryColor: '#EAECEE',
  cardColor: '#FFFFFF',
  accentColor: '#B35C37',
  textColor: '#1A1D20',
  mutedColor: '#6C757D',
  borderColor: '#E2E8F0',
  darkBgColor: '#121417',
  darkPrimaryColor: '#22262B',
  darkCardColor: '#1A1D22',
  darkAccentColor: '#D0764D',
  darkTextColor: '#F1F3F5',
  darkMutedColor: '#8B95A1',
  darkBorderColor: '#2D3239',
}

export const M3_LIGHT_DEFAULTS = {
  primaryColor: '#FFF0F1',
  cardColor: '#FFF0F1',
  accentColor: '#8B4A58',
  textColor: '#211A1B',
  mutedColor: '#524344',
  borderColor: '#D8C2C3',
}

export const M3_DARK_DEFAULTS = {
  darkBgColor: '#191112',
  darkPrimaryColor: '#261E1F',
  darkCardColor: '#22160f',
  darkAccentColor: '#FFB2B8',
  darkTextColor: '#EDE1E1',
  darkMutedColor: '#D8C2C3',
  darkBorderColor: '#524344',
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

/** Strips a leading `#` and parses R/G/B hex byte pairs, returning a
 * space-separated decimal triplet (e.g. "179 92 55") as required by
 * tailwind.config.ts's `rgb(var(--x) / <alpha-value>)` convention. */
function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/** Applies the full theme color set for whichever theme is currently active
 * — call again whenever the `dark` class on <html> changes. */
export function applyThemeColors(settings: BrandSettings) {
  const isDark = document.documentElement.classList.contains('dark')
  const root = document.documentElement.style

  if (isDark) {
    root.setProperty('--background', hexToRgbTriplet(settings.darkBgColor))
    root.setProperty('--foreground', hexToRgbTriplet(settings.darkTextColor))
    root.setProperty('--card', hexToRgbTriplet(settings.darkCardColor))
    root.setProperty('--card-foreground', hexToRgbTriplet(settings.darkTextColor))
    root.setProperty('--secondary', hexToRgbTriplet(settings.darkPrimaryColor))
    root.setProperty('--secondary-foreground', hexToRgbTriplet(settings.darkTextColor))
    root.setProperty('--muted', hexToRgbTriplet(settings.darkPrimaryColor))
    root.setProperty('--muted-foreground', hexToRgbTriplet(settings.darkMutedColor))
    root.setProperty('--accent', hexToRgbTriplet(settings.darkPrimaryColor))
    root.setProperty('--accent-foreground', hexToRgbTriplet(settings.darkTextColor))
    root.setProperty('--border', hexToRgbTriplet(settings.darkBorderColor))
    root.setProperty('--primary', hexToRgbTriplet(settings.darkAccentColor))
    root.setProperty('--ring', hexToRgbTriplet(settings.darkAccentColor))
  } else {
    root.setProperty('--background', hexToRgbTriplet(settings.secondaryColor))
    root.setProperty('--foreground', hexToRgbTriplet(settings.textColor))
    root.setProperty('--card', hexToRgbTriplet(settings.cardColor))
    root.setProperty('--card-foreground', hexToRgbTriplet(settings.textColor))
    root.setProperty('--secondary', hexToRgbTriplet(settings.primaryColor))
    root.setProperty('--secondary-foreground', hexToRgbTriplet(settings.textColor))
    root.setProperty('--muted', hexToRgbTriplet(settings.primaryColor))
    root.setProperty('--muted-foreground', hexToRgbTriplet(settings.mutedColor))
    root.setProperty('--accent', hexToRgbTriplet(settings.primaryColor))
    root.setProperty('--accent-foreground', hexToRgbTriplet(settings.textColor))
    root.setProperty('--border', hexToRgbTriplet(settings.borderColor))
    root.setProperty('--primary', hexToRgbTriplet(settings.accentColor))
    root.setProperty('--ring', hexToRgbTriplet(settings.accentColor))
  }
}
