import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { getTenantConfig } from "@/lib/tenant"
import { parseEnabledLocales } from "@/lib/localized-content"
import PageBlocksEditor from "@/components/admin/content/PageBlocksEditor"

interface AdminPageDetailProps {
  params: { id: string }
}

export default async function AdminPageDetail({ params }: AdminPageDetailProps) {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    redirect("/auth/login")
  }

  const page = await prisma.page.findUnique({
    where: { id: params.id },
    include: { blocks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  })
  if (!page || page.ownerType !== "global" || page.masterId !== null) notFound()

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/pages"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('admin.pages.backToPages')}
        </Link>
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-primary">
          {t('admin.pages.blocksEyebrow')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.pages.publicUrlLabel')}: <code className="text-foreground">/pages/{page.slug}</code>
        </p>
      </div>

      <PageBlocksEditor pageId={page.id} blocks={page.blocks} enabledLocales={enabledLocales} />
    </div>
  )
}
