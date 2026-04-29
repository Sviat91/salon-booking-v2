export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const PasswordSchema = z.object({
  action: z.literal("password"),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
})

const EmailSchema = z.object({
  action: z.literal("email"),
  currentPassword: z.string().min(1),
  newEmail: z.string().email(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true, email: true },
  })
  if (!user?.password) {
    return NextResponse.json({ error: "Account has no password set" }, { status: 400 })
  }

  const validCurrent = await bcrypt.compare(body.currentPassword ?? "", user.password)
  if (!validCurrent) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
  }

  if (body.action === "password") {
    const parsed = PasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 })
    }
    const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, plainPassword: null },
    })
    return NextResponse.json({ success: true, message: "Password updated" })
  }

  if (body.action === "email") {
    const parsed = EmailSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    const taken = await prisma.user.findFirst({
      where: { email: parsed.data.newEmail, id: { not: user.id } },
    })
    if (taken) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { email: parsed.data.newEmail },
    })
    return NextResponse.json({ success: true, message: "Email updated" })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
