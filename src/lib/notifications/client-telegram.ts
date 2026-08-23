/**
 * Client-bot Telegram sender for booking reminders.
 * Plain text (no HTML parse mode) — mirrors the client bot's `ctx.reply` style
 * and avoids breaking on `&`/`<`/`>` in admin-entered service names.
 * Uses native fetch — no extra dependencies. Never throws.
 *
 * Takes a pre-rendered plain-text body (composed by `reminders.ts` from
 * `NotificationTemplate` / `DEFAULT_REMINDER_BODIES.telegram`); this module
 * is transport only.
 */

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
  text: string
}): Promise<Error | null> {
  return postPlainText(params.botToken, params.chatId, params.text)
}
