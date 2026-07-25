"use client"

import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import type { TextBlockConfig } from "@/lib/content/blocks"

interface TextBlockRendererProps {
  config: TextBlockConfig
}

/**
 * Localized plain-text block, line breaks preserved. Per C-3, `text_pl` is
 * optional — never dereferenced directly; `resolveLocalized` already handles
 * `undefined` fields, and an empty resolved result renders nothing.
 */
export default function TextBlockRenderer({ config }: TextBlockRendererProps) {
  const lang = useCurrentLanguage()
  const text = resolveLocalized({ pl: config.text_pl, en: config.text_en, uk: config.text_uk }, lang)

  if (!text) return null

  return <p className="whitespace-pre-line leading-relaxed text-foreground">{text}</p>
}
