/**
 * Catalog data helpers for the Telegram client booking bot. Mirrors the
 * prisma queries in `GET /api/masters` and `GET /api/procedures` in-process —
 * the bot must NOT HTTP self-call the app's public API (see plan decision #3).
 */
import prisma from '@/lib/prisma'
import type { LocalizedField } from '@/lib/localized-content'

export interface BookableMaster {
  id: string
  name: string
}

export interface BookableProcedure {
  id: string
  nameField: LocalizedField
  duration: number
  price: number
}

/** Masters eligible for booking via the bot — mirrors `GET /api/masters`. */
export async function listBookableMasters(): Promise<BookableMaster[]> {
  const masters = await prisma.user.findMany({
    where: {
      role: 'MASTER',
      masterProfile: { showOnHomepage: true },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })

  return masters.map((m) => ({ id: m.id, name: m.name ?? 'Master' }))
}

/** Procedures available to `masterId` — mirrors `GET /api/procedures?masterId=`. */
export async function listMasterProcedures(masterId: string): Promise<BookableProcedure[]> {
  const profile = await prisma.masterProfile.findUnique({ where: { userId: masterId } })

  if (profile) {
    const masterServices = await prisma.masterService.findMany({
      where: { masterProfileId: profile.id },
      include: { service: true },
      orderBy: { service: { name_pl: 'asc' } },
    })

    if (masterServices.length > 0) {
      return masterServices.map((ms) => ({
        id: ms.service.id,
        nameField: { pl: ms.service.name_pl, en: ms.service.name_en, uk: ms.service.name_uk },
        duration: ms.service.duration,
        price: ms.priceOverride ?? ms.service.price,
      }))
    }
  }

  // Fallback: global services + master's own services (same as the API route).
  const services = await prisma.service.findMany({
    where: { OR: [{ masterId: null }, { masterId }] },
    orderBy: { name_pl: 'asc' },
  })

  return services.map((s) => ({
    id: s.id,
    nameField: { pl: s.name_pl, en: s.name_en, uk: s.name_uk },
    duration: s.duration,
    price: s.price,
  }))
}
