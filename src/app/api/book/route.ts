import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { bookingApiSchema } from "@/lib/validation/api-schemas"
import { z } from "zod"

export const runtime = "nodejs"

/**
 * POST /api/book
 * Creates a new booking (guest flow — no auth required).
 * 
 * Body: { startISO, endISO, procedureId?, masterId?, name, phone, email?, turnstileToken?, consents? }
 * Returns: { eventId: string }
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof bookingApiSchema>

  try {
    const raw = await req.json()
    body = bookingApiSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid booking data", code: "VALIDATION_ERROR", details: err.errors[0]?.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { startISO, endISO, procedureId, masterId, name, phone, email } = body

  if (!masterId) {
    return NextResponse.json({ error: "masterId is required", code: "MISSING_MASTER" }, { status: 400 })
  }

  // Parse start/end times from ISO strings
  const startDate = new Date(startISO)
  const endDate = new Date(endISO)

  // Extract date and time components
  const dateOnly = startISO.slice(0, 10) // "YYYY-MM-DD"
  const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
  const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

  try {
    // 1. Check for time conflict — no overlapping appointments for this master
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        masterId,
        date: new Date(dateOnly),
        status: { not: "CANCELLED" },
        // Check overlap: existing.start < new.end AND existing.end > new.start
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    })

    if (existingAppointment) {
      return NextResponse.json(
        { error: "Time slot is already booked", code: "CONFLICT" },
        { status: 409 }
      )
    }

    // 2. Find or create client user
    let clientUser = phone
      ? await prisma.user.findUnique({ where: { phone } })
      : null

    if (!clientUser) {
      clientUser = await prisma.user.create({
        data: {
          name,
          phone: phone || null,
          email: email || null,
          role: "CLIENT",
          isGuest: true,
        },
      })
    } else {
      // Update name/email if provided and user has no data
      const updates: Record<string, string> = {}
      if (name && !clientUser.name) updates.name = name
      if (email && !clientUser.email) updates.email = email
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: clientUser.id }, data: updates })
      }
    }

    // 3. Resolve service — use provided procedureId or create placeholder
    let serviceId = procedureId
    if (!serviceId) {
      // Find any generic service as fallback
      const genericService = await prisma.service.findFirst({
        where: { masterId: null },
      })
      if (genericService) {
        serviceId = genericService.id
      } else {
        // Create a placeholder "Consultation" service
        const placeholder = await prisma.service.create({
          data: { name: "Консультация", duration: 60, price: 0 },
        })
        serviceId = placeholder.id
      }
    }

    // 4. Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        clientId: clientUser.id,
        masterId,
        serviceId,
        date: new Date(dateOnly),
        startTime,
        endTime,
        status: "CONFIRMED",
      },
    })

    return NextResponse.json({ eventId: appointment.id })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Failed to create booking", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
