import { NextRequest, NextResponse } from "next/server"
import { formatInTimeZone } from "date-fns-tz"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { notifyBookingCancellation, notifyBookingUpdate } from "@/lib/notifications"

export const runtime = "nodejs"

const TZ = "Europe/Warsaw"

const patchSchema = z
  .object({
    newProcedureId: z.string().optional(),
    newStartISO: z.string().min(16).optional(),
    newEndISO: z.string().min(16).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.newProcedureId && !data.newStartISO) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one change is required",
      })
    }
    if ((data.newStartISO && !data.newEndISO) || (!data.newStartISO && data.newEndISO)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "newStartISO and newEndISO must be provided together",
      })
    }
  })

async function resolveAccessibleClientIds(userId: string) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  })

  if (!currentUser?.phone) {
    return [userId]
  }

  const relatedUsers = await prisma.user.findMany({
    where: { phone: currentUser.phone },
    select: { id: true },
  })

  const ids = relatedUsers.map((u) => u.id)
  if (!ids.includes(userId)) ids.push(userId)
  return ids
}

function canModifyMoreThan24Hours(appointmentDate: Date, startTime: string) {
  const dateISO = formatInTimeZone(appointmentDate, TZ, "yyyy-MM-dd")
  const startTimestamp = new Date(`${dateISO}T${startTime}:00`).getTime()
  const hoursUntil = (startTimestamp - Date.now()) / (1000 * 60 * 60)
  return hoursUntil >= 24
}

const wTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
})

const wDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: appointmentId } = await params

  let body: z.infer<typeof patchSchema>
  try {
    const raw = await req.json()
    body = patchSchema.parse(raw)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: { select: { name_pl: true, name_en: true, name_uk: true } } },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const allowedClientIds = await resolveAccessibleClientIds(session.user.id)
    if (!allowedClientIds.includes(appointment.clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking already cancelled" }, { status: 409 })
    }

    if (!canModifyMoreThan24Hours(appointment.date, appointment.startTime)) {
      return NextResponse.json(
        { error: "Less than 24h before appointment", code: "TOO_LATE_TO_MODIFY" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, string> = {}

    if (body.newStartISO && body.newEndISO) {
      const newStartDate = new Date(body.newStartISO)
      const newEndDate = new Date(body.newEndISO)

      if (Number.isNaN(newStartDate.getTime()) || Number.isNaN(newEndDate.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
      }

      const newDate = wDateFormatter.format(newStartDate)
      const newStartTime = wTimeFormatter.format(newStartDate)
      const newEndTime = wTimeFormatter.format(newEndDate)

      const conflicting = await prisma.appointment.findFirst({
        where: {
          masterId: appointment.masterId,
          date: new Date(newDate),
          status: { not: "CANCELLED" },
          id: { not: appointment.id },
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime },
        },
      })

      if (conflicting) {
        return NextResponse.json(
          { error: "Selected time slot is already occupied", code: "CONFLICT" },
          { status: 409 }
        )
      }

      updateData.date = new Date(newDate)
      updateData.startTime = newStartTime
      updateData.endTime = newEndTime
      changes.startTime = body.newStartISO
      changes.endTime = body.newEndISO
    }

    if (body.newProcedureId) {
      const service = await prisma.service.findUnique({
        where: { id: body.newProcedureId },
        select: { id: true, name_pl: true, name_en: true, name_uk: true },
      })

      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 })
      }

      updateData.serviceId = service.id
      changes.procedure = service.name_pl
      changes.procedure_en = service.name_en ?? ""
      changes.procedure_uk = service.name_uk ?? ""
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: updateData,
    })

    notifyBookingUpdate(
      appointment.id,
      {
        date: appointment.date,
        startTime: appointment.startTime,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name_pl,
      },
      'client'
    ).catch(console.error)

    return NextResponse.json({ success: true, changes })
  } catch (error) {
    console.error("[Client appointment PATCH] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: appointmentId } = await params

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        clientId: true,
        status: true,
        date: true,
        startTime: true,
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const allowedClientIds = await resolveAccessibleClientIds(session.user.id)
    if (!allowedClientIds.includes(appointment.clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking already cancelled" }, { status: 409 })
    }

    if (!canModifyMoreThan24Hours(appointment.date, appointment.startTime)) {
      return NextResponse.json(
        { error: "Less than 24h before appointment", code: "TOO_LATE_TO_MODIFY" },
        { status: 400 }
      )
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
      include: { client: true, master: true, service: true },
    })

    notifyBookingCancellation(updated, 'client').catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Client appointment DELETE] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
