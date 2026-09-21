import prisma from "@/lib/prisma"
import {
  findConsentHistoryForIdentity,
  normalizeConsentIdentityForGdpr,
  type ConsentLookupInput,
} from "@/lib/consent-identity"

export type ExportConsentDataInput = ConsentLookupInput

export interface ExportConsentDataResult {
  exportedData: {
    personalData: {
      name: string
      phone: string
      email?: string
    }
    consentHistory: Array<{
      consentDate: string
      ipHash: string
      privacyV10: boolean
      termsV10: boolean
      notificationsV10: boolean
      withdrawnDate?: string
      withdrawalMethod?: string
    }>
    isAnonymized: boolean
    exportTimestamp: string
  } | null
  reason?: "NOT_FOUND"
}

export async function exportConsentData(
  input: ExportConsentDataInput,
  db = prisma
): Promise<ExportConsentDataResult> {
  const identity = normalizeConsentIdentityForGdpr(input)
  const records = await findConsentHistoryForIdentity(identity, db)

  if (records.length === 0) {
    return { exportedData: null, reason: "NOT_FOUND" }
  }

  const latest = records[0]
  const isAnonymized = records.every((record) => Boolean(record.erasureDate))

  const personalData = {
    name: isAnonymized ? "Deleted User" : latest.fullName,
    phone: latest.phoneDigits,
    ...(isAnonymized || !latest.email ? {} : { email: latest.email }),
  }

  return {
    exportedData: {
      personalData,
      consentHistory: records.map((record) => ({
        consentDate: record.consentDate.toISOString(),
        ipHash: record.ipHash || "0.0.0.xxx",
        privacyV10: record.consentPrivacyV10,
        termsV10: record.consentTermsV10,
        notificationsV10: record.consentNotificationsV10,
        ...(record.consentWithdrawnDate
          ? { withdrawnDate: record.consentWithdrawnDate.toISOString() }
          : {}),
        ...(record.withdrawalMethod ? { withdrawalMethod: record.withdrawalMethod } : {}),
      })),
      isAnonymized,
      exportTimestamp: new Date().toISOString(),
    },
  }
}
