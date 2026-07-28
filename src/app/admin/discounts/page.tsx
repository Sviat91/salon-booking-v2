import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"
import { listDiscountsForOwner } from "@/lib/discounts/server"
import DiscountListClient from "@/components/admin/discounts/DiscountListClient"

export default async function AdminDiscountsPage() {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    redirect("/auth/login")
  }

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  const discounts = await listDiscountsForOwner({ ownerType: "global", masterId: null })
  const services = await prisma.service.findMany({
    orderBy: { name_pl: "asc" },
    select: { id: true, name_pl: true, name_en: true, name_uk: true },
  })

  return (
    <DiscountListClient
      discounts={discounts}
      owner={{ ownerType: "global", masterId: null }}
      scope="global"
      services={services}
      enabledLocales={enabledLocales}
    />
  )
}
