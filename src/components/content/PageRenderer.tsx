"use client"

import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import BlockRenderer from "./BlockRenderer"

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
  /**
   * Accepted now for the public master-page route's call shape; the top nav
   * line (Step 20, Stage 5) is mounted here once `TopNavLine` exists — it
   * doesn't yet at this point in the plan, so Stage 4 ships without it.
   */
  masterId?: string
}

/**
 * Renders a content page: localized title (skipped entirely when it
 * resolves empty — C-3, no locale is required) + ordered blocks. Layout
 * container matches the rest of the site.
 */
export default function PageRenderer({ page, blocks }: PageRendererProps) {
  const lang = useCurrentLanguage()
  const title = resolveLocalized({ pl: page.title_pl, en: page.title_en, uk: page.title_uk }, lang)

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      {title && <h1 className="mb-6 mt-8 text-2xl font-semibold text-foreground">{title}</h1>}
      <div className="flex flex-col gap-8 pb-12">
        {blocks.map((block) => (
          <BlockRenderer key={block.id} type={block.type} config={block.config} />
        ))}
      </div>
    </div>
  )
}
