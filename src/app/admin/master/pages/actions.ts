"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { getTenantConfig } from "@/lib/tenant"
import { parseBlockSlot, serializeBlockSlot, type TextBlockConfig } from "@/lib/content/blocks"
import { parseEnabledLocales, hasAnyEnabledLocaleValue } from "@/lib/localized-content"

export type MasterFooterBlockFormState = {
  error?: string
  success?: boolean
}

/**
 * Master-only: writes `MasterProfile.footerBlock` for the current session's
 * own profile — the owner id is always taken from the session, never from
 * client input (AD-5's ownership discipline applied to a singleton column).
 */
export async function saveMasterFooterBlock(
  _prev: MasterFooterBlockFormState,
  formData: FormData
): Promise<MasterFooterBlockFormState> {
  const t = getServerT()
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "MASTER") {
    return { error: t('errors.UNAUTHORIZED') }
  }

  const raw = (formData.get("footerBlock") as string) || ""
  let slot = parseBlockSlot(raw)

  // C-3: no privileged locale — a text slot whose every enabled locale is
  // empty is stored as "none" rather than rejected, no new validation surface.
  if (slot?.type === "text") {
    const { text_pl, text_en, text_uk } = slot.config as TextBlockConfig
    const config = await getTenantConfig()
    const enabledLocales = parseEnabledLocales((config as { enabledLocales?: string }).enabledLocales)
    if (!hasAnyEnabledLocaleValue({ pl: text_pl, en: text_en, uk: text_uk }, enabledLocales)) {
      slot = null
    }
  }

  const footerBlock = slot ? serializeBlockSlot(slot) : null

  try {
    await prisma.masterProfile.upsert({
      where: { userId: session.user.id },
      update: { footerBlock },
      create: { userId: session.user.id, footerBlock },
    })
    revalidatePath("/admin/master/pages")
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: t('admin.pages.footerBlockSaveError') }
  }
}
