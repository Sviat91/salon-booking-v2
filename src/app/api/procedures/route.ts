import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/procedures?masterId=xxx
 * Returns services available for a specific master.
 * Format: { items: [{ id, name_pl, duration_min, price_pln, price_default_pln?, price_override_pln? }] }
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
        orderBy: { name_pl: "asc" },
      })
      return NextResponse.json({
        items: services.map((s) => ({
          id: s.id,
          name_pl: s.name_pl,
          duration_min: s.duration,
          price_pln: s.price,
          price_default_pln: s.price,
          price_override_pln: null,
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
        orderBy: { service: { name_pl: "asc" } },
      })

      if (masterServices.length > 0) {
        return NextResponse.json({
          items: masterServices.map((ms) => ({
            id: ms.service.id,
            name_pl: ms.service.name_pl,
            duration_min: ms.service.duration,
            // Use price override if set, otherwise default service price
            price_pln: ms.priceOverride ?? ms.service.price,
            price_default_pln: ms.service.price,
            price_override_pln: ms.priceOverride,
          })),
        })
      }
    }

    // Fallback: return global services + master's own services
    const services = await prisma.service.findMany({
      where: {
        OR: [{ masterId: null }, { masterId }],
      },
      orderBy: { name_pl: "asc" },
    })

    return NextResponse.json({
      items: services.map((s) => ({
        id: s.id,
        name_pl: s.name_pl,
        duration_min: s.duration,
        price_pln: s.price,
        price_default_pln: s.price,
        price_override_pln: null,
      })),
    })
  } catch (error) {
    console.error("Error fetching procedures:", error)
    return NextResponse.json({ items: [] })
  }
}
