"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function buildServiceSchema(t: (key: string) => string) {
  return z.object({
    name:     z.string().min(1, t('admin.services.nameRequired')).max(100),
    duration: z.coerce.number().int().min(5).max(480),
    price:    z.coerce.number().min(0),
  })
}

export type ServiceFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse master assignments from FormData.
 * Fields follow the pattern:
 *   master_{profileId} = "on"  (checkbox)
 *   price_{profileId}  = "120" (optional price override)
 */
function parseMasterAssignments(
  formData: FormData
): Array<{ masterProfileId: string; priceOverride: number | null }> {
  const result: Array<{ masterProfileId: string; priceOverride: number | null }> = []
  for (const [key] of formData.entries()) {
    if (key.startsWith("master_")) {
      const profileId = key.slice("master_".length)
      const priceRaw = formData.get(`price_${profileId}`)
      const priceOverride =
        priceRaw && priceRaw !== ""
          ? parseFloat(priceRaw as string)
          : null
      result.push({ masterProfileId: profileId, priceOverride })
    }
  }
  return result
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createService(
  _prev: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const t = getServerT()
  const parsed = buildServiceSchema(t).safeParse({
    name:     formData.get("name"),
    duration: formData.get("duration"),
    price:    formData.get("price"),
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const assignments = parseMasterAssignments(formData)

  try {
    const service = await prisma.service.create({ data: parsed.data })

    // Create MasterService records for selected masters
    if (assignments.length > 0) {
      await db.masterService.createMany({
        data: assignments.map((a) => ({
          serviceId:      service.id,
          masterProfileId:a.masterProfileId,
          priceOverride:  a.priceOverride,
        })),
      })
    }

    revalidatePath("/admin/services")
    return { success: true }
  } catch {
    return { error: t('admin.services.createError') }
  }
}

export async function updateService(
  id: string,
  _prev: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const t = getServerT()
  const parsed = buildServiceSchema(t).safeParse({
    name:     formData.get("name"),
    duration: formData.get("duration"),
    price:    formData.get("price"),
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const assignments = parseMasterAssignments(formData)

  try {
    await prisma.service.update({ where: { id }, data: parsed.data })

    // Replace all MasterService records for this service
    await db.masterService.deleteMany({ where: { serviceId: id } })
    if (assignments.length > 0) {
      await db.masterService.createMany({
        data: assignments.map((a) => ({
          serviceId:      id,
          masterProfileId:a.masterProfileId,
          priceOverride:  a.priceOverride,
        })),
      })
    }

    revalidatePath("/admin/services")
    return { success: true }
  } catch {
    return { error: t('admin.services.updateError') }
  }
}

export async function deleteService(id: string): Promise<void> {
  // MasterService records deleted via cascade
  await prisma.service.delete({ where: { id } })
  revalidatePath("/admin/services")
}
