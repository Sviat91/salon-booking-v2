import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { loadCandidates } from "@/lib/discounts/server"
import { pickBestDiscount, type EligibilityContext } from "@/lib/discounts/eligibility"
import { applyPercent } from "@/lib/discounts/shared"
import type { ProcedureItem } from "@/types/api-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface BareItem {
  id: string
  name_pl: string
  name_en: string | null
  name_uk: string | null
  duration_min: number
  price_pln: number
  price_default_pln: number
  price_override_pln: number | null
}
type DecoratedItem = BareItem & Pick<ProcedureItem, "discount_percent" | "discount_label" | "price_after_discount_pln">

/**
 * Appends the three additive discount fields to each item. `masterId` absent
 * (global-services fallback listing) ⇒ all three are null, and the discount
 * layer is never called. `masterId` present ⇒ one loadCandidates() query for
 * the whole batch, then pickBestDiscount() per item at stage 'catalog'.
 * Every existing field name and value is kept identical.
 */
async function decorate(rows: BareItem[], masterId: string | null): Promise<DecoratedItem[]> {
  if (!masterId) {
    return rows.map((item) => ({
      ...item,
      discount_percent: null,
      discount_label: null,
      price_after_discount_pln: null,
    }))
  }

  const candidates = await loadCandidates(masterId)

  return rows.map((item) => {
    const ctx: EligibilityContext = {
      stage: 'catalog',
      masterId,
      serviceId: item.id,
      slotDayOfWeek: null,
      slotStartMinutes: null,
      appointmentDate: null,
      code: null,
      redeemedDiscountIds: new Set(),
      hasClientIdentity: false,
    }
    const winner = pickBestDiscount(candidates, ctx)
    return {
      ...item,
      discount_percent: winner?.percent ?? null,
      discount_label: winner?.label ?? null,
      price_after_discount_pln: winner ? applyPercent(item.price_pln, winner.percent) : null,
    }
  })
}

/**
 * GET /api/procedures?masterId=xxx
 * Returns services available for a specific master.
 * Format: { items: [{ id, name_pl, name_en, name_uk, duration_min, price_pln, price_default_pln?, price_override_pln?, discount_percent?, discount_label?, price_after_discount_pln? }] }
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
      const items = await decorate(
        services.map((s) => ({
          id: s.id,
          name_pl: s.name_pl,
          name_en: s.name_en,
          name_uk: s.name_uk,
          duration_min: s.duration,
          price_pln: s.price,
          price_default_pln: s.price,
          price_override_pln: null,
        })),
        null
      )
      return NextResponse.json({ items })
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
        const items = await decorate(
          masterServices.map((ms) => ({
            id: ms.service.id,
            name_pl: ms.service.name_pl,
            name_en: ms.service.name_en,
            name_uk: ms.service.name_uk,
            duration_min: ms.service.duration,
            // Use price override if set, otherwise default service price
            price_pln: ms.priceOverride ?? ms.service.price,
            price_default_pln: ms.service.price,
            price_override_pln: ms.priceOverride,
          })),
          masterId
        )
        return NextResponse.json({ items })
      }
    }

    // Fallback: return global services + master's own services
    const services = await prisma.service.findMany({
      where: {
        OR: [{ masterId: null }, { masterId }],
      },
      orderBy: { name_pl: "asc" },
    })

    const items = await decorate(
      services.map((s) => ({
        id: s.id,
        name_pl: s.name_pl,
        name_en: s.name_en,
        name_uk: s.name_uk,
        duration_min: s.duration,
        price_pln: s.price,
        price_default_pln: s.price,
        price_override_pln: null,
      })),
      masterId
    )
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Error fetching procedures:", error)
    return NextResponse.json({ items: [] })
  }
}
