import { NextResponse } from "next/server"
import { getTenantConfig } from "@/lib/tenant"

// No request-object usage means Next.js would otherwise treat this as
// statically cacheable and freeze the first response forever in production
// (`next start`) — dev mode never hits this path, which is why the bug is
// invisible locally. Every client component reading branding/theme fields
// depends on this staying live.
export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await getTenantConfig()
  return NextResponse.json(config)
}
