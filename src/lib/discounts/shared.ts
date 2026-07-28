/**
 * discounts/shared.ts
 *
 * Zero Prisma, zero React — safe for client bundles. Pure types and helpers
 * shared by the server-side evaluator (server.ts), the pure eligibility
 * predicates (eligibility.ts), and client components.
 */

export type DiscountOwner =
  | { ownerType: 'global'; masterId: null }
  | { ownerType: 'master'; masterId: string }

export type EvaluationStage = 'catalog' | 'slot' | 'final'

export type CodeStatus =
  | 'none'            // no code submitted
  | 'valid'           // code matched an eligible discount
  | 'unknown'         // no discount with that code
  | 'inactive'        // active = false
  | 'expired'         // outside startDate/endDate
  | 'not_applicable'  // wrong master, wrong service, or outside the happy-hour window
  | 'already_used'    // oncePerClient and this phone already redeemed it

export interface DiscountInterval {
  start: string
  end: string
}

/** `dates.*Short` i18n keys, indexed 0=Sunday..6=Saturday, matching `windowDays`. */
export const DISCOUNT_DAY_KEYS = [
  'dates.sundayShort',
  'dates.mondayShort',
  'dates.tuesdayShort',
  'dates.wednesdayShort',
  'dates.thursdayShort',
  'dates.fridayShort',
  'dates.saturdayShort',
] as const

export interface DiscountCandidate {
  id: string
  label: string
  percent: number
  masterId: string | null
  requiresCode: boolean
  code: string | null
  oncePerClient: boolean
  windowDays: number[]                // [] = no day restriction
  windowIntervals: DiscountInterval[] // [] = no hour restriction
  startDate: Date | null
  endDate: Date | null
  active: boolean
  serviceIds: string[]                // [] = all services in scope
  createdAt: Date
}

export interface DiscountEvaluation {
  originalPrice: number
  finalPrice: number
  percent: number | null
  label: string | null
  discountId: string | null
  oncePerClient: boolean   // of the WINNING discount; false when none applied
  codeStatus: CodeStatus
}

/**
 * Trim, collapse internal whitespace, uppercase. Return null for empty.
 * Used on both write and lookup — this is what makes the Discount.code
 * @unique index effectively case-insensitive on SQLite.
 */
export function normalizeDiscountCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = raw.trim().replace(/\s+/g, ' ').toUpperCase()
  return normalized.length > 0 ? normalized : null
}

/** JSON.parse in try/catch, keep only integers 0..6, dedupe, sort; [] on any failure. */
export function parseWindowDays(json: string | null): number[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    const days = parsed.filter(
      (d): d is number => Number.isInteger(d) && d >= 0 && d <= 6
    )
    return Array.from(new Set(days)).sort((a, b) => a - b)
  } catch {
    return []
  }
}

/**
 * Try/catch, keep only entries where both start/end match HH:MM and
 * end > start in minutes; [] on any failure. Same defensive posture as
 * readWeeklyFromDb in schedule-utils.ts.
 */
export function parseWindowIntervals(json: string | null): DiscountInterval[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((iv): iv is DiscountInterval => {
      if (!iv || typeof iv !== 'object') return false
      const { start, end } = iv as { start?: unknown; end?: unknown }
      if (typeof start !== 'string' || typeof end !== 'string') return false
      const timePattern = /^\d{1,2}:\d{2}$/
      if (!timePattern.test(start) || !timePattern.test(end)) return false
      return hhmmToMinutes(end) > hhmmToMinutes(start)
    })
  } catch {
    return []
  }
}

export function serializeWindowDays(days: number[]): string | null {
  return days.length > 0 ? JSON.stringify(days) : null
}

export function serializeWindowIntervals(intervals: DiscountInterval[]): string | null {
  return intervals.length > 0 ? JSON.stringify(intervals) : null
}

/**
 * Convert "HH:MM" to minutes since midnight. NaN on bad input.
 * Duplicated from `t2m` in `src/lib/schedule-utils.ts`, which cannot be
 * imported here because it pulls in Prisma at module scope.
 */
export function hhmmToMinutes(t: string): number {
  const s = String(t || '').trim()
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Apply a percentage discount to a price, rounded to the nearest cent.
 * Clamps percent to 0..100 and the result to >= 0.
 */
export function applyPercent(price: number, percent: number): number {
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const result = Math.round((price * (100 - clampedPercent)) / 100 * 100) / 100
  return Math.max(0, result)
}

/**
 * The one place the AD-2 fallback rule is written down: a null appointment
 * snapshot (pre-discounts row) falls back to the live derivation.
 */
export function resolveAppointmentPrice(
  finalPrice: number | null | undefined,
  livePrice: number
): number {
  return finalPrice ?? livePrice
}

/**
 * Derive the discount percentage from a price snapshot alone, so it stays
 * visible even after the Discount row has been deleted (discountId is
 * onDelete: SetNull). null when there's nothing to show.
 */
export function discountPercentFromSnapshot(
  originalPrice: number | null | undefined,
  finalPrice: number | null | undefined
): number | null {
  if (originalPrice == null || finalPrice == null) return null
  if (originalPrice <= 0) return null
  if (originalPrice <= finalPrice) return null
  return Math.round((1 - finalPrice / originalPrice) * 100)
}
