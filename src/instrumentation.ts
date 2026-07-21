/**
 * Next.js server-boot hook (requires `experimental.instrumentationHook` in
 * `next.config.mjs`). Starts the interactive Telegram client booking bot's
 * long-polling loop if it's enabled in `TenantConfig` — see
 * `src/lib/telegram-bot/lifecycle.ts`. Runs in both `next dev` and
 * `next start`/production.
 */
export async function register() {
  // Guard must be a single `if (cond) { ... }` block (not an early-return
  // guard clause) — webpack's dead-branch elimination only drops an entire
  // `if` block (and the dynamic import()s inside it) from the edge-runtime
  // compilation when `process.env.NEXT_RUNTIME` folds to a literal that
  // makes the condition false at build time. An early return doesn't get
  // the same treatment, so the (Node-only: grammy/Prisma/nodemailer) import
  // graph would still be resolved — and fail to build — for the edge bundle.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
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
}
