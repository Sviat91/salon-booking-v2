import { NextRequest, NextResponse } from "next/server"
import { getLogger } from "@/lib/logger"
import { rateLimit } from "@/lib/cache"
import { validateTurnstileForAPI } from "@/lib/turnstile"
import { normalizePhoneDigitsOnly, normalizePhoneToE164 } from "@/lib/utils/phone-normalization"
import { exportConsentData } from "@/lib/consent-service"
import { exportDataApiSchema } from "@/lib/validation/api-schemas"

export const runtime = "nodejs"

const log = getLogger({ module: "api.consents.export" })

function maskPhoneForLog(phone: string): string {
  const digits = normalizePhoneDigitsOnly(phone)
  if (digits.length < 4) return "***"
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
}

function invalidPhoneResponse() {
  return NextResponse.json(
    {
      error: "Invalid phone number format.",
      code: "INVALID_PHONE",
      hints: ["Use full number with country code, for example +48..."],
    },
    { status: 400 }
  )
}

function dataNotFoundResponse() {
  return NextResponse.json(
    {
      error: "We could not find personal data for the provided identity.",
      code: "DATA_NOT_FOUND",
      hints: [
        "Check full name and phone number.",
        "If you used email during booking, provide the same email.",
      ],
    },
    { status: 404 }
  )
}

/**
 * POST /api/consents/export
 * Exports personal data and consent history for GDPR data portability.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "0.0.0.0"
  const userAgent = req.headers.get("user-agent") || "Unknown"
  const parsed = exportDataApiSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        code: "INVALID_PAYLOAD",
        details: parsed.error.issues[0]?.message,
      },
      { status: 400 }
    )
  }

  const body = parsed.data
  const finalRequestId =
    body.requestId || `gdpr-export-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

  let normalizedPhoneE164: string
  try {
    normalizedPhoneE164 = normalizePhoneToE164(body.phone)
  } catch {
    return invalidPhoneResponse()
  }

  const rate = await rateLimit(`rate:gdpr:export:${ip}`, 5, 15 * 60)
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again in 15 minutes.",
        code: "RATE_LIMITED",
      },
      { status: 429 }
    )
  }

  const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, {
    requireToken: false,
  })
  if (!turnstileResult.success) {
    return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
  }

  try {
    const result = await exportConsentData({
      phone: normalizedPhoneE164,
      name: body.name,
      email: body.email,
    })

    if (!result.exportedData) {
      return dataNotFoundResponse()
    }

    log.info(
      {
        requestId: finalRequestId,
        ip,
        userAgent,
        phone: maskPhoneForLog(normalizedPhoneE164),
        consentRows: result.exportedData.consentHistory.length,
      },
      "Personal data exported"
    )

    return NextResponse.json(result.exportedData)
  } catch (error) {
    log.error(
      {
        requestId: finalRequestId,
        ip,
        phone: maskPhoneForLog(normalizedPhoneE164),
        error,
      },
      "Data export failed"
    )
    return NextResponse.json(
      {
        error: "Failed to export data.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}
