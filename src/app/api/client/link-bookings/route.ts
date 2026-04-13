import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

const linkBookingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(5, "Invalid phone number"),
})

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const raw = await req.json()
    const parsed = linkBookingsSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input data" },
        { status: 400 }
      )
    }

    const { name, phone } = parsed.data
    const currentUserId = session.user.id

    // Find guest users matching the exact name and phone
    const guestUsers = await prisma.user.findMany({
      where: {
        name: name,
        phone: phone,
        isGuest: true,
      },
      select: { id: true },
    })

    if (guestUsers.length === 0) {
      return NextResponse.json(
        { error: "Гостевые записи с таким именем и телефоном не найдены." },
        { status: 404 }
      )
    }

    const guestIds = guestUsers.map((u) => u.id)

    // Run a transaction to safely attach records to the authorized user and delete guests
    const result = await prisma.$transaction(async (tx) => {
      // 1. Move Appointments
      const { count: linkedAppointments } = await tx.appointment.updateMany({
        where: { clientId: { in: guestIds } },
        data: { clientId: currentUserId },
      })

      // 2. Move Consents
      const { count: linkedConsents } = await tx.consent.updateMany({
        where: { userId: { in: guestIds } },
        data: { userId: currentUserId },
      })

      // 3. Update current user's phone if it was null
      const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
      if (currentUser && !currentUser.phone) {
        await tx.user.update({
          where: { id: currentUserId },
          data: { phone: phone },
        })
      }

      // 4. Delete the now-empty guest users
      await tx.user.deleteMany({
        where: { id: { in: guestIds } },
      })

      return { linkedAppointments, linkedConsents }
    })

    return NextResponse.json({
      success: true,
      linked: result.linkedAppointments,
    })
  } catch (error) {
    console.error("[Link Bookings Error]:", error)
    return NextResponse.json(
      { error: "Internal server error during merge process" },
      { status: 500 }
    )
  }
}
