/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

import { canManagePage, authorizePageOwner } from '@/lib/content/pages-server'

const globalPage = { ownerType: 'global', masterId: null }
const masterPage = (masterId: string) => ({ ownerType: 'master', masterId })

describe('canManagePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ADMIN can manage a global row', () => {
    expect(canManagePage({ id: 'a_1', role: 'ADMIN' }, globalPage)).toBe(true)
  })

  it('ADMIN can manage another master\'s row', () => {
    expect(canManagePage({ id: 'a_1', role: 'ADMIN' }, masterPage('m_1'))).toBe(true)
  })

  it('SUPERADMIN can manage a global row', () => {
    expect(canManagePage({ id: 'a_1', role: 'SUPERADMIN' }, globalPage)).toBe(true)
  })

  it('SUPERADMIN can manage another master\'s row', () => {
    expect(canManagePage({ id: 'a_1', role: 'SUPERADMIN' }, masterPage('m_1'))).toBe(true)
  })

  it('MASTER can manage their own row', () => {
    expect(canManagePage({ id: 'm_1', role: 'MASTER' }, masterPage('m_1'))).toBe(true)
  })

  it('MASTER cannot manage another master\'s row', () => {
    expect(canManagePage({ id: 'm_1', role: 'MASTER' }, masterPage('m_2'))).toBe(false)
  })

  it('MASTER cannot manage a global row', () => {
    expect(canManagePage({ id: 'm_1', role: 'MASTER' }, globalPage)).toBe(false)
  })

  it('CLIENT cannot manage any row', () => {
    expect(canManagePage({ id: 'c_1', role: 'CLIENT' }, globalPage)).toBe(false)
    expect(canManagePage({ id: 'c_1', role: 'CLIENT' }, masterPage('m_1'))).toBe(false)
  })

  it('null/undefined user cannot manage any row', () => {
    expect(canManagePage(null, globalPage)).toBe(false)
    expect(canManagePage(undefined, globalPage)).toBe(false)
  })

  it('MASTER with no id cannot manage any row', () => {
    expect(canManagePage({ role: 'MASTER' }, masterPage('m_1'))).toBe(false)
  })
})

describe('authorizePageOwner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('MASTER requesting global scope is denied', async () => {
    const result = await authorizePageOwner({ id: 'm_1', role: 'MASTER' }, { ownerType: 'global', masterId: null })
    expect(result).toBeNull()
  })

  it('MASTER requesting another master\'s id is denied without a DB call', async () => {
    const result = await authorizePageOwner(
      { id: 'm_1', role: 'MASTER' },
      { ownerType: 'master', masterId: 'm_2' }
    )
    expect(result).toBeNull()
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('MASTER requesting their own id is authorized', async () => {
    const result = await authorizePageOwner(
      { id: 'm_1', role: 'MASTER' },
      { ownerType: 'master', masterId: 'm_1' }
    )
    expect(result).toEqual({ ownerType: 'master', masterId: 'm_1' })
  })

  it('ADMIN requesting global scope is authorized', async () => {
    const result = await authorizePageOwner({ id: 'a_1', role: 'ADMIN' }, { ownerType: 'global', masterId: null })
    expect(result).toEqual({ ownerType: 'global', masterId: null })
  })

  it('ADMIN requesting a MASTER target is authorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'MASTER' })
    const result = await authorizePageOwner(
      { id: 'a_1', role: 'ADMIN' },
      { ownerType: 'master', masterId: 'm_1' }
    )
    expect(result).toEqual({ ownerType: 'master', masterId: 'm_1' })
  })

  it('ADMIN requesting a target that resolves to null is denied', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await authorizePageOwner(
      { id: 'a_1', role: 'ADMIN' },
      { ownerType: 'master', masterId: 'missing' }
    )
    expect(result).toBeNull()
  })

  it('ADMIN requesting a CLIENT target is denied', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'CLIENT' })
    const result = await authorizePageOwner(
      { id: 'a_1', role: 'ADMIN' },
      { ownerType: 'master', masterId: 'c_1' }
    )
    expect(result).toBeNull()
  })

  it('ADMIN requesting an ADMIN target is denied', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' })
    const result = await authorizePageOwner(
      { id: 'a_1', role: 'ADMIN' },
      { ownerType: 'master', masterId: 'a_2' }
    )
    expect(result).toBeNull()
  })

  it('CLIENT requesting global scope is denied', async () => {
    const result = await authorizePageOwner({ id: 'c_1', role: 'CLIENT' }, { ownerType: 'global', masterId: null })
    expect(result).toBeNull()
  })

  it('CLIENT requesting a master scope is denied', async () => {
    const result = await authorizePageOwner(
      { id: 'c_1', role: 'CLIENT' },
      { ownerType: 'master', masterId: 'c_1' }
    )
    expect(result).toBeNull()
  })

  it('anonymous requesting global scope is denied', async () => {
    const result = await authorizePageOwner(null, { ownerType: 'global', masterId: null })
    expect(result).toBeNull()
  })

  it('anonymous requesting a master scope is denied', async () => {
    const result = await authorizePageOwner(null, { ownerType: 'master', masterId: 'm_1' })
    expect(result).toBeNull()
  })
})
