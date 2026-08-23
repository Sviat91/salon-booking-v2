/**
 * SMSAPI.pl SMS provider. Uses native fetch — no extra dependencies. Never throws.
 *
 * Footgun: the `.do` endpoint returns HTTP 200 even on failure, with an
 * `{ "error": <code>, "message": "..." }` body. Checking `res.ok` alone would
 * silently swallow every error — the JSON body must be parsed and checked.
 */

export async function sendSmsApiSms(params: {
  token: string
  from: string
  to: string
  text: string
}): Promise<Error | null> {
  try {
    const url = 'https://api.smsapi.pl/sms.do'
    const body = new URLSearchParams({
      to: params.to,
      message: params.text,
      from: params.from,
      format: 'json',
      encoding: 'utf-8',
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const responseBody = await res.text()
      return new Error(`SMSAPI ${res.status}: ${responseBody}`)
    }

    const data = await res.json()
    if (data && typeof data === 'object' && 'error' in data) {
      return new Error(`SMSAPI error ${data.error}: ${data.message ?? 'unknown error'}`)
    }

    return null
  } catch (err) {
    return err instanceof Error ? new Error(`${err.name}: ${err.message}`) : new Error(String(err))
  }
}
