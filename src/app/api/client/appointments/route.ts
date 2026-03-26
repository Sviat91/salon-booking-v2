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
    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ appointments: [], clientName: null })
    }

    // Fetch all appointments for this client
    const appointments = await prisma.appointment.findMany({
      where: { clientId: user.id },
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
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    })

    return NextResponse.json({
      appointments,
      clientName: user.name,
    })
  } catch (error) {
    console.error("Error fetching client appointments:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    )
  }
}
