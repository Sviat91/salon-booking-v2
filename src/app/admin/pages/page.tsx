import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"
import { listPagesForOwner } from "@/lib/content/pages-server"
import PageListClient from "@/components/admin/content/PageListClient"

export default async function AdminPagesPage() {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    redirect("/auth/login")
  }

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  const pages = await listPagesForOwner({ ownerType: "global", masterId: null })

  return (
    <PageListClient
      pages={pages}
      owner={{ ownerType: "global", masterId: null }}
      scope="global"
      enabledLocales={enabledLocales}
      detailHrefBase="/admin/pages"
    />
  )
}
