"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { getTenantConfig } from "@/lib/tenant"
import { canManagePage } from "@/lib/content/pages-server"
import { BLOCK_TYPES, defaultConfigFor, blockConfigSchemaFor, type BlockType, type TextBlockConfig } from "@/lib/content/blocks"
import { parseEnabledLocales, hasAnyEnabledLocaleValue } from "@/lib/localized-content"

function revalidateAll() {
  revalidatePath("/admin/pages")
  revalidatePath("/admin/master/pages")
  revalidatePath("/admin/masters/[masterId]/pages", "page")
  revalidatePath("/admin/masters/[masterId]/pages/[id]", "page")
  revalidatePath("/", "layout")
}

async function verifyPageOwnership(pageId: string) {
  const t = getServerT()
  const session = await auth()

  const page = await prisma.page.findUnique({ where: { id: pageId } })
  if (!page || !canManagePage(session?.user, page)) throw new Error(t('errors.UNAUTHORIZED'))
  return page
}

async function verifyBlockOwnership(blockId: string) {
  const t = getServerT()
  const session = await auth()

  const block = await prisma.block.findUnique({ where: { id: blockId }, include: { page: true } })
  if (!block || !canManagePage(session?.user, block.page)) throw new Error(t('errors.UNAUTHORIZED'))
  return block
}

export async function createBlock(pageId: string, type: string): Promise<void> {
  const t = getServerT()
  await verifyPageOwnership(pageId)
  if (!BLOCK_TYPES.includes(type as BlockType)) throw new Error(t('admin.pages.invalidBlockType'))

  const maxOrder = await prisma.block.aggregate({
    where: { pageId },
    _max: { order: true },
  })

  await prisma.block.create({
    data: {
      pageId,
      type,
      order: (maxOrder._max.order ?? -1) + 1,
      config: JSON.stringify(defaultConfigFor(type as BlockType)),
    },
  })
  revalidateAll()
}

export async function updateBlockConfig(
  blockId: string,
  configJson: string
): Promise<{ error?: string }> {
  const t = getServerT()
  const block = await verifyBlockOwnership(blockId)

  let parsedInput: unknown
  try {
    parsedInput = JSON.parse(configJson)
  } catch {
    return { error: t('admin.pages.invalidBlockConfig') }
  }

  const result = blockConfigSchemaFor(block.type as BlockType).safeParse(parsedInput)
  if (!result.success) return { error: t('admin.pages.invalidBlockConfig') }

  // C-3: a text block must have at least one currently-enabled locale filled —
  // never a hardcoded `text_pl` requirement.
  if (block.type === "text") {
    const config = result.data as TextBlockConfig
    const tenantConfig = await getTenantConfig()
    const enabledLocales = parseEnabledLocales((tenantConfig as { enabledLocales?: string }).enabledLocales)
    if (!hasAnyEnabledLocaleValue({ pl: config.text_pl, en: config.text_en, uk: config.text_uk }, enabledLocales)) {
      return { error: t('admin.pages.textRequiredAnyLocale') }
    }
  }

  await prisma.block.update({ where: { id: blockId }, data: { config: JSON.stringify(result.data) } })
  revalidateAll()
  return {}
}

export async function deleteBlock(blockId: string): Promise<void> {
  await verifyBlockOwnership(blockId)
  await prisma.block.delete({ where: { id: blockId } })
  revalidateAll()
}

/**
 * Whole-list reorder (replaces the old single-step `moveBlock` swap, C-1) —
 * same rationale as `reorderPages`: atomic, matches the drag-end payload, and
 * the submitted id set must exactly equal this page's block ids.
 */
export async function reorderBlocks(pageId: string, orderedIds: string[]): Promise<void> {
  const t = getServerT()
  await verifyPageOwnership(pageId)

  const scoped = await prisma.block.findMany({ where: { pageId }, select: { id: true } })
  const scopedIds = new Set(scoped.map((b) => b.id))
  const submittedIds = new Set(orderedIds)
  if (
    orderedIds.length !== scopedIds.size ||
    submittedIds.size !== scopedIds.size ||
    ![...scopedIds].every((id) => submittedIds.has(id))
  ) {
    throw new Error(t('errors.UNAUTHORIZED'))
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.block.update({ where: { id }, data: { order: index } }))
  )
  revalidateAll()
}
