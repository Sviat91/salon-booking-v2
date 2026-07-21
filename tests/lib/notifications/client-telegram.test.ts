/// <reference types='vitest' />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendClientBookingReminder } from '../../../src/lib/notifications/client-telegram'

const baseParams = {
  botToken: 'SECRET_TOKEN',
  chatId: '123',
  lang: 'en' as const,
  hours: 24 as const,
  labels: { master: 'Anna', service: 'Facial', date: '10.04.2026', time: '10:00' },
}

describe('sendClientBookingReminder', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when fetch resolves ok', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })

    const result = await sendClientBookingReminder(baseParams)

    expect(result).toBeNull()
  })

  it('calls fetch with the correct URL and plain-text body (no parse_mode)', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })

    await sendClientBookingReminder(baseParams)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = (fetch as any).mock.calls[0]
    expect(url).toBe('https://api.telegram.org/botSECRET_TOKEN/sendMessage')

    const body = JSON.parse(options.body)
    expect(body.chat_id).toBe('123')
    expect(body.text).toContain('Reminder: your appointment is tomorrow')
    expect(body.text).toContain('Anna')
    expect(body.text).toContain('Facial')
    expect(body.parse_mode).toBeUndefined()
  })

  it('returns an Error (does not throw) when fetch resolves not ok', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 401, text: async () => '{"ok":false}' })

    const result = await sendClientBookingReminder(baseParams)

    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error (does not throw) when fetch rejects, and never leaks the token', async () => {
    ;(fetch as any).mockRejectedValue(new Error('network down'))

    const result = await sendClientBookingReminder(baseParams)

    expect(result).toBeInstanceOf(Error)
    expect(result!.message).not.toContain('SECRET_TOKEN')
  })

  it('selects the 2h heading when hours is 2', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })

    await sendClientBookingReminder({ ...baseParams, hours: 2 })

    const [, options] = (fetch as any).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.text).toContain('Reminder: your appointment is in 2 hours')
  })
})
