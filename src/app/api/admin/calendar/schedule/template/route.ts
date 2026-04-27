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
  const masterId = searchParams.get("masterId")

  if (!masterId || masterId === "all") {
    // Cannot fetch template for 'all' masters combined naturally, return empty
    return NextResponse.json({ templates: [] })
  }

  try {
    const templates = await prisma.schedule.findMany({
      where: { masterId: masterId },
      orderBy: { dayOfWeek: "asc" }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("Error fetching admin templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}
