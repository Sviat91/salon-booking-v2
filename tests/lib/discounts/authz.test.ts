/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

import { canManageDiscount, authorizeDiscountScope } from '@/lib/discounts/server'

const globalDiscount = { masterId: null }
const masterDiscount = (masterId: string) => ({ masterId })

describe('canManageDiscount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ADMIN can manage a global row', () => {
    expect(canManageDiscount({ id: 'a_1', role: 'ADMIN' }, globalDiscount)).toBe(true)
  })

  it('ADMIN can manage any master\'s row', () => {
    expect(canManageDiscount({ id: 'a_1', role: 'ADMIN' }, masterDiscount('m_1'))).toBe(true)
  })

  it('SUPERADMIN can manage a global row', () => {
    expect(canManageDiscount({ id: 'a_1', role: 'SUPERADMIN' }, globalDiscount)).toBe(true)
  })

  it('SUPERADMIN can manage any master\'s row', () => {
    expect(canManageDiscount({ id: 'a_1', role: 'SUPERADMIN' }, masterDiscount('m_1'))).toBe(true)
  })

  it('MASTER can manage only their own row', () => {
    expect(canManageDiscount({ id: 'm_1', role: 'MASTER' }, masterDiscount('m_1'))).toBe(true)
    expect(canManageDiscount({ id: 'm_1', role: 'MASTER' }, masterDiscount('m_2'))).toBe(false)
  })

  it('MASTER cannot manage a global row', () => {
    expect(canManageDiscount({ id: 'm_1', role: 'MASTER' }, globalDiscount)).toBe(false)
  })

  it('CLIENT/null/undefined cannot manage any row', () => {
    expect(canManageDiscount({ id: 'c_1', role: 'CLIENT' }, globalDiscount)).toBe(false)
    expect(canManageDiscount(null, globalDiscount)).toBe(false)
    expect(canManageDiscount(undefined, masterDiscount('m_1'))).toBe(false)
  })

  it('MASTER with no id cannot manage any row', () => {
    expect(canManageDiscount({ role: 'MASTER' }, masterDiscount('m_1'))).toBe(false)
  })
})

describe('authorizeDiscountScope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('MASTER requesting global scope is denied', async () => {
    const result = await authorizeDiscountScope({ id: 'm_1', role: 'MASTER' }, { ownerType: 'global', masterId: null })
    expect(result).toBeNull()
  })

  it('MASTER requesting another master\'s id is denied', async () => {
    const result = await authorizeDiscountScope(
      { id: 'm_1', role: 'MASTER' },
      { ownerType: 'master', masterId: 'm_2' }
    )
    expect(result).toBeNull()
  })

  it('MASTER requesting their own id is authorized with a freshly built scope', async () => {
    const requested = { ownerType: 'master' as const, masterId: 'm_1' }
    const result = await authorizeDiscountScope({ id: 'm_1', role: 'MASTER' }, requested)
    expect(result).toEqual({ ownerType: 'master', masterId: 'm_1' })
    expect(result).not.toBe(requested)
  })

  it('ADMIN requesting global scope is authorized with a freshly built scope', async () => {
    const requested = { ownerType: 'global' as const, masterId: null }
    const result = await authorizeDiscountScope({ id: 'a_1', role: 'ADMIN' }, requested)
    expect(result).toEqual({ ownerType: 'global', masterId: null })
    expect(result).not.toBe(requested)
  })

  it('ADMIN requesting a master scope is denied (AD-8 divergence — no admin-on-behalf surface)', async () => {
    const result = await authorizeDiscountScope(
      { id: 'a_1', role: 'ADMIN' },
      { ownerType: 'master', masterId: 'm_1' }
    )
    expect(result).toBeNull()
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('SUPERADMIN requesting a master scope is denied', async () => {
    const result = await authorizeDiscountScope(
      { id: 'a_1', role: 'SUPERADMIN' },
      { ownerType: 'master', masterId: 'm_1' }
    )
    expect(result).toBeNull()
  })

  it('CLIENT requesting global or master scope is denied', async () => {
    expect(await authorizeDiscountScope({ id: 'c_1', role: 'CLIENT' }, { ownerType: 'global', masterId: null })).toBeNull()
    expect(
      await authorizeDiscountScope({ id: 'c_1', role: 'CLIENT' }, { ownerType: 'master', masterId: 'c_1' })
    ).toBeNull()
  })

  it('anonymous requesting global or master scope is denied', async () => {
    expect(await authorizeDiscountScope(null, { ownerType: 'global', masterId: null })).toBeNull()
    expect(await authorizeDiscountScope(null, { ownerType: 'master', masterId: 'm_1' })).toBeNull()
  })
})
