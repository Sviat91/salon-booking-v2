import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAvailableDays } from "@/lib/availability"

export const runtime = "nodejs"

/**
 * GET /api/admin/calendar/availability/days?from=YYYY-MM-DD&until=YYYY-MM-DD&duration=N&masterId=xxx
 * Returns which days have at least one free slot for the given master (admin/superadmin only).
 * Format: { days: [{ date, hasWindow }] }
 */
export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") || ""
  const until = searchParams.get("until") || ""
  const durationParam = searchParams.get("duration")
  const masterId = searchParams.get("masterId")

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
  }

  if (!masterId || masterId === "all") {
    return NextResponse.json({ error: "Master ID is required" }, { status: 400 })
  }

  const duration = Math.max(5, Number(durationParam) || 0)

  try {
    const result = await getAvailableDays(from, until, duration, { masterId })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching admin availability days:", error)
    return NextResponse.json({ days: [] })
  }
}
