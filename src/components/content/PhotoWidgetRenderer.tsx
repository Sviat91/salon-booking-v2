"use client"

import StripWidget from "./photo-widget/StripWidget"
import FadeWidget from "./photo-widget/FadeWidget"
import StackWidget from "./photo-widget/StackWidget"
import type { PhotoWidgetConfig } from "@/lib/content/blocks"

interface PhotoWidgetRendererProps {
  config: PhotoWidgetConfig
}

/** Switches on `config.style`; renders nothing for an empty `photos` array (AD-7-adjacent). */
export default function PhotoWidgetRenderer({ config }: PhotoWidgetRendererProps) {
  if (!config.photos || config.photos.length === 0) return null

  if (config.style === "fade") return <FadeWidget photos={config.photos} />
  if (config.style === "stack") return <StackWidget photos={config.photos} />
  return <StripWidget photos={config.photos} />
}
