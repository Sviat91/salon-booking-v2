import { describe, expect, it } from 'vitest'
import {
  isGoogleSyncEnabled,
  normalizeCalendarId,
  parseServiceAccountKey,
} from '@/lib/google-calendar/config'

const validKey = {
  type: 'service_account',
  client_email: 'salon-sync@my-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
}

describe('parseServiceAccountKey', () => {
  it('parses a valid key', () => {
    expect(parseServiceAccountKey(JSON.stringify(validKey))).toEqual({
      clientEmail: validKey.client_email,
      privateKey: validKey.private_key,
    })
  })

  it.each(['type', 'client_email', 'private_key'])('returns null when %s is missing', (field) => {
    const copy: Record<string, unknown> = { ...validKey }
    delete copy[field]
    expect(parseServiceAccountKey(JSON.stringify(copy))).toBeNull()
  })

  it('returns null for a wrong type or non-PEM key', () => {
    expect(parseServiceAccountKey(JSON.stringify({ ...validKey, type: 'authorized_user' }))).toBeNull()
    expect(parseServiceAccountKey(JSON.stringify({ ...validKey, private_key: 'nope' }))).toBeNull()
  })

  it('returns null for malformed JSON without throwing', () => {
    expect(() => parseServiceAccountKey('{not json')).not.toThrow()
    expect(parseServiceAccountKey('{not json')).toBeNull()
    expect(parseServiceAccountKey('null')).toBeNull()
  })
})

describe('normalizeCalendarId', () => {
  it('accepts group calendar ids and gmail addresses', () => {
    expect(normalizeCalendarId('abc@group.calendar.google.com')).toBe('abc@group.calendar.google.com')
    expect(normalizeCalendarId('user@gmail.com')).toBe('user@gmail.com')
  })

  it('trims and lowercases', () => {
    expect(normalizeCalendarId('  User@Gmail.COM ')).toBe('user@gmail.com')
  })

  it.each(['', '  ', 'not an id', '<script>', 'primary', ' Primary ', null, undefined])('rejects %j', (value) => {
    expect(normalizeCalendarId(value as string | null | undefined)).toBeNull()
  })
})

describe('isGoogleSyncEnabled', () => {
  it('requires both the flag and the key', () => {
    expect(isGoogleSyncEnabled({ googleCalendarEnabled: true, googleServiceAccountKey: 'k' })).toBe(true)
    expect(isGoogleSyncEnabled({ googleCalendarEnabled: false, googleServiceAccountKey: 'k' })).toBe(false)
    expect(isGoogleSyncEnabled({ googleCalendarEnabled: true, googleServiceAccountKey: null })).toBe(false)
    expect(isGoogleSyncEnabled({ googleCalendarEnabled: true, googleServiceAccountKey: '' })).toBe(false)
    expect(isGoogleSyncEnabled({})).toBe(false)
  })
})
