"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { getServerT } from "@/lib/i18n-server"
import { invalidateTenantConfigCache } from "@/lib/tenant"

function buildLegalSchema(t: (key: string) => string) {
  const field = () => z.string().max(50000, t('admin.settings.legal.tooLong')).optional()
  return z.object({
    termsContent_pl: field(),
    termsContent_en: field(),
    termsContent_uk: field(),
    privacyContent_pl: field(),
    privacyContent_en: field(),
    privacyContent_uk: field(),
  })
}

/**
 * Locale fields are only rendered in the form when their locale is enabled
 * for the tenant. When a field is absent from the submission (locale
 * currently disabled), we must not touch its DB column — preserves any
 * previously-saved text instead of nulling it out. No locale is privileged
 * (D1) — `_pl` goes through the same helper as `_en`/`_uk`.
 */
function readOptionalLocaleField(formData: FormData, key: string): string | undefined {
  return formData.has(key) ? (formData.get(key) as string) : undefined
}

export type LegalFormState = {
  error?: string
  success?: boolean
}

export async function saveLegalContent(
  _prev: LegalFormState,
  formData: FormData
): Promise<LegalFormState> {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
    return { error: t('admin.settings.legal.unauthorized') }
  }

  const parsed = buildLegalSchema(t).safeParse({
    termsContent_pl:   readOptionalLocaleField(formData, "termsContent_pl"),
    termsContent_en:   readOptionalLocaleField(formData, "termsContent_en"),
    termsContent_uk:   readOptionalLocaleField(formData, "termsContent_uk"),
    privacyContent_pl: readOptionalLocaleField(formData, "privacyContent_pl"),
    privacyContent_en: readOptionalLocaleField(formData, "privacyContent_en"),
    privacyContent_uk: readOptionalLocaleField(formData, "privacyContent_uk"),
  })
  if (!parsed.success) return { error: t('admin.settings.legal.saveError') }

  const {
    termsContent_pl, termsContent_en, termsContent_uk,
    privacyContent_pl, privacyContent_en, privacyContent_uk,
  } = parsed.data

  const data = {
    ...(termsContent_pl   !== undefined ? { termsContent_pl:   termsContent_pl   || null } : {}),
    ...(termsContent_en   !== undefined ? { termsContent_en:   termsContent_en   || null } : {}),
    ...(termsContent_uk   !== undefined ? { termsContent_uk:   termsContent_uk   || null } : {}),
    ...(privacyContent_pl !== undefined ? { privacyContent_pl: privacyContent_pl || null } : {}),
    ...(privacyContent_en !== undefined ? { privacyContent_en: privacyContent_en || null } : {}),
    ...(privacyContent_uk !== undefined ? { privacyContent_uk: privacyContent_uk || null } : {}),
  }

  try {
    const existing = await prisma.tenantConfig.findFirst()
    if (existing) {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data })
    } else {
      await prisma.tenantConfig.create({ data })
    }
    await invalidateTenantConfigCache()

    revalidatePath('/terms')
    revalidatePath('/privacy')
    revalidatePath('/admin/settings/legal')
    return { success: true }
  } catch {
    return { error: t('admin.settings.legal.saveError') }
  }
}
