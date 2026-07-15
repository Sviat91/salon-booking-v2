import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { bookingApiSchema } from "@/lib/validation/api-schemas"
import { evaluateConsentStatus, getRequestIp, saveConsentRecord } from "@/lib/consent-service"
import { z } from "zod"
import { auth } from "@/auth"
import { notifyBookingConfirmation } from "@/lib/notifications"
import { normalizePhoneToE164 } from "@/lib/utils/phone-normalization"

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

  const session = await auth();
  const isAuth = session?.user?.role === "CLIENT";

  if (!isAuth && (!phone || phone.trim().length < 5)) {
    return NextResponse.json({ error: "Phone number is required for booking", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  let normalizedGuestPhone: string | null = null
  if (!isAuth && phone) {
    try {
      normalizedGuestPhone = normalizePhoneToE164(phone)
    } catch {
      return NextResponse.json(
        { error: "Invalid phone number", code: "INVALID_PHONE" },
        { status: 400 }
      )
    }
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
    const hasRequiredNewConsents = Boolean(consents?.dataProcessing && consents?.terms)
    let needsNewConsent = false

    // Consent is enforced only for guest booking flow.
    // Authenticated clients accept consents during registration.
    if (!isAuth) {
      if (!phone || !name) {
        return NextResponse.json({ error: "Missing identity for guest consent check", code: "VALIDATION_ERROR" }, { status: 400 })
      }
      const consentStatus = await evaluateConsentStatus({ phone, name, email: email ?? undefined })
      needsNewConsent = !consentStatus.hasValidConsent
    }

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
    let clientUser = null;
    let userIdForConsent = null;

    if (isAuth) {
      clientUser = await prisma.user.findUnique({ where: { id: session.user.id } })
      if (!clientUser) {
        return NextResponse.json({ error: "Session user not found", code: "UNAUTHORIZED" }, { status: 401 })
      }
      userIdForConsent = clientUser.id;
    } else {
      // Identity = (phone + name) — a couple sharing the same phone get separate records.
      const normalizedName = name.trim()
      clientUser = normalizedGuestPhone
        ? await prisma.user.findFirst({
            where: {
              phone: normalizedGuestPhone,
              name: normalizedName,
              isGuest: true
            },
          })
        : null

      if (!clientUser) {
        clientUser = await prisma.user.create({
          data: {
            name: normalizedName,
            phone: normalizedGuestPhone,
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
      userIdForConsent = clientUser.id;
    }

    // 3. Persist consent when user is booking after consent modal confirmation.
    if (!isAuth && needsNewConsent && hasRequiredNewConsents && userIdForConsent) {
      if (!phone || !name) {
        // This shouldn't normally happen due to line 43, but for TS safety:
        return NextResponse.json({ error: "Missing identity for guest consent saving", code: "VALIDATION_ERROR" }, { status: 400 })
      }
      await saveConsentRecord({
        userId: userIdForConsent,
        phone,
        name,
        email: email || null,
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
          data: { name: "General Service", duration: 60, price: 0 },
        })
        serviceId = placeholder.id
      }
    }

    // 5. Create the appointment — re-check conflict atomically to close the race window
    const created = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          masterId,
          date: new Date(dateOnly),
          status: { not: "CANCELLED" },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflict) return null
      return tx.appointment.create({
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
    })

    if (!created) {
      return NextResponse.json(
        { error: "Time slot is already booked", code: "CONFLICT" },
        { status: 409 }
      )
    }

    notifyBookingConfirmation(created.id).catch(console.error)
    return NextResponse.json({ eventId: created.id })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Failed to create booking", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
