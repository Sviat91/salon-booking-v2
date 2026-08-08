import { beforeEach, describe, expect, it, vi } from 'vitest'

const rateLimit = vi.fn()
const validateTurnstileForAPI = vi.fn()

vi.mock('@/lib/cache', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/turnstile', () => ({
  validateTurnstileForAPI: (...args: unknown[]) => validateTurnstileForAPI(...args),
}))

import { checkLoginGuards } from '@/lib/auth-guards'

describe('checkLoginGuards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns RATE_LIMITED and does not call validateTurnstileForAPI when IP rate limit is exceeded', async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 31 })

    const result = await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: 'token' })

    expect(result).toEqual({ ok: false, reason: 'RATE_LIMITED' })
    expect(validateTurnstileForAPI).not.toHaveBeenCalled()
  })

  it('calls rateLimit with the exact per-IP and per-account keys/limits/windows', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })

    await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: 'token' })

    expect(rateLimit).toHaveBeenCalledWith('rate:login:1.2.3.4', 30, 900)
    expect(rateLimit).toHaveBeenCalledWith('rate:login:acct:user@example.com', 10, 900)
  })

  it('returns ok:true when allowed and Turnstile succeeds', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })

    const result = await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: 'token' })

    expect(result).toEqual({ ok: true })
  })

  it('returns TURNSTILE_FAILED when allowed but token is required/invalid', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({
      success: false,
      errorResponse: { error: 'Turnstile verification required', code: 'TURNSTILE_TOKEN_REQUIRED' },
      status: 400,
    })

    const result = await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: undefined })

    expect(result).toEqual({ ok: false, reason: 'TURNSTILE_FAILED' })
  })

  it('fails open (ok:true) when verification errors with VERIFY_ERROR', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({
      success: false,
      errorResponse: { error: 'Turnstile verification failed', code: 'VERIFY_ERROR' },
      status: 400,
    })

    const result = await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: 'token' })

    expect(result).toEqual({ ok: true })
  })

  it('forwards a non-string turnstileToken to validateTurnstileForAPI as undefined', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })

    for (const value of [undefined, null, 123]) {
      validateTurnstileForAPI.mockClear()
      await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: value })
      expect(validateTurnstileForAPI).toHaveBeenCalledWith(undefined, '1.2.3.4', { requireToken: false })
    }
  })

  it('returns RATE_LIMITED and does not call validateTurnstileForAPI when only the per-account limit is exceeded', async () => {
    rateLimit.mockImplementation(async (key: string) => {
      if (key.startsWith('rate:login:acct:')) {
        return { allowed: false, count: 11 }
      }
      return { allowed: true, count: 1 }
    })

    const result = await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: 'token' })

    expect(result).toEqual({ ok: false, reason: 'RATE_LIMITED' })
    expect(validateTurnstileForAPI).not.toHaveBeenCalled()
  })

  it('enforces the per-account limit independently of the per-IP limit having headroom', async () => {
    rateLimit.mockImplementation(async (key: string) => {
      if (key === 'rate:login:acct:user@example.com') {
        return { allowed: false, count: 11 }
      }
      // IP limit still has headroom.
      return { allowed: true, count: 2 }
    })

    const result = await checkLoginGuards({ ip: '1.2.3.4', email: 'user@example.com', turnstileToken: 'token' })

    expect(result).toEqual({ ok: false, reason: 'RATE_LIMITED' })
    expect(rateLimit).toHaveBeenCalledWith('rate:login:1.2.3.4', 30, 900)
    expect(rateLimit).toHaveBeenCalledWith('rate:login:acct:user@example.com', 10, 900)
  })
})
