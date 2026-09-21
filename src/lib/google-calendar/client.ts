import { TokenUnavailableError, getAccessToken } from './auth'

const API_BASE = 'https://www.googleapis.com/calendar/v3'

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

export interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  transparency?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  extendedProperties?: { private?: Record<string, string> }
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof GoogleApiError) {
    if ([429, 500, 502, 503, 504].includes(err.status)) return true
    return (
      err.status === 403 &&
      ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].includes(err.reason)
    )
  }
  return true
}

async function call<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
): Promise<T> {
  let token: string | null
  try {
    token = await getAccessToken()
  } catch (err) {
    if (err instanceof TokenUnavailableError) {
      throw new GoogleApiError(503, 'token_unavailable', 'Google token endpoint unavailable')
    }
    throw err
  }
  if (!token) throw new GoogleApiError(401, 'no_token', 'No Google access token')

  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  if (res.status === 204) return undefined as T
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (!res.ok) {
    const errBody = json as { error?: { message?: unknown; errors?: { reason?: unknown }[] } } | null
    const reason = errBody?.error?.errors?.[0]?.reason
    const message = errBody?.error?.message
    throw new GoogleApiError(
      res.status,
      typeof reason === 'string' ? reason : '',
      typeof message === 'string' ? message : `Google API HTTP ${res.status}`,
    )
  }
  return json as T
}

const enc = encodeURIComponent

export function getCalendar(calendarId: string) {
  return call<{ id: string; summary?: string; timeZone?: string }>(
    'GET',
    `/calendars/${enc(calendarId)}`,
  )
}

export function insertEvent(calendarId: string, body: Record<string, unknown>) {
  return call<{ id: string }>('POST', `/calendars/${enc(calendarId)}/events`, { body })
}

export function patchEvent(calendarId: string, eventId: string, body: Record<string, unknown>) {
  return call<{ id: string }>('PATCH', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
    body,
  })
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await call<void>('DELETE', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`)
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) return
    throw err
  }
}

export function listEvents(
  calendarId: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  return call<{ items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(
    'GET',
    `/calendars/${enc(calendarId)}/events`,
    { query: params },
  )
}
