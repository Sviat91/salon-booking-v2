import { NextRequest, NextResponse } from "next/server"
import { formatInTimeZone } from "date-fns-tz"
import prisma from "@/lib/prisma"
import { phonesMatchE164 } from "@/lib/utils/phone-normalization"
import { resolveAppointmentPrice } from "@/lib/discounts/shared"
import { rateLimit } from "@/lib/cache"
import { getRequestIp } from "@/lib/consent-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TZ = "Europe/Warsaw"

/**
 * GET /api/bookings/all?phone=+48123456789&name=Наталія[&currentMasterId=xxx]
 *
 * Returns all upcoming appointments for a client across all masters in this
 * salon instance. One instance = one salon, so no masterId scoping needed.
 *
 * Optional currentMasterId: used only for sort priority — current master's
 * bookings are shown first, the rest are grouped by master.
 *
 * Security rules:
 *  1. Phone full E.164 number must match
 *  2. First name must match (case-insensitive, trimmed)
 *  3. Last name structure must match (both present → exact, one missing → reject)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawPhone        = searchParams.get("phone")           ?? ""
  const rawName         = searchParams.get("name")            ?? ""
  // Optional: used only for sort priority (current master's bookings shown first)
  const currentMasterId = searchParams.get("currentMasterId") ?? null

  const ip = getRequestIp(req)
  const { allowed } = await rateLimit(`rate:bookings-all:${ip}`, 20, 15 * 60)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }

  // ── Validate required params ──────────────────────────────────────────────
  if (!rawPhone || !rawName) {
    return NextResponse.json(
      { error: "phone and name are required", code: "MISSING_PARAMS" },
      { status: 400 }
    )
  }

  // ── Normalize search terms ─────────────────────────────────────────────────
  const searchPhoneDigits = rawPhone.replace(/\D/g, "")
  if (searchPhoneDigits.length < 9) {
    return NextResponse.json(
      { error: "Phone number too short", code: "INVALID_PHONE" },
      { status: 400 }
    )
  }

  // Name: split into firstName / lastName
  const nameParts   = rawName.trim().split(/\s+/)
  const searchFirst = (nameParts[0] ?? "").toLowerCase()
  const searchLast  = nameParts.slice(1).join(" ").toLowerCase()

  // ── Build "today" in Warsaw timezone ──────────────────────────────────────
  const nowWarsawStr = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")
  const todayDate    = new Date(nowWarsawStr + "T00:00:00")

  try {
    // ── SQL query — no masterId filter (one instance = one salon) ──────────
    const appointments = await prisma.appointment.findMany({
      where: {
        date:   { gte: todayDate },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: {
        client:  { select: { id: true, name: true, phone: true, email: true } },
        service: { select: { id: true, name_pl: true, name_en: true, name_uk: true, duration: true, price: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    })

    // ── Fetch master display names (for UI card) ───────────────────────────
    const uniqueMasterIds = [...new Set(appointments.map((a) => a.masterId))]
    const masterUsers = await prisma.user.findMany({
      where:  { id: { in: uniqueMasterIds } },
      select: { id: true, name: true },
    })
    const masterNameById = new Map(masterUsers.map((u) => [u.id, u.name ?? ""]))

    // ── Price overrides per master ─────────────────────────────────────────
    // Key: "masterProfileId:serviceId" → override price
    const masterProfiles = await prisma.masterProfile.findMany({
      where:  { userId: { in: uniqueMasterIds } },
      select: { id: true, userId: true },
    })
    const profileByUserId = new Map(masterProfiles.map((p) => [p.userId, p.id]))

    const overrideMap = new Map<string, number>() // key: "profileId:serviceId"
    if (masterProfiles.length > 0 && appointments.length > 0) {
      const serviceIds = [...new Set(appointments.map((a) => a.service.id))]
      const profileIds = masterProfiles.map((p) => p.id)
      const overrides  = await prisma.masterService.findMany({
        where: {
          masterProfileId: { in: profileIds },
          serviceId:       { in: serviceIds },
          priceOverride:   { not: null },
        },
        select: { masterProfileId: true, serviceId: true, priceOverride: true },
      })
      for (const o of overrides) {
        if (o.priceOverride !== null) {
          overrideMap.set(`${o.masterProfileId}:${o.serviceId}`, o.priceOverride)
        }
      }
    }

    // ── Filter by phone + name (security-first matching) ──────────────────
    const matchingAppointments = appointments.filter((appt) => {
      const client = appt.client

      // Phone check — full normalized E.164 number
      if (!phonesMatchE164(rawPhone, client.phone)) return false

      // Name check
      const clientParts = (client.name ?? "").trim().split(/\s+/)
      const clientFirst = (clientParts[0] ?? "").toLowerCase()
      const clientLast  = clientParts.slice(1).join(" ").toLowerCase()

      // First name must match
      if (clientFirst !== searchFirst) return false

      // Last name structure must match
      const hasSearchLast = searchLast.length > 0
      const hasClientLast = clientLast.length > 0
      if (hasSearchLast && hasClientLast)   return searchLast === clientLast
      if (!hasSearchLast && !hasClientLast) return true
      // One has last name, other doesn't → reject (prevents data leakage)
      return false
    })

    // ── Map to API response format ─────────────────────────────────────────
    const now = Date.now()

    const bookings = matchingAppointments.map((appt) => {
      const client    = appt.client
      const service   = appt.service
      const parts     = (client.name ?? "").trim().split(/\s+/)
      const firstName = parts[0] ?? ""
      const lastName  = parts.slice(1).join(" ")

      const dateISO  = formatInTimeZone(appt.date, TZ, "yyyy-MM-dd")
      const startISO = formatInTimeZone(
        new Date(`${dateISO}T${appt.startTime}:00`),
        TZ,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      )
      const endISO = formatInTimeZone(
        new Date(`${dateISO}T${appt.endTime}:00`),
        TZ,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      )

      // canModify = canCancel = more than 24 hours until appointment
      const apptTimestamp = new Date(`${dateISO}T${appt.startTime}:00`).getTime()
      const canModify     = (apptTimestamp - now) > 24 * 60 * 60 * 1000

      const profileId    = profileByUserId.get(appt.masterId)
      const liveOverride = (profileId ? overrideMap.get(`${profileId}:${service.id}`) : undefined) ?? service.price
      const price         = resolveAppointmentPrice(appt.finalPrice, liveOverride)
      const originalPrice = resolveAppointmentPrice(appt.originalPrice, liveOverride)

      return {
        eventId:       appt.id,
        firstName,
        lastName,
        phone:         client.phone ?? "",
        email:         client.email ?? "",
        procedureName:    service.name_pl,
        procedureName_en: service.name_en,
        procedureName_uk: service.name_uk,
        procedureId:   service.id,
        masterName:    masterNameById.get(appt.masterId) ?? "",
        masterId:      appt.masterId,
        startTime:     startISO,
        endTime:       endISO,
        price,
        originalPrice,
        canModify,
        canCancel:     canModify,
      }
    })

    // ── Sort: current master first, then others grouped by master ──────────
    bookings.sort((a, b) => {
      if (currentMasterId) {
        // Priority: current master's bookings come first
        const aIsCurrent = a.masterId === currentMasterId ? 0 : 1
        const bIsCurrent = b.masterId === currentMasterId ? 0 : 1
        if (aIsCurrent !== bIsCurrent) return aIsCurrent - bIsCurrent
      }
      // Within same priority group: keep same-master bookings together
      if (a.masterId !== b.masterId) return a.masterId < b.masterId ? -1 : 1
      // Same master: keep original date/time order from DB
      return 0
    })

    return NextResponse.json({
      bookings,
      count:  bookings.length,
      cached: false,
    })
  } catch (error) {
    console.error("[/api/bookings/all] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookings", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
