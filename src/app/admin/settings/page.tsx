import { getTenantConfig } from "@/lib/tenant"
import SettingsForm from "./SettingsForm"

export default async function SettingsPage() {
  const config = await getTenantConfig()
  // Provide defaults for any missing fields (schema evolution)
  const c = config as Record<string, unknown>
  const fullConfig = {
    ...config,
    cardColor: c.cardColor as string || "#FFFFFF",
    darkPrimaryColor: c.darkPrimaryColor as string || config.primaryColor,
    darkAccentColor: c.darkAccentColor as string || config.accentColor,
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
