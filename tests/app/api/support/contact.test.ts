import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Note: N8N delivery/retry logic now lives in @/lib/notifications
// (notifyContactForm), fire-and-forget from this route. That delivery/retry
// behavior is out of this route's test scope — this file only asserts the
// route's own contract: validation, rate limiting, masked logging, and
// delegation to notifyContactForm.

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const notifyContactForm = vi.fn()

vi.mock('../../../../src/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('../../../../src/lib/cache', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('../../../../src/lib/notifications', () => ({
  notifyContactForm: (...args: unknown[]) => notifyContactForm(...args),
}))

let postHandler: any

describe('POST /api/support/contact', () => {
  const validPayload = {
    name: 'Sviatoslav Upirow',
    email: 'user@example.com',
    subject: 'booking',
    message: 'This is a test message for booking support.',
  }

  function createRequest(body: any = validPayload) {
    return {
      headers: new Headers({
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'Mozilla/5.0 Test Browser',
      }),
      json: vi.fn().mockResolvedValue(body),
      ip: '127.0.0.1',
    } as unknown as Request
  }

  beforeAll(async () => {
    ;({ POST: postHandler } = await import('../../../../src/app/api/support/contact/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    notifyContactForm.mockResolvedValue(undefined)
  })

  it('returns 200 and delegates to notifyContactForm for a valid payload', async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('success')
    expect(body.message).toContain('Wiadomość została wysłana pomyślnie')
    expect(body.requestId).toBeDefined()

    expect(notifyContactForm).toHaveBeenCalledWith({
      senderName: validPayload.name,
      senderEmail: validPayload.email,
      subject: validPayload.subject,
      message: validPayload.message,
    })
  })

  it('validates required fields and returns 400 for missing data', async () => {
    const invalidPayload = {
      name: 'A', // Too short
      email: 'invalid-email',
      subject: '', // Empty
      message: 'Short', // Too short
    }

    const response = await postHandler(createRequest(invalidPayload))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.field).toBeDefined()
    expect(notifyContactForm).not.toHaveBeenCalled()
  })

  it('enforces rate limiting and returns 429 when exceeded', async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 4 })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toContain('Zbyt wiele wiadomości')
    expect(notifyContactForm).not.toHaveBeenCalled()
  })

  it('masks email in logs for privacy', async () => {
    await postHandler(createRequest())

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'u***r@example.com', // Masked email
      }),
      expect.any(String)
    )
  })

  it('trims name, subject, and message before forwarding', async () => {
    const messyPayload = {
      name: '  Sviatoslav Upirow  ',
      email: '  user@example.com  ',
      subject: '  booking  ',
      message: '  This is a test message.  ',
    }

    const response = await postHandler(createRequest(messyPayload))
    expect(response.status).toBe(200)

    expect(notifyContactForm).toHaveBeenCalledWith({
      senderName: 'Sviatoslav Upirow',
      senderEmail: 'user@example.com',
      subject: 'booking',
      message: 'This is a test message.',
    })
  })
})
