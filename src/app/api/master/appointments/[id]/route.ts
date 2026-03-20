import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * PATCH /api/master/appointments/[id]
 * Allows a master to cancel their own appointment.
 * Sets status to "CANCELLED_BY_MASTER".
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    // Verify the appointment belongs to this master
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    if (appointment.masterId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only cancel your own appointments" },
        { status: 403 }
      )
    }

    // Only allow cancellation of active appointments
    const cancellableStatuses = ["PENDING", "CONFIRMED"]
    if (!cancellableStatuses.includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot cancel appointment with status "${appointment.status}"` },
        { status: 400 }
      )
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED_BY_MASTER" },
      include: {
        service: { select: { name: true } },
        client: { select: { name: true, phone: true } },
      },
    })

    return NextResponse.json({ appointment: updated })
  } catch (error) {
    console.error("Error cancelling appointment:", error)
    return NextResponse.json(
      { error: "Failed to cancel appointment" },
      { status: 500 }
    )
  }
}
