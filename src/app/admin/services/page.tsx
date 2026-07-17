import prisma from "@/lib/prisma"
import ServicesClient from "./ServicesClient"
import { getServerT } from "@/lib/i18n-server"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"

export default async function ServicesPage() {
  const t = getServerT()
  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  const [services, masterProfiles] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.service.findMany as any)({
      orderBy: { createdAt: "asc" },
      include: {
        masterServices: {
          select: { masterProfileId: true, priceOverride: true },
        },
      },
    }),
    prisma.masterProfile.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        user: { select: { name: true } },
      },
    }),
  ])

  const masters = masterProfiles.map((mp) => ({
    masterProfileId: mp.id,
    name: mp.user?.name ?? t('admin.services.unknownMaster'),
  }))

  return <ServicesClient services={services} masters={masters} enabledLocales={enabledLocales} />
}
