import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAvailableDays } from "@/lib/availability"

export const runtime = "nodejs"

/**
 * GET /api/master/availability/days?from=YYYY-MM-DD&until=YYYY-MM-DD&duration=N
 * Returns which days have at least one free slot for the logged-in master.
 * Format: { days: [{ date, hasWindow }] }
 */
export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") || ""
  const until = searchParams.get("until") || ""
  const durationParam = searchParams.get("duration")

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
  }

  const duration = Math.max(5, Number(durationParam) || 0)

  try {
    const result = await getAvailableDays(from, until, duration, { masterId: session.user.id })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching master availability days:", error)
    return NextResponse.json({ days: [] })
  }
}
