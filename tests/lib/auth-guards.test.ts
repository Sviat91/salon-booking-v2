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

  it('returns RATE_LIMITED and does not call validateTurnstileForAPI when rate limit is exceeded', async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 11 })

    const result = await checkLoginGuards({ ip: '1.2.3.4', turnstileToken: 'token' })

    expect(result).toEqual({ ok: false, reason: 'RATE_LIMITED' })
    expect(validateTurnstileForAPI).not.toHaveBeenCalled()
  })

  it('calls rateLimit with the exact login key/limit/window', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })

    await checkLoginGuards({ ip: '1.2.3.4', turnstileToken: 'token' })

    expect(rateLimit).toHaveBeenCalledWith('rate:login:1.2.3.4', 10, 900)
  })

  it('returns ok:true when allowed and Turnstile succeeds', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })

    const result = await checkLoginGuards({ ip: '1.2.3.4', turnstileToken: 'token' })

    expect(result).toEqual({ ok: true })
  })

  it('returns TURNSTILE_FAILED when allowed but token is required/invalid', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({
      success: false,
      errorResponse: { error: 'Turnstile verification required', code: 'TURNSTILE_TOKEN_REQUIRED' },
      status: 400,
    })

    const result = await checkLoginGuards({ ip: '1.2.3.4', turnstileToken: undefined })

    expect(result).toEqual({ ok: false, reason: 'TURNSTILE_FAILED' })
  })

  it('fails open (ok:true) when verification errors with VERIFY_ERROR', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({
      success: false,
      errorResponse: { error: 'Turnstile verification failed', code: 'VERIFY_ERROR' },
      status: 400,
    })

    const result = await checkLoginGuards({ ip: '1.2.3.4', turnstileToken: 'token' })

    expect(result).toEqual({ ok: true })
  })

  it('forwards a non-string turnstileToken to validateTurnstileForAPI as undefined', async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })

    for (const value of [undefined, null, 123]) {
      validateTurnstileForAPI.mockClear()
      await checkLoginGuards({ ip: '1.2.3.4', turnstileToken: value })
      expect(validateTurnstileForAPI).toHaveBeenCalledWith(undefined, '1.2.3.4', { requireToken: false })
    }
  })
})
