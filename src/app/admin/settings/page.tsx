import prisma from "@/lib/prisma"
import SettingsForm from "./SettingsForm"

const defaults = {
  brandName: "Somique Beauty",
  primaryColor: "#FDE5C3",
  secondaryColor: "#FFF6E9",
  accentColor: "#FFBBBD",
  textColor: "#2B2B2B",
  mutedColor: "#6B6B6B",
}

export default async function SettingsPage() {
  const config = await prisma.tenantConfig.findFirst()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salon Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize your salon&apos;s name and brand colors.
        </p>
      </div>

      <SettingsForm config={config ?? defaults} />
    </div>
  )
}
