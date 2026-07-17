import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { formatInTimeZone } from "date-fns-tz"
import { z } from "zod"

export const runtime = "nodejs"
const TZ = "Europe/Warsaw"

/**
 * GET /api/client/profile
 * Returns profile details and upcoming/past appointments.
 */
export async function GET() {
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, createdAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Determine user IDs to fetch appointments for.
    // If the user has a phone, we fetch appointments for ALL users sharing this phone (like couples).
    // Otherwise, just for this specific user.
    let userIds = [userId]
    if (user.phone) {
      const relatedUsers = await prisma.user.findMany({
        where: { phone: user.phone },
        select: { id: true },
      })
      userIds = relatedUsers.map((u) => u.id)
      if (!userIds.includes(userId)) userIds.push(userId)
    }

    const appointments = await prisma.appointment.findMany({
      where: { clientId: { in: userIds } },
      include: {
        service: { select: { id: true, name_pl: true, name_en: true, name_uk: true, duration: true, price: true } },
        master: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    })

    // Fetch master profiles to resolve price overrides
    const uniqueMasterIds = [...new Set(appointments.map((a) => a.masterId))]
    const masterProfiles = await prisma.masterProfile.findMany({
      where: { userId: { in: uniqueMasterIds } },
      select: { id: true, userId: true },
    })
    
    const overrideMap = new Map<string, number>()
    if (masterProfiles.length > 0 && appointments.length > 0) {
      const serviceIds = [...new Set(appointments.map((a) => a.service.id))]
      const overrides = await prisma.masterService.findMany({
        where: {
          masterProfileId: { in: masterProfiles.map((p) => p.id) },
          serviceId: { in: serviceIds },
          priceOverride: { not: null },
        },
        select: { masterProfileId: true, serviceId: true, priceOverride: true }
      })
      for (const o of overrides) {
        if (o.priceOverride !== null) {
          overrideMap.set(`${o.masterProfileId}:${o.serviceId}`, o.priceOverride)
        }
      }
    }

    const profileByUserId = new Map(masterProfiles.map((p) => [p.userId, p.id]))

    const nowWarsawStr = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")
    const todayDate = new Date(nowWarsawStr + "T00:00:00")

    const upcoming = []
    const past = []

    for (const appt of appointments) {
      const profileId = profileByUserId.get(appt.masterId)
      const price = (profileId && overrideMap.get(`${profileId}:${appt.service.id}`)) ?? appt.service.price
      
      const mappedAppt = {
        id: appt.id,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        notes: appt.notes,
        service: { ...appt.service, price },
        master: appt.master,
      }

      if (appt.date >= todayDate && appt.status !== "CANCELLED") {
        upcoming.push(mappedAppt)
      } else {
        past.push(mappedAppt)
      }
    }

    // Sort upcoming ascending (soonest first)
    upcoming.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (diff !== 0) return diff
      return a.startTime.localeCompare(b.startTime)
    })

    return NextResponse.json({
      user,
      upcoming,
      past,
      stats: {
        totalVisits: appointments.length,
      }
    })
  } catch (error) {
    console.error("[Profile GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format"),
  phone: z.string().max(30).nullable().optional(),
})

/**
 * PATCH /api/client/profile
 * Updates name and email.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const raw = await req.json()
    const parsed = updateProfileSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      )
    }

    const { name, email, phone } = parsed.data
    const userId = session.user.id

    // Check if email is already used by another registered user
    const existing = await prisma.user.findFirst({
      where: {
        email,
        password: { not: null },
        id: { not: userId },
      },
    })

    if (existing) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, email, phone: phone || null },
      select: { name: true, email: true, phone: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[Profile PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
