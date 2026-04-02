import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { normalizePhoneDigitsOnly } from "@/lib/utils/phone-normalization"
import { normalizeEmailForMatching, normalizeNameForMatching } from "@/lib/utils/string-normalization"

type ConsentRecordLike = {
  id: string
  consentDate: Date
  emailNormalized: string | null
  consentPrivacyV10: boolean
  consentTermsV10: boolean
  consentWithdrawnDate: Date | null
  erasureDate: Date | null
}

type ConsentReader = {
  consentRecord: {
    findMany: (args: {
      where: { phoneDigits: string; normalizedName: string }
      orderBy: { consentDate: "asc" | "desc" }
      select: {
        id: true
        consentDate: true
        emailNormalized: true
        consentPrivacyV10: true
        consentTermsV10: true
        consentWithdrawnDate: true
        erasureDate: true
      }
      take: number
    }) => Promise<ConsentRecordLike[]>
  }
}

type ConsentWriter = {
  consentRecord: {
    create: (args: {
      data: {
        userId?: string | null
        phoneDigits: string
        email?: string | null
        emailNormalized?: string | null
        fullName: string
        normalizedName: string
        ipHash?: string | null
        consentPrivacyV10: boolean
        consentTermsV10: boolean
        consentNotificationsV10: boolean
      }
    }) => Promise<unknown>
  }
}

export interface ConsentLookupInput {
  phone: string
  name: string
  email?: string | null
}

export interface ConsentStatus {
  hasValidConsent: boolean
  latestConsentDate?: string
}

export interface SaveConsentInput {
  userId?: string | null
  phone: string
  name: string
  email?: string | null
  ip?: string | null
  dataProcessing: boolean
  terms: boolean
  notifications: boolean
}

function normalizeOptionalEmail(email?: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim()
  if (!trimmed) return null
  return normalizeEmailForMatching(trimmed)
}

function isEmailCompatible(
  inputEmailNormalized: string | null,
  consentEmailNormalized: string | null
): boolean {
  if (!inputEmailNormalized) return true
  if (!consentEmailNormalized) return true
  return inputEmailNormalized === consentEmailNormalized
}

function isConsentActive(record: ConsentRecordLike): boolean {
  return (
    record.consentPrivacyV10 &&
    record.consentTermsV10 &&
    !record.consentWithdrawnDate &&
    !record.erasureDate
  )
}

function normalizeLookup(input: ConsentLookupInput) {
  return {
    phoneDigits: normalizePhoneDigitsOnly(input.phone),
    normalizedName: normalizeNameForMatching(input.name),
    emailNormalized: normalizeOptionalEmail(input.email),
  }
}

export async function evaluateConsentStatus(
  input: ConsentLookupInput,
  db: ConsentReader = prisma
): Promise<ConsentStatus> {
  const normalized = normalizeLookup(input)
  if (!normalized.phoneDigits || !normalized.normalizedName) {
    return { hasValidConsent: false }
  }

  const records = await db.consentRecord.findMany({
    where: {
      phoneDigits: normalized.phoneDigits,
      normalizedName: normalized.normalizedName,
    },
    orderBy: { consentDate: "desc" },
    select: {
      id: true,
      consentDate: true,
      emailNormalized: true,
      consentPrivacyV10: true,
      consentTermsV10: true,
      consentWithdrawnDate: true,
      erasureDate: true,
    },
    take: 50,
  })

  const matched = records.find((record) =>
    isEmailCompatible(normalized.emailNormalized, record.emailNormalized)
  )
  if (!matched) {
    return { hasValidConsent: false }
  }

  return {
    hasValidConsent: isConsentActive(matched),
    latestConsentDate: matched.consentDate.toISOString(),
  }
}

export function getRequestIp(req: NextRequest): string {
  const reqWithIp = req as NextRequest & { ip?: string }
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || reqWithIp.ip || "0.0.0.0"
}

// Historical field name is `ip_hash` even though this is masked IP, not a cryptographic hash.
export function maskIpForConsent(ip: string | null | undefined): string {
  if (!ip) return "0.0.0.xxx"
  const sanitized = ip.trim()

  const ipv4Match = sanitized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/)
  if (ipv4Match) {
    return `${ipv4Match[1]}.${ipv4Match[2]}.${ipv4Match[3]}.xxx`
  }

  if (sanitized.includes(":")) {
    const parts = sanitized.split(":").filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:xxxx:xxxx`
    }
    return "xxxx:xxxx:xxxx:xxxx"
  }

  return "0.0.0.xxx"
}

export async function saveConsentRecord(
  input: SaveConsentInput,
  db: ConsentWriter = prisma
): Promise<void> {
  const phoneDigits = normalizePhoneDigitsOnly(input.phone)
  const normalizedName = normalizeNameForMatching(input.name)
  const emailNormalized = normalizeOptionalEmail(input.email)

  await db.consentRecord.create({
    data: {
      userId: input.userId ?? null,
      phoneDigits,
      email: input.email?.trim() || null,
      emailNormalized,
      fullName: input.name.trim(),
      normalizedName,
      ipHash: maskIpForConsent(input.ip),
      consentPrivacyV10: input.dataProcessing,
      consentTermsV10: input.terms,
      consentNotificationsV10: input.notifications,
    },
  })
}
