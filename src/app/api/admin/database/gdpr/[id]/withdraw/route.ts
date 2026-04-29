export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getPermissionsForRole } from "@/lib/admin-permissions"

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
  if (!permissions.gdpr.withdraw) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const record = await prisma.consentRecord.findUnique({ where: { id: params.id } })
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (record.consentWithdrawnDate != null) {
    return NextResponse.json({ error: "Consent already withdrawn" }, { status: 409 })
  }

  const withdrawnAt = new Date()
  await prisma.consentRecord.update({
    where: { id: params.id },
    data: {
      consentWithdrawnDate: withdrawnAt,
      withdrawalMethod: "admin_manual",
      consentPrivacyV10: false,
      consentTermsV10: false,
      consentNotificationsV10: false,
    },
  })

  return NextResponse.json({ success: true, withdrawnAt })
}
