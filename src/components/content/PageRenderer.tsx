"use client"

import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import BlockRenderer from "./BlockRenderer"
import TopNavLine from "./TopNavLine"

type PageRendererPage = {
  title_pl: string | null
  title_en: string | null
  title_uk: string | null
}

type PageRendererBlock = {
  id: string
  type: string
  config: string
}

interface PageRendererProps {
  page: PageRendererPage
  blocks: PageRendererBlock[]
  masterId?: string
}

/**
 * Renders a content page: the top nav line, the localized title (skipped
 * entirely when it resolves empty — C-3, no locale is required), then the
 * ordered blocks. Layout container matches the rest of the site.
 */
export default function PageRenderer({ page, blocks, masterId }: PageRendererProps) {
  const lang = useCurrentLanguage()
  const title = resolveLocalized({ pl: page.title_pl, en: page.title_en, uk: page.title_uk }, lang)

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <TopNavLine masterId={masterId} className="mb-2" />
      {title && <h1 className="mb-6 mt-8 text-2xl font-semibold text-foreground">{title}</h1>}
      <div className="flex flex-col gap-8 pb-12">
        {blocks.map((block) => (
          <BlockRenderer key={block.id} type={block.type} config={block.config} />
        ))}
      </div>
    </div>
  )
}
