/**
 * The persisted block-config shape is a bare `string[]`
 * (`photoWidgetConfigSchema`/`photoGalleryConfigSchema` in `./blocks.ts`) and
 * stays that way, so dnd-kit tile ids are derived per render, never stored;
 * pure/React-free/Prisma-free, same client-safe contract as `pages-shared.ts`.
 */

/** URL as id; a repeated URL (legal in the persisted shape) gets an occurrence suffix. */
export function derivePhotoIds(photos: string[]): string[] {
  const seen = new Map<string, number>()
  return photos.map((url) => {
    const n = seen.get(url) ?? 0
    seen.set(url, n + 1)
    return n === 0 ? url : `${url}#${n}`
  })
}

/**
 * Maps a reordered id list from `SortableList` back to a reordered photo array.
 * Returns `photos` unchanged on any mismatch: an `undefined` slot would fail
 * `z.array(z.string())` on save, and `parseBlockConfig` then falls back to
 * `defaultConfigFor(type)` — i.e. every photo in the block would be lost.
 */
export function reorderPhotosByIds(photos: string[], ids: string[], orderedIds: string[]): string[] {
  if (orderedIds.length !== ids.length) return photos
  if (new Set(orderedIds).size !== orderedIds.length) return photos
  const next: string[] = []
  for (const id of orderedIds) {
    const index = ids.indexOf(id)
    if (index === -1) return photos
    next.push(photos[index])
  }
  return next
}
