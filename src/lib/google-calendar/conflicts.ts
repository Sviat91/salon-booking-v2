import prisma from '@/lib/prisma'
import { formatDate } from '@/lib/notifications/internal'
import { notifyCalendarConflict } from '@/lib/notifications/calendar-conflict'

export interface TimeEntry {
  id: string
  kind: 'appointment' | 'external'
  date: string
  startTime: string
  endTime: string
  label: string
}

/** Same-day pairs where a.start < b.end && a.end > b.start; each pair once. HH:MM strings compare lexically. */
export function findOverlaps(entries: TimeEntry[]): Array<[TimeEntry, TimeEntry]> {
  const pairs: Array<[TimeEntry, TimeEntry]> = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.date !== b.date) continue
      if (a.startTime < b.endTime && a.endTime > b.startTime) pairs.push([a, b])
    }
  }
  return pairs
}

const EXTERNAL_TITLE_FALLBACK = 'Wydarzenie z Google Calendar'

/**
 * Notifies (once per block, deduped via conflictNotifiedAt) about overlaps on one
 * master-day that involve an external block. Never deletes or moves anything.
 * `blockId` / `appointmentId` narrow the check to pairs touching that entry.
 * Never throws.
 */
export async function detectAndNotifyConflicts(
  masterId: string,
  date: Date,
  blockId?: string,
  appointmentId?: string,
): Promise<void> {
  try {
    const [appointments, blocks, master] = await Promise.all([
      prisma.appointment.findMany({
        where: { masterId, date, NOT: { status: { startsWith: 'CANCELLED' } } },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          client: { select: { name: true } },
          service: { select: { name_pl: true } },
        },
      }),
      prisma.externalCalendarBlock.findMany({ where: { masterId, date } }),
      prisma.user.findUnique({ where: { id: masterId }, select: { name: true } }),
    ])

    const dateKey = date.toISOString().slice(0, 10)
    const entries: TimeEntry[] = [
      ...appointments.map((a) => ({
        id: a.id,
        kind: 'appointment' as const,
        date: dateKey,
        startTime: a.startTime,
        endTime: a.endTime,
        label: `${a.client.name?.trim() || 'Klient'} — ${a.service.name_pl}`,
      })),
      ...blocks.map((b) => ({
        id: b.id,
        kind: 'external' as const,
        date: dateKey,
        startTime: b.startTime,
        endTime: b.endTime,
        label: b.title?.trim() || EXTERNAL_TITLE_FALLBACK,
      })),
    ]
    const notified = new Map(blocks.map((b) => [b.id, b.conflictNotifiedAt]))
    const focused = blockId !== undefined || appointmentId !== undefined

    const stamp = new Set<string>()
    for (const [a, b] of findOverlaps(entries)) {
      const externals = [a, b].filter((e) => e.kind === 'external')
      if (externals.length === 0) continue
      if (focused && ![a, b].some((e) => e.id === blockId || e.id === appointmentId)) continue
      // An appointment just moved/created via Google always warns (once per applied change).
      if (appointmentId === undefined && externals.every((e) => notified.get(e.id) || stamp.has(e.id))) continue

      await notifyCalendarConflict({
        masterName: master?.name ?? 'Mistrz',
        dateLabel: formatDate(date),
        first: { label: a.label, time: `${a.startTime}–${a.endTime}` },
        second: { label: b.label, time: `${b.startTime}–${b.endTime}` },
      })
      for (const e of externals) stamp.add(e.id)
    }

    if (stamp.size > 0) {
      await prisma.externalCalendarBlock.updateMany({
        where: { id: { in: [...stamp] } },
        data: { conflictNotifiedAt: new Date() },
      })
    }
  } catch (err) {
    console.error('[google-calendar conflicts] detect failed:', err)
  }
}
