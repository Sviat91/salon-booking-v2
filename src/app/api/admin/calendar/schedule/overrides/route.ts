import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const masterId = searchParams.get("masterId")

  if (!masterId || masterId === "all") {
    // If viewing all masters, we could potentially show day offs, but avoiding them keeps UI cleaner.
    return NextResponse.json({ overrides: [] })
  }

  const dateFilter: Record<string, Date> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    dateFilter.lte = toDate
  }

  try {
    const overrides = await prisma.dateOverride.findMany({
      where: {
        masterId: masterId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      },
      orderBy: { date: "asc" }
    })

    return NextResponse.json({ overrides })
  } catch (error) {
    console.error("Error fetching admin overrides:", error)
    return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 })
  }
}
