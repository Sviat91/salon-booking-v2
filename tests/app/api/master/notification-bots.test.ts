import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decrypt } from '@/lib/encryption'

const { mockAuth, mockPrisma, mockGetTelegramBotInfo } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    tenantConfig: { findFirst: vi.fn() },
    user: { count: vi.fn() },
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

import { GET, POST } from '../../../../src/app/api/master/notification-bots/route'
import { PATCH, DELETE } from '../../../../src/app/api/master/notification-bots/[id]/route'
import { POST as testRoute } from '../../../../src/app/api/master/notification-bots/[id]/test/route'

const VALID_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123'

function req(body: unknown, method = 'POST') {
  return new Request('http://localhost/api', { method, body: JSON.stringify(body) })
}

function fixtureRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bot-1',
    label: 'Anna bot',
    username: 'anna_bot',
    enabled: true,
    scope: 'SELECTED',
    ownerId: 'me',
    owner: { name: 'Anna' },
    masters: [{ masterId: 'me', master: { name: 'Anna' } }],
    recipients: [{ chatId: '111', label: null }],
    token: 'enc:token',
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
  mockGetTelegramBotInfo.mockResolvedValue({ ok: true, username: 'anna_bot' })
  mockPrisma.user.count.mockResolvedValue(1)
})

describe('master notification-bots — auth guard', () => {
  it.each([null, { user: { id: 'a', role: 'ADMIN' } }, { user: { id: 'c', role: 'CLIENT' } }])(
    'rejects non-master session %j on every handler',
    async (session) => {
      mockAuth.mockResolvedValue(session)

      expect((await GET()).status).toBe(401)
      expect((await POST(req({ label: 'x', token: VALID_TOKEN }))).status).toBe(401)
      expect((await PATCH(req({ label: 'y' }, 'PATCH'), { params: { id: 'bot-1' } })).status).toBe(401)
      expect((await DELETE(req({}, 'DELETE'), { params: { id: 'bot-1' } })).status).toBe(401)
      expect((await testRoute(req({}), { params: { id: 'bot-1' } })).status).toBe(401)

      expect(mockPrisma.notificationBot.create).not.toHaveBeenCalled()
    }
  )
})

describe('master notification-bots POST', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'me', role: 'MASTER' } })
    mockPrisma.notificationBot.create.mockResolvedValue({ id: 'bot-1' })
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow())
  })

  it('forces ownerId/scope/masterIds server-side, ignoring any client-supplied values', async () => {
    const res = await POST(
      req({
        label: 'Anna bot',
        token: VALID_TOKEN,
        scope: 'ALL',
        masterIds: ['someone-else'],
        ownerId: 'someone-else',
      })
    )
    expect(res.status).toBe(200)

    const createArgs = mockPrisma.notificationBot.create.mock.calls[0][0]
    expect(createArgs.data.scope).toBe('SELECTED')
    expect(createArgs.data.ownerId).toBe('me')

    const masterCreateArgs = mockPrisma.notificationBotMaster.createMany.mock.calls[0][0]
    expect(masterCreateArgs.data).toEqual([{ botId: 'bot-1', masterId: 'me' }])
  })

  it('stores an encrypted token and never returns it', async () => {
    const res = await POST(req({ label: 'Anna bot', token: VALID_TOKEN }))
    const createArgs = mockPrisma.notificationBot.create.mock.calls[0][0]
    expect(createArgs.data.token).not.toBe(VALID_TOKEN)
    expect(decrypt(createArgs.data.token)).toBe(VALID_TOKEN)

    const text = await res.text()
    expect(text).not.toContain(VALID_TOKEN)
    expect(JSON.parse(text).bot).not.toHaveProperty('token')
  })
})

describe('master notification-bots — ownership (canManageBot)', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'me', role: 'MASTER' } })
  })

  it('rejects PATCH on another master\'s bot with 403, does not leak more than that', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow({ ownerId: 'someone-else' }))
    const res = await PATCH(req({ label: 'hijack' }, 'PATCH'), { params: { id: 'bot-1' } })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('FORBIDDEN')
    expect(mockPrisma.notificationBot.update).not.toHaveBeenCalled()
  })

  it('rejects DELETE on another master\'s bot with 403', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow({ ownerId: 'someone-else' }))
    const res = await DELETE(req({}, 'DELETE'), { params: { id: 'bot-1' } })
    expect(res.status).toBe(403)
    expect(mockPrisma.notificationBot.delete).not.toHaveBeenCalled()
  })

  it('rejects test on another master\'s bot with 403', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow({ ownerId: 'someone-else' }))
    const res = await testRoute(req({}), { params: { id: 'bot-1' } })
    expect(res.status).toBe(403)
    expect(mockGetTelegramBotInfo).not.toHaveBeenCalled()
  })

  it('404s (not 403) when the bot does not exist', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(null)
    const res = await PATCH(req({ label: 'x' }, 'PATCH'), { params: { id: 'missing' } })
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('NOT_FOUND')
  })

  it('allows PATCH/DELETE/test on her own bot', async () => {
    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow({ ownerId: 'me' }))
    const patchRes = await PATCH(req({ label: 'renamed' }, 'PATCH'), { params: { id: 'bot-1' } })
    expect(patchRes.status).toBe(200)

    mockPrisma.notificationBot.findUnique.mockResolvedValue(fixtureRow({ ownerId: 'me' }))
    mockPrisma.notificationBot.delete.mockResolvedValue({})
    const deleteRes = await DELETE(req({}, 'DELETE'), { params: { id: 'bot-1' } })
    expect(deleteRes.status).toBe(200)
  })
})

describe('master notification-bots GET', () => {
  it('never returns a token, only scopes to her own bots', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me', role: 'MASTER' } })
    mockPrisma.tenantConfig.findFirst.mockResolvedValue({ notifTelegramEnabled: true })
    mockPrisma.notificationBot.findMany.mockResolvedValue([fixtureRow()])

    const res = await GET()
    const text = await res.text()
    expect(text).not.toContain('enc:token')
    expect(mockPrisma.notificationBot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'me' } })
    )
  })
})
