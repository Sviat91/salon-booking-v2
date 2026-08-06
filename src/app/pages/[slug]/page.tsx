import { notFound } from "next/navigation"
import { getPageWithBlocks } from "@/lib/content/pages-server"
import PageRenderer from "@/components/content/PageRenderer"

export const dynamic = "force-dynamic"

interface PublicContentPageProps {
  params: { slug: string }
}

export default async function PublicContentPage({ params }: PublicContentPageProps) {
  const result = await getPageWithBlocks({ ownerType: "global", masterId: null, slug: params.slug })
  if (!result) notFound()

  return (
    <main className="relative flex-1 px-3 py-4 sm:p-6">
      <PageRenderer blocks={result.blocks} backHref="/" />
    </main>
  )
}
