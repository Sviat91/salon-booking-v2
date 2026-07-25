import { notFound } from "next/navigation"
import { getPageWithBlocks } from "@/lib/content/pages-server"
import PageRenderer from "@/components/content/PageRenderer"
import BackButton from "@/components/BackButton"
import LanguageToggle from "@/components/LanguageToggle"
import ThemeToggle from "@/components/ThemeToggle"

export const dynamic = "force-dynamic"

interface PublicContentPageProps {
  params: { slug: string }
}

export default async function PublicContentPage({ params }: PublicContentPageProps) {
  const result = await getPageWithBlocks({ ownerType: "global", masterId: null, slug: params.slug })
  if (!result) notFound()

  return (
    <main className="relative min-h-screen px-3 py-4 sm:p-6">
      <BackButton />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <PageRenderer page={result.page} blocks={result.blocks} />
    </main>
  )
}
