/**
 * discounts/eligibility.ts
 *
 * Pure, Prisma-free predicates. 100% unit-testable with no mocks.
 */

import type { CodeStatus, DiscountCandidate, EvaluationStage } from './shared'
import { hhmmToMinutes } from './shared'

export interface EligibilityContext {
  stage: EvaluationStage
  masterId: string
  serviceId: string
  /** Selected slot start, already converted to Europe/Warsaw wall-clock. */
  slotDayOfWeek: number | null    // 0..6, null at stage 'catalog'
  slotStartMinutes: number | null // minutes since midnight, null at stage 'catalog'
  /**
   * The appointment's own start instant — null at stage 'catalog' (no slot
   * chosen yet). `startDate`/`endDate` gate the appointment's date, not the
   * moment the client happens to be booking, so a "29 Jul – 31 Jul" period
   * applies to an appointment scheduled on the 30th even if it's booked
   * today, the 28th. Same treatment as the happy-hour window: unknown at
   * 'catalog', so a period-restricted discount is excluded until a slot is
   * picked.
   */
  appointmentDate: Date | null
  code: string | null             // already normalized
  redeemedDiscountIds: ReadonlySet<string>
  hasClientIdentity: boolean      // false ⇒ oncePerClient discounts are ineligible
}

function hasWindow(c: DiscountCandidate): boolean {
  return c.windowDays.length > 0 && c.windowIntervals.length > 0
}

function matchesWindow(c: DiscountCandidate, ctx: EligibilityContext): boolean {
  if (ctx.stage === 'catalog') return false
  if (ctx.slotDayOfWeek === null || ctx.slotStartMinutes === null) return false
  if (!c.windowDays.includes(ctx.slotDayOfWeek)) return false
  return c.windowIntervals.some((iv) => {
    const start = hhmmToMinutes(iv.start)
    const end = hhmmToMinutes(iv.end)
    return (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      ctx.slotStartMinutes! >= start &&
      ctx.slotStartMinutes! < end
    )
  })
}

export function isDiscountEligible(c: DiscountCandidate, ctx: EligibilityContext): boolean {
  if (!c.active) return false
  if (c.startDate || c.endDate) {
    if (!ctx.appointmentDate) return false
    if (c.startDate && ctx.appointmentDate < c.startDate) return false
    if (c.endDate && ctx.appointmentDate > c.endDate) return false
  }
  if (c.masterId !== null && c.masterId !== ctx.masterId) return false
  if (c.serviceIds.length > 0 && !c.serviceIds.includes(ctx.serviceId)) return false
  if (hasWindow(c) && !matchesWindow(c, ctx)) return false
  if (c.requiresCode) {
    if (ctx.stage !== 'final') return false
    if (ctx.code === null || ctx.code !== c.code) return false
  }
  if (c.oncePerClient) {
    if (ctx.stage !== 'final') return false
    if (!ctx.hasClientIdentity) return false
    if (ctx.redeemedDiscountIds.has(c.id)) return false
  }
  if (!Number.isInteger(c.percent) || c.percent < 1 || c.percent > 100) return false
  return true
}

export function pickBestDiscount(
  cands: DiscountCandidate[],
  ctx: EligibilityContext
): DiscountCandidate | null {
  const eligible = cands.filter((c) => isDiscountEligible(c, ctx))
  eligible.sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime()
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return eligible[0] ?? null
}

/**
 * Explains what would happen for a submitted code, independent of whether it
 * ultimately "wins" against a better automatic discount (AD-3).
 */
export function explainCode(cands: DiscountCandidate[], ctx: EligibilityContext): CodeStatus {
  if (ctx.code === null) return 'none'

  const candidate = cands.find((c) => c.code === ctx.code)
  if (!candidate) return 'unknown'

  if (!candidate.active) return 'inactive'
  if (candidate.startDate || candidate.endDate) {
    if (!ctx.appointmentDate) return 'not_applicable'
    if (candidate.startDate && ctx.appointmentDate < candidate.startDate) return 'expired'
    if (candidate.endDate && ctx.appointmentDate > candidate.endDate) return 'expired'
  }
  if (candidate.masterId !== null && candidate.masterId !== ctx.masterId) return 'not_applicable'
  if (candidate.serviceIds.length > 0 && !candidate.serviceIds.includes(ctx.serviceId)) {
    return 'not_applicable'
  }
  if (hasWindow(candidate) && !matchesWindow(candidate, ctx)) return 'not_applicable'
  if (candidate.oncePerClient) {
    if (!ctx.hasClientIdentity) return 'already_used'
    if (ctx.redeemedDiscountIds.has(candidate.id)) return 'already_used'
  }
  return 'valid'
}
