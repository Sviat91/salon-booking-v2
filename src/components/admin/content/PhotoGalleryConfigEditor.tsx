"use client"

import PhotoListEditor from "./PhotoListEditor"
import type { PhotoGalleryConfig } from "@/lib/content/blocks"

interface PhotoGalleryConfigEditorProps {
  config: PhotoGalleryConfig
  onChange: (config: PhotoGalleryConfig) => void
}

export default function PhotoGalleryConfigEditor({ config, onChange }: PhotoGalleryConfigEditorProps) {
  return <PhotoListEditor photos={config.photos} onChange={(photos) => onChange({ photos })} />
}
