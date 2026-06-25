import { unstable_noStore as noStore } from "next/cache"
import prisma from "@/lib/prisma"

const DEFAULT_CONFIG = {
  brandName: "Somique Beauty",
  primaryColor: "#FDE5C3",
  secondaryColor: "#FFF6E9",
  accentColor: "#FFBBBD",
  textColor: "#2B2B2B",
  mutedColor: "#6B6B6B",
  borderColor: "#E9E2D6",
  cardColor: "#FFFFFF",
  successColor: "#21A67A",
  errorColor: "#D84E4E",
  darkBgColor: "#9c6849",
  darkPrimaryColor: "#FDE5C3",
  darkAccentColor: "#FFBBBD",
  darkCardColor: "#2A2A2A",
  darkTextColor: "#FFFFFF",
  darkMutedColor: "#D0D0D0",
  darkBorderColor: "#7A4F35",
  logoUrl: null,
  faviconUrl: null,
  darkLogoUrl: null,
  logoPositionX: 0,
  logoPositionY: 0,
  logoWidth: 200,
  logoHeight: 80,
  logoPages: '["home","booking"]',
  bgType: 'solid',
  bgImageUrl: null,
  bgGradientFrom: '#FDE5C3',
  bgGradientTo: '#FFF6E9',
  bgGradientAngle: 135,
  bgApplyToDark: true,
  logoFullscreen: false,
  darkBgType: 'solid',
  darkBgImageUrl: null,
  darkBgGradientFrom: '#9c6849',
  darkBgGradientTo: '#2A2A2A',
  darkBgGradientAngle: 135,
  salonAddress: null,
  salonCity: null,
  salonPhone: null,
  salonEmail: null,
  salonCompanyName: null,
  salonNip: null,
  salonLegalAddress: null,
  notifEmailEnabled: false,
  notifTelegramEnabled: false,
  notifAdminChatId: null,
  notifReminder24hEnabled: false,
  notifReminder2hEnabled: false,
  telegramBotToken: null,
  telegramBotUsername: null,
}

export async function getTenantConfig() {
  noStore() // Disable caching to always get fresh config
  try {
    const config = await prisma.tenantConfig.findFirst()
    if (config) {
      return config
    }

    // Auto-seed default config if none exists
    const newConfig = await prisma.tenantConfig.create({
      data: DEFAULT_CONFIG,
    })
    
    return newConfig

  } catch {
    // Fallback if DB is unavailable during certain build steps
    return DEFAULT_CONFIG
  }
}
