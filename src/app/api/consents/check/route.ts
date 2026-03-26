import { NextRequest, NextResponse } from "next/server"
import { checkConsentApiSchema } from "@/lib/validation/api-schemas"
import { z } from "zod"

export const runtime = "nodejs"

/**
 * POST /api/consents/check
 * Checks if user already has valid consents (GDPR).
 * 
 * Stub implementation: always returns skipConsentModal: true
 * Full GDPR consent tracking will be implemented in a later phase.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    checkConsentApiSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: err.errors[0]?.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  // Stub: skip consent modal for now (no consent table yet)
  // When GDPR consent table is added, query here and return
  // skipConsentModal: false if user hasn't given consent yet
  return NextResponse.json({ skipConsentModal: true })
}
