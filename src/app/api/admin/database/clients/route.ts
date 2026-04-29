export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getPermissionsForRole } from "@/lib/admin-permissions"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  let rawPermissions: string | null | undefined = undefined
  if (session.user.role === "ADMIN") {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { adminPermissions: true },
    })
    rawPermissions = u?.adminPermissions
  }

  const permissions = getPermissionsForRole(session.user.role ?? "", rawPermissions)
  if (!permissions.clients.view) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const search = req.nextUrl.searchParams.get("search") ?? ""

  const where = {
    role: "CLIENT",
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  }

  const [clients, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, phone: true, email: true, createdAt: true, isGuest: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ clients, total })
}
