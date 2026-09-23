/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    notificationBot: { findMany: vi.fn() },
    notificationLog: { create: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const { mockSendTelegramMessage } = vi.hoisted(() => ({
  mockSendTelegramMessage: vi.fn(),
}))

vi.mock('@/lib/notifications/telegram', () => ({
  sendTelegramMessage: mockSendTelegramMessage,
}))

import { encrypt } from '@/lib/encryption'
import { broadcastToMasterBots, broadcastToAllScopeBots } from '@/lib/notifications/bots'

const rawTokenA = '111:AAA-token-aaaaaaaaaaaaaaaaaaaa'
const rawTokenB = '222:BBB-token-bbbbbbbbbbbbbbbbbbbb'
const tokenA = encrypt(rawTokenA)!
const tokenB = encrypt(rawTokenB)!

function makeBot(
  overrides: Partial<{ id: string; label: string; token: string; recipients: { chatId: string }[] }> = {}
) {
  return {
    id: 'bot_1',
    label: 'General bot',
    token: tokenA,
    recipients: [{ chatId: 'chat_1' }],
    ...overrides,
  }
}

describe('broadcastToMasterBots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendTelegramMessage.mockResolvedValue(null)
  })

  it('an ALL-scope bot receives a message for any master', async () => {
    mockPrisma.notificationBot.findMany.mockResolvedValue([makeBot()])

    await broadcastToMasterBots({ masterId: 'm_1', html: '<b>hi</b>', type: 'BOOKING_CONFIRMATION', appointmentId: 'a_1' })

    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_1', '<b>hi</b>')
  })

  it('a SELECTED-scope bot is only sent to when the master matches its join set', async () => {
    // Simulates the DB-level `where.OR` filtering that Prisma would apply for real.
    mockPrisma.notificationBot.findMany.mockImplementation(async ({ where }: any) => {
      const requestedMasterId = where.OR[1].masters.some.masterId
      return requestedMasterId === 'm_1' ? [makeBot({ id: 'bot_selected', label: 'Selected' })] : []
    })

    await broadcastToMasterBots({ masterId: 'm_1', html: 'hit', type: 'BOOKING_CONFIRMATION' })
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_1', 'hit')

    mockSendTelegramMessage.mockClear()
    await broadcastToMasterBots({ masterId: 'm_2', html: 'miss', type: 'BOOKING_CONFIRMATION' })
    expect(mockSendTelegramMessage).not.toHaveBeenCalled()
  })

  it('disabled bots are excluded via the enabled: true filter passed to findMany', async () => {
    mockPrisma.notificationBot.findMany.mockResolvedValue([])

    await broadcastToMasterBots({ masterId: 'm_1', html: 'x', type: 'BOOKING_CONFIRMATION' })

    const [{ where }] = mockPrisma.notificationBot.findMany.mock.calls[0]
    expect(where.enabled).toBe(true)
  })

  it("each bot's send uses its own token to only its own chat IDs — never a merged recipient list", async () => {
    const botA = makeBot({
      id: 'bot_a',
      label: 'A',
      token: tokenA,
      recipients: [{ chatId: 'chat_a1' }, { chatId: 'chat_a2' }],
    })
    const botB = makeBot({ id: 'bot_b', label: 'B', token: tokenB, recipients: [{ chatId: 'chat_b1' }] })
    mockPrisma.notificationBot.findMany.mockResolvedValue([botA, botB])

    await broadcastToMasterBots({ masterId: 'm_1', html: '<b>msg</b>', type: 'BOOKING_CONFIRMATION' })

    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(3)
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_a1', '<b>msg</b>')
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_a2', '<b>msg</b>')
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenB, 'chat_b1', '<b>msg</b>')
    expect(mockSendTelegramMessage).not.toHaveBeenCalledWith(rawTokenA, 'chat_b1', expect.anything())
    expect(mockSendTelegramMessage).not.toHaveBeenCalledWith(rawTokenB, 'chat_a1', expect.anything())
    expect(mockSendTelegramMessage).not.toHaveBeenCalledWith(rawTokenB, 'chat_a2', expect.anything())
  })

  it("one bot's failure does not prevent the next bot's send, and the aggregated log is 'sent' when another bot succeeded", async () => {
    const botA = makeBot({ id: 'bot_a', label: 'Failing', token: tokenA, recipients: [{ chatId: 'chat_a1' }] })
    const botB = makeBot({ id: 'bot_b', label: 'Working', token: tokenB, recipients: [{ chatId: 'chat_b1' }] })
    mockPrisma.notificationBot.findMany.mockResolvedValue([botA, botB])
    mockSendTelegramMessage.mockImplementation(async (token: string) => {
      if (token === rawTokenA) return new Error('Telegram API error 401: unauthorized')
      return null
    })

    await broadcastToMasterBots({ masterId: 'm_1', html: 'x', type: 'BOOKING_CONFIRMATION', appointmentId: 'a_1' })

    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(2)
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(1)
    const [{ data }] = mockPrisma.notificationLog.create.mock.calls[0]
    expect(data.status).toBe('sent')
    expect(data.channel).toBe('telegram_bot')
    expect(data.error).toContain('Failing:')
  })

  it('zero matching bots ⇒ zero notificationLog.create calls', async () => {
    mockPrisma.notificationBot.findMany.mockResolvedValue([])

    await broadcastToMasterBots({ masterId: 'm_1', html: 'x', type: 'BOOKING_CONFIRMATION' })

    expect(mockPrisma.notificationLog.create).not.toHaveBeenCalled()
  })

  it('a migrated legacy bot row (plaintext token, U-2 verbatim copy) behaves identically to a hand-created ALL-scope bot', async () => {
    const handCreatedBot = makeBot({ id: 'bot_hand', label: 'Hand-created', token: tokenA, recipients: [{ chatId: 'chat_hand' }] })
    const legacyBot = makeBot({
      id: 'legacy_general_bot',
      label: 'Telegram',
      token: rawTokenB, // U-2: stored verbatim, decrypt() passes it through unchanged
      recipients: [{ chatId: 'chat_legacy' }],
    })
    mockPrisma.notificationBot.findMany.mockResolvedValue([handCreatedBot, legacyBot])

    await broadcastToMasterBots({ masterId: 'm_1', html: 'x', type: 'BOOKING_CONFIRMATION' })

    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_hand', 'x')
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenB, 'chat_legacy', 'x')
  })
})

describe('broadcastToAllScopeBots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendTelegramMessage.mockResolvedValue(null)
  })

  it('passes an ALL-scope-only where clause with no OR/masters clause', async () => {
    mockPrisma.notificationBot.findMany.mockResolvedValue([])

    await broadcastToAllScopeBots({ html: 'x', type: 'CONTACT_FORM' })

    const [{ where }] = mockPrisma.notificationBot.findMany.mock.calls[0]
    expect(where).toEqual({ enabled: true, scope: 'ALL' })
  })

  it('sends to every recipient of every returned bot and writes one telegram_bot log', async () => {
    const botA = makeBot({ id: 'bot_a', label: 'A', token: tokenA, recipients: [{ chatId: 'chat_a1' }, { chatId: 'chat_a2' }] })
    const botB = makeBot({ id: 'bot_b', label: 'B', token: tokenB, recipients: [{ chatId: 'chat_b1' }] })
    mockPrisma.notificationBot.findMany.mockResolvedValue([botA, botB])

    await broadcastToAllScopeBots({ html: '<b>msg</b>', type: 'CONTACT_FORM' })

    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(3)
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_a1', '<b>msg</b>')
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenA, 'chat_a2', '<b>msg</b>')
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(rawTokenB, 'chat_b1', '<b>msg</b>')
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(1)
    const [{ data }] = mockPrisma.notificationLog.create.mock.calls[0]
    expect(data.channel).toBe('telegram_bot')
    expect(data.status).toBe('sent')
  })

  it('zero bots ⇒ zero notificationLog.create calls', async () => {
    mockPrisma.notificationBot.findMany.mockResolvedValue([])

    await broadcastToAllScopeBots({ html: 'x', type: 'CONTACT_FORM' })

    expect(mockPrisma.notificationLog.create).not.toHaveBeenCalled()
  })
})
