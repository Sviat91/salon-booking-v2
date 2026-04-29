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

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const permissions = await getPermissions(session)
  if (!permissions.gdpr.view) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const search = req.nextUrl.searchParams.get("search") ?? ""

  const records = await prisma.consentRecord.findMany({
    where: search ? { fullName: { contains: search } } : undefined,
    orderBy: { consentDate: "desc" },
    take: 100,
    select: {
      id: true,
      fullName: true,
      phoneDigits: true,
      email: true,
      consentDate: true,
      consentWithdrawnDate: true,
      erasureDate: true,
      consentPrivacyV10: true,
      userId: true,
    },
  })

  const masked = records.map((r) => ({
    ...r,
    phoneDigits: "****" + r.phoneDigits.slice(-4),
  }))

  return NextResponse.json({ records: masked })
}
