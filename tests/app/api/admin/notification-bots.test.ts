import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decrypt } from '@/lib/encryption'

const { mockAuth, mockPrisma, mockGetTelegramBotInfo } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    tenantConfig: { findFirst: vi.fn() },
    user: { findMany: vi.fn(), count: vi.fn() },
    notificationBot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notificationBotMaster: { createMany: vi.fn(), deleteMany: vi.fn() },
    notificationBotRecipient: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockGetTelegramBotInfo: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/notifications/telegram', () => ({ getTelegramBotInfo: mockGetTelegramBotInfo }))

import { GET, POST } from '../../../../src/app/api/admin/notification-bots/route'
import { PATCH, DELETE } from '../../../../src/app/api/admin/notification-bots/[id]/route'
import { POST as testRoute } from '../../../../src/app/api/admin/notification-bots/[id]/test/route'

const VALID_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123'

function req(body: unknown, method = 'POST') {
  return new Request('http://localhost/api', { method, body: JSON.stringify(body) })
}

function fixtureRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bot-1',
    label: 'Salon bot',
    username: 'salon_bot',
    enabled: true,
    scope: 'SELECTED',
    ownerId: null,
    owner: null,
    masters: [{ masterId: 'm1', master: { name: 'Anna' } }],
    recipients: [{ chatId: '111', label: null }],
    token: 'enc:token',
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
  mockGetTelegramBotInfo.mockResolvedValue({ ok: true, username: 'salon_bot' })
})

describe('admin notification-bots — auth guard', () => {
  it.each([null, { user: { id: 'c', role: 'CLIENT' } }, { user: { id: 'm', role: 'MASTER' } }])(
    'rejects non-admin session %j on every handler',
    async (session) => {
      mockAuth.mockResolvedValue(session)

      expect((await GET()).status).toBe(401)
      expect((await POST(req({ label: 'x', token: VALID_TOKEN, scope: 'ALL' }))).status).toBe(401)
      expect((await PATCH(req({ label: 'y' }, 'PATCH'), { params: { id: 'bot-1' } })).status).toBe(401)
      expect((await DELETE(req({}, 'DELETE'), { params: { id: 'bot-1' } })).status).toBe(401)
      expect((await testRoute(req({}), { params: { id: 'bot-1' } })).status).toBe(401)

      expect(mockPrisma.notificationBot.create).not.toHaveBeenCalled()
      expect(mockPrisma.notificationBot.update).not.toHaveBeenCalled()
      expect(mockPrisma.notificationBot.delete).not.toHaveBeenCalled()
    }
  )
})

describe('admin notification-bots POST', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockPrisma.user.count.mockResolvedValue(1)
    mockPrisma.notificationBot.create.mockResolvedValue({ id: 'bot-1' })
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow())
  })

  it('stores an encrypted token, never the plaintext, and never returns it', async () => {
    const res = await POST(req({ label: 'Salon bot', token: VALID_TOKEN, scope: 'ALL' }))
    expect(res.status).toBe(200)

    const createArgs = mockPrisma.notificationBot.create.mock.calls[0][0]
    expect(createArgs.data.token).not.toBe(VALID_TOKEN)
    expect(decrypt(createArgs.data.token)).toBe(VALID_TOKEN)
    expect(createArgs.data.ownerId).toBeNull()

    const text = await res.text()
    expect(text).not.toContain(VALID_TOKEN)
    expect(JSON.parse(text).bot).not.toHaveProperty('token')
  })

  it('rejects scope SELECTED with empty masterIds', async () => {
    const res = await POST(req({ label: 'x', token: VALID_TOKEN, scope: 'SELECTED', masterIds: [] }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('BOT_SCOPE_REQUIRED')
    expect(mockPrisma.notificationBot.create).not.toHaveBeenCalled()
  })

  it('rejects a malformed token', async () => {
    const res = await POST(req({ label: 'x', token: 'not-a-token', scope: 'ALL' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('BOT_TOKEN_INVALID')
    expect(mockPrisma.notificationBot.create).not.toHaveBeenCalled()
  })
})

describe('admin notification-bots GET/PATCH/DELETE/test', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
  })

  it('GET never includes a token in the response', async () => {
    mockPrisma.tenantConfig.findFirst.mockResolvedValue({ notifTelegramEnabled: true })
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'm1', name: 'Anna' }])
    mockPrisma.notificationBot.findMany.mockResolvedValue([fixtureRow()])

    const res = await GET()
    const text = await res.text()
    expect(text).not.toContain('enc:token')
    expect(JSON.parse(text).bots[0]).not.toHaveProperty('token')
    expect(JSON.parse(text).bots[0]).toMatchObject({ hasToken: true })
  })

  it('PATCH can change scope/masterIds of a master-owned bot without changing ownerId', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow({ ownerId: 'm1' }))
    const res = await PATCH(req({ scope: 'ALL', masterIds: [] }, 'PATCH'), { params: { id: 'bot-1' } })
    expect(res.status).toBe(200)
    const updateArgs = mockPrisma.notificationBot.update.mock.calls[0][0]
    expect(updateArgs.data).not.toHaveProperty('ownerId')
  })

  it('PATCH scope SELECTED without masterIds keeps the existing master joins (effective-state check)', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(
      fixtureRow({ scope: 'SELECTED', masters: [{ masterId: 'm1', master: { name: 'Anna' } }] })
    )
    const res = await PATCH(req({ scope: 'SELECTED', label: 'x' }, 'PATCH'), { params: { id: 'bot-1' } })
    expect(res.status).toBe(200)
    expect(mockPrisma.notificationBotMaster.deleteMany).not.toHaveBeenCalled()
  })

  it('PATCH masterIds: [] on a bot whose current scope is SELECTED is rejected, not silently wiped', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(
      fixtureRow({ scope: 'SELECTED', masters: [{ masterId: 'm1', master: { name: 'Anna' } }] })
    )
    const res = await PATCH(req({ masterIds: [] }, 'PATCH'), { params: { id: 'bot-1' } })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('BOT_SCOPE_REQUIRED')
    expect(mockPrisma.notificationBot.update).not.toHaveBeenCalled()
    expect(mockPrisma.notificationBotMaster.deleteMany).not.toHaveBeenCalled()
  })

  it('DELETE removes any bot', async () => {
    mockPrisma.notificationBot.delete.mockResolvedValue({})
    const res = await DELETE(req({}, 'DELETE'), { params: { id: 'bot-1' } })
    expect(res.status).toBe(200)
    expect(mockPrisma.notificationBot.delete).toHaveBeenCalledWith({ where: { id: 'bot-1' } })
  })

  it('test route never returns the token', async () => {
    mockGetTelegramBotInfo.mockResolvedValue({ ok: true, username: 'salon_bot' })
    const res = await testRoute(req({ token: VALID_TOKEN }), { params: { id: 'bot-1' } })
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).not.toContain(VALID_TOKEN)
    expect(mockPrisma.notificationBot.findUnique).not.toHaveBeenCalled()
  })
})
