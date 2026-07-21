import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

const appointmentSchema = z.object({
  entries: z.array(z.object({
    date: z.string(),
    startTime: z.string(),
    duration: z.number().min(5),
  })).min(1),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  notes: z.string().optional(),
  masterId: z.string().optional()
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const masterId = searchParams.get("masterId")

  const dateFilter: Record<string, Date> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    dateFilter.lte = toDate
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(masterId && masterId !== "all" ? { masterId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        service: { select: { id: true, name_pl: true, name_en: true, name_uk: true, duration: true, price: true } },
        client: { select: { id: true, name: true, phone: true, email: true } },
        master: { select: { id: true, name: true, masterProfile: { select: { color: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error("Error fetching admin appointments:", error)
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = appointmentSchema.parse(body)

    if (!parsed.masterId || parsed.masterId === "all") {
       return NextResponse.json({ error: "Master ID is required" }, { status: 400 })
    }

    const masterId = parsed.masterId

    let finalClientId = parsed.clientId
    if (!finalClientId) {
       if (!parsed.clientName) return NextResponse.json({ error: "Client Name is required" }, { status: 400 })
       if (parsed.clientPhone) {
         const existingUser = await prisma.user.findFirst({
           where: { phone: parsed.clientPhone, name: parsed.clientName },
         })
         if (existingUser) finalClientId = existingUser.id
       }
       if (!finalClientId) {
         const newUser = await prisma.user.create({
           data: { name: parsed.clientName, phone: parsed.clientPhone || null, role: "CLIENT", isGuest: true }
         })
         finalClientId = newUser.id
       }
    }

    let finalServiceId = parsed.serviceId
    if (!finalServiceId) {
      if (!parsed.serviceName) return NextResponse.json({ error: "Service Name is required" }, { status: 400 })
      const customService = await prisma.service.create({
        data: { name_pl: parsed.serviceName, duration: parsed.entries[0].duration, price: 0, masterId }
      })
      finalServiceId = customService.id
    }

    const createdAppointments = []
    for (const entry of parsed.entries) {
      const { date, startTime, duration } = entry
      const [h, m] = startTime.split(':').map(Number)
      const endMins = h * 60 + m + duration
      const endH = Math.floor(endMins / 60)
      const endM = endMins % 60
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

      const appt = await prisma.appointment.create({
        data: {
          clientId: finalClientId,
          masterId,
          serviceId: finalServiceId,
          date: new Date(date),
          startTime,
          endTime,
          notes: parsed.notes || null,
          status: "CONFIRMED"
        }
      })
      createdAppointments.push(appt)
    }

    return NextResponse.json({ success: true, count: createdAppointments.length })
  } catch (error: any) {
    console.error("Error creating appointment:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}
