import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TZ = "Europe/Warsaw"

/**
 * Warsaw-safe time/date extractors using Intl.DateTimeFormat.
 * Mirrors the pattern from /api/book/route.ts.
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
 * PATCH /api/bookings/[id]
 *
 * Combined update — can change procedure, time, or both in a single request.
 * Called from the frontend when a procedure change requires a new time slot
 * (e.g. after check-extension returns "can_shift_back" or manual time pick).
 *
 * Body: { newProcedureId?, newStartISO?, newEndISO?, masterId? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await params

  let body: {
    newProcedureId?: string
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

  const { newProcedureId, newStartISO, newEndISO } = body

  // At least one change must be provided
  if (!newProcedureId && !newStartISO) {
    return NextResponse.json(
      { error: "At least newProcedureId or newStartISO must be provided", code: "MISSING_PARAMS" },
      { status: 400 }
    )
  }

  try {
    // ── Find appointment ───────────────────────────────────────────────────
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: { select: { name: true } },
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

    // ── Build update data ──────────────────────────────────────────────────
    const updateData: Record<string, unknown> = {}
    const changes: Record<string, string> = {}

    // Handle time change
    if (newStartISO && newEndISO) {
      const newStartDate = new Date(newStartISO)
      const newEndDate = new Date(newEndISO)

      if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid ISO date format", code: "INVALID_DATE" },
          { status: 400 }
        )
      }

      const newDate = wDateFormatter.format(newStartDate)
      const newStartTime = wTimeFormatter.format(newStartDate)
      const newEndTime = wTimeFormatter.format(newEndDate)

      // Check for time conflict
      const conflicting = await prisma.appointment.findFirst({
        where: {
          masterId: appointment.masterId,
          date: new Date(newDate),
          status: { not: "CANCELLED" },
          id: { not: appointmentId },
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime },
        },
      })

      if (conflicting) {
        return NextResponse.json(
          { error: "Wybrany termin jest już zajęty.", code: "CONFLICT" },
          { status: 409 }
        )
      }

      updateData.date = new Date(newDate)
      updateData.startTime = newStartTime
      updateData.endTime = newEndTime

      changes.startTime = newStartISO
      changes.endTime = newEndISO
    }

    // Handle procedure change
    if (newProcedureId) {
      const newService = await prisma.service.findUnique({
        where: { id: newProcedureId },
      })

      if (!newService) {
        return NextResponse.json(
          { error: "Wybrana procedura nie istnieje.", code: "SERVICE_NOT_FOUND" },
          { status: 404 }
        )
      }

      updateData.serviceId = newProcedureId
      changes.procedure = newService.name
    }

    // ── Apply updates ──────────────────────────────────────────────────────
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    })

    return NextResponse.json({ changes })
  } catch (error) {
    console.error("[/api/bookings/[id]] Error:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd serwera.", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
