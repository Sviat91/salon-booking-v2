import { getTenantConfig } from "@/lib/tenant"
import SettingsForm from "./SettingsForm"

export default async function SettingsPage() {
  const config = await getTenantConfig()
  const c = config as Record<string, unknown>
  const fullConfig = {
    ...config,
    cardColor: c.cardColor as string || "#FFFFFF",
    darkPrimaryColor: c.darkPrimaryColor as string || config.primaryColor,
    darkAccentColor: c.darkAccentColor as string || config.accentColor,
    darkLogoUrl: c.darkLogoUrl as string | null || null,
    logoPositionX: c.logoPositionX as number ?? 0,
    logoPositionY: c.logoPositionY as number ?? 0,
    logoWidth: c.logoWidth as number ?? 200,
    logoHeight: c.logoHeight as number ?? 80,
    logoPages: c.logoPages as string || '["home","booking"]',
    logoLayer: c.logoLayer as string || 'above',
    availableSlotColor: c.availableSlotColor as string || "#22c55e",
    dayOffColor: c.dayOffColor as string || "#ef4444",
    workingHourStart: c.workingHourStart as number ?? 8,
    workingHourEnd: c.workingHourEnd as number ?? 21,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salon Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brand name, logo, favicon and colors.
        </p>
      </div>

      <SettingsForm config={fullConfig} />
    </div>
  )
}
