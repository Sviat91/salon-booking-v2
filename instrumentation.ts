/**
 * Next.js server-boot hook (requires `experimental.instrumentationHook` in
 * `next.config.mjs`). Starts the interactive Telegram client booking bot's
 * long-polling loop if it's enabled in `TenantConfig` — see
 * `src/lib/telegram-bot/lifecycle.ts`. Runs in both `next dev` and
 * `next start`/production.
 */
export async function register() {
  // Guard: never run in the edge runtime, and dynamic-import so grammy/Prisma
  // never enter the edge bundle.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { startClientBot } = await import('@/lib/telegram-bot/lifecycle')
    // Fire-and-forget: startClientBot() itself never awaits bot.start().
    startClientBot().catch((err) => {
      console.error('[instrumentation] startClientBot failed:', err)
    })
  } catch (err) {
    // A bad token or misconfiguration must never crash server boot.
    console.error('[instrumentation] failed to start client bot:', err)
  }
}
