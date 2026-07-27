import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"
import { listPagesForOwner } from "@/lib/content/pages-server"
import PageListClient from "@/components/admin/content/PageListClient"

interface AdminMasterPagesProps {
  params: { masterId: string }
}

export default async function AdminMasterPagesPage({ params }: AdminMasterPagesProps) {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    redirect("/auth/login")
  }

  const master = await prisma.user.findUnique({
    where: { id: params.masterId },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!master || master.role !== "MASTER") notFound()

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  const pages = await listPagesForOwner({ ownerType: "master", masterId: master.id })

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/masters"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('admin.pages.backToMasters')}
      </Link>

      <PageListClient
        pages={pages}
        owner={{ ownerType: "master", masterId: master.id }}
        scope="master-as-admin"
        masterName={master.name?.trim() || master.email || master.id}
        enabledLocales={enabledLocales}
        detailHrefBase={`/admin/masters/${master.id}/pages`}
      />
    </div>
  )
}
