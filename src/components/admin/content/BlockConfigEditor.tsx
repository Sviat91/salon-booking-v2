"use client"

import PhotoWidgetConfigEditor from "./PhotoWidgetConfigEditor"
import PhotoGalleryConfigEditor from "./PhotoGalleryConfigEditor"
import TextBlockConfigEditor from "./TextBlockConfigEditor"
import type {
  BlockConfig,
  BlockType,
  PhotoWidgetConfig,
  PhotoGalleryConfig,
  TextBlockConfig,
} from "@/lib/content/blocks"
import type { Language } from "@/lib/i18n-shared"

interface BlockConfigEditorProps {
  type: BlockType
  config: BlockConfig
  onChange: (config: BlockConfig) => void
  enabledLocales: Language[]
}

/** Thin switch on `type` → the matching per-type config editor. No layout, no save button. */
export default function BlockConfigEditor({ type, config, onChange, enabledLocales }: BlockConfigEditorProps) {
  if (type === "photoWidget") {
    return <PhotoWidgetConfigEditor config={config as PhotoWidgetConfig} onChange={onChange} />
  }
  if (type === "photoGallery") {
    return <PhotoGalleryConfigEditor config={config as PhotoGalleryConfig} onChange={onChange} />
  }
  return (
    <TextBlockConfigEditor
      config={config as TextBlockConfig}
      onChange={onChange}
      enabledLocales={enabledLocales}
    />
  )
}
