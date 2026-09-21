import { generateKeyPairSync, createVerify } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetTenantConfig } = vi.hoisted(() => ({ mockGetTenantConfig: vi.fn() }))

vi.mock('@/lib/tenant', () => ({ getTenantConfig: mockGetTenantConfig }))
vi.mock('@/lib/encryption', () => ({ decrypt: (v: string | null) => v }))
vi.mock('@/lib/prisma', () => ({ default: {} }))

import {
  TokenUnavailableError,
  getAccessToken,
  resetAccessTokenCache,
} from '@/lib/google-calendar/auth'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const saKey = JSON.stringify({
  type: 'service_account',
  client_email: 'sa@proj.iam.gserviceaccount.com',
  private_key: privateKey,
})

const fetchMock = vi.fn()

function configWithKey(key: string | null = saKey) {
  mockGetTenantConfig.mockResolvedValue({ googleCalendarEnabled: true, googleServiceAccountKey: key })
}

function tokenResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  resetAccessTokenCache()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  fetchMock.mockReset()
  mockGetTenantConfig.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('getAccessToken JWT assertion', () => {
  it('sends a well-formed, correctly signed RS256 JWT (base64url)', async () => {
    configWithKey()
    fetchMock.mockResolvedValue(tokenResponse(200, { access_token: 'tok', expires_in: 3600 }))

    expect(await getAccessToken()).toBe('tok')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    const params = init.body as URLSearchParams
    expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')

    const assertion = params.get('assertion') as string
    const [h, c, s] = assertion.split('.')
    for (const part of [h, c, s]) expect(part).toMatch(/^[A-Za-z0-9_-]+$/)

    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString())
    expect(claims.iss).toBe('sa@proj.iam.gserviceaccount.com')
    expect(claims.scope).toBe('https://www.googleapis.com/auth/calendar')
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token')
    expect(claims.exp - claims.iat).toBe(3600)

    const verifier = createVerify('RSA-SHA256').update(`${h}.${c}`)
    expect(verifier.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true)
  })
})

describe('getAccessToken cache', () => {
  it('reuses a cached token until shortly before expiry, then refreshes', async () => {
    vi.useFakeTimers()
    configWithKey()
    fetchMock
      .mockResolvedValueOnce(tokenResponse(200, { access_token: 't1', expires_in: 3600 }))
      .mockResolvedValueOnce(tokenResponse(200, { access_token: 't2', expires_in: 3600 }))

    expect(await getAccessToken()).toBe('t1')
    expect(await getAccessToken()).toBe('t1')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3600 * 1000 - 30_000) // inside the 60s safety margin
    expect(await getAccessToken()).toBe('t2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('getAccessToken failure classification', () => {
  it('missing key -> null (non-retryable), no network call', async () => {
    configWithKey(null)
    expect(await getAccessToken()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('unparseable key -> null', async () => {
    configWithKey('not json')
    expect(await getAccessToken()).toBeNull()
  })

  it.each([500, 503, 429])('token endpoint HTTP %i -> TokenUnavailableError (retryable)', async (status) => {
    configWithKey()
    fetchMock.mockResolvedValue(tokenResponse(status))
    await expect(getAccessToken()).rejects.toBeInstanceOf(TokenUnavailableError)
  })

  it('network failure -> TokenUnavailableError', async () => {
    configWithKey()
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(getAccessToken()).rejects.toBeInstanceOf(TokenUnavailableError)
  })

  it.each([400, 401])('token endpoint HTTP %i (invalid_grant) -> null (non-retryable)', async (status) => {
    configWithKey()
    fetchMock.mockResolvedValue(tokenResponse(status, { error: 'invalid_grant' }))
    expect(await getAccessToken()).toBeNull()
  })
})
