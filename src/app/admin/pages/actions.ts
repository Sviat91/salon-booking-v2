"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { getTenantConfig } from "@/lib/tenant"
import { resolvePageOwner, generateUniqueSlug } from "@/lib/content/pages-server"
import { slugify, parseVisibility, serializeVisibility } from "@/lib/content/pages-shared"
import { parseEnabledLocales, hasAnyEnabledLocaleValue, resolveLocalized } from "@/lib/localized-content"
import { DEFAULT_LANGUAGE } from "@/lib/i18n-shared"

// C-3: no locale is privileged — `title_pl` is not required by shape. The real
// rule ("at least one of the tenant's enabled locales is non-empty") is
// enforced below via `hasAnyEnabledLocaleValue`, as a form-level error rather
// than pinned to one field.
function buildPageSchema(t: (key: string) => string) {
  return z.object({
    title_pl:   z.string().max(150, t('admin.pages.titleTooLong')).optional(),
    title_en:   z.string().max(150, t('admin.pages.titleTooLong')).optional(),
    title_uk:   z.string().max(150, t('admin.pages.titleTooLong')).optional(),
    enabled:    z.coerce.boolean().default(true),
    visibility: z.string().optional().default("[]"),
  })
}

/**
 * `title_en`/`title_uk` are only rendered when their locale is enabled for the
 * tenant. When absent from the submission, don't touch the DB column —
 * preserves a previously-saved translation instead of nulling it out.
 */
function readOptionalLocaleField(formData: FormData, key: string): string | undefined {
  return formData.has(key) ? (formData.get(key) as string) : undefined
}

export type PageFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  pageId?: string
}

function revalidateAll() {
  revalidatePath("/admin/pages")
  revalidatePath("/admin/master/pages")
  revalidatePath("/", "layout")
}

export async function createPage(
  _prev: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const t = getServerT()
  const session = await auth()
  const owner = resolvePageOwner(session?.user)
  if (!owner) return { error: t('errors.UNAUTHORIZED') }

  const parsed = buildPageSchema(t).safeParse({
    title_pl:   formData.get("title_pl"),
    title_en:   readOptionalLocaleField(formData, "title_en"),
    title_uk:   readOptionalLocaleField(formData, "title_uk"),
    enabled:    formData.get("enabled") === "on" || formData.get("enabled") === "true",
    visibility: formData.get("visibility") || "[]",
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const titleField = { pl: parsed.data.title_pl, en: parsed.data.title_en, uk: parsed.data.title_uk }
  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  if (!hasAnyEnabledLocaleValue(titleField, enabledLocales)) {
    return { error: t('admin.pages.titleRequiredAnyLocale') }
  }

  // `resolveLocalized` already falls back pl → any non-empty locale — exactly
  // "pick whatever the admin actually filled in"; `slugify` falls back to
  // 'page' for an empty/unslugifiable result.
  const slug = await generateUniqueSlug(
    slugify(resolveLocalized(titleField, DEFAULT_LANGUAGE)),
    owner.ownerType,
    owner.masterId
  )

  const maxOrder = await prisma.page.aggregate({
    where: { ownerType: owner.ownerType, masterId: owner.masterId },
    _max: { order: true },
  })

  const visibility =
    owner.ownerType === "global" ? serializeVisibility(parseVisibility(parsed.data.visibility)) : null

  try {
    const created = await prisma.page.create({
      data: {
        ownerType: owner.ownerType,
        masterId:  owner.masterId,
        slug,
        title_pl:  parsed.data.title_pl || null,
        title_en:  parsed.data.title_en || null,
        title_uk:  parsed.data.title_uk || null,
        enabled:   parsed.data.enabled,
        order:     (maxOrder._max.order ?? -1) + 1,
        visibility,
      },
    })
    revalidateAll()
    return { success: true, pageId: created.id }
  } catch {
    return { error: t('admin.pages.createError') }
  }
}

export async function updatePage(
  id: string,
  _prev: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const t = getServerT()
  const session = await auth()
  const owner = resolvePageOwner(session?.user)
  if (!owner) return { error: t('errors.UNAUTHORIZED') }

  const existing = await prisma.page.findUnique({ where: { id } })
  if (!existing || existing.ownerType !== owner.ownerType || existing.masterId !== owner.masterId) {
    return { error: t('errors.UNAUTHORIZED') }
  }

  const parsed = buildPageSchema(t).safeParse({
    title_pl:   formData.get("title_pl"),
    title_en:   readOptionalLocaleField(formData, "title_en"),
    title_uk:   readOptionalLocaleField(formData, "title_uk"),
    enabled:    formData.get("enabled") === "on" || formData.get("enabled") === "true",
    visibility: formData.get("visibility") || "[]",
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const { title_en, title_uk } = parsed.data
  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
  if (!hasAnyEnabledLocaleValue({ pl: parsed.data.title_pl, en: title_en, uk: title_uk }, enabledLocales)) {
    return { error: t('admin.pages.titleRequiredAnyLocale') }
  }

  // Slug is intentionally never touched here (AD-3) — renaming a page never changes its URL.
  const visibility =
    owner.ownerType === "global" ? serializeVisibility(parseVisibility(parsed.data.visibility)) : existing.visibility

  try {
    await prisma.page.update({
      where: { id },
      data: {
        title_pl: parsed.data.title_pl || null,
        ...(title_en !== undefined ? { title_en: title_en || null } : {}),
        ...(title_uk !== undefined ? { title_uk: title_uk || null } : {}),
        enabled: parsed.data.enabled,
        visibility,
      },
    })
    revalidateAll()
    return { success: true }
  } catch {
    return { error: t('admin.pages.updateError') }
  }
}

async function verifyPageOwnership(id: string) {
  const t = getServerT()
  const session = await auth()
  const owner = resolvePageOwner(session?.user)
  if (!owner) throw new Error(t('errors.UNAUTHORIZED'))

  const page = await prisma.page.findUnique({ where: { id } })
  if (!page || page.ownerType !== owner.ownerType || page.masterId !== owner.masterId) {
    throw new Error(t('errors.UNAUTHORIZED'))
  }
  return { page, owner }
}

export async function deletePage(id: string): Promise<void> {
  await verifyPageOwnership(id)
  // Blocks cascade via the FK.
  await prisma.page.delete({ where: { id } })
  revalidateAll()
}

/**
 * Whole-list reorder (replaces the old single-step `movePage` swap, C-1) — a
 * drag-end event hands back the complete new ordering, so bulk write is the
 * right shape: atomic (one transaction) and matches the drag-end payload.
 * Per-row ownership is enforced by requiring the submitted id set to be
 * exactly equal to this owner's scope — a foreign or partial id set is rejected
 * outright rather than silently reordering only the ids that happen to match.
 */
export async function reorderPages(orderedIds: string[]): Promise<void> {
  const t = getServerT()
  const session = await auth()
  const owner = resolvePageOwner(session?.user)
  if (!owner) throw new Error(t('errors.UNAUTHORIZED'))

  const scoped = await prisma.page.findMany({
    where: { ownerType: owner.ownerType, masterId: owner.masterId },
    select: { id: true },
  })
  const scopedIds = new Set(scoped.map((p) => p.id))
  const submittedIds = new Set(orderedIds)
  if (
    orderedIds.length !== scopedIds.size ||
    submittedIds.size !== scopedIds.size ||
    ![...scopedIds].every((id) => submittedIds.has(id))
  ) {
    throw new Error(t('errors.UNAUTHORIZED'))
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.page.update({ where: { id }, data: { order: index } }))
  )
  revalidateAll()
}

export async function togglePageEnabled(id: string, enabled: boolean): Promise<void> {
  await verifyPageOwnership(id)
  await prisma.page.update({ where: { id }, data: { enabled } })
  revalidateAll()
}
