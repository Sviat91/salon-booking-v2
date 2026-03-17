"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")

const SettingsSchema = z.object({
  brandName:      z.string().min(1, "Brand name is required").max(80),
  // logoUrl/faviconUrl are relative paths ("/uploads/..."), not full URLs
  logoUrl:        z.string().optional().default(""),
  faviconUrl:     z.string().optional().default(""),
  // Light theme
  primaryColor:   hexColor,
  secondaryColor: hexColor,
  accentColor:    hexColor,
  textColor:      hexColor,
  mutedColor:     hexColor,
  borderColor:    hexColor,
  // Dark theme
  darkBgColor:    hexColor,
  darkTextColor:  hexColor,
  darkMutedColor: hexColor,
  darkBorderColor:hexColor,
  darkCardColor:  hexColor,
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
    brandName:       formData.get("brandName"),
    logoUrl:         formData.get("logoUrl") || "",
    faviconUrl:      formData.get("faviconUrl") || "",
    primaryColor:    formData.get("primaryColor"),
    secondaryColor:  formData.get("secondaryColor"),
    accentColor:     formData.get("accentColor"),
    textColor:       formData.get("textColor"),
    mutedColor:      formData.get("mutedColor"),
    borderColor:     formData.get("borderColor"),
    darkBgColor:     formData.get("darkBgColor"),
    darkTextColor:   formData.get("darkTextColor"),
    darkMutedColor:  formData.get("darkMutedColor"),
    darkBorderColor: formData.get("darkBorderColor"),
    darkCardColor:   formData.get("darkCardColor"),
  }

  const parsed = SettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const data = {
    ...parsed.data,
    logoUrl:    parsed.data.logoUrl    || null,
    faviconUrl: parsed.data.faviconUrl || null,
  }

  try {
    const existing = await prisma.tenantConfig.findFirst()
    if (existing) {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data })
    } else {
      await prisma.tenantConfig.create({ data })
    }
    revalidatePath("/admin/settings")
    revalidatePath("/", "layout") // refresh global CSS vars across all pages
    return { success: true }
  } catch {
    return { error: "Failed to save settings. Please try again." }
  }
}
