/**
 * Thin Telegram Bot API sender.
 * Uses native fetch — no extra dependencies.
 * Never throws: errors are caught and returned as Error objects.
 */

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  html: string
): Promise<Error | null> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return new Error(`Telegram API error ${res.status}: ${body}`)
    }

    return null
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err))
  }
}
