import { NextRequest, NextResponse } from "next/server"
import { checkConsentApiSchema } from "@/lib/validation/api-schemas"
import { evaluateConsentStatus } from "@/lib/consent-service"
import { z } from "zod"

export const runtime = "nodejs"

/**
 * POST /api/consents/check
 * Checks if user already has valid consents (GDPR).
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof checkConsentApiSchema>

  try {
    const raw = await req.json()
    body = checkConsentApiSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: err.errors[0]?.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const status = await evaluateConsentStatus({
      phone: body.phone,
      name: body.name,
      email: body.email,
    })

    return NextResponse.json({
      skipConsentModal: status.hasValidConsent,
      hasValidConsent: status.hasValidConsent,
      consentDate: status.latestConsentDate,
    })
  } catch (error) {
    console.error("[Consent Check API] Failed to evaluate consent:", error)
    return NextResponse.json(
      { error: "Failed to check consent status" },
      { status: 500 }
    )
  }
}
