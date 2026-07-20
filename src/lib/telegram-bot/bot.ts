/**
 * Builds and lazily caches the grammy `Bot` instance for the interactive
 * client booking bot, keyed by token. `getClientBot(token)` is the single
 * entry point handler modules and the lifecycle module (`lifecycle.ts`) use —
 * it registers every handler module exactly once per instance.
 */
import { Bot } from 'grammy'
import { registerStartHandler } from './handlers/start'

let cachedBot: Bot | null = null
let cachedToken: string | null = null

function registerHandlers(bot: Bot) {
  registerStartHandler(bot)
}

/** Returns the cached `Bot` for `token`, creating (and registering handlers on) a new one if the token changed. */
export function getClientBot(token: string): Bot {
  if (cachedBot && cachedToken === token) return cachedBot
  const bot = new Bot(token)
  registerHandlers(bot)
  cachedBot = bot
  cachedToken = token
  return bot
}
