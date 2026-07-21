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

  try {
    if (masterId && masterId !== "all") {
      const profile = await prisma.masterProfile.findUnique({
        where: { userId: masterId },
      })

      if (profile) {
        const masterServices = await prisma.masterService.findMany({
          where: { masterProfileId: profile.id },
          include: { service: true },
          orderBy: { service: { name_pl: "asc" } },
        })

        if (masterServices.length > 0) {
          return NextResponse.json({ services: masterServices.map((ms) => ms.service) })
        }
      }

      const services = await prisma.service.findMany({
        where: { OR: [{ masterId: null }, { masterId }] },
        orderBy: { name_pl: "asc" },
      })
      return NextResponse.json({ services })
    }

    const services = await prisma.service.findMany({
      orderBy: { name_pl: "asc" }
    })
    return NextResponse.json({ services })
  } catch {
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}
