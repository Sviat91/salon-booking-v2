import { describe, it, expect } from 'vitest'
import { derivePhotoIds, reorderPhotosByIds } from '@/lib/content/photo-ids'

describe('derivePhotoIds', () => {
  it('returns an empty array for an empty input', () => {
    expect(derivePhotoIds([])).toEqual([])
  })

  it('returns ids identical to the URLs when all are distinct', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png', '/uploads/c.png']
    expect(derivePhotoIds(photos)).toEqual(photos)
  })

  it('suffixes repeated URLs with an occurrence number', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png', '/uploads/a.png', '/uploads/a.png']
    expect(derivePhotoIds(photos)).toEqual([
      '/uploads/a.png',
      '/uploads/b.png',
      '/uploads/a.png#1',
      '/uploads/a.png#2',
    ])
  })

  it('always returns ids with the same length as the input and no duplicates', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png', '/uploads/a.png', '/uploads/a.png']
    const ids = derivePhotoIds(photos)
    expect(ids.length).toBe(photos.length)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('reorderPhotosByIds', () => {
  it('moves the first id to the end and reorders the photos accordingly', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png', '/uploads/c.png']
    const ids = derivePhotoIds(photos)
    const orderedIds = [ids[1], ids[2], ids[0]]
    expect(reorderPhotosByIds(photos, ids, orderedIds)).toEqual([
      '/uploads/b.png',
      '/uploads/c.png',
      '/uploads/a.png',
    ])
  })

  it('returns the same order when the ids are passed back unchanged', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png', '/uploads/c.png']
    const ids = derivePhotoIds(photos)
    expect(reorderPhotosByIds(photos, ids, ids)).toEqual(photos)
  })

  it('returns photos unchanged when orderedIds has the wrong length', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png']
    const ids = derivePhotoIds(photos)
    expect(reorderPhotosByIds(photos, ids, [ids[0]])).toEqual(photos)
  })

  it('returns photos unchanged when orderedIds contains an unknown id', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png']
    const ids = derivePhotoIds(photos)
    expect(reorderPhotosByIds(photos, ids, [ids[0], '/uploads/unknown.png'])).toEqual(photos)
  })

  it('returns photos unchanged when orderedIds contains the same id twice', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png']
    const ids = derivePhotoIds(photos)
    expect(reorderPhotosByIds(photos, ids, [ids[0], ids[0]])).toEqual(photos)
  })

  it('round-trips a photos array with a duplicate URL through derivePhotoIds + a reorder without losing or duplicating any photo', () => {
    const photos = ['/uploads/a.png', '/uploads/b.png', '/uploads/a.png']
    const ids = derivePhotoIds(photos)
    const orderedIds = [ids[2], ids[0], ids[1]]
    const result = reorderPhotosByIds(photos, ids, orderedIds)
    expect(result.length).toBe(photos.length)
    expect([...result].sort()).toEqual([...photos].sort())
  })
})
