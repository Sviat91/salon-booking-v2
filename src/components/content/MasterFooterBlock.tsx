"use client"

import { useQuery } from "@tanstack/react-query"
import BlockRenderer from "./BlockRenderer"
import type { ContentResponse } from "./TopNavLine"

interface MasterFooterBlockProps {
  masterId: string
}

/** Reads the same `['content-nav', masterId]` query key as `TopNavLine` — costs no extra request. */
export default function MasterFooterBlock({ masterId }: MasterFooterBlockProps) {
  const { data } = useQuery<ContentResponse>({
    queryKey: ["content-nav", masterId ?? "home"],
    queryFn: () => fetch(`/api/content?masterId=${masterId}`).then((r) => r.json() as Promise<ContentResponse>),
    staleTime: 60_000,
  })

  if (!data?.footerBlock) return null

  return <BlockRenderer type={data.footerBlock.type} config={data.footerBlock.config} />
}
