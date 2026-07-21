import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

// Input validation schema
const appointmentSchema = z.object({
  entries: z.array(z.object({
    date: z.string(), // "2026-03-20"
    startTime: z.string(), // "10:00"
    duration: z.number().min(5),
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
  })).min(1),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  notes: z.string().optional()
})

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const dateFilter: Record<string, Date> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    dateFilter.lte = toDate
  }

  try {
    const [appointments, masterProfile] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          masterId: session.user.id,
          status: { not: "CANCELLED" },
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
          master: { select: { masterProfile: { select: { color: true } } } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      prisma.masterProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }),
    ])

    let appointmentsWithEffectivePrice = appointments

    if (masterProfile) {
      const serviceIds = Array.from(new Set(appointments.map((a) => a.service.id)))
      if (serviceIds.length > 0) {
        const masterOverrides = await prisma.masterService.findMany({
          where: {
            masterProfileId: masterProfile.id,
            serviceId: { in: serviceIds },
          },
          select: {
            serviceId: true,
            priceOverride: true,
          },
        })

        const overrideByServiceId = new Map<string, number>(
          masterOverrides
            .filter((o) => o.priceOverride !== null)
            .map((o) => [o.serviceId, o.priceOverride as number])
        )

        appointmentsWithEffectivePrice = appointments.map((appointment) => {
          const overridePrice = overrideByServiceId.get(appointment.service.id)
          if (overridePrice === undefined) return appointment
          return {
            ...appointment,
            service: {
              ...appointment.service,
              price: overridePrice,
            },
          }
        })
      }
    }

    return NextResponse.json({ appointments: appointmentsWithEffectivePrice })
  } catch (error) {
    console.error("Error fetching master appointments:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const masterId = session.user.id
  
  try {
    const body = await req.json()
    const parsed = appointmentSchema.parse(body)

    // 1. Resolve Client
    let finalClientId = parsed.clientId
    if (!finalClientId) {
       if (!parsed.clientName) {
         return NextResponse.json({ error: "Client Name is required if no existing client selected" }, { status: 400 })
       }
       
       // Try to find existing client by phone + name (identity pair)
       if (parsed.clientPhone) {
         const existingUser = await prisma.user.findFirst({
           where: {
             phone: parsed.clientPhone,
             name: parsed.clientName,
           },
         })
         if (existingUser) {
           finalClientId = existingUser.id
         }
       }
       
       if (!finalClientId) {
         const newUser = await prisma.user.create({
           data: {
             name: parsed.clientName,
             phone: parsed.clientPhone || null,
             role: "CLIENT",
             isGuest: true
           }
         })
         finalClientId = newUser.id
       }
    }

    // 2. Insert Appointments (resolving a service per entry, AD-B3)
    const createdAppointments = []

    for (const entry of parsed.entries) {
      const { date, startTime, duration } = entry

      const [h, m] = startTime.split(':').map(Number)
      const endMins = h * 60 + m + duration
      const endH = Math.floor(endMins / 60)
      const endM = endMins % 60
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

      let entryServiceId = entry.serviceId
      if (!entryServiceId) {
        if (!entry.serviceName) {
          return NextResponse.json({ error: "Service Name is required if no existing service selected" }, { status: 400 })
        }
        // Create a custom service on the fly for this master
        const customService = await prisma.service.create({
          data: {
            name_pl: entry.serviceName,
            duration,
            price: 0,
            masterId: masterId
          }
        })
        entryServiceId = customService.id
      }

      const appt = await prisma.appointment.create({
        data: {
          clientId: finalClientId,
          masterId: masterId,
          serviceId: entryServiceId,
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
    if (error instanceof z.ZodError) {
       return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}
