import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * GET /api/client/appointments?phone=xxx
 * Returns appointments for a client identified by phone number.
 * Public endpoint (no auth required) — client enters phone to see their bookings.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")

  if (!phone || phone.length < 5) {
    return NextResponse.json(
      { error: "Phone number is required (at least 5 characters)" },
      { status: 400 }
    )
  }

  try {
    // Find all users with this phone (may be multiple — e.g. a couple)
    const users = await prisma.user.findMany({
      where: { phone },
      select: { id: true, name: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ appointments: [], clientName: null })
    }

    const userIds = users.map((u) => u.id)

    // Fetch all appointments for all users with this phone
    const appointments = await prisma.appointment.findMany({
      where: { clientId: { in: userIds } },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        service: {
          select: { id: true, name: true, duration: true, price: true },
        },
        master: {
          select: {
            id: true,
            name: true,
            masterProfile: { select: { avatarUrl: true } },
          },
        },
        client: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    })

    return NextResponse.json({
      appointments,
      clientName: users[0].name, // primary name for display
    })
  } catch (error) {
    console.error("Error fetching client appointments:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    )
  }
}
