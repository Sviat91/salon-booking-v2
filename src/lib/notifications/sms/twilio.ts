/**
 * Twilio SMS provider. Uses native fetch — no extra dependencies. Never throws.
 */

export async function sendTwilioSms(params: {
  accountSid: string
  authToken: string
  from: string
  to: string
  text: string
}): Promise<Error | null> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`
    const auth = Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64')
    const body = new URLSearchParams({ To: params.to, From: params.from, Body: params.text })

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const responseBody = await res.text()
      return new Error(`Twilio ${res.status}: ${responseBody}`)
    }

    return null
  } catch (err) {
    return err instanceof Error ? new Error(`${err.name}: ${err.message}`) : new Error(String(err))
  }
}
