import prisma from "@/lib/prisma"

const DEFAULT_CONFIG = {
  brandName: "Somique Beauty",
  primaryColor: "#FDE5C3",
  secondaryColor: "#FFF6E9",
  accentColor: "#FFBBBD",
  textColor: "#2B2B2B",
  mutedColor: "#6B6B6B",
  borderColor: "#E9E2D6",
  successColor: "#21A67A",
  errorColor: "#D84E4E",
  darkBgColor: "#9c6849",
  darkTextColor: "#FFFFFF",
  darkMutedColor: "#D0D0D0",
  darkBorderColor: "#7A4F35",
  darkCardColor: "#2A2A2A",
  logoUrl: null,
  faviconUrl: null,
}

export async function getTenantConfig() {
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

  } catch (error) {
    // Fallback if DB is unavailable during certain build steps
    return DEFAULT_CONFIG
  }
}
