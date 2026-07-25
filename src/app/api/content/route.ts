import { NextRequest, NextResponse } from "next/server"
import { getNavPages, getMasterFooterSlot } from "@/lib/content/pages-server"

export const runtime = "nodejs"

/**
 * GET /api/content?masterId=<optional>
 * Public — no auth, this is public content. Feeds `TopNavLine`/`MasterFooterBlock`.
 * A content error must never break the booking page, so any failure soft-fails
 * to an empty payload (matching `/api/masters`'s style) rather than a 500.
 */
export async function GET(req: NextRequest) {
  try {
    const masterId = req.nextUrl.searchParams.get("masterId") || undefined
    const pages = await getNavPages(masterId)
    const footerBlock = masterId ? await getMasterFooterSlot(masterId) : null
    return NextResponse.json({ pages, footerBlock })
  } catch {
    return NextResponse.json({ pages: [], footerBlock: null })
  }
}
