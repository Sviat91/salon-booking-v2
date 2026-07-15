import { NextRequest, NextResponse } from "next/server"
import { formatInTimeZone } from "date-fns-tz"
import prisma from "@/lib/prisma"
import { phonesMatchE164 } from "@/lib/utils/phone-normalization"
import { canModifyBooking } from "@/lib/booking-helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TZ = "Europe/Warsaw"

/**
 * POST /api/bookings/cancel
 *
 * Cancels an upcoming appointment. Double-validates ownership on the server
 * even though the Cancel button is already hidden in UI for <24h bookings.
 *
 * Body: { eventId, firstName, phone, email?, masterId? }
 */
export async function POST(req: NextRequest) {
  let body: {
    eventId?: string
    firstName?: string
    phone?: string
    email?: string
    masterId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    )
  }

  const { eventId, firstName, phone } = body

  // ── Validate required fields ───────────────────────────────────────────────
  if (!eventId || !firstName || !phone) {
    return NextResponse.json(
      { error: "eventId, firstName and phone are required", code: "MISSING_PARAMS" },
      { status: 400 }
    )
  }

  const searchPhoneDigits = phone.replace(/\D/g, "")
  if (searchPhoneDigits.length < 9) {
    return NextResponse.json(
      { error: "Phone number too short", code: "INVALID_PHONE" },
      { status: 400 }
    )
  }

  try {
    // ── Find appointment ───────────────────────────────────────────────────
    const appointment = await prisma.appointment.findUnique({
      where: { id: eventId },
      include: {
        client: { select: { name: true, phone: true, email: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Rezerwacja nie została znaleziona.", code: "BOOKING_NOT_FOUND" },
        { status: 404 }
      )
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Rezerwacja jest już anulowana.", code: "ALREADY_CANCELLED" },
        { status: 409 }
      )
    }

    // ── Verify ownership — full E.164 phone number ─────────────────────────
    const phoneMatch = phonesMatchE164(phone, appointment.client.phone)
    if (!phoneMatch) {
      return NextResponse.json(
        { error: "Weryfikacja nie powiodła się. Sprawdź poprawność danych.", code: "VERIFICATION_FAILED" },
        { status: 403 }
      )
    }

    // ── Server-side 24h guard (mirrors UI hide logic) ──────────────────────
    const dateISO  = formatInTimeZone(appointment.date, TZ, "yyyy-MM-dd")
    const apptDate = new Date(`${dateISO}T${appointment.startTime}:00`)
    const { canModify } = canModifyBooking(apptDate)

    if (!canModify) {
      return NextResponse.json(
        {
          error: "Nie można anulować rezerwacji mniej niż 24 godziny przed terminem.",
          code: "TOO_LATE_TO_CANCEL",
        },
        { status: 400 }
      )
    }

    // ── Cancel ─────────────────────────────────────────────────────────────
    await prisma.appointment.update({
      where: { id: eventId },
      data:  { status: "CANCELLED" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[/api/bookings/cancel] Error:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd serwera.", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
