import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

const IntervalSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time"),
})

const BulkOverrideSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")).min(1, "At least one date required"),
  isDayOff: z.boolean(),
  intervals: z.array(IntervalSchema),
})

// POST /api/master/schedule/overrides/bulk
// Creates or updates DateOverrides for multiple dates at once (Bulk Settings)
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof BulkOverrideSchema>
  try {
    body = BulkOverrideSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message, code: "VALIDATION_ERROR" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const serializedIntervals = JSON.stringify(body.intervals)
    const masterId = session.user.id

    // Use a transaction to perform all upserts
    const results = await prisma.$transaction(
      body.dates.map((dateStr) => {
        const dateObj = new Date(`${dateStr}T00:00:00.000Z`)
        return prisma.dateOverride.upsert({
          where: {
            masterId_date: {
              masterId,
              date: dateObj,
            },
          },
          update: {
            isDayOff: body.isDayOff,
            intervals: serializedIntervals,
          },
          create: {
            masterId,
            date: dateObj,
            isDayOff: body.isDayOff,
            intervals: serializedIntervals,
          },
        })
      })
    )

    return NextResponse.json({ 
      success: true, 
      count: results.length 
    }, { status: 200 })
  } catch (error) {
    console.error("Error bulk updating overrides:", error)
    return NextResponse.json({ error: "Failed to perform bulk update" }, { status: 500 })
  }
}
