import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/cache"
import { getRequestIp } from "@/lib/consent-service"
import { discountPreviewApiSchema } from "@/lib/validation/api-schemas"
import { evaluateDiscount } from "@/lib/discounts/server"
import type { EvaluationStage } from "@/lib/discounts/shared"
import { handleApiError } from "@/lib/api/error-handler"
import { ApiError, ErrorResponses } from "@/lib/api/error-responses"

export const runtime = "nodejs"

/**
 * POST /api/discounts/preview
 * Public (the booking flow is guest-accessible), rate-limited. Never accepts
 * a client-computed price — the server always recomputes via
 * `evaluateDiscount()`. Does not import `@/auth` (see src/app/api/AGENTS.md).
 */
export async function POST(req: NextRequest) {
  const ip = getRequestIp(req)

  try {
    const { allowed } = await rateLimit(`discount-preview:${ip}`, 30, 60)
    if (!allowed) {
      return ErrorResponses.rateLimited("1m")
    }

    const body = discountPreviewApiSchema.parse(await req.json().catch(() => null))

    // Stage derivation (AD-9): no startISO ⇒ 'catalog'; startISO + no code/phone
    // ⇒ 'slot'; startISO + (code or phone) ⇒ 'final'.
    const stage: EvaluationStage = !body.startISO
      ? 'catalog'
      : body.code || body.phone
        ? 'final'
        : 'slot'

    const evaluation = await evaluateDiscount({
      masterId: body.masterId,
      serviceId: body.serviceId,
      stage,
      startsAt: body.startISO ? new Date(body.startISO) : null,
      code: body.code,
      clientPhone: body.phone,
    })

    if (evaluation === null) {
      throw new ApiError('SERVICE_NOT_FOUND', 'Selected service not found', 404)
    }

    return NextResponse.json({
      originalPrice: evaluation.originalPrice,
      finalPrice: evaluation.finalPrice,
      percent: evaluation.percent,
      label: evaluation.label,
      discountId: evaluation.discountId,
      codeStatus: evaluation.codeStatus,
    })
  } catch (error) {
    return handleApiError(error, { module: "api.discounts.preview", ip })
  }
}
