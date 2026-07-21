import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getDaySlots } from "@/lib/availability"

export const runtime = "nodejs"

/**
 * GET /api/admin/calendar/availability/slots?date=YYYY-MM-DD&duration=N&masterId=xxx&excludeAppointmentId=xxx
 * Returns available time slots for the given master (admin/superadmin only).
 * Format: { slots: [{ startISO, endISO }] }
 */
export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date") || ""
  const durationParam = searchParams.get("duration")
  const masterId = searchParams.get("masterId")
  const excludeAppointmentId = searchParams.get("excludeAppointmentId")

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
  }

  if (!masterId || masterId === "all") {
    return NextResponse.json({ error: "Master ID is required" }, { status: 400 })
  }

  const duration = Math.max(5, Number(durationParam) || 0)

  try {
    const result = await getDaySlots(date, duration, 15, masterId, excludeAppointmentId || undefined)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching admin availability slots:", error)
    return NextResponse.json({ slots: [] })
  }
}
