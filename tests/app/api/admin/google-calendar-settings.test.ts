import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth, mockPrisma, mockSetCalendarId, mockBackfill } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    tenantConfig: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() },
    masterProfile: { findUnique: vi.fn(), findMany: vi.fn() },
  },
  mockSetCalendarId: vi.fn(),
  mockBackfill: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/encryption', () => ({ encrypt: (v: string) => `enc:${v}` }))
vi.mock('@/lib/tenant', () => ({ invalidateTenantConfigCache: vi.fn() }))
vi.mock('@/lib/google-calendar/auth', () => ({ resetAccessTokenCache: vi.fn() }))
vi.mock('@/lib/google-calendar/outbox', () => ({ enqueueBackfillForMaster: mockBackfill }))
vi.mock('@/lib/google-calendar/connect', () => ({ setMasterCalendarId: mockSetCalendarId }))

import { GET, PATCH } from '../../../../src/app/api/admin/google-calendar-settings/route'
import { PUT as masterPut } from '../../../../src/app/api/master/google-calendar/route'
import { PUT as adminMasterPut } from '../../../../src/app/api/admin/masters/[masterId]/google-calendar/route'

function req(body: unknown) {
  return new Request('http://localhost/api', { method: 'PUT', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockBackfill.mockResolvedValue({ queued: 0 })
})

describe('google-calendar-settings GET', () => {
  it('never returns the service-account key, only hasKey', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a', role: 'ADMIN' } })
    mockPrisma.tenantConfig.findFirst.mockResolvedValue({
      googleCalendarEnabled: true,
      googleServiceAccountEmail: 'sa@p.iam.gserviceaccount.com',
      googleServiceAccountKey: 'SUPER-SECRET-ENCRYPTED',
    })
    mockPrisma.user.findMany.mockResolvedValue([])
    const res = await GET()
    const text = await res.text()
    expect(text).not.toContain('SUPER-SECRET')
    expect(JSON.parse(text)).toMatchObject({ hasKey: true, googleCalendarEnabled: true })
    expect(JSON.parse(text)).not.toHaveProperty('serviceAccountKey')
  })

  it.each([null, { user: { id: 'c', role: 'CLIENT' } }, { user: { id: 'm', role: 'MASTER' } }])(
    'rejects non-admin session %j',
    async (session) => {
      mockAuth.mockResolvedValue(session)
      const res = await GET()
      expect(res.status).toBe(401)
      expect(mockPrisma.tenantConfig.findFirst).not.toHaveBeenCalled()
    },
  )
})

describe('google-calendar-settings PATCH backfill', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'a', role: 'ADMIN' } })
    mockPrisma.masterProfile.findMany.mockResolvedValue([{ userId: 'm1' }, { userId: 'm2' }])
  })

  it('rejects non-admins', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'm', role: 'MASTER' } })
    const res = await PATCH(req({ googleCalendarEnabled: true }))
    expect(res.status).toBe(401)
    expect(mockPrisma.tenantConfig.update).not.toHaveBeenCalled()
  })

  it('backfills every connected master on a false -> true transition', async () => {
    mockPrisma.tenantConfig.findFirst.mockResolvedValue({ id: 'c', googleCalendarEnabled: false })
    const res = await PATCH(req({ googleCalendarEnabled: true }))
    expect(res.status).toBe(200)
    await vi.waitFor(() => expect(mockBackfill).toHaveBeenCalledTimes(2))
    expect(mockPrisma.masterProfile.findMany).toHaveBeenCalledWith({
      where: { googleCalendarId: { not: null } },
      select: { userId: true },
    })
    expect(mockBackfill).toHaveBeenCalledWith('m1')
    expect(mockBackfill).toHaveBeenCalledWith('m2')
  })

  it('does not backfill when already enabled or when disabling', async () => {
    mockPrisma.tenantConfig.findFirst.mockResolvedValue({ id: 'c', googleCalendarEnabled: true })
    await PATCH(req({ googleCalendarEnabled: true }))
    mockPrisma.tenantConfig.findFirst.mockResolvedValue({ id: 'c', googleCalendarEnabled: true })
    await PATCH(req({ googleCalendarEnabled: false }))
    expect(mockPrisma.masterProfile.findMany).not.toHaveBeenCalled()
    expect(mockBackfill).not.toHaveBeenCalled()
  })
})

describe('master calendar PUT routes', () => {
  it('master route always uses the session id, never a body masterId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me', role: 'MASTER' } })
    mockSetCalendarId.mockResolvedValue({ ok: true, queued: 0 })
    const res = await masterPut(req({ calendarId: 'x@y.com', masterId: 'someone-else' }))
    expect(res.status).toBe(200)
    expect(mockSetCalendarId).toHaveBeenCalledWith('me', 'x@y.com')
  })

  it('master route rejects non-masters', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a', role: 'ADMIN' } })
    const res = await masterPut(req({ calendarId: 'x@y.com' }))
    expect(res.status).toBe(401)
    expect(mockSetCalendarId).not.toHaveBeenCalled()
  })

  it('maps CALENDAR_ID_IN_USE to 409 on both PUT surfaces', async () => {
    mockSetCalendarId.mockResolvedValue({ ok: false, code: 'CALENDAR_ID_IN_USE' })
    mockAuth.mockResolvedValue({ user: { id: 'me', role: 'MASTER' } })
    const r1 = await masterPut(req({ calendarId: 'x@y.com' }))
    expect(r1.status).toBe(409)
    expect((await r1.json()).code).toBe('CALENDAR_ID_IN_USE')

    mockAuth.mockResolvedValue({ user: { id: 'a', role: 'ADMIN' } })
    const r2 = await adminMasterPut(req({ calendarId: 'x@y.com' }), { params: { masterId: 'm9' } })
    expect(r2.status).toBe(409)
    expect(mockSetCalendarId).toHaveBeenLastCalledWith('m9', 'x@y.com')
  })
})
