import { NextRequest, NextResponse } from "next/server"
import { getAvailableDays } from "@/lib/availability"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * GET /api/availability?from=YYYY-MM-DD&until=YYYY-MM-DD&procedureId=xxx&masterId=xxx
 * Returns available days for booking calendar.
 * Format: { days: [{ date: "YYYY-MM-DD", hasWindow: boolean }] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const until = searchParams.get("until")
  const procedureId = searchParams.get("procedureId")
  const masterId = searchParams.get("masterId")

  if (!from || !until) {
    return NextResponse.json(
      { error: "Missing 'from' and 'until' query parameters" },
      { status: 400 }
    )
  }

  // Determine minimum duration from the selected procedure
  let minDuration = 30 // default fallback
  if (procedureId) {
    try {
      const service = await prisma.service.findUnique({
        where: { id: procedureId },
        select: { duration: true },
      })
      if (service) {
        minDuration = service.duration
      }
    } catch {
      // Use default
    }
  }

  try {
    const result = await getAvailableDays(from, until, minDuration, {
      masterId: masterId || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json({ days: [] })
  }
}
