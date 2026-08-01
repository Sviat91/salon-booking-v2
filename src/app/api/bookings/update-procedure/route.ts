import { NextRequest, NextResponse } from "next/server"
import { formatInTimeZone } from "date-fns-tz"
import prisma from "@/lib/prisma"
import { t2m, m2t } from "@/lib/schedule-utils"
import { phonesMatchE164 } from "@/lib/utils/phone-normalization"
import { canModifyBooking } from "@/lib/booking-helpers"
import { notifyBookingUpdate } from "@/lib/notifications"
import { resnapshotAppointmentPrice } from "@/lib/discounts/server"
import { rateLimit } from "@/lib/cache"
import { getRequestIp } from "@/lib/consent-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TZ = "Europe/Warsaw"

/**
 * POST /api/bookings/update-procedure
 *
 * Changes the procedure (service) for an existing appointment.
 * Recalculates endTime based on the new service duration while keeping
 * the existing startTime. Does NOT check for conflicts — the caller is
 * expected to use /check-extension first when duration increases.
 *
 * Body: {
 *   eventId, firstName, lastName, phone, email?,
 *   currentStartISO, newProcedureId, masterId?
 * }
 */
export async function POST(req: NextRequest) {
  let body: {
    eventId?: string
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
    currentStartISO?: string
    newProcedureId?: string
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

  const ip = getRequestIp(req)
  const { allowed } = await rateLimit(`rate:bookings-update-procedure:${ip}`, 15, 15 * 60)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }

  const { eventId, phone, newProcedureId } = body

  // ── Validate required fields ───────────────────────────────────────────────
  if (!eventId || !phone || !newProcedureId) {
    return NextResponse.json(
      { error: "eventId, phone and newProcedureId are required", code: "MISSING_PARAMS" },
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
        client: { select: { phone: true } },
        service: { select: { name_pl: true } },
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

    // ── Server-side 24h guard ──────────────────────────────────────────────
    const dateISO  = formatInTimeZone(appointment.date, TZ, "yyyy-MM-dd")
    const apptDate = new Date(`${dateISO}T${appointment.startTime}:00`)
    const { canModify } = canModifyBooking(apptDate)

    if (!canModify) {
      return NextResponse.json(
        {
          error: "Nie można zmienić rezerwacji mniej niż 24 godziny przed terminem.",
          code: "TOO_LATE_TO_MODIFY",
        },
        { status: 400 }
      )
    }

    // ── Find the new service ───────────────────────────────────────────────
    const newService = await prisma.service.findUnique({
      where: { id: newProcedureId },
    })

    if (!newService) {
      return NextResponse.json(
        { error: "Wybrana procedura nie istnieje.", code: "SERVICE_NOT_FOUND" },
        { status: 404 }
      )
    }

    // ── Recalculate endTime based on existing startTime + new duration ─────
    const startMinutes = t2m(appointment.startTime)
    if (!Number.isFinite(startMinutes)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format czasu w rezerwacji.", code: "INVALID_TIME" },
        { status: 500 }
      )
    }
    const newEndMinutes = startMinutes + newService.duration
    const newEndTime = m2t(newEndMinutes) // "HH:mm"

    // ── Update appointment with new service and recalculated endTime ───────
    await prisma.appointment.update({
      where: { id: eventId },
      data: {
        serviceId: newProcedureId,
        endTime: newEndTime,
      },
    })

    // Service changed — re-snapshot the price, clearing any applied discount
    // (AD-7): a discount evaluated for the old service must not silently
    // carry over.
    if (newProcedureId !== appointment.serviceId) {
      await resnapshotAppointmentPrice(eventId)
    }

    notifyBookingUpdate(
      eventId,
      {
        date: appointment.date,
        startTime: appointment.startTime,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name_pl,
      },
      'client'
    ).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[/api/bookings/update-procedure] Error:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd serwera.", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
