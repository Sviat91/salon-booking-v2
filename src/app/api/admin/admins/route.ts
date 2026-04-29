export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  adminPermissions: z.object({
    clients: z.object({ view: z.boolean(), edit: z.boolean(), delete: z.boolean() }),
    gdpr: z.object({ view: z.boolean(), withdraw: z.boolean(), erase: z.boolean() }),
  }),
})

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, adminPermissions: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ admins })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, email, password, adminPermissions } = parsed.data

  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "ADMIN",
      adminPermissions: JSON.stringify(adminPermissions),
    },
    select: { id: true, name: true, email: true, adminPermissions: true, createdAt: true },
  })

  return NextResponse.json({ admin }, { status: 201 })
}
