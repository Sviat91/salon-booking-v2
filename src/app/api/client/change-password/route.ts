import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

export const runtime = "nodejs"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
})

/**
 * POST /api/client/change-password
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  
  if (!session?.user || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const raw = await req.json()
    const parsed = changePasswordSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = parsed.data
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })

    if (!user || !user.password) {
      return NextResponse.json({ error: "User or password not found" }, { status: 404 })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Change Password API] Error:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
