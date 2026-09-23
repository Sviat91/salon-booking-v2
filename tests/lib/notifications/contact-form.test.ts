/// <reference types='vitest' />

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    notificationLog: { create: vi.fn() },
  },
}))

const { mockGetTenantConfig } = vi.hoisted(() => ({
  mockGetTenantConfig: vi.fn(),
}))

const { mockEmail } = vi.hoisted(() => ({
  mockEmail: {
    sendContactFormToAdmin: vi.fn(),
    sendBookingConfirmationToClient: vi.fn(),
    sendBookingConfirmationToAdmin: vi.fn(),
  },
}))

const { mockBots } = vi.hoisted(() => ({
  mockBots: {
    broadcastToMasterBots: vi.fn(),
    broadcastToAllScopeBots: vi.fn(),
  },
}))

const { mockSendTelegramMessage } = vi.hoisted(() => ({
  mockSendTelegramMessage: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('@/lib/tenant', () => ({ getTenantConfig: mockGetTenantConfig }))
vi.mock('@/lib/notifications/email', () => mockEmail)
vi.mock('@/lib/notifications/bots', () => ({ ...mockBots, BOT_SCOPES: ['ALL', 'SELECTED'] }))
vi.mock('@/lib/notifications/telegram', () => ({ sendTelegramMessage: mockSendTelegramMessage }))
vi.mock('@/lib/notifications/reminders', () => ({ notifyBookingReminders: vi.fn() }))

import { notifyContactForm } from '@/lib/notifications'

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    brandName: 'Salon',
    notifEmailEnabled: false,
    notifTelegramEnabled: false,
    salonEmail: 'admin@example.com',
    telegramBotToken: undefined,
    ...overrides,
  }
}

const formData = { senderName: 'Jan Kowalski', senderEmail: 'jan@example.com', message: 'Hello there' }

describe('notifyContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('notifTelegramEnabled: true ⇒ broadcastToAllScopeBots called once with the rendered message', async () => {
    mockGetTenantConfig.mockResolvedValue(baseConfig({ notifTelegramEnabled: true }))

    await notifyContactForm(formData)

    expect(mockBots.broadcastToAllScopeBots).toHaveBeenCalledTimes(1)
    const [{ html, type }] = mockBots.broadcastToAllScopeBots.mock.calls[0]
    expect(html).toContain('Jan Kowalski')
    expect(html).toContain('Hello there')
    expect(type).toBe('CONTACT_FORM')
  })

  it('never calls sendTelegramMessage directly (the deleted legacy path) or broadcastToMasterBots (no master to scope to)', async () => {
    mockGetTenantConfig.mockResolvedValue(baseConfig({ notifTelegramEnabled: true }))

    await notifyContactForm(formData)

    expect(mockSendTelegramMessage).not.toHaveBeenCalled()
    expect(mockBots.broadcastToMasterBots).not.toHaveBeenCalled()
  })

  it('notifTelegramEnabled: false + notifEmailEnabled: true ⇒ broadcastToAllScopeBots not called, email still sent', async () => {
    mockGetTenantConfig.mockResolvedValue(baseConfig({ notifTelegramEnabled: false, notifEmailEnabled: true }))

    await notifyContactForm(formData)

    expect(mockBots.broadcastToAllScopeBots).not.toHaveBeenCalled()
    expect(mockEmail.sendContactFormToAdmin).toHaveBeenCalledTimes(1)
  })

  it('a set config.telegramBotToken changes nothing — the field is no longer consulted', async () => {
    mockGetTenantConfig.mockResolvedValue(
      baseConfig({ notifTelegramEnabled: true, telegramBotToken: 'some-legacy-token' })
    )

    await notifyContactForm(formData)

    expect(mockBots.broadcastToAllScopeBots).toHaveBeenCalledTimes(1)
    const [{ html }] = mockBots.broadcastToAllScopeBots.mock.calls[0]
    expect(html).not.toContain('some-legacy-token')
  })
})
