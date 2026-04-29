export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

const ALLOWED_TABLES = [
  "user",
  "masterProfile",
  "service",
  "masterService",
  "consentRecord",
  "schedule",
  "appointment",
  "dateOverride",
  "tenantConfig",
  "passwordResetToken",
  "account",
] as const

type AllowedTable = (typeof ALLOWED_TABLES)[number]

const MASKED_FIELDS: Record<string, string[]> = {
  user: ["password", "plainPassword"],
  tenantConfig: ["smtpPass", "googleClientSecret", "applePrivateKey", "telegramBotToken"],
}

function maskRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const fields = MASKED_FIELDS[table]
  if (!fields) return row
  const result = { ...row }
  for (const field of fields) {
    if (field in result && result[field] != null) {
      result[field] = "[REDACTED]"
    }
  }
  return result
}

export async function GET(
  req: NextRequest,
  { params }: { params: { table: string } }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { table } = params
  if (!(ALLOWED_TABLES as readonly string[]).includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)))
  const skip = (page - 1) * pageSize

  const TABLES_WITH_CREATED_AT = ["user", "service", "consentRecord", "schedule",
    "appointment", "dateOverride", "tenantConfig", "passwordResetToken", "masterProfile"]

  const orderBy = TABLES_WITH_CREATED_AT.includes(table)
    ? { createdAt: "desc" as const }
    : undefined

  const model = (prisma as unknown as Record<AllowedTable, { findMany: Function; count: Function }>)[table as AllowedTable]

  const [rawRows, total] = await Promise.all([
    model.findMany({ skip, take: pageSize, ...(orderBy ? { orderBy } : {}) }),
    model.count(),
  ])

  const rows = (rawRows as Record<string, unknown>[]).map((row) => maskRow(table, row))

  return NextResponse.json({ rows, total, page, pageSize })
}
