import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { notifyBookingCancellation, notifyBookingUpdate } from "@/lib/notifications"
import { resnapshotAppointmentPrice } from "@/lib/discounts/server"

export const runtime = "nodejs"

/**
 * DELETE /api/admin/calendar/appointments/[id]
 * Permanently deletes an appointment from the database.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { client: true, master: true, service: true },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    notifyBookingCancellation(appointment, 'admin').catch(console.error)

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
 * PUT /api/admin/calendar/appointments/[id]
 * Updates an appointment's service, client, and schedule.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { service: { select: { name_pl: true } } },
    })

    if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data = await req.json()
    const { entries, serviceId, serviceName, clientId, clientName, clientPhone, notes, masterId } = data

    const finalMasterId = masterId || appointment.masterId

    // Reconstruct service and client associations based on IDs or custom input
    let finalServiceId = serviceId
    if (serviceId === "custom" && serviceName) {
      const newSrv = await prisma.service.create({
        data: {
          name_pl: serviceName,
          duration: entries[0].duration,
          price: 0,
          masterId: finalMasterId
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
        masterId: finalMasterId,
      }
    })

    // Service changed — re-snapshot the price, clearing any applied discount
    // (AD-7).
    if (finalServiceId !== appointment.serviceId) {
      await resnapshotAppointmentPrice(id)
    }

    notifyBookingUpdate(
      updated.id,
      {
        date: appointment.date,
        startTime: appointment.startTime,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name_pl,
      },
      'admin'
    ).catch(console.error)

    return NextResponse.json({ appointment: updated })
  } catch (error) {
    console.error("Error updating appointment:", error)
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 })
  }
}
