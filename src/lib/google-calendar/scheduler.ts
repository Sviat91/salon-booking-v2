import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { isGoogleSyncEnabled } from './config'
import { drainOutbox } from './outbox'
import { pullMasterCalendar } from './pull'

const PULL_STALE_MS = 55_000
const PULL_PER_TICK = 3

const KEY = Symbol.for('salon.googleCalendarScheduler')

type SchedulerState = { timer: NodeJS.Timeout | null; running: boolean }

function state(): SchedulerState {
  const g = globalThis as unknown as Record<symbol, SchedulerState | undefined>
  return (g[KEY] ??= { timer: null, running: false })
}

async function tick(): Promise<void> {
  const s = state()
  if (s.running) return
  s.running = true
  try {
    await drainOutbox()
    if (!isGoogleSyncEnabled(await getTenantConfig())) {
      // Sync off / key removed: imported blocks must not keep blocking; re-enabling starts a clean full sync.
      if ((await prisma.externalCalendarBlock.count()) > 0) {
        await prisma.externalCalendarBlock.deleteMany({})
      }
      await prisma.masterProfile.updateMany({
        where: { googleSyncToken: { not: null } },
        data: { googleSyncToken: null },
      })
      return
    }
    const staleBefore = new Date(Date.now() - PULL_STALE_MS)
    const masters = await prisma.masterProfile.findMany({
      where: {
        googleCalendarId: { not: null },
        OR: [{ googleSyncedAt: null }, { googleSyncedAt: { lt: staleBefore } }],
      },
      orderBy: { googleSyncedAt: { sort: 'asc', nulls: 'first' } },
      take: PULL_PER_TICK,
      select: { userId: true },
    })
    for (const m of masters) {
      try {
        await pullMasterCalendar(m.userId)
      } catch (err) {
        console.error('[google-calendar scheduler] pull failed:', err)
      }
    }
  } catch (err) {
    console.error('[google-calendar scheduler] tick failed:', err)
  } finally {
    s.running = false
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
