import { NextRequest, NextResponse } from "next/server"
import { getLogger } from "@/lib/logger"
import { cacheDel, cacheSetNX, rateLimit } from "@/lib/cache"
import { validateTurnstileForAPI } from "@/lib/turnstile"
import { normalizePhoneDigitsOnly, normalizePhoneToE164 } from "@/lib/utils/phone-normalization"
import { normalizeNameForMatching } from "@/lib/utils/string-normalization"
import { withdrawConsentRecord } from "@/lib/consent-service"
import { withdrawConsentApiSchema } from "@/lib/validation/api-schemas"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

const log = getLogger({ module: "api.consents.withdraw" })

function maskPhoneForLog(phone: string): string {
  const digits = normalizePhoneDigitsOnly(phone)
  if (digits.length < 4) return "***"
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
}

function dataNotFoundResponse() {
  return NextResponse.json(
    {
      error: "We could not find active consent for the provided data.",
      code: "DATA_NOT_FOUND",
      hints: [
        "Check full name and phone number.",
        "If you used email during booking, provide the same email.",
      ],
    },
    { status: 404 }
  )
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

/**
 * POST /api/consents/withdraw
 * Withdraw latest active consent for a matching user identity.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "0.0.0.0"
  const userAgent = req.headers.get("user-agent") || "Unknown"
  const parsed = withdrawConsentApiSchema.safeParse(await req.json().catch(() => null))

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
  if (!body.consentAcknowledged) {
    return NextResponse.json(
      {
        error: "Consent acknowledgement is required.",
        code: "CONSENT_ACK_REQUIRED",
      },
      { status: 400 }
    )
  }

  const finalRequestId =
    body.requestId || `gdpr-withdraw-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

  const session = await auth()
  let targetPhone = body.phone
  let targetName = body.name
  let targetEmail = body.email

  if (session?.user?.id) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { phone: true, name: true, email: true },
      })
      if (dbUser) {
        if (!dbUser.phone || !dbUser.name) {
          return NextResponse.json(
            { error: "Your profile is missing phone or name. Please update it first." },
            { status: 400 }
          )
        }
        targetPhone = dbUser.phone
        targetName = dbUser.name
        targetEmail = dbUser.email
      }
    } catch (err) {
      log.error({ error: err }, "Failed to fetch user from session")
    }
  }

  if (!targetPhone || !targetName) {
    return NextResponse.json(
      { error: "Phone and name must be provided if you are not logged in." },
      { status: 400 }
    )
  }

  let normalizedPhoneE164: string
  let phoneDigits: string
  try {
    normalizedPhoneE164 = normalizePhoneToE164(targetPhone)
    phoneDigits = normalizePhoneDigitsOnly(normalizedPhoneE164)
  } catch {
    return invalidPhoneResponse()
  }

  const normalizedName = normalizeNameForMatching(targetName)
  if (!normalizedName) {
    return NextResponse.json(
      {
        error: "Name is required.",
        code: "INVALID_NAME",
      },
      { status: 400 }
    )
  }

  const rate = await rateLimit(`rate:gdpr:withdraw:${ip}`, 5, 15 * 60)
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again in 15 minutes.",
        code: "RATE_LIMITED",
      },
      { status: 429 }
    )
  }

  if (!session?.user?.id) {
    const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, {
      requireToken: false,
    })
    if (!turnstileResult.success) {
      return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
    }
  }

  const lockKey = `lock:gdpr:withdraw:${phoneDigits}:${normalizedName}`
  const lockAcquired = await cacheSetNX(lockKey, 45)
  if (!lockAcquired) {
    return NextResponse.json(
      {
        error: "A similar request is already being processed.",
        code: "ALREADY_PROCESSING",
        requestId: finalRequestId,
      },
      { status: 202 }
    )
  }

  try {
    const result = await withdrawConsentRecord({
      phone: normalizedPhoneE164,
      name: targetName,
      email: targetEmail,
      withdrawalMethod: session?.user?.id ? "support_form_auth" : "support_form",
    })

    if (!result.updated) {
      return dataNotFoundResponse()
    }

    log.info(
      {
        requestId: finalRequestId,
        ip,
        userAgent,
        phone: maskPhoneForLog(normalizedPhoneE164),
      },
      "Consent withdrawn"
    )

    return NextResponse.json({
      status: "accepted",
      message: "Consent withdrawal request processed successfully.",
      withdrawnDate: result.withdrawnDate,
      requestId: finalRequestId,
    })
  } catch (error) {
    log.error(
      {
        requestId: finalRequestId,
        ip,
        phone: maskPhoneForLog(normalizedPhoneE164),
        error,
      },
      "Consent withdrawal failed"
    )
    return NextResponse.json(
      {
        error: "Failed to process consent withdrawal.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  } finally {
    await cacheDel(lockKey)
  }
}
