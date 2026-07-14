import type { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import prisma from "@/lib/prisma"
import { normalizePhoneDigitsOnly, normalizePhoneToE164 } from "@/lib/utils/phone-normalization"
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

export interface WithdrawConsentInput extends ConsentLookupInput {
  withdrawalMethod: string
}

export interface WithdrawConsentResult {
  updated: boolean
  reason?: "NOT_FOUND"
  withdrawnDate?: string
}

export interface EraseConsentInput extends ConsentLookupInput {
  erasureMethod: string
}

export interface EraseConsentResult {
  erased: boolean
  alreadyErased?: boolean
  reason?: "NOT_FOUND"
  erasedAt?: string
  erasedRecordsCount?: number
  anonymizedUsersCount?: number
}

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

type ConsentRecordForGdpr = {
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

type NormalizedConsentIdentity = {
  phoneDigits: string
  normalizedName: string
  emailNormalized: string | null
}

function normalizeOptionalEmail(email?: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim()
  if (!trimmed) return null
  return normalizeEmailForMatching(trimmed)
}

function hashConsentIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function normalizeConsentIdentityForGdpr(input: ConsentLookupInput): NormalizedConsentIdentity {
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

async function findConsentHistoryForIdentity(
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

export async function withdrawConsentRecord(
  input: WithdrawConsentInput,
  db = prisma
): Promise<WithdrawConsentResult> {
  const identity = normalizeConsentIdentityForGdpr(input)
  const records = await findConsentHistoryForIdentity(identity, db)
  const latest = records[0]

  if (!latest || !isConsentActive(latest)) {
    return { updated: false, reason: "NOT_FOUND" }
  }

  const now = new Date()
  const updated = await db.consentRecord.updateMany({
    where: {
      id: latest.id,
      consentWithdrawnDate: null,
      erasureDate: null,
    },
    data: {
      consentPrivacyV10: false,
      consentTermsV10: false,
      consentNotificationsV10: false,
      consentWithdrawnDate: now,
      withdrawalMethod: input.withdrawalMethod,
    },
  })

  if (updated.count === 0) {
    return { updated: false, reason: "NOT_FOUND" }
  }

  return {
    updated: true,
    withdrawnDate: now.toISOString(),
  }
}

export async function eraseConsentData(
  input: EraseConsentInput,
  db = prisma
): Promise<EraseConsentResult> {
  const identity = normalizeConsentIdentityForGdpr(input)
  const records = await findConsentHistoryForIdentity(identity, db)

  if (records.length === 0) {
    return { erased: false, reason: "NOT_FOUND" }
  }

  if (records.every((record) => Boolean(record.erasureDate))) {
    return { erased: false, alreadyErased: true }
  }

  const recordsToErase = records.filter((record) => !record.erasureDate)
  if (recordsToErase.length === 0) {
    return { erased: false, alreadyErased: true }
  }

  const now = new Date()
  const anonymizedPhone = hashConsentIdentifier(identity.phoneDigits)
  const anonymizedNameHash = hashConsentIdentifier(identity.normalizedName)
  const anonymizedFullName = `erased-${anonymizedNameHash.slice(0, 8)}`

  const uniqueUserIds = Array.from(
    new Set(
      recordsToErase
        .map((record) => record.userId)
        .filter((value): value is string => Boolean(value))
    )
  )

  const { updatedConsents, updatedUsers } = await db.$transaction(async (tx) => {
    const consentUpdateResult = await tx.consentRecord.updateMany({
      where: {
        id: { in: recordsToErase.map((record) => record.id) },
      },
      data: {
        userId: null,
        phoneDigits: anonymizedPhone,
        email: null,
        emailNormalized: null,
        fullName: anonymizedFullName,
        normalizedName: anonymizedNameHash,
        consentPrivacyV10: false,
        consentTermsV10: false,
        consentNotificationsV10: false,
        consentWithdrawnDate: now,
        withdrawalMethod: input.erasureMethod,
        requestErasureDate: now,
        erasureDate: now,
        erasureMethod: input.erasureMethod,
      },
    })

    const userUpdateResult =
      uniqueUserIds.length > 0
        ? await tx.user.updateMany({
            where: {
              id: { in: uniqueUserIds },
              role: "CLIENT",
            },
            data: {
              name: "Deleted User",
              email: null,
              phone: null,
              image: null,
              password: null,
              passwordEncrypted: null,
              isGuest: true,
            },
          })
        : { count: 0 }

    return {
      updatedConsents: consentUpdateResult,
      updatedUsers: userUpdateResult,
    }
  })

  return {
    erased: true,
    erasedAt: now.toISOString(),
    erasedRecordsCount: updatedConsents.count,
    anonymizedUsersCount: updatedUsers.count,
  }
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
