import { auth } from "@/auth"
import { getTenantConfig } from "@/lib/tenant"
import SettingsForm from "./SettingsForm"
import SuperAdminCredentials from "./SuperAdminCredentials"
import { getServerT } from "@/lib/i18n-server"

export default async function SettingsPage() {
  const t = getServerT()
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPERADMIN"
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
    availableSlotColor: c.availableSlotColor as string || "#21A67A",
    dayOffColor: c.dayOffColor as string || "#BA1A1A",
    workingHourStart: c.workingHourStart as number ?? 8,
    workingHourEnd: c.workingHourEnd as number ?? 21,
    salonAddress: c.salonAddress as string | null ?? null,
    salonCity: c.salonCity as string | null ?? null,
    salonPhone: c.salonPhone as string | null ?? null,
    salonEmail: c.salonEmail as string | null ?? null,
    salonCompanyName: c.salonCompanyName as string | null ?? null,
    salonNip: c.salonNip as string | null ?? null,
    salonLegalAddress: c.salonLegalAddress as string | null ?? null,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.settings.configurationEyebrow')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.settings.general.mainDesc')}
        </p>
      </div>

      <SettingsForm config={fullConfig} />

      {isSuperAdmin && (
        <>
          <hr className="border-border" />
          <SuperAdminCredentials />
        </>
      )}
    </div>
  )
}
