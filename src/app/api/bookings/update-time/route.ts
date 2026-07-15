import { NextRequest, NextResponse } from "next/server"
import { formatInTimeZone } from "date-fns-tz"
import prisma from "@/lib/prisma"
import { phonesMatchE164 } from "@/lib/utils/phone-normalization"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TZ = "Europe/Warsaw"

/**
 * Warsaw-safe time/date extractors using Intl.DateTimeFormat.
 * Mirrors the pattern from /api/book/route.ts — no daylight-saving issues.
 */
const wTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
})
const wDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * POST /api/bookings/update-time
 *
 * Updates the date/time of an existing appointment.
 * Validates ownership (full E.164 phone number) and checks for time conflicts.
 *
 * Body: {
 *   eventId, procedureName?, firstName, lastName, phone, email?,
 *   price?, newStartISO, newEndISO, masterId?
 * }
 */
export async function POST(req: NextRequest) {
  let body: {
    eventId?: string
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
    procedureName?: string
    price?: number
    newStartISO?: string
    newEndISO?: string
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

  const { eventId, phone, newStartISO, newEndISO } = body

  // ── Validate required fields ───────────────────────────────────────────────
  if (!eventId || !phone || !newStartISO || !newEndISO) {
    return NextResponse.json(
      { error: "eventId, phone, newStartISO and newEndISO are required", code: "MISSING_PARAMS" },
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

  // Parse new start/end into Date objects
  const newStartDate = new Date(newStartISO)
  const newEndDate = new Date(newEndISO)

  if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid ISO date format", code: "INVALID_DATE" },
      { status: 400 }
    )
  }

  // Extract Warsaw-safe date and time components
  const newDate = wDateFormatter.format(newStartDate)       // "YYYY-MM-DD"
  const newStartTime = wTimeFormatter.format(newStartDate)  // "HH:mm"
  const newEndTime = wTimeFormatter.format(newEndDate)      // "HH:mm"

  try {
    // ── Find appointment ───────────────────────────────────────────────────
    const appointment = await prisma.appointment.findUnique({
      where: { id: eventId },
      include: {
        client: { select: { phone: true } },
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
    const dateISO = formatInTimeZone(appointment.date, TZ, "yyyy-MM-dd")
    const apptTimestamp = new Date(`${dateISO}T${appointment.startTime}:00`).getTime()
    const hoursUntil = (apptTimestamp - Date.now()) / (1000 * 60 * 60)

    if (hoursUntil < 24) {
      return NextResponse.json(
        {
          error: "Nie można zmienić rezerwacji mniej niż 24 godziny przed terminem.",
          code: "TOO_LATE_TO_MODIFY",
        },
        { status: 400 }
      )
    }

    // ── Check for time conflict at the new slot ────────────────────────────
    // Use the appointment's masterId (canonical source of truth)
    const targetMasterId = appointment.masterId

    const hasConflict = await prisma.$transaction(async (tx) => {
      const conflicting = await tx.appointment.findFirst({
        where: {
          masterId: targetMasterId,
          date: new Date(newDate),
          status: { not: "CANCELLED" },
          id: { not: eventId }, // exclude current appointment
          // Overlap condition: existing.start < new.end AND existing.end > new.start
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime },
        },
      })
      if (conflicting) return true
      await tx.appointment.update({
        where: { id: eventId },
        data: { date: new Date(newDate), startTime: newStartTime, endTime: newEndTime },
      })
      return false
    })

    if (hasConflict) {
      return NextResponse.json(
        { error: "Wybrany termin jest już zajęty.", code: "CONFLICT" },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[/api/bookings/update-time] Error:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd serwera.", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
