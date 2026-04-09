import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { bookingApiSchema } from "@/lib/validation/api-schemas"
import { evaluateConsentStatus, getRequestIp, saveConsentRecord } from "@/lib/consent-service"
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
      console.error("[Booking API] Validation error:", err.errors)
      return NextResponse.json(
        { error: "Invalid booking data", code: "VALIDATION_ERROR", details: err.errors[0]?.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { startISO, endISO, procedureId, masterId, name, phone, email, consents } = body

  if (!masterId) {
    return NextResponse.json({ error: "masterId is required", code: "MISSING_MASTER" }, { status: 400 })
  }

  // Parse start/end times from ISO strings
  const startDate = new Date(startISO)
  const endDate = new Date(endISO)

  // Extract date and time components explicitly in Warsaw timezone
  const wTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const wDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // Returns "YYYY-MM-DD" safely
  const dateOnly = wDateFormatter.format(startDate)
  // Returns "HH:mm" safely regardless of Node.js server timezone
  const startTime = wTimeFormatter.format(startDate)
  const endTime = wTimeFormatter.format(endDate)

  try {
    const consentStatus = await evaluateConsentStatus({ phone, name, email })
    const hasRequiredNewConsents = Boolean(consents?.dataProcessing && consents?.terms)
    const needsNewConsent = !consentStatus.hasValidConsent

    if (needsNewConsent && !hasRequiredNewConsents) {
      return NextResponse.json(
        {
          error: "Consent required before booking",
          code: "CONSENT_REQUIRED",
        },
        { status: 400 }
      )
    }

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
    // Identity = (phone + name) — a couple sharing the same phone get separate records.
    const normalizedName = name.trim()
    let clientUser = phone
      ? await prisma.user.findFirst({
          where: {
            phone,
            name: normalizedName,
          },
        })
      : null

    if (!clientUser) {
      clientUser = await prisma.user.create({
        data: {
          name: normalizedName,
          phone: phone || null,
          email: email || null,
          role: "CLIENT",
          isGuest: true,
        },
      })
    } else {
      // Update email if provided and user has no email yet
      if (email && !clientUser.email) {
        await prisma.user.update({ where: { id: clientUser.id }, data: { email } })
      }
    }

    // 3. Persist consent when user is booking after consent modal confirmation.
    if (needsNewConsent && hasRequiredNewConsents) {
      await saveConsentRecord({
        userId: clientUser.id,
        phone,
        name,
        email,
        ip: getRequestIp(req),
        dataProcessing: Boolean(consents?.dataProcessing),
        terms: Boolean(consents?.terms),
        notifications: Boolean(consents?.notifications),
      })
    }

    // 4. Resolve service — use provided procedureId or create placeholder
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

    // 5. Create the appointment
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
