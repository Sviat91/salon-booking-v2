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
        service: { select: { name_pl: true } },
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

/**
 * DELETE /api/master/appointments/[id]
 * Permanently deletes an appointment from the database.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (appointment.masterId !== session.user.id) {
      return NextResponse.json({ error: "You can only delete your own appointments" }, { status: 403 })
    }

    await prisma.appointment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting appointment:", error)
    return NextResponse.json(
      { error: "Failed to delete appointment" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/master/appointments/[id]
 * Updates an appointment's service, client, and schedule.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (appointment.masterId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = await req.json()
    const { entries, serviceId, serviceName, clientId, clientName, clientPhone, notes } = data

    // Reconstruct service and client associations based on IDs or custom input
    let finalServiceId = serviceId
    if (serviceId === "custom" && serviceName) {
      const newSrv = await prisma.service.create({
        data: {
          name_pl: serviceName,
          duration: entries[0].duration,
          price: 0,
          masterId: session.user.id 
        } 
      })
      finalServiceId = newSrv.id
    }

    let finalClientId = clientId
    if (clientId === "custom" && clientName) {
      const newCli = await prisma.user.create({ 
        data: { 
          name: clientName, 
          phone: clientPhone || null, 
          role: "CLIENT",
          isGuest: true
        } 
      })
      finalClientId = newCli.id
    }

    const { date, startTime, duration } = entries[0]
    const startMins = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1])
    const endMins = startMins + duration
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        date: new Date(date),
        startTime,
        endTime,
        serviceId: finalServiceId,
        clientId: finalClientId,
        notes: notes || null,
      }
    })

    return NextResponse.json({ appointment: updated })
  } catch (error) {
    console.error("Error updating appointment:", error)
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 })
  }
}
