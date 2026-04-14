import { NextRequest, NextResponse } from "next/server"
import { getLogger } from "@/lib/logger"
import { rateLimit } from "@/lib/cache"
import { validateTurnstileForAPI } from "@/lib/turnstile"
import { normalizePhoneDigitsOnly, normalizePhoneToE164 } from "@/lib/utils/phone-normalization"
import { eraseConsentData } from "@/lib/consent-service"
import { eraseDataApiSchema } from "@/lib/validation/api-schemas"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

const log = getLogger({ module: "api.consents.erase" })

function maskPhoneForLog(phone: string): string {
  const digits = normalizePhoneDigitsOnly(phone)
  if (digits.length < 4) return "***"
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
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
 * POST /api/consents/erase
 * Erases/anonymizes user consent data and marks GDPR erasure fields.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "0.0.0.0"
  const userAgent = req.headers.get("user-agent") || "Unknown"
  const parsed = eraseDataApiSchema.safeParse(await req.json().catch(() => null))

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
    body.requestId || `gdpr-erase-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

  const session = await auth()
  let targetPhone: string | null | undefined = body.phone
  let targetName: string | null | undefined = body.name
  let targetEmail: string | null | undefined = body.email

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

  const finalPhone = targetPhone;
  const finalName = targetName;
  const finalEmail = targetEmail;

  if (!finalPhone || !finalName) {
    return NextResponse.json(
      { error: "Phone and name must be provided if you are not logged in." },
      { status: 400 }
    )
  }

  let normalizedPhoneE164: string
  try {
    normalizedPhoneE164 = normalizePhoneToE164(finalPhone)
  } catch {
    return invalidPhoneResponse()
  }

  const rate = await rateLimit(`rate:gdpr:erase:${ip}`, 3, 15 * 60)
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

  try {
    const result = await eraseConsentData({
      phone: normalizedPhoneE164,
      name: finalName,
      email: finalEmail,
      erasureMethod: session?.user?.id ? "support_form_auth" : "support_form",
    })

    if (result.reason === "NOT_FOUND") {
      return dataNotFoundResponse()
    }

    if (result.alreadyErased) {
      return NextResponse.json(
        {
          error: "Data has already been erased for this identity.",
          code: "ALREADY_ERASED",
          requestId: finalRequestId,
        },
        { status: 409 }
      )
    }

    log.info(
      {
        requestId: finalRequestId,
        ip,
        userAgent,
        phone: maskPhoneForLog(normalizedPhoneE164),
        erasedRecordsCount: result.erasedRecordsCount,
        anonymizedUsersCount: result.anonymizedUsersCount,
      },
      "Personal data erased"
    )

    return NextResponse.json({
      status: "erased",
      message: "Your personal data has been removed from active systems.",
      details: {
        erasedData: [
          "Name, email, and phone identifiers in consent records",
          "Direct links between consent records and your user profile",
        ],
        retainedData: [
          "Minimal anonymized audit history required for legal compliance",
          "Booking records without direct personal identifiers",
        ],
        bookingInfo: [
          "Past booking timeline is preserved in anonymized form",
          "No new booking can reuse old consent after erasure",
        ],
        notice: "Erasure has been completed and recorded in our GDPR audit log.",
      },
      meta: {
        erasedAt: result.erasedAt,
        erasedRecordsCount: result.erasedRecordsCount,
        anonymizedUsersCount: result.anonymizedUsersCount,
      },
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
      "Data erasure failed"
    )
    return NextResponse.json(
      {
        error: "Failed to process data erasure request.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}
