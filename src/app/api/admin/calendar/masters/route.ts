import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const masters = await prisma.user.findMany({
      where: { role: "MASTER" },
      select: {
        id: true,
        name: true,
        masterProfile: {
          select: { color: true, avatarUrl: true }
        }
      },
      orderBy: { name: "asc" }
    })
    
    return NextResponse.json({ masters })
  } catch (error) {
    console.error("Error fetching masters:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
