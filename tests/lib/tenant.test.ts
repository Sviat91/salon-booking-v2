/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tenantConfig: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

vi.mock('next/cache', () => ({
  unstable_noStore: vi.fn(),
}))

const { mockCache } = vi.hoisted(() => ({
  mockCache: {
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
    cacheDel: vi.fn(),
  },
}))

vi.mock('@/lib/cache', () => mockCache)

import { getTenantConfig, invalidateTenantConfigCache } from '@/lib/tenant'

describe('getTenantConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the cached value as-is and never hits the DB on a cache hit', async () => {
    const cached = { brandName: 'Cached Salon' }
    mockCache.cacheGet.mockResolvedValue(cached)

    const result = await getTenantConfig()

    expect(result).toBe(cached)
    expect(mockPrisma.tenantConfig.findFirst).not.toHaveBeenCalled()
  })

  it('queries the DB, caches the row with a 30s TTL, and returns it on a cache miss with an existing row', async () => {
    mockCache.cacheGet.mockResolvedValue(null)
    const dbRow = { brandName: 'DB Salon' }
    mockPrisma.tenantConfig.findFirst.mockResolvedValue(dbRow)

    const result = await getTenantConfig()

    expect(mockPrisma.tenantConfig.findFirst).toHaveBeenCalledTimes(1)
    expect(mockCache.cacheSet).toHaveBeenCalledWith('tenant:config', dbRow, 30)
    expect(result).toBe(dbRow)
  })

  it('auto-seeds a default config, caches it, and returns it when no row exists', async () => {
    mockCache.cacheGet.mockResolvedValue(null)
    mockPrisma.tenantConfig.findFirst.mockResolvedValue(null)
    const newRow = { brandName: 'Default Salon' }
    mockPrisma.tenantConfig.create.mockResolvedValue(newRow)

    const result = await getTenantConfig()

    expect(mockPrisma.tenantConfig.create).toHaveBeenCalledTimes(1)
    expect(mockCache.cacheSet).toHaveBeenCalledWith('tenant:config', newRow, 30)
    expect(result).toBe(newRow)
  })

  it('falls back to DEFAULT_CONFIG without caching it when the DB is unavailable', async () => {
    mockCache.cacheGet.mockResolvedValue(null)
    mockPrisma.tenantConfig.findFirst.mockRejectedValue(new Error('db down'))
    mockPrisma.tenantConfig.create.mockRejectedValue(new Error('db down'))

    const result = await getTenantConfig()

    expect(mockCache.cacheSet).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      brandName: expect.any(String),
      primaryColor: '#FFF0F1',
    })
  })
})

describe('invalidateTenantConfigCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cacheDel with the tenant config cache key', async () => {
    await invalidateTenantConfigCache()

    expect(mockCache.cacheDel).toHaveBeenCalledTimes(1)
    expect(mockCache.cacheDel).toHaveBeenCalledWith('tenant:config')
  })
})
