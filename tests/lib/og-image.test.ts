import { describe, it, expect, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import {
  safeColor,
  truncateBrandName,
  brandFontSize,
  resolveUploadPath,
  loadOgLogo,
} from '@/lib/og-image'

describe('safeColor', () => {
  it.each(['#fff', '#FFF0F1', '#FFF0F1AA', '  #abc  '])('accepts %s', (value) => {
    expect(safeColor(value, 'fallback')).toBe(value.trim())
  })

  it.each(['red', 'rgb(0,0,0)', '#12', '', null, undefined, '#fff; background: url(x)'])(
    'falls back for %s',
    (value) => {
      expect(safeColor(value, 'fallback')).toBe('fallback')
    },
  )
})

describe('truncateBrandName', () => {
  it.each([null, '', '   '])('returns the fallback for %s', (value) => {
    expect(truncateBrandName(value, 'fallback')).toBe('fallback')
  })

  it('leaves a 48-char name unchanged', () => {
    const name = 'a'.repeat(48)
    expect(truncateBrandName(name, 'fallback')).toBe(name)
  })

  it('truncates a 60-char name to 48 chars ending with an ellipsis', () => {
    const name = 'a'.repeat(60)
    const result = truncateBrandName(name, 'fallback')
    expect(result.length).toBe(48)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('brandFontSize', () => {
  it.each([
    [14, 104],
    [15, 80],
    [24, 80],
    [25, 64],
    [34, 64],
    [35, 52],
  ])('returns %i for a name of length %i', (length, expected) => {
    expect(brandFontSize('a'.repeat(length))).toBe(expected)
  })
})

describe('resolveUploadPath', () => {
  it('resolves a valid /uploads/ URL to an absolute path under public/uploads', () => {
    const result = resolveUploadPath('/uploads/1700000000-ab12cd.png')
    expect(result).not.toBeNull()
    expect(path.isAbsolute(result!)).toBe(true)
    expect(result!.endsWith(path.join('public', 'uploads', '1700000000-ab12cd.png'))).toBe(true)
  })

  it.each([
    null,
    '',
    'uploads/a.png',
    '/uploads/',
    '/uploads/../../etc/passwd',
    '/uploads/sub/a.png',
    'https://evil.test/uploads/a.png',
    '/public/uploads/a.png',
  ])('returns null for %s', (value) => {
    expect(resolveUploadPath(value)).toBeNull()
  })
})

describe('loadOgLogo', () => {
  const tempDirs: string[] = []

  afterAll(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('returns null for a path that does not exist', async () => {
    const result = await loadOgLogo('/nonexistent/path/does-not-exist.png')
    expect(result).toBeNull()
  })

  it('returns null for non-image bytes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'og-'))
    tempDirs.push(dir)
    const filePath = path.join(dir, 'not-an-image.png')
    await writeFile(filePath, Buffer.from('this is not an image'))

    const result = await loadOgLogo(filePath)
    expect(result).toBeNull()
  })

  it("succeeds for a WebP input — sharp decodes it; satori's rejection happens downstream in ImageResponse, not in loadOgLogo", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'og-'))
    tempDirs.push(dir)
    const filePath = path.join(dir, 'logo.webp')
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 4, background: '#00ff00' },
    })
      .webp()
      .toBuffer()
    await writeFile(filePath, buffer)

    const result = await loadOgLogo(filePath)
    // sharp itself can decode WebP, so loadOgLogo succeeds at the sharp layer;
    // the WebP-rejection happens downstream in satori's <img> renderer, which
    // is exercised by the route (ImageResponse), not this pure helper.
    expect(result).not.toBeNull()
  })

  it('upscales a tiny logo up to the 2x clamp', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'og-'))
    tempDirs.push(dir)
    const filePath = path.join(dir, 'tiny.png')
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 4, background: '#ff0000' },
    })
      .png()
      .toBuffer()
    await writeFile(filePath, buffer)

    const result = await loadOgLogo(filePath)
    expect(result).not.toBeNull()
    expect(result!.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(result!.width).toBe(2)
    expect(result!.height).toBe(2)
  })

  it('fits a wide logo into the 800x340 box', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'og-'))
    tempDirs.push(dir)
    const filePath = path.join(dir, 'wide.png')
    const buffer = await sharp({
      create: { width: 1600, height: 400, channels: 4, background: '#ff0000' },
    })
      .png()
      .toBuffer()
    await writeFile(filePath, buffer)

    const result = await loadOgLogo(filePath)
    expect(result).not.toBeNull()
    expect(result!.width).toBe(800)
    expect(result!.height).toBe(200)
  })
})
