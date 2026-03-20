import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import MasterServicesClient from "./MasterServicesClient"

export default async function MasterServicesPage() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  const services = await prisma.service.findMany({
    where: {
      OR: [
        { masterId: null },
        { masterId: session.user.id },
      ],
    },
    orderBy: { name: "asc" },
  })

  return <MasterServicesClient services={services} currentMasterId={session.user.id} />
}
