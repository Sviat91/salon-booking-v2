import { notFound } from "next/navigation"
import { getPageWithBlocks } from "@/lib/content/pages-server"
import PageRenderer from "@/components/content/PageRenderer"
import BackButton from "@/components/BackButton"
import LanguageToggle from "@/components/LanguageToggle"
import ThemeToggle from "@/components/ThemeToggle"

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
    <main className="relative min-h-screen px-3 py-4 sm:p-6">
      <BackButton href={`/${params.masterId}`} />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <PageRenderer page={result.page} blocks={result.blocks} masterId={params.masterId} />
    </main>
  )
}
