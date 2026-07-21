/**
 * Client-bot Telegram sender for booking reminders.
 * Plain text (no HTML parse mode) — mirrors the client bot's `ctx.reply` style
 * and avoids breaking on `&`/`<`/`>` in admin-entered service names.
 * Uses native fetch — no extra dependencies. Never throws.
 */

import { botT } from '@/lib/telegram-bot/i18n'
import type { Language } from '@/lib/i18n-shared'

interface ReminderLabels extends Record<string, string> {
  master: string
  service: string
  date: string
  time: string
}

async function postPlainText(botToken: string, chatId: string, text: string): Promise<Error | null> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return new Error(`Telegram API error ${res.status}: ${body}`)
    }

    return null
  } catch (err) {
    return err instanceof Error ? new Error(`${err.name}: ${err.message}`) : new Error(String(err))
  }
}

export async function sendClientBookingReminder(params: {
  botToken: string
  chatId: string
  lang: Language
  hours: 24 | 2
  labels: ReminderLabels
}): Promise<Error | null> {
  const t = botT(params.lang)
  const heading = params.hours === 24 ? t('bot.reminder.heading24h') : t('bot.reminder.heading2h')
  const details = t('bot.reminder.details', params.labels)
  return postPlainText(params.botToken, params.chatId, `${heading}\n\n${details}`)
}
