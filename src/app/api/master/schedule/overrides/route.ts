import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"
import { startOfDay } from "date-fns"

export const runtime = "nodejs"

// GET /api/master/schedule/overrides
export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get("from")
  const toStr = searchParams.get("to")

  const dateFilter: Record<string, Date> = {}
  
  // Default to today forwards if no 'from' provided
  if (fromStr) {
    dateFilter.gte = startOfDay(new Date(fromStr))
  } else {
    dateFilter.gte = startOfDay(new Date())
  }

  if (toStr) {
    const toDate = new Date(toStr)
    toDate.setHours(23, 59, 59, 999)
    dateFilter.lte = toDate
  }

  try {
    const overrides = await prisma.dateOverride.findMany({
      where: {
        masterId: session.user.id,
        date: dateFilter,
      },
      orderBy: { date: "asc" },
    })

    return NextResponse.json({ overrides })
  } catch (error) {
    console.error("Error fetching date overrides:", error)
    return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 })
  }
}

const IntervalSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time"),
})

const OverrideCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  isDayOff: z.boolean(),
  intervals: z.array(IntervalSchema),
})

// POST /api/master/schedule/overrides
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof OverrideCreateSchema>
  try {
    body = OverrideCreateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message, code: "VALIDATION_ERROR" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const dateObj = new Date(`${body.date}T00:00:00.000Z`)

  try {
    const serializedIntervals = JSON.stringify(body.intervals)

    const override = await prisma.dateOverride.upsert({
      where: {
        masterId_date: {
          masterId: session.user.id,
          date: dateObj,
        },
      },
      update: {
        isDayOff: body.isDayOff,
        intervals: serializedIntervals,
      },
      create: {
        masterId: session.user.id,
        date: dateObj,
        isDayOff: body.isDayOff,
        intervals: serializedIntervals,
      },
    })

    return NextResponse.json({ override }, { status: 200 })
  } catch (error) {
    console.error("Error updating date override:", error)
    return NextResponse.json({ error: "Failed to update override" }, { status: 500 })
  }
}
