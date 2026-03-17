import prisma from "@/lib/prisma"
import MastersClient from "./MastersClient"

// Type pending Prisma client regeneration after db push
type MasterWithProfile = {
  id: string
  name: string | null
  email: string | null
  masterProfile: {
    bio: string | null
    avatarUrl: string | null
    showOnHomepage: boolean
  } | null
}

export default async function MastersPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masters = await (prisma.user.findMany as any)({
    where: { role: "MASTER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      masterProfile: {
        select: { bio: true, avatarUrl: true, showOnHomepage: true },
      },
    },
  }) as MasterWithProfile[]

  return <MastersClient masters={masters} />
}
