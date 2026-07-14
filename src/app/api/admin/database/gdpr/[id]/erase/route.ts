export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getPermissionsForRole } from "@/lib/admin-permissions"
import { createHash } from "crypto"

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

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const permissions = await getPermissions(session)
  if (!permissions.gdpr.erase) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const record = await prisma.consentRecord.findUnique({ where: { id: params.id } })
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (record.erasureDate != null) {
    return NextResponse.json({ error: "Record already erased" }, { status: 409 })
  }

  const erasedAt = new Date()
  const hashedPhone = createHash("sha256").update(record.phoneDigits).digest("hex")

  await prisma.$transaction(async (tx) => {
    await tx.consentRecord.update({
      where: { id: params.id },
      data: {
        fullName: "Deleted User",
        normalizedName: createHash("sha256").update("deleted_" + record.id).digest("hex"),
        phoneDigits: hashedPhone,
        email: null,
        requestErasureDate: erasedAt,
        erasureDate: erasedAt,
        erasureMethod: "admin_manual",
      },
    })

    if (record.userId) {
      await tx.user.update({
        where: { id: record.userId },
        data: {
          email: null,
          phone: null,
          name: "Deleted User",
          password: null,
          passwordEncrypted: null,
          isGuest: true,
        },
      })
    }
  })

  return NextResponse.json({ success: true, erasedAt })
}
