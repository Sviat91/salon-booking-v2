import { notFound } from "next/navigation"
import { getPageWithBlocks } from "@/lib/content/pages-server"
import PageRenderer from "@/components/content/PageRenderer"

export const dynamic = "force-dynamic"

interface MasterPublicContentPageProps {
  params: { masterId: string; slug: string }
}

export default async function MasterPublicContentPage({ params }: MasterPublicContentPageProps) {
  const result = await getPageWithBlocks({
    ownerType: "master",
    masterId: params.masterId,
    slug: params.slug,
  })
  if (!result) notFound()

  return (
    <main className="relative flex-1 px-3 py-4 sm:p-6">
      <PageRenderer blocks={result.blocks} masterId={params.masterId} backHref={`/${params.masterId}`} />
    </main>
  )
}
