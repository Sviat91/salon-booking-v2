"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"

const SettingsSchema = z.object({
  brandName: z.string().min(1, "Brand name is required").max(80),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
  mutedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
})

export type SettingsFormState = {
  error?: string
  success?: boolean
}

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const raw = {
    brandName: formData.get("brandName"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
    textColor: formData.get("textColor"),
    mutedColor: formData.get("mutedColor"),
  }

  const parsed = SettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  try {
    // Upsert: one row of TenantConfig (take the first or create)
    const existing = await prisma.tenantConfig.findFirst()
    if (existing) {
      await prisma.tenantConfig.update({
        where: { id: existing.id },
        data: parsed.data,
      })
    } else {
      await prisma.tenantConfig.create({ data: parsed.data })
    }
    revalidatePath("/admin/settings")
    revalidatePath("/", "layout") // refresh global CSS vars
    return { success: true }
  } catch {
    return { error: "Failed to save settings. Please try again." }
  }
}
