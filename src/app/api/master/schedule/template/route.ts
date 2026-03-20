import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

// GET /api/master/schedule/template
export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const templates = await prisma.schedule.findMany({
      where: { masterId: session.user.id },
      orderBy: { dayOfWeek: "asc" },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("Error fetching schedule template:", error)
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
  }
}

const IntervalSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time"),
})

const TemplateUpdateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isDayOff: z.boolean(),
  intervals: z.array(IntervalSchema),
})

// POST /api/master/schedule/template
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof TemplateUpdateSchema>
  try {
    body = TemplateUpdateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message, code: "VALIDATION_ERROR" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const serializedIntervals = JSON.stringify(body.intervals)

    const schedule = await prisma.schedule.upsert({
      where: {
        masterId_dayOfWeek: {
          masterId: session.user.id,
          dayOfWeek: body.dayOfWeek,
        },
      },
      update: {
        isDayOff: body.isDayOff,
        intervals: serializedIntervals,
      },
      create: {
        masterId: session.user.id,
        dayOfWeek: body.dayOfWeek,
        isDayOff: body.isDayOff,
        intervals: serializedIntervals,
      },
    })

    return NextResponse.json({ schedule }, { status: 200 })
  } catch (error) {
    console.error("Error updating schedule template:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}
