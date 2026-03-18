import { NextResponse } from "next/server"
import { getTenantConfig } from "@/lib/tenant"

export async function GET() {
  const config = await getTenantConfig()
  return NextResponse.json(config)
}
