"use client"

import BlockRenderer from "./BlockRenderer"
import TopNavLine from "./TopNavLine"
import LanguageToggle from "@/components/LanguageToggle"
import ThemeToggle from "@/components/ThemeToggle"

type PageRendererBlock = {
  id: string
  type: string
  config: string
}

interface PageRendererProps {
  blocks: PageRendererBlock[]
  masterId?: string
}

/**
 * Renders a content page: the top nav line, then the ordered blocks. The
 * page title isn't repeated here — it's already shown as the active tab in
 * the nav line above (2026-07-26). Nav bar + layout container match the
 * homepage/master booking page (AD-6) — same reserved leading space, same
 * icon cluster. Expects to be mounted directly inside a `relative`-positioned
 * parent (the page route's `<main>`), same as `[masterId]/page.tsx`.
 */
export default function PageRenderer({ blocks, masterId }: PageRendererProps) {
  return (
    <>
      <div className="absolute top-2 left-0 right-0 z-20 pl-28 sm:pl-32">
        <TopNavLine
          masterId={masterId}
          leadingSpaceClassName="pl-48"
          actions={
            <>
              <LanguageToggle />
              <ThemeToggle />
            </>
          }
        />
      </div>
      <div className="mx-auto w-full max-w-5xl px-4 pt-12">
        <div className="flex flex-col gap-8 pt-8 pb-12">
          {blocks.map((block) => (
            <BlockRenderer key={block.id} type={block.type} config={block.config} />
          ))}
        </div>
      </div>
    </>
  )
}
