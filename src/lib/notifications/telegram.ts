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

/**
 * Calls Telegram's `getMe` to validate a bot token and fetch its username.
 * Never throws, never logs the token. `status: 0` means a network/timeout failure.
 */
export async function getTelegramBotInfo(
  botToken: string
): Promise<{ ok: true; username: string | null } | { ok: false; status: number }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getMe`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })

    if (!res.ok) {
      return { ok: false, status: res.status }
    }

    const body = await res.json()
    return { ok: true, username: body?.result?.username ?? null }
  } catch {
    return { ok: false, status: 0 }
  }
}
