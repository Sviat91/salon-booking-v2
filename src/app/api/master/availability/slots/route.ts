import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getDaySlots } from "@/lib/availability"

export const runtime = "nodejs"

/**
 * GET /api/master/availability/slots?date=YYYY-MM-DD&duration=N&excludeAppointmentId=xxx
 * Returns available time slots for the logged-in master.
 * Format: { slots: [{ startISO, endISO }] }
 */
export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date") || ""
  const durationParam = searchParams.get("duration")
  const excludeAppointmentId = searchParams.get("excludeAppointmentId")

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
  }

  const duration = Math.max(5, Number(durationParam) || 0)

  try {
    const result = await getDaySlots(date, duration, 15, session.user.id, excludeAppointmentId || undefined)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching master availability slots:", error)
    return NextResponse.json({ slots: [] })
  }
}
