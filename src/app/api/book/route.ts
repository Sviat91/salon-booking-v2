import { NextRequest, NextResponse } from "next/server"
import { bookingApiSchema } from "@/lib/validation/api-schemas"
import { getRequestIp } from "@/lib/consent-service"
import { z } from "zod"
import { auth } from "@/auth"
import { createBooking, type CreateBookingErrorCode } from "@/lib/booking-service"

export const runtime = "nodejs"

const STATUS_FOR_CODE: Record<CreateBookingErrorCode, number> = {
  VALIDATION_ERROR: 400,
  MISSING_MASTER: 400,
  INVALID_PHONE: 400,
  CONSENT_REQUIRED: 400,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
  DISCOUNT_INVALID: 400,
}

/**
 * POST /api/book
 * Creates a new booking (guest flow — no auth required).
 *
 * Body: { startISO, endISO, procedureId?, masterId?, name, phone, email?, turnstileToken?, language?, discountCode?, consents? }
 * Returns: { eventId: string, originalPrice: number, finalPrice: number, discountPercent: number | null }
 *
 * Thin HTTP wrapper around the shared `createBooking()` transaction
 * (`@/lib/booking-service`), which is also used by the Telegram client
 * booking bot. Do not re-implement booking logic here.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof bookingApiSchema>

  try {
    const raw = await req.json()
    body = bookingApiSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("[Booking API] Validation error:", err.errors)
      return NextResponse.json(
        { error: "Invalid booking data", code: "VALIDATION_ERROR", details: err.errors[0]?.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const session = await auth();
  const isAuth = session?.user?.role === "CLIENT";

  const result = await createBooking({
    startISO: body.startISO,
    endISO: body.endISO,
    procedureId: body.procedureId,
    masterId: body.masterId,
    name: body.name,
    phone: body.phone,
    email: body.email,
    language: body.language,
    consents: body.consents,
    ip: getRequestIp(req),
    authenticatedUserId: isAuth ? session!.user!.id : null,
    discountCode: body.discountCode,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: STATUS_FOR_CODE[result.code] }
    )
  }

  return NextResponse.json({
    eventId: result.appointmentId,
    originalPrice: result.originalPrice,
    finalPrice: result.finalPrice,
    discountPercent: result.discountPercent,
  })
}
