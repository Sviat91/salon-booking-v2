import { getTenantConfig } from "@/lib/tenant"
import SettingsForm from "./SettingsForm"

export default async function SettingsPage() {
  const config = await getTenantConfig()
  // Ensure faviconUrl is available (added via db push, may be missing from old cached types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullConfig = { ...config, faviconUrl: (config as any).faviconUrl ?? null }

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
