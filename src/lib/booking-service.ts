import prisma from "@/lib/prisma"
import { evaluateConsentStatus, saveConsentRecord } from "@/lib/consent-service"
import { notifyBookingConfirmation } from "@/lib/notifications"
import { normalizePhoneToE164 } from "@/lib/utils/phone-normalization"
import { isValidLanguage, DEFAULT_LANGUAGE } from "@/lib/i18n-shared"
import { evaluateDiscount } from "@/lib/discounts/server"

/**
 * Framework-free booking-creation transaction, shared by `POST /api/book`
 * (web guest/authenticated flow) and the Telegram client booking bot. Do not
 * duplicate this logic elsewhere — both callers must go through here.
 *
 * Behavior-preserving extraction of the logic formerly inline in
 * `src/app/api/book/route.ts` — see that file for the thin HTTP wrapper.
 */

export interface CreateBookingConsents {
  dataProcessing: boolean
  terms: boolean
  notifications: boolean
}

export interface CreateBookingInput {
  startISO: string
  endISO: string
  procedureId?: string | null
  masterId?: string | null
  name: string
  phone?: string | null
  email?: string | null
  language?: string | null
  consents?: CreateBookingConsents | null
  ip?: string | null
  authenticatedUserId?: string | null
  telegramChatId?: string | null
  discountCode?: string | null
}

export type CreateBookingErrorCode =
  | "MISSING_MASTER"
  | "VALIDATION_ERROR"
  | "INVALID_PHONE"
  | "CONSENT_REQUIRED"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR"
  | "DISCOUNT_INVALID"

export type CreateBookingResult =
  | { ok: true; appointmentId: string; originalPrice: number; finalPrice: number; discountPercent: number | null }
  | { ok: false; code: CreateBookingErrorCode; message: string }

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { startISO, endISO, procedureId, masterId, name, phone, email, consents, ip, authenticatedUserId, telegramChatId } = input
  const clientLanguage = input.language && isValidLanguage(input.language) ? input.language : DEFAULT_LANGUAGE

  if (!masterId) {
    return { ok: false, code: "MISSING_MASTER", message: "masterId is required" }
  }

  const isAuth = Boolean(authenticatedUserId)

  if (!isAuth && (!phone || phone.trim().length < 5)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Phone number is required for booking" }
  }

  let normalizedGuestPhone: string | null = null
  if (!isAuth && phone) {
    try {
      normalizedGuestPhone = normalizePhoneToE164(phone)
    } catch {
      return { ok: false, code: "INVALID_PHONE", message: "Invalid phone number" }
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
        return { ok: false, code: "VALIDATION_ERROR", message: "Missing identity for guest consent check" }
      }
      const consentStatus = await evaluateConsentStatus({ phone, name, email: email ?? undefined })
      needsNewConsent = !consentStatus.hasValidConsent
    }

    if (needsNewConsent && !hasRequiredNewConsents) {
      return { ok: false, code: "CONSENT_REQUIRED", message: "Consent required before booking" }
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
      return { ok: false, code: "CONFLICT", message: "Time slot is already booked" }
    }

    // 2. Find or create client user
    let clientUser = null;
    let userIdForConsent = null;

    if (isAuth) {
      clientUser = await prisma.user.findUnique({ where: { id: authenticatedUserId! } })
      if (!clientUser) {
        return { ok: false, code: "UNAUTHORIZED", message: "Session user not found" }
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
            telegramChatId: telegramChatId || null,
            role: "CLIENT",
            isGuest: true,
          },
        })
      } else {
        const updateData: { email?: string; telegramChatId?: string } = {}
        // Update email if provided and user has no email yet
        if (email && !clientUser.email) {
          updateData.email = email
        }
        // Always refresh telegramChatId when provided and different — it should
        // track whichever Telegram account most recently booked with this
        // phone+name identity (not just fill-in-if-missing, unlike email above).
        if (telegramChatId && telegramChatId !== clientUser.telegramChatId) {
          updateData.telegramChatId = telegramChatId
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({ where: { id: clientUser.id }, data: updateData })
        }
      }
      userIdForConsent = clientUser.id;
    }

    // 3. Persist consent when user is booking after consent modal confirmation.
    if (!isAuth && needsNewConsent && hasRequiredNewConsents && userIdForConsent) {
      if (!phone || !name) {
        // This shouldn't normally happen due to the earlier phone check, but for TS safety:
        return { ok: false, code: "VALIDATION_ERROR", message: "Missing identity for guest consent saving" }
      }
      await saveConsentRecord({
        userId: userIdForConsent,
        phone,
        name,
        email: email || null,
        ip,
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
          data: { name_pl: "General Service", duration: 60, price: 0 },
        })
        serviceId = placeholder.id
      }
    }

    // 4b. Evaluate the discount to price and charge — never accept a
    // client-computed price; always recompute at stage 'final'.
    const clientPhone = isAuth ? clientUser.phone : normalizedGuestPhone

    const evaluation = await evaluateDiscount({
      masterId,
      serviceId,
      stage: 'final',
      startsAt: startDate,
      code: input.discountCode,
      clientPhone,
    })

    if (evaluation === null) {
      // serviceId is guaranteed to exist here (just created or found) —
      // a null evaluation means an internal error, not a client mistake.
      return { ok: false, code: "INTERNAL_ERROR", message: "Failed to price the booking" }
    }

    if (input.discountCode && evaluation.codeStatus !== 'valid') {
      return { ok: false, code: "DISCOUNT_INVALID", message: "Promo code is not valid for this booking" }
    }

    // 5. Create the appointment — re-check conflict atomically to close the race window
    const outcome = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          masterId,
          date: new Date(dateOnly),
          status: { not: "CANCELLED" },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflict) return { kind: 'conflict' as const }

      // Re-check oncePerClient inside the transaction — same reasoning as the
      // conflict re-check above; there is no DB constraint that can express it.
      if (evaluation.discountId && evaluation.oncePerClient && clientPhone) {
        const taken = await tx.discountRedemption.findFirst({
          where: { discountId: evaluation.discountId, clientPhone },
        })
        if (taken) return { kind: 'discountTaken' as const }
      }

      const appointment = await tx.appointment.create({
        data: {
          clientId: clientUser.id,
          masterId,
          serviceId,
          date: new Date(dateOnly),
          startTime,
          endTime,
          status: "CONFIRMED",
          clientLanguage,
          discountId: evaluation.discountId,
          originalPrice: evaluation.originalPrice,
          finalPrice: evaluation.finalPrice,
        },
      })

      if (evaluation.discountId) {
        await tx.discountRedemption.create({
          data: { discountId: evaluation.discountId, appointmentId: appointment.id, clientPhone },
        })
      }
      return { kind: 'ok' as const, appointment }
    })

    if (outcome.kind === 'conflict') {
      return { ok: false, code: "CONFLICT", message: "Time slot is already booked" }
    }
    if (outcome.kind === 'discountTaken') {
      return { ok: false, code: "DISCOUNT_INVALID", message: "Promo code is not valid for this booking" }
    }

    const created = outcome.appointment
    notifyBookingConfirmation(created.id, 'client').catch(console.error)
    return {
      ok: true,
      appointmentId: created.id,
      originalPrice: evaluation.originalPrice,
      finalPrice: evaluation.finalPrice,
      discountPercent: evaluation.percent,
    }
  } catch (error) {
    console.error("Error creating booking:", error)
    return { ok: false, code: "INTERNAL_ERROR", message: "Failed to create booking" }
  }
}
