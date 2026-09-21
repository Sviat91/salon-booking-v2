export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"
import { enqueueAppointmentDelete } from "@/lib/google-calendar/outbox"

const patchSchema = z.object({
  adminPermissions: z.object({
    clients: z.object({ view: z.boolean(), edit: z.boolean(), delete: z.boolean() }),
    gdpr: z.object({ view: z.boolean(), withdraw: z.boolean(), erase: z.boolean() }),
  }),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { adminPermissions: JSON.stringify(parsed.data.adminPermissions) },
    select: { id: true, name: true, email: true, adminPermissions: true, createdAt: true },
  })

  return NextResponse.json({ admin: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
  }

  // Snapshot before the cascade: the profile and appointment rows vanish with the user.
  const profile = await prisma.masterProfile.findUnique({
    where: { userId: params.id },
    select: { googleCalendarId: true },
  })
  const events = await prisma.appointment.findMany({
    where: { OR: [{ clientId: params.id }, { masterId: params.id }], googleEventId: { not: null } },
    select: { id: true, masterId: true, googleEventId: true },
  })

  await prisma.user.delete({ where: { id: params.id } })

  for (const e of events) {
    if (e.masterId === params.id) {
      if (!profile?.googleCalendarId) continue
      enqueueAppointmentDelete({
        appointmentId: e.id,
        masterId: params.id,
        googleEventId: e.googleEventId,
        calendarId: profile.googleCalendarId,
      }).catch(console.error)
    } else {
      enqueueAppointmentDelete({
        appointmentId: e.id,
        masterId: e.masterId,
        googleEventId: e.googleEventId,
      }).catch(console.error)
    }
  }

  return NextResponse.json({ success: true })
}
