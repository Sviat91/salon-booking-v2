import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

// GET /api/master/services
export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const services = await prisma.service.findMany({
      where: {
        OR: [
          { masterId: null }, // Admin services
          { masterId: session.user.id }, // Master's own services
        ],
      },
      orderBy: { name_pl: "asc" },
    })

    return NextResponse.json({ services })
  } catch (error) {
    console.error("Error fetching master services:", error)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}

const ServiceSchema = z.object({
  name_pl: z.string().min(2, "Name must be at least 2 characters"),
  name_en: z.string().optional(),
  name_uk: z.string().optional(),
  duration: z.number().int().min(5, "Duration must be at least 5 minutes"),
  price: z.number().min(0, "Price must be positive"),
})

// POST /api/master/services
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof ServiceSchema>
  try {
    body = ServiceSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const service = await prisma.service.create({
      data: {
        name_pl: body.name_pl,
        ...(body.name_en !== undefined ? { name_en: body.name_en || null } : {}),
        ...(body.name_uk !== undefined ? { name_uk: body.name_uk || null } : {}),
        duration: body.duration,
        price: body.price,
        masterId: session.user.id, // Explicitly assign to this master
      },
    })

    // Auto-assign to master's profile?
    // Wait, if it's their own service, they probably want it assigned.
    const profile = await prisma.masterProfile.findUnique({
      where: { userId: session.user.id }
    });
    
    if (profile) {
      await prisma.masterService.create({
        data: {
          masterProfileId: profile.id,
          serviceId: service.id,
        }
      });
    }

    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    console.error("Error creating service:", error)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}
