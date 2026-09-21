import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAccessToken } = vi.hoisted(() => ({ mockGetAccessToken: vi.fn() }))

vi.mock('@/lib/google-calendar/auth', () => {
  class TokenUnavailableError extends Error {}
  return { getAccessToken: mockGetAccessToken, TokenUnavailableError }
})

import { TokenUnavailableError } from '@/lib/google-calendar/auth'
import {
  GoogleApiError,
  deleteEvent,
  insertEvent,
  isRetryable,
  patchEvent,
} from '@/lib/google-calendar/client'

const fetchMock = vi.fn()

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

beforeEach(() => {
  mockGetAccessToken.mockResolvedValue('tok')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  mockGetAccessToken.mockReset()
  vi.unstubAllGlobals()
})

describe('google client URLs', () => {
  it('insertEvent POSTs to the encoded calendar events URL with a bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'ev1' }))
    const res = await insertEvent('abc@group.calendar.google.com', { summary: 'x' })
    expect(res).toEqual({ id: 'ev1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/abc%40group.calendar.google.com/events',
    )
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ summary: 'x' })
  })

  it('patchEvent encodes both calendar and event ids', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'e/1' }))
    await patchEvent('a+b@x.com', 'e/1', {})
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/a%2Bb%40x.com/events/e%2F1',
    )
    expect(init.method).toBe('PATCH')
  })

  it('deleteEvent handles a 204 with no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(deleteEvent('a@x.com', 'ev')).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://www.googleapis.com/calendar/v3/calendars/a%40x.com/events/ev')
    expect(init.method).toBe('DELETE')
  })

  it.each([404, 410])('deleteEvent treats %i as success', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: { message: 'gone' } }))
    await expect(deleteEvent('a@x.com', 'ev')).resolves.toBeUndefined()
  })

  it('deleteEvent rethrows other errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { message: 'boom' } }))
    await expect(deleteEvent('a@x.com', 'ev')).rejects.toBeInstanceOf(GoogleApiError)
  })
})

describe('token failures', () => {
  it('no token -> non-retryable 401 no_token', async () => {
    mockGetAccessToken.mockResolvedValue(null)
    const err = await insertEvent('a@x.com', {}).catch((e) => e)
    expect(err).toBeInstanceOf(GoogleApiError)
    expect(err.status).toBe(401)
    expect(err.reason).toBe('no_token')
    expect(isRetryable(err)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('transient token failure -> retryable 503 token_unavailable', async () => {
    mockGetAccessToken.mockRejectedValue(new TokenUnavailableError('down'))
    const err = await insertEvent('a@x.com', {}).catch((e) => e)
    expect(err).toBeInstanceOf(GoogleApiError)
    expect(err.status).toBe(503)
    expect(err.reason).toBe('token_unavailable')
    expect(isRetryable(err)).toBe(true)
  })
})

describe('isRetryable', () => {
  it.each([429, 500, 502, 503, 504])('HTTP %i is retryable', (status) => {
    expect(isRetryable(new GoogleApiError(status, '', 'x'))).toBe(true)
  })

  it.each([400, 401, 404, 410])('HTTP %i is not retryable', (status) => {
    expect(isRetryable(new GoogleApiError(status, '', 'x'))).toBe(false)
  })

  it.each(['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'])(
    '403 %s is retryable',
    (reason) => {
      expect(isRetryable(new GoogleApiError(403, reason, 'x'))).toBe(true)
    },
  )

  it('other 403 reasons are not retryable', () => {
    expect(isRetryable(new GoogleApiError(403, 'forbidden', 'x'))).toBe(false)
    expect(isRetryable(new GoogleApiError(403, '', 'x'))).toBe(false)
  })

  it('non-Google errors (network) are retryable', () => {
    expect(isRetryable(new TypeError('fetch failed'))).toBe(true)
  })

  it('parses the 403 reason from the response body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: { message: 'slow down', errors: [{ reason: 'rateLimitExceeded' }] } }),
    )
    const err = await insertEvent('a@x.com', {}).catch((e) => e)
    expect(err.reason).toBe('rateLimitExceeded')
    expect(isRetryable(err)).toBe(true)
  })

  it('ignores non-string reason/message from Google (not retryable, no throw)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: { message: { x: 1 }, errors: [{ reason: 42 }] } }),
    )
    const err = await insertEvent('a@x.com', {}).catch((e) => e)
    expect(err).toBeInstanceOf(GoogleApiError)
    expect(err.reason).toBe('')
    expect(err.message).toBe('Google API HTTP 403')
    expect(isRetryable(err)).toBe(false)
  })

  it('tolerates a non-JSON error body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 403 }))
    const err = await insertEvent('a@x.com', {}).catch((e) => e)
    expect(err).toBeInstanceOf(GoogleApiError)
    expect(err.reason).toBe('')
    expect(isRetryable(err)).toBe(false)
  })
})
