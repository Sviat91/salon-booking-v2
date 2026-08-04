import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * GET /api/masters
 * Returns masters with showOnHomepage = true from DB.
 * Used by MasterSelector on the homepage.
 */
// No request-object usage means Next.js would otherwise treat this as
// statically cacheable and freeze the first response forever in production
// (`next start`) — a newly added/removed master, or a showOnHomepage toggle,
// would never appear until a rebuild. Dev mode never hits this path.
export const dynamic = 'force-dynamic'

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
          select: { avatarUrl: true, bio_pl: true, bio_en: true, bio_uk: true },
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = masters.map((m: any) => ({
      id: m.id,
      name: m.name ?? "Master",
      avatar: m.masterProfile?.avatarUrl ?? null,
      bio_pl: m.masterProfile?.bio_pl ?? null,
      bio_en: m.masterProfile?.bio_en ?? null,
      bio_uk: m.masterProfile?.bio_uk ?? null,
    }))

    return NextResponse.json({ masters: result })
  } catch {
    return NextResponse.json({ masters: [] })
  }
}
