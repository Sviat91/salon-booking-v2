import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * GET /api/masters
 * Returns masters with showOnHomepage = true from DB.
 * Used by MasterSelector on the homepage.
 */
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masters = await (prisma.user.findMany as any)({
      where: {
        role: "MASTER",
        masterProfile: { showOnHomepage: true },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        masterProfile: {
          select: { avatarUrl: true, bio: true },
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = masters.map((m: any) => ({
      id: m.id,
      name: m.name ?? "Master",
      avatar: m.masterProfile?.avatarUrl ?? null,
      bio: m.masterProfile?.bio ?? null,
    }))

    return NextResponse.json({ masters: result })
  } catch {
    return NextResponse.json({ masters: [] })
  }
}
