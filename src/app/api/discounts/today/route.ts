import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/cache"
import { getRequestIp } from "@/lib/consent-service"
import { loadCandidates } from "@/lib/discounts/server"
import { handleApiError } from "@/lib/api/error-handler"
import { ApiError } from "@/lib/api/error-responses"

export const runtime = "nodejs"

const MAX_RESULTS = 5

/**
 * GET /api/discounts/today?masterId=X&serviceId=Y (serviceId optional)
 * Public, rate-limited. Powers the client-facing "current promotions" card
 * (`TodayPromoCard.tsx`) — an advisory listing, not a price quote or a
 * booking-eligibility check (that's `evaluateDiscount()`/`/preview`).
 *
 * Only considers discounts visible to a browsing client: `requiresCode:
 * false` (a code is a secret, never advertised) and not yet past their
 * `endDate`. Unlike booking eligibility, a discount stays listed for its
 * *entire* advertised window — a "29–31 Jul" promo shows from the moment
 * it's created through the 31st, not only once "today" is inside the range
 * — and a happy-hour discount is listed regardless of the current
 * day/hour, so clients can see *when* it applies, not just whether it
 * applies right now. Never returns `Discount.label` (admin-only, see
 * DiscountForm's labelHint).
 *
 * A discount scoped to specific services is only included when `serviceId`
 * is supplied and matches — an unscoped (all-services) discount is always
 * included. `matchesSelectedService` tells the client which case it is, so
 * the card can say "on your selected service" instead of "on all services".
 */
export async function GET(req: NextRequest) {
  const ip = getRequestIp(req)
  const masterId = req.nextUrl.searchParams.get("masterId")
  const serviceId = req.nextUrl.searchParams.get("serviceId")

  try {
    const { allowed } = await rateLimit(`discount-today:${ip}`, 60, 60)
    if (!allowed) {
      return NextResponse.json({ discounts: [] })
    }

    if (!masterId) {
      throw new ApiError('VALIDATION_ERROR', 'masterId is required', 400)
    }

    const now = new Date()
    const candidates = await loadCandidates(masterId)

    const discounts = candidates
      .filter((c) => c.active && !c.requiresCode && (!c.endDate || c.endDate >= now))
      .filter((c) => c.serviceIds.length === 0 || (!!serviceId && c.serviceIds.includes(serviceId)))
      .map((c) => ({
        percent: c.percent,
        startDate: c.startDate ? c.startDate.toISOString() : null,
        endDate: c.endDate ? c.endDate.toISOString() : null,
        windowDays: c.windowDays,
        windowIntervals: c.windowIntervals,
        matchesSelectedService: c.serviceIds.length > 0,
      }))
      .sort((a, b) => Number(b.matchesSelectedService) - Number(a.matchesSelectedService) || b.percent - a.percent)
      .slice(0, MAX_RESULTS)

    return NextResponse.json({ discounts })
  } catch (error) {
    return handleApiError(error, { module: "api.discounts.today", ip })
  }
}
