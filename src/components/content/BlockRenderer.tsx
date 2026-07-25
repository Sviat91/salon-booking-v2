"use client"

import PhotoWidgetRenderer from "./PhotoWidgetRenderer"
import PhotoGalleryRenderer from "./PhotoGalleryRenderer"
import TextBlockRenderer from "./TextBlockRenderer"
import {
  BLOCK_TYPES,
  parseBlockConfig,
  type BlockType,
  type PhotoWidgetConfig,
  type PhotoGalleryConfig,
  type TextBlockConfig,
} from "@/lib/content/blocks"

interface BlockRendererProps {
  type: string
  /**
   * Either the raw DB `Block.config` JSON string (page blocks, via
   * `PageRenderer`) or an already-parsed `BlockConfig` object (the two
   * singleton slots, via `parseBlockSlot` in `TopNavLine`/`MasterFooterBlock`
   * consumers) — `parseBlockConfig` accepts both.
   */
  config: unknown
}

/** `parseBlockConfig` then switch to the matching renderer; unknown type ⇒ null. */
export default function BlockRenderer({ type, config }: BlockRendererProps) {
  if (!BLOCK_TYPES.includes(type as BlockType)) return null
  const blockType = type as BlockType
  const parsedConfig = parseBlockConfig(blockType, config)

  if (blockType === "photoWidget") return <PhotoWidgetRenderer config={parsedConfig as PhotoWidgetConfig} />
  if (blockType === "photoGallery") return <PhotoGalleryRenderer config={parsedConfig as PhotoGalleryConfig} />
  return <TextBlockRenderer config={parsedConfig as TextBlockConfig} />
}
