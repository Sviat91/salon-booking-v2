import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"
import { listPagesForOwner } from "@/lib/content/pages-server"
import PageListClient from "@/components/admin/content/PageListClient"
import MasterFooterBlockSection from "./MasterFooterBlockSection"

export default async function MasterPagesPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  const pages = await listPagesForOwner({ ownerType: "master", masterId: session.user.id })
  const masterProfile = await prisma.masterProfile.findUnique({
    where: { userId: session.user.id },
    select: { footerBlock: true },
  })

  return (
    <div className="flex flex-col gap-8">
      <MasterFooterBlockSection value={masterProfile?.footerBlock ?? null} enabledLocales={enabledLocales} />
      <PageListClient
        pages={pages}
        scope="master"
        enabledLocales={enabledLocales}
        detailHrefBase="/admin/master/pages"
      />
    </div>
  )
}
