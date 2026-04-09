import { NextRequest, NextResponse } from "next/server"
import { formatInTimeZone } from "date-fns-tz"
import prisma from "@/lib/prisma"
import {
  t2m,
  m2t,
  fetchBusyRanges,
  getOpenRangesForDate,
  fitsInOpen,
  overlapsWithBusy,
  minusBusy,
  SCHEDULE_TZ,
} from "@/lib/schedule-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TZ = SCHEDULE_TZ

/**
 * POST /api/bookings/[id]/check-extension
 *
 * "Smart shift" algorithm — checks whether a procedure change can fit into
 * the existing time slot, or suggests an earlier start, or reports no
 * availability. Three possible outcomes:
 *
 *   A) can_extend      — time after current booking is free, keep same start
 *   B) can_shift_back  — shift start earlier to make room + alternative slots
 *   C) no_availability — nothing fits on this day
 *
 * Body: { eventId, currentStartISO, currentEndISO, newProcedureId, masterId? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await params

  let body: {
    eventId?: string
    currentStartISO?: string
    currentEndISO?: string
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

  const { newProcedureId } = body

  if (!newProcedureId) {
    return NextResponse.json(
      { error: "newProcedureId is required", code: "MISSING_PARAMS" },
      { status: 400 }
    )
  }

  try {
    // ── Fetch appointment and new service ─────────────────────────────────
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: { select: { id: true, name: true, duration: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Rezerwacja nie została znaleziona.", code: "BOOKING_NOT_FOUND" },
        { status: 404 }
      )
    }

    const newService = await prisma.service.findUnique({
      where: { id: newProcedureId },
    })

    if (!newService) {
      return NextResponse.json(
        { error: "Wybrana procedura nie istnieje.", code: "SERVICE_NOT_FOUND" },
        { status: 404 }
      )
    }

    const masterId = appointment.masterId
    const dateISO = formatInTimeZone(appointment.date, TZ, "yyyy-MM-dd")
    const currentStartMinutes = t2m(appointment.startTime)
    const newDuration = newService.duration

    if (!Number.isFinite(currentStartMinutes)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format czasu w rezerwacji.", code: "INVALID_TIME" },
        { status: 500 }
      )
    }

    // ── Get schedule data for this day ────────────────────────────────────
    // Exclude current appointment from busy ranges (it's being modified)
    const openRanges = await getOpenRangesForDate(masterId, dateISO)
    const busyRanges = await fetchBusyRanges(masterId, dateISO, appointmentId)

    // ── STEP A: Can we simply extend (keep same start)? ──────────────────
    const newEndMinutes = currentStartMinutes + newDuration

    const canExtend =
      fitsInOpen(openRanges, currentStartMinutes, newEndMinutes) &&
      !overlapsWithBusy(busyRanges, currentStartMinutes, newEndMinutes)

    if (canExtend) {
      return NextResponse.json({
        result: {
          status: "can_extend",
          message: "Czas po aktualnym terminie jest wolny. Można wydłużyć.",
        },
        currentBooking: {
          startISO: buildISO(dateISO, appointment.startTime),
          endISO: buildISO(dateISO, appointment.endTime),
        },
        newProcedure: {
          id: newService.id,
          name: newService.name,
          duration: newService.duration,
        },
      })
    }

    // ── STEP B: Can we shift the start earlier? ──────────────────────────
    let suggested: {
      startMinutes: number
      endMinutes: number
      shiftMinutes: number
      reason: string
    } | null = null

    // Try shifting back in 15-minute increments (15 → 120)
    for (let shiftMin = 15; shiftMin <= 120; shiftMin += 15) {
      const shiftedStart = currentStartMinutes - shiftMin
      const shiftedEnd = shiftedStart + newDuration

      // Can't start before midnight
      if (shiftedStart < 0) break

      const fits =
        fitsInOpen(openRanges, shiftedStart, shiftedEnd) &&
        !overlapsWithBusy(busyRanges, shiftedStart, shiftedEnd)

      if (fits) {
        // Determine why original slot didn't work
        const isConflict = overlapsWithBusy(busyRanges, currentStartMinutes, newEndMinutes)
        const reason = isConflict
          ? "konflikt z kolejną rezerwacją"
          : "poza godzinami pracy"

        suggested = {
          startMinutes: shiftedStart,
          endMinutes: shiftedEnd,
          shiftMinutes: shiftMin,
          reason,
        }
        break // first valid shift = minimal shift
      }
    }

    // Collect alternative slots for this day (up to 5)
    const alternativeSlots = collectAlternativeSlots(
      openRanges,
      busyRanges,
      newDuration,
      currentStartMinutes,
      5
    )

    if (suggested) {
      return NextResponse.json({
        result: {
          status: "can_shift_back",
          message: "Nie można wydłużyć w aktualnym terminie",
          reason: suggested.reason,
          suggestedStartISO: buildISO(dateISO, m2t(suggested.startMinutes)),
          suggestedEndISO: buildISO(dateISO, m2t(suggested.endMinutes)),
          shiftMinutes: suggested.shiftMinutes,
          alternativeSlots: alternativeSlots.map((s) => ({
            startISO: buildISO(dateISO, m2t(s.start)),
            endISO: buildISO(dateISO, m2t(s.end)),
          })),
        },
        currentBooking: {
          startISO: buildISO(dateISO, appointment.startTime),
          endISO: buildISO(dateISO, appointment.endTime),
        },
        newProcedure: {
          id: newService.id,
          name: newService.name,
          duration: newService.duration,
        },
      })
    }

    // ── STEP C: No availability ──────────────────────────────────────────
    return NextResponse.json({
      result: {
        status: "no_availability",
        message: "Brak wolnych terminów w tym dniu dla wybranej procedury.",
        alternativeSlots: alternativeSlots.map((s) => ({
          startISO: buildISO(dateISO, m2t(s.start)),
          endISO: buildISO(dateISO, m2t(s.end)),
        })),
      },
      currentBooking: {
        startISO: buildISO(dateISO, appointment.startTime),
        endISO: buildISO(dateISO, appointment.endTime),
      },
      newProcedure: {
        id: newService.id,
        name: newService.name,
        duration: newService.duration,
      },
    })
  } catch (error) {
    console.error("[/api/bookings/[id]/check-extension] Error:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd serwera.", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a Warsaw-timezone ISO string from a date and "HH:mm" time.
 * Uses formatInTimeZone to produce proper offset-aware strings.
 */
function buildISO(dateISO: string, timeHHmm: string): string {
  const localStr = `${dateISO}T${timeHHmm}:00`
  return formatInTimeZone(
    new Date(localStr),
    TZ,
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  )
}

/**
 * Collect up to `maxSlots` alternative free windows that can fit `duration`
 * minutes. Excludes the current start time to avoid suggesting "keep as is".
 */
function collectAlternativeSlots(
  openRanges: { start: number; end: number }[],
  busyRanges: { start: number; end: number }[],
  duration: number,
  excludeStartMinutes: number,
  maxSlots: number
): { start: number; end: number }[] {
  const freeWindows = minusBusy(openRanges, busyRanges)
  const slots: { start: number; end: number }[] = []

  for (const window of freeWindows) {
    // Align to 15-minute grid
    let cursor = Math.ceil(window.start / 15) * 15
    while (cursor + duration <= window.end && slots.length < maxSlots) {
      // Skip the slot that starts at the current booking time
      if (cursor !== excludeStartMinutes) {
        slots.push({ start: cursor, end: cursor + duration })
      }
      cursor += 15
    }
    if (slots.length >= maxSlots) break
  }

  return slots
}
