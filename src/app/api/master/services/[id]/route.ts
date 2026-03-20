import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

const ServiceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  duration: z.number().int().min(5, "Duration must be at least 5 minutes"),
  price: z.number().min(0, "Price must be positive"),
})

// PUT /api/master/services/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const existing = await prisma.service.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    if (existing.masterId !== session.user.id) {
      return NextResponse.json({ error: "You can only edit your own services" }, { status: 403 })
    }

    const service = await prisma.service.update({
      where: { id: params.id },
      data: {
        name: body.name,
        duration: body.duration,
        price: body.price,
      },
    })

    return NextResponse.json({ service })
  } catch (error) {
    console.error("Error updating service:", error)
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
  }
}

// DELETE /api/master/services/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const existing = await prisma.service.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    if (existing.masterId !== session.user.id) {
      return NextResponse.json({ error: "You can only delete your own services" }, { status: 403 })
    }

    await prisma.service.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting service:", error)
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
  }
}
