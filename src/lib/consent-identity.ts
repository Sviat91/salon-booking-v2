import { createHash } from "node:crypto"
import prisma from "@/lib/prisma"
import { normalizePhoneDigitsOnly, normalizePhoneToE164 } from "@/lib/utils/phone-normalization"
import { normalizeEmailForMatching, normalizeNameForMatching } from "@/lib/utils/string-normalization"

export interface ConsentLookupInput {
  phone: string
  name: string
  email?: string | null
}

export type ConsentRecordForGdpr = {
  id: string
  userId: string | null
  phoneDigits: string
  email: string | null
  emailNormalized: string | null
  fullName: string
  normalizedName: string
  consentDate: Date
  ipHash: string | null
  consentPrivacyV10: boolean
  consentTermsV10: boolean
  consentNotificationsV10: boolean
  consentWithdrawnDate: Date | null
  withdrawalMethod: string | null
  requestErasureDate: Date | null
  erasureDate: Date | null
  erasureMethod: string | null
}

export type NormalizedConsentIdentity = {
  phoneDigits: string
  normalizedName: string
  emailNormalized: string | null
}

export function normalizeOptionalEmail(email?: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim()
  if (!trimmed) return null
  return normalizeEmailForMatching(trimmed)
}

export function hashConsentIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

export function normalizeConsentIdentityForGdpr(input: ConsentLookupInput): NormalizedConsentIdentity {
  const normalizedName = normalizeNameForMatching(input.name)
  const normalizedPhone = normalizePhoneToE164(input.phone)
  const phoneDigits = normalizePhoneDigitsOnly(normalizedPhone)

  if (!phoneDigits || !normalizedName) {
    throw new Error("INVALID_IDENTITY")
  }

  return {
    phoneDigits,
    normalizedName,
    emailNormalized: normalizeOptionalEmail(input.email),
  }
}

export async function findConsentHistoryForIdentity(
  identity: NormalizedConsentIdentity,
  db = prisma
): Promise<ConsentRecordForGdpr[]> {
  const phoneCandidates = [identity.phoneDigits, hashConsentIdentifier(identity.phoneDigits)]
  const nameCandidates = [identity.normalizedName, hashConsentIdentifier(identity.normalizedName)]

  const records = await db.consentRecord.findMany({
    where: {
      phoneDigits: { in: phoneCandidates },
      normalizedName: { in: nameCandidates },
    },
    orderBy: { consentDate: "desc" },
    select: {
      id: true,
      userId: true,
      phoneDigits: true,
      email: true,
      emailNormalized: true,
      fullName: true,
      normalizedName: true,
      consentDate: true,
      ipHash: true,
      consentPrivacyV10: true,
      consentTermsV10: true,
      consentNotificationsV10: true,
      consentWithdrawnDate: true,
      withdrawalMethod: true,
      requestErasureDate: true,
      erasureDate: true,
      erasureMethod: true,
    },
    take: 100,
  })

  return records.filter((record) =>
    isEmailCompatible(identity.emailNormalized, record.emailNormalized)
  )
}

export function isEmailCompatible(
  inputEmailNormalized: string | null,
  consentEmailNormalized: string | null
): boolean {
  if (!inputEmailNormalized) return true
  if (!consentEmailNormalized) return true
  return inputEmailNormalized === consentEmailNormalized
}
