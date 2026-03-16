import prisma from "@/lib/prisma"

const DEFAULT_CONFIG = {
  brandName: "Salon Booking",
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
  logoUrl: null,
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
