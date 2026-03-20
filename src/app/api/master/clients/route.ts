import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const clients = await prisma.user.findMany({
      where: {
        appointmentsAsClient: {
          some: {
            masterId: session.user.id
          }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true
      },
      distinct: ['id']
    })

    return NextResponse.json({ clients })
  } catch (error) {
    console.error("Error fetching master clients:", error)
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}
