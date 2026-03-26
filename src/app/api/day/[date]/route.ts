import { NextRequest, NextResponse } from "next/server"
import { getDaySlots } from "@/lib/availability"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

interface RouteParams {
  params: { date: string }
}

/**
 * GET /api/day/2026-03-27?procedureId=xxx&masterId=xxx
 * Returns available time slots for a specific date.
 * Format: { slots: [{ startISO, endISO }] }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { date } = params
  const { searchParams } = new URL(req.url)
  const procedureId = searchParams.get("procedureId")
  const masterId = searchParams.get("masterId")

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
  }

  // Determine duration from selected procedure
  let minDuration = 30
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
    const result = await getDaySlots(date, minDuration, 15, masterId || undefined)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching day slots:", error)
    return NextResponse.json({ slots: [] })
  }
}
