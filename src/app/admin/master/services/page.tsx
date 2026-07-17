import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import MasterServicesClient from "./MasterServicesClient"

export default async function MasterServicesPage() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  const masterProfile = await prisma.masterProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  const services = await prisma.service.findMany({
    where: {
      OR: [
        { masterId: null },
        { masterId: session.user.id },
      ],
    },
    include: {
      masterServices: masterProfile
        ? {
            where: { masterProfileId: masterProfile.id },
            select: { masterProfileId: true, priceOverride: true },
          }
        : undefined,
    },
    orderBy: { name_pl: "asc" },
  })

  return <MasterServicesClient services={services} currentMasterId={session.user.id} />
}
