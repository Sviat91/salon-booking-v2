export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getPermissionsForRole } from "@/lib/admin-permissions"
import { z } from "zod"

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(30).optional(),
  email: z.string().email().optional(),
})

async function getPermissions(session: { user: { id: string; role?: string | null } }) {
  let raw: string | null | undefined = undefined
  if (session.user.role === "ADMIN") {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { adminPermissions: true },
    })
    raw = u?.adminPermissions
  }
  return getPermissionsForRole(session.user.role ?? "", raw)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const permissions = await getPermissions(session)
  if (!permissions.clients.edit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = params
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!target || target.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, phone: true, email: true, createdAt: true, isGuest: true },
  })

  return NextResponse.json({ client: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const permissions = await getPermissions(session)
  if (!permissions.clients.delete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = params
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!target || target.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
