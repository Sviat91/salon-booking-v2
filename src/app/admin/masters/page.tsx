import prisma from "@/lib/prisma"
import MastersClient from "./MastersClient"

export default async function MastersPage() {
  const masters = await prisma.user.findMany({
    where: { role: "MASTER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      masterProfile: { select: { bio: true } },
    },
  })

  return <MastersClient masters={masters} />
}
