import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"
import { listDiscountsForOwner, listMasterOfferedServiceIds } from "@/lib/discounts/server"
import DiscountListClient from "@/components/admin/discounts/DiscountListClient"

export default async function MasterDiscountsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  const discounts = await listDiscountsForOwner({ ownerType: "master", masterId: session.user.id })
  const offeredServiceIds = await listMasterOfferedServiceIds(session.user.id)
  const services = await prisma.service.findMany({
    where: { id: { in: [...offeredServiceIds] } },
    orderBy: { name_pl: "asc" },
    select: { id: true, name_pl: true, name_en: true, name_uk: true },
  })

  return (
    <DiscountListClient
      discounts={discounts}
      owner={{ ownerType: "master", masterId: session.user.id }}
      scope="master"
      services={services}
      enabledLocales={enabledLocales}
    />
  )
}
