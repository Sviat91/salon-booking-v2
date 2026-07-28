/**
 * discounts/server.ts
 *
 * Prisma-backed. Authorization primitives, candidate loading, base-price
 * resolution, evaluateDiscount(), and resnapshotAppointmentPrice() — the
 * single source of truth for every price shown or charged, including the
 * Telegram bot (in-process, never via HTTP self-call).
 */
import prisma from '@/lib/prisma'
import { normalizePhoneToE164 } from '@/lib/utils/phone-normalization'
import { pickBestDiscount, explainCode, type EligibilityContext } from './eligibility'
import {
  applyPercent,
  normalizeDiscountCode,
  parseWindowDays,
  parseWindowIntervals,
  type DiscountCandidate,
  type DiscountEvaluation,
  type DiscountOwner,
  type EvaluationStage,
} from './shared'

/**
 * Row-targeted authorization: the row itself carries its real owner, so
 * nothing has to be supplied by the client. Mirrors `canManagePage`
 * (`src/lib/content/pages-server.ts`).
 */
export function canManageDiscount(
  user: { id?: string; role?: string } | null | undefined,
  discount: { masterId: string | null }
): boolean {
  if (!user) return false
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return true
  if (user.role === 'MASTER') {
    return !!user.id && discount.masterId === user.id
  }
  return false
}

/**
 * Authorizes a client-*requested* DiscountOwner for `createDiscount` (no row
 * to derive a scope from). Returns a freshly constructed owner (never the
 * caller's `requested` object) or `null`. Deliberate divergence from
 * `authorizePageOwner` (AD-8): ADMIN requesting a `master` scope returns
 * `null` — there is no admin-on-behalf surface for discounts.
 */
export async function authorizeDiscountScope(
  user: { id?: string; role?: string } | null | undefined,
  requested: DiscountOwner
): Promise<DiscountOwner | null> {
  if (!user) return null

  if (requested.ownerType === 'global') {
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      return { ownerType: 'global', masterId: null }
    }
    return null
  }

  // requested.ownerType === 'master'
  if (user.role === 'MASTER') {
    return user.id === requested.masterId
      ? { ownerType: 'master', masterId: requested.masterId }
      : null
  }
  return null
}

/**
 * Services a master may discount. Deliberately includes salon-owned (global)
 * services the master offers, not only rows where Service.masterId ===
 * masterId (OQ-1, confirmed by the user) — do not narrow this filter.
 *
 * This is the same lookup already written 4x in the repo:
 * `api/procedures/route.ts:38-74`, `api/admin/calendar/services`,
 * `api/master/services`, `lib/telegram-bot/catalog.ts:36-67`. Not refactored
 * here — out of scope for this feature (mention, don't fix).
 */
export async function listMasterOfferedServiceIds(masterId: string): Promise<Set<string>> {
  const profile = await prisma.masterProfile.findUnique({ where: { userId: masterId } })

  if (profile) {
    const masterServices = await prisma.masterService.findMany({
      where: { masterProfileId: profile.id },
      select: { serviceId: true },
    })
    if (masterServices.length > 0) {
      return new Set(masterServices.map((ms) => ms.serviceId))
    }
  }

  const services = await prisma.service.findMany({
    where: { OR: [{ masterId: null }, { masterId }] },
    select: { id: true },
  })
  return new Set(services.map((s) => s.id))
}

export async function listDiscountsForOwner(owner: DiscountOwner) {
  return prisma.discount.findMany({
    where: { masterId: owner.masterId },
    orderBy: [{ createdAt: 'desc' }],
    include: { services: { select: { serviceId: true } } },
  })
}

interface DiscountRow {
  id: string
  label: string
  percent: number
  masterId: string | null
  requiresCode: boolean
  code: string | null
  oncePerClient: boolean
  windowDays: string | null
  windowIntervals: string | null
  startDate: Date | null
  endDate: Date | null
  active: boolean
  createdAt: Date
  services: { serviceId: string }[]
}

export function toCandidate(row: DiscountRow): DiscountCandidate {
  return {
    id: row.id,
    label: row.label,
    percent: row.percent,
    masterId: row.masterId,
    requiresCode: row.requiresCode,
    code: row.code,
    oncePerClient: row.oncePerClient,
    windowDays: parseWindowDays(row.windowDays),
    windowIntervals: parseWindowIntervals(row.windowIntervals),
    startDate: row.startDate,
    endDate: row.endDate,
    active: row.active,
    serviceIds: row.services.map((s) => s.serviceId),
    createdAt: row.createdAt,
  }
}

/** One query: all discounts in scope for `masterId` (global + that master's own). */
export async function loadCandidates(masterId: string): Promise<DiscountCandidate[]> {
  const rows = await prisma.discount.findMany({
    where: { OR: [{ masterId: null }, { masterId }] },
    include: { services: { select: { serviceId: true } } },
  })
  return rows.map(toCandidate)
}

/** MasterService.priceOverride ?? Service.price. null when the service doesn't exist. */
export async function resolveBasePrice(masterId: string, serviceId: string): Promise<number | null> {
  const profile = await prisma.masterProfile.findUnique({ where: { userId: masterId } })
  if (profile) {
    const masterService = await prisma.masterService.findUnique({
      where: { masterProfileId_serviceId: { masterProfileId: profile.id, serviceId } },
    })
    if (masterService) {
      if (masterService.priceOverride != null) return masterService.priceOverride
      const service = await prisma.service.findUnique({ where: { id: serviceId } })
      return service?.price ?? null
    }
  }
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  return service?.price ?? null
}

/**
 * Convert a UTC instant to Europe/Warsaw wall-clock day-of-week +
 * minutes-since-midnight. Same `Intl.DateTimeFormat` idiom as
 * `booking-service.ts:78-95` — never `Date.getDay()` on the raw instant
 * (server-TZ dependent). `dayOfWeek` matches `Schedule.dayOfWeek` semantics
 * (0=Sunday..6=Saturday) because the Warsaw calendar-date string is
 * re-parsed as a UTC midnight instant, whose `getUTCDay()` is TZ-independent.
 */
function toWarsawSlot(startsAt: Date): { dayOfWeek: number; minutes: number } {
  const wTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const wDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateOnly = wDateFormatter.format(startsAt) // "YYYY-MM-DD"
  const [hh, mm] = wTimeFormatter.format(startsAt).split(':').map(Number)
  const dayOfWeek = new Date(`${dateOnly}T00:00:00Z`).getUTCDay()
  return { dayOfWeek, minutes: hh * 60 + mm }
}

export interface EvaluateInput {
  masterId: string
  serviceId: string
  stage: EvaluationStage
  startsAt?: Date | null       // slot start (UTC instant)
  code?: string | null         // raw; normalized internally
  clientPhone?: string | null  // raw; normalized internally
  candidates?: DiscountCandidate[] // pre-loaded, for the /api/procedures batch path
}

/**
 * The single source of truth for pricing, used by the preview route,
 * /api/procedures, createBooking, and the Telegram bot. Returns null only
 * when the service doesn't exist.
 */
export async function evaluateDiscount(input: EvaluateInput): Promise<DiscountEvaluation | null> {
  const originalPrice = await resolveBasePrice(input.masterId, input.serviceId)
  if (originalPrice === null) return null

  let slotDayOfWeek: number | null = null
  let slotStartMinutes: number | null = null
  if (input.startsAt) {
    const slot = toWarsawSlot(input.startsAt)
    slotDayOfWeek = slot.dayOfWeek
    slotStartMinutes = slot.minutes
  }

  let phone: string | null = null
  if (input.clientPhone) {
    try {
      phone = normalizePhoneToE164(input.clientPhone)
    } catch {
      phone = null
    }
  }
  const hasClientIdentity = phone !== null

  const candidates = input.candidates ?? (await loadCandidates(input.masterId))

  let redeemedDiscountIds = new Set<string>()
  if (phone && input.stage === 'final') {
    const redemptions = await prisma.discountRedemption.findMany({
      where: { clientPhone: phone },
      select: { discountId: true },
    })
    redeemedDiscountIds = new Set(redemptions.map((r: { discountId: string }) => r.discountId))
  }

  const code = normalizeDiscountCode(input.code)

  const ctx: EligibilityContext = {
    stage: input.stage,
    masterId: input.masterId,
    serviceId: input.serviceId,
    slotDayOfWeek,
    slotStartMinutes,
    appointmentDate: input.startsAt ?? null,
    code,
    redeemedDiscountIds,
    hasClientIdentity,
  }

  const winner = pickBestDiscount(candidates, ctx)
  const codeStatus = explainCode(candidates, ctx)

  const finalPrice = winner ? applyPercent(originalPrice, winner.percent) : originalPrice

  return {
    originalPrice,
    finalPrice,
    percent: winner?.percent ?? null,
    label: winner?.label ?? null,
    discountId: winner?.id ?? null,
    oncePerClient: winner?.oncePerClient ?? false,
    codeStatus,
  }
}

/**
 * Called whenever an appointment's service changes (all 5 routes in R-3):
 * recompute originalPrice for the new service, clear the discount, and
 * delete the redemption row (restoring oncePerClient eligibility). No-op
 * when resolveBasePrice returns null (service no longer resolvable).
 */
export async function resnapshotAppointmentPrice(appointmentId: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { masterId: true, serviceId: true },
  })
  if (!appointment) return

  const originalPrice = await resolveBasePrice(appointment.masterId, appointment.serviceId)
  if (originalPrice === null) return

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { originalPrice, finalPrice: originalPrice, discountId: null },
  })
  await prisma.discountRedemption.deleteMany({ where: { appointmentId } })
}
