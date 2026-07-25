/**
 * Pure block-type definitions, config schemas, and parsers for the content
 * pages feature (`Page`/`Block` models + the two singleton slot columns).
 * Framework-free (no React, no Prisma, no `next/*`) so both client and server
 * code can import it — same rationale as `src/lib/localized-content.ts`.
 */
import { z } from 'zod'

export const BLOCK_TYPES = ['photoWidget', 'photoGallery', 'text'] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const PHOTO_WIDGET_STYLES = ['strip', 'fade', 'stack'] as const
export type PhotoWidgetStyle = (typeof PHOTO_WIDGET_STYLES)[number]

export const photoWidgetConfigSchema = z.object({
  style: z.enum(PHOTO_WIDGET_STYLES),
  photos: z.array(z.string()),
})
export type PhotoWidgetConfig = z.infer<typeof photoWidgetConfigSchema>

export const photoGalleryConfigSchema = z.object({
  photos: z.array(z.string()),
})
export type PhotoGalleryConfig = z.infer<typeof photoGalleryConfigSchema>

export const textBlockConfigSchema = z.object({
  text_pl: z.string(),
  text_en: z.string().optional(),
  text_uk: z.string().optional(),
})
export type TextBlockConfig = z.infer<typeof textBlockConfigSchema>

export type BlockConfig = PhotoWidgetConfig | PhotoGalleryConfig | TextBlockConfig

function schemaFor(type: BlockType) {
  if (type === 'photoWidget') return photoWidgetConfigSchema
  if (type === 'photoGallery') return photoGalleryConfigSchema
  return textBlockConfigSchema
}

export function defaultConfigFor(type: BlockType): BlockConfig {
  if (type === 'photoWidget') return { style: 'strip', photos: [] }
  if (type === 'photoGallery') return { photos: [] }
  return { text_pl: '' }
}

/**
 * Parses/validates a block's `config` JSON against its type's schema. Never
 * throws — malformed JSON, a wrong shape, or an unknown `type` all fall back
 * to `defaultConfigFor(type)`. `json` may be the raw DB string or an
 * already-parsed value.
 */
export function parseBlockConfig(type: BlockType, json: unknown): BlockConfig {
  try {
    const value = typeof json === 'string' ? JSON.parse(json) : json
    const result = schemaFor(type).safeParse(value)
    if (result.success) return result.data
  } catch {
    // fall through to default below
  }
  return defaultConfigFor(type)
}

export type BlockSlot = { type: BlockType; config: BlockConfig }

/**
 * Parses one of the two singleton slot columns (`TenantConfig.homepageWidgetBlock`,
 * `MasterProfile.footerBlock`), which store the wrapper shape
 * `{"type":"...","config":{...}}`. Returns `null` for `null`/empty/malformed
 * input or an unrecognised `type` — never throws.
 */
export function parseBlockSlot(json: string | null | undefined): BlockSlot | null {
  if (!json) return null
  try {
    const value = JSON.parse(json)
    if (!value || typeof value !== 'object') return null
    const type = value.type
    if (!BLOCK_TYPES.includes(type)) return null
    return { type, config: parseBlockConfig(type, value.config) }
  } catch {
    return null
  }
}

export function serializeBlockSlot(slot: BlockSlot | null): string {
  if (!slot) return ''
  return JSON.stringify(slot)
}
