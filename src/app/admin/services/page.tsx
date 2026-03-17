import prisma from "@/lib/prisma"
import ServicesClient from "./ServicesClient"

export default async function ServicesPage() {
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
    name: mp.user?.name ?? "Unknown",
  }))

  return <ServicesClient services={services} masters={masters} />
}
