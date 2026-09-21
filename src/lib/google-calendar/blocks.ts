import prisma from '@/lib/prisma'
import type { Range } from '@/lib/schedule-utils'

// Inlined (instead of importing t2m) because schedule-utils imports this module.
function toMinutes(t: string): number {
  const m = String(t || '').trim().match(/^(\d{1,2})[.:](\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** External (Google-origin) busy ranges for one master-day; used by fetchBusyRanges(). */
export async function getExternalRangesForDay(masterId: string, dateISO: string): Promise<Range[]> {
  const blocks = await prisma.externalCalendarBlock.findMany({
    where: { masterId, date: new Date(`${dateISO}T00:00:00.000Z`) },
    select: { startTime: true, endTime: true },
  })
  return blocks
    .map((b) => ({ start: toMinutes(b.startTime), end: toMinutes(b.endTime) }))
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
}

export async function hasExternalOverlap(
  masterId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const hit = await prisma.externalCalendarBlock.findFirst({
    where: { masterId, date, startTime: { lt: endTime }, endTime: { gt: startTime } },
    select: { id: true },
  })
  return Boolean(hit)
}

/** For the calendar GET routes; `masterId: null` = all masters. */
export async function listExternalBlocks(masterId: string | null, from?: Date | null, to?: Date | null) {
  return prisma.externalCalendarBlock.findMany({
    where: {
      ...(masterId ? { masterId } : {}),
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: {
      master: { select: { id: true, name: true, masterProfile: { select: { color: true } } } },
    },
  })
}

type ListedBlock = Awaited<ReturnType<typeof listExternalBlocks>>[number]

/** Shapes a block as a read-only `Appointment`-compatible calendar entry (id prefixed `ext:`). */
export function externalBlockToCalendarEntry(block: ListedBlock) {
  const duration = Math.max(0, toMinutes(block.endTime) - toMinutes(block.startTime))
  return {
    id: `ext:${block.id}`,
    date: block.date,
    startTime: block.startTime,
    endTime: block.endTime,
    status: 'EXTERNAL',
    notes: null,
    isExternal: true,
    externalTitle: block.title,
    externalDescription: block.description,
    allDay: block.allDay,
    service: { id: '', name_pl: '', name_en: null, name_uk: null, duration, price: 0 },
    client: { id: '', name: null, phone: null, email: null },
    master: block.master,
    finalPrice: null,
    originalPrice: null,
    discount: null,
  }
}
