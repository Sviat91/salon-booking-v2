import { unstable_noStore as noStore } from "next/cache"
import prisma from "@/lib/prisma"
import { DEFAULT_BRAND_NAME } from "@/lib/constants/brand"
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache"

const TENANT_CONFIG_CACHE_KEY = 'tenant:config'
const TENANT_CONFIG_CACHE_TTL_SEC = 30

const DEFAULT_CONFIG = {
  brandName: DEFAULT_BRAND_NAME,
  primaryColor: '#FFF0F1',
  secondaryColor: '#FFF8F6',
  accentColor: '#8B4A58',
  textColor: '#211A1B',
  mutedColor: '#524344',
  borderColor: '#D8C2C3',
  cardColor: '#FFF0F1',
  successColor: '#21A67A',
  errorColor: '#BA1A1A',
  darkBgColor: '#191112',
  darkPrimaryColor: '#261E1F',
  darkAccentColor: '#FFB2B8',
  darkCardColor: '#22160f',
  darkTextColor: '#EDE1E1',
  darkMutedColor: '#D8C2C3',
  darkBorderColor: '#524344',
  logoUrl: null,
  faviconUrl: null,
  darkLogoUrl: null,
  themeToggleIconUrl: null,
  darkThemeToggleIconUrl: null,
  themeToggleIconSize: null,
  logoPositionX: 0,
  logoPositionY: 0,
  logoWidth: 200,
  logoHeight: 80,
  logoPages: '["home","booking"]',
  bgType: 'solid',
  bgImageUrl: null,
  bgGradientFrom: '#FFD9DC',
  bgGradientTo: '#FFF8F6',
  bgGradientAngle: 135,
  bgApplyToDark: true,
  logoFullscreen: false,
  darkBgType: 'solid',
  darkBgImageUrl: null,
  darkBgGradientFrom: '#723340',
  darkBgGradientTo: '#191112',
  darkBgGradientAngle: 135,
  salonAddress: null,
  salonCity: null,
  salonPhone: null,
  salonEmail: null,
  salonCompanyName: null,
  salonNip: null,
  salonLegalAddress: null,
  termsContent_pl: null,
  termsContent_en: null,
  termsContent_uk: null,
  privacyContent_pl: null,
  privacyContent_en: null,
  privacyContent_uk: null,
  notifEmailEnabled: false,
  notifTelegramEnabled: false,
  notifReminder24hEnabled: false,
  notifReminder2hEnabled: false,
  telegramBotToken: null,
  telegramBotUsername: null,
  clientBotToken: null,
  clientBotUsername: null,
  clientBotSiteUrl: null,
  clientBotEnabled: false,
  enabledLocales: '["pl","en","uk"]',
}

export async function getTenantConfig() {
  noStore() // Disable caching to always get fresh config
  const cached = await cacheGet<typeof DEFAULT_CONFIG>(TENANT_CONFIG_CACHE_KEY)
  if (cached) return cached
  try {
    const config = await prisma.tenantConfig.findFirst()
    if (config) {
      await cacheSet(TENANT_CONFIG_CACHE_KEY, config, TENANT_CONFIG_CACHE_TTL_SEC)
      return config
    }

    // Auto-seed default config if none exists
    const newConfig = await prisma.tenantConfig.create({
      data: DEFAULT_CONFIG,
    })

    await cacheSet(TENANT_CONFIG_CACHE_KEY, newConfig, TENANT_CONFIG_CACHE_TTL_SEC)
    return newConfig

  } catch {
    // Fallback if DB is unavailable during certain build steps
    return DEFAULT_CONFIG
  }
}

export async function invalidateTenantConfigCache() {
  await cacheDel(TENANT_CONFIG_CACHE_KEY)
}
