import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/procedures?masterId=xxx
 * Returns services available for a specific master.
 * Format: { items: [{ id, name_pl, duration_min, price_pln }] }
 * Used by ProcedureSelect, BookingForm, BookingSuccessPanel.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const masterId = searchParams.get("masterId")

  try {
    if (!masterId) {
      // Return all global services as fallback
      const services = await prisma.service.findMany({
        where: { masterId: null },
        orderBy: { name: "asc" },
      })
      return NextResponse.json({
        items: services.map((s) => ({
          id: s.id,
          name_pl: s.name,
          duration_min: s.duration,
          price_pln: s.price,
        })),
      })
    }

    // Find master profile to get MasterService assignments
    const profile = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
    })

    if (profile) {
      // Get services assigned to this master via MasterService
      const masterServices = await prisma.masterService.findMany({
        where: { masterProfileId: profile.id },
        include: { service: true },
        orderBy: { service: { name: "asc" } },
      })

      if (masterServices.length > 0) {
        return NextResponse.json({
          items: masterServices.map((ms) => ({
            id: ms.service.id,
            name_pl: ms.service.name,
            duration_min: ms.service.duration,
            // Use price override if set, otherwise default service price
            price_pln: ms.priceOverride ?? ms.service.price,
          })),
        })
      }
    }

    // Fallback: return global services + master's own services
    const services = await prisma.service.findMany({
      where: {
        OR: [{ masterId: null }, { masterId }],
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({
      items: services.map((s) => ({
        id: s.id,
        name_pl: s.name,
        duration_min: s.duration,
        price_pln: s.price,
      })),
    })
  } catch (error) {
    console.error("Error fetching procedures:", error)
    return NextResponse.json({ items: [] })
  }
}
