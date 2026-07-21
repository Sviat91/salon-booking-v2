/**
 * Long-polling lifecycle for the interactive client booking bot. Holds a
 * module-level singleton reference to the running `Bot` instance so it can be
 * started/stopped/restarted at runtime (server boot, Settings save) without
 * restarting the Node process. Mirrors `notifications/telegram.ts`'s
 * never-throw contract — every exported function returns a result object.
 */
import { Bot } from 'grammy'
import { getClientBot } from './bot'
import { getTenantConfig } from '@/lib/tenant'

interface LifecycleResult {
  ok: boolean
  running: boolean
  error?: string
}

interface ValidateTokenResult {
  ok: boolean
  username?: string
  error?: string
}

let runningBot: Bot | null = null
let runningToken: string | null = null

/**
 * Extracts a safe, short summary from an unknown error value — never returns
 * the raw value itself. grammy's `BotError` wraps `{ error: <cause>, ctx }`,
 * and `ctx` exposes the `Api` instance (which holds the bot token) as an
 * enumerable property, so passing the raw error/context to `console.error`
 * risks leaking the token via Node's default object inspection. Exported so
 * handler modules (e.g. `handlers/consent.ts`) can reuse it for the same
 * reason.
 */
export function describeError(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as { error: unknown }).error
    return inner instanceof Error ? `${inner.name}: ${inner.message}` : String(inner)
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

/** Reads `TenantConfig` and starts long polling if enabled+token are set. No-op (not an error) otherwise. Never throws. */
export async function startClientBot(): Promise<LifecycleResult> {
  try {
    const config = await getTenantConfig()
    const { clientBotEnabled, clientBotToken } = config as {
      clientBotEnabled?: boolean
      clientBotToken?: string | null
    }

    if (!clientBotEnabled || !clientBotToken) {
      return { ok: true, running: false }
    }

    if (runningBot && runningToken === clientBotToken && runningBot.isRunning()) {
      return { ok: true, running: true }
    }

    const bot = getClientBot(clientBotToken)
    bot.catch((err) => {
      console.error('[telegram-bot lifecycle] middleware error:', describeError(err))
    })

    // Fire-and-forget: bot.start() resolves only when the bot stops.
    bot.start().catch((err) => {
      console.error('[telegram-bot lifecycle] start() failed:', describeError(err))
    })

    runningBot = bot
    runningToken = clientBotToken

    return { ok: true, running: true }
  } catch (err) {
    return { ok: false, running: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Stops the running bot, if any. Idempotent. Never throws. */
export async function stopClientBot(): Promise<LifecycleResult> {
  try {
    if (runningBot) {
      await runningBot.stop()
    }
    runningBot = null
    runningToken = null
    return { ok: true, running: false }
  } catch (err) {
    return { ok: false, running: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Stops then starts — re-reads `TenantConfig`, so it uniformly handles enable, disable, and token change. */
export async function restartClientBot(): Promise<LifecycleResult> {
  await stopClientBot()
  return startClientBot()
}

/** Validates a token via `getMe()` without touching the running singleton. Never throws. */
export async function validateToken(token: string): Promise<ValidateTokenResult> {
  try {
    const bot = new Bot(token)
    const me = await bot.api.getMe()
    return { ok: true, username: me.username }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
