import { drainOutbox } from './outbox'

const KEY = Symbol.for('salon.googleCalendarScheduler')

type SchedulerState = { timer: NodeJS.Timeout | null }

function state(): SchedulerState {
  const g = globalThis as unknown as Record<symbol, SchedulerState | undefined>
  return (g[KEY] ??= { timer: null })
}

async function tick(): Promise<void> {
  try {
    await drainOutbox()
  } catch (err) {
    console.error('[google-calendar scheduler] tick failed:', err)
  }
}

export function startCalendarScheduler(): void {
  const s = state()
  if (s.timer) return
  s.timer = setInterval(() => void tick(), 30_000)
  s.timer.unref?.()
  const warmup = setTimeout(() => void tick(), 5_000)
  warmup.unref?.()
}

export function stopCalendarScheduler(): void {
  const s = state()
  if (s.timer) clearInterval(s.timer)
  s.timer = null
}
