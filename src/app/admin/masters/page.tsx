import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import MastersClient from "./MastersClient"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"

// Type pending Prisma client regeneration after db push
type MasterWithProfile = {
  id: string
  name: string | null
  email: string | null
  masterProfile: {
    bio_pl: string | null
    bio_en: string | null
    bio_uk: string | null
    avatarUrl: string | null
    showOnHomepage: boolean
    color: string | null
    footerBlock: string | null
  } | null
}

export default async function MastersPage() {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    redirect("/auth/login")
  }

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masters = await (prisma.user.findMany as any)({
    where: { role: "MASTER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      masterProfile: {
        select: { bio_pl: true, bio_en: true, bio_uk: true, avatarUrl: true, showOnHomepage: true, color: true, footerBlock: true },
      },
    },
  }) as MasterWithProfile[]

  return <MastersClient masters={masters} enabledLocales={enabledLocales} />
}
