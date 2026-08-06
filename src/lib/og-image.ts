// Helpers for the site-wide OG/Twitter preview card (src/app/opengraph-image.tsx).
// The OG route's module graph is evaluated during metadata generation for
// EVERY page, so nothing here may throw at module scope and no helper may
// throw at all. No top-level `sharp` import.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const OG_SIZE = { width: 1200, height: 630 } as const

/** Box the logo is fitted into, in OG-canvas pixels. */
const LOGO_BOX = { width: 800, height: 340 } as const
/** A crisp small logo beats a blurry stretched one — cap upscaling. */
const LOGO_MAX_UPSCALE = 2
const BRAND_MAX_CHARS = 48
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/
/** Only `/uploads/<safe-name>`: no traversal, no subdirs, no absolute URLs. */
const UPLOAD_URL = /^\/uploads\/[A-Za-z0-9._-]+$/

/** TenantConfig colours are admin-typed free text and end up inside a CSS string. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? ''
  return HEX_COLOR.test(trimmed) ? trimmed : fallback
}

export function truncateBrandName(name: string | null | undefined, fallback: string): string {
  const trimmed = (name ?? '').trim() || fallback
  return trimmed.length > BRAND_MAX_CHARS ? `${trimmed.slice(0, BRAND_MAX_CHARS - 1)}…` : trimmed
}

/** Font-size ladder so a long brand name still fits the 1200×630 canvas. */
export function brandFontSize(name: string): number {
  if (name.length <= 14) return 104
  if (name.length <= 24) return 80
  if (name.length <= 34) return 64
  return 52
}

/** Absolute on-disk path for a `/uploads/...` TenantConfig URL, or null if it isn't one. */
export function resolveUploadPath(url: string | null | undefined): string | null {
  if (!url || !UPLOAD_URL.test(url)) return null
  return path.join(process.cwd(), 'public', url)
}

export type OgLogo = { dataUrl: string; width: number; height: number }

/**
 * Normalises the uploaded logo to a PNG data URL sized for the OG canvas.
 * Returns null on ANY failure (file deleted, corrupt, WebP/AVIF that satori
 * rejects, sharp native binding unavailable) so the caller falls back to the
 * text card instead of 500-ing the route.
 */
export async function loadOgLogo(diskPath: string): Promise<OgLogo | null> {
  try {
    const source = await readFile(diskPath)
    // Lazy so a broken sharp install can never break module evaluation —
    // this module is imported while resolving metadata for every page.
    const { default: sharp } = await import('sharp')
    // `density` only affects vector input: rasterise SVG at 300dpi so a
    // small viewBox still yields a crisp bitmap.
    const image = sharp(source, { density: 300 })
    const meta = await image.metadata()
    const intrinsicWidth = meta.width ?? LOGO_BOX.width
    const intrinsicHeight = meta.height ?? LOGO_BOX.height
    const scale = Math.min(
      LOGO_BOX.width / intrinsicWidth,
      LOGO_BOX.height / intrinsicHeight,
      LOGO_MAX_UPSCALE,
    )
    const { data, info } = await image
      .resize({
        width: Math.max(1, Math.round(intrinsicWidth * scale)),
        height: Math.max(1, Math.round(intrinsicHeight * scale)),
        fit: 'inside',
      })
      .png()
      .toBuffer({ resolveWithObject: true })
    return {
      dataUrl: `data:image/png;base64,${data.toString('base64')}`,
      width: info.width,
      height: info.height,
    }
  } catch (err) {
    console.warn('[opengraph-image] logo unavailable, falling back to text card:', err)
    return null
  }
}
