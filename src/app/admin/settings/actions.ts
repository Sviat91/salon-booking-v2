"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")

const SettingsSchema = z.object({
  brandName:      z.string().min(1, "Brand name is required").max(80),
  logoUrl:        z.string().optional().default(""),
  faviconUrl:     z.string().optional().default(""),
  darkLogoUrl:    z.string().optional().default(""),
  logoPositionX:  z.coerce.number().min(0).max(100).default(0),
  logoPositionY:  z.coerce.number().min(0).max(100).default(0),
  logoWidth:      z.coerce.number().min(50).max(500).default(200),
  logoHeight:     z.coerce.number().min(20).max(200).default(80),
  logoPages:      z.string().optional().default('["home","booking"]'),
  primaryColor:   hexColor,
  secondaryColor: hexColor,
  accentColor:    hexColor,
  textColor:      hexColor,
  mutedColor:     hexColor,
  borderColor:    hexColor,
  cardColor:      hexColor,
  darkBgColor:     hexColor,
  darkPrimaryColor: hexColor,
  darkAccentColor: hexColor,
  darkCardColor:   hexColor,
  darkTextColor:   hexColor,
  darkMutedColor:  hexColor,
  darkBorderColor: hexColor,
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
    brandName:        formData.get("brandName"),
    logoUrl:          formData.get("logoUrl") || "",
    faviconUrl:       formData.get("faviconUrl") || "",
    darkLogoUrl:      formData.get("darkLogoUrl") || "",
    logoPositionX:    formData.get("logoPositionX") || 0,
    logoPositionY:    formData.get("logoPositionY") || 0,
    logoWidth:        formData.get("logoWidth") || 200,
    logoHeight:       formData.get("logoHeight") || 80,
    logoPages:        formData.get("logoPages") || '["home","booking"]',
    primaryColor:     formData.get("primaryColor"),
    secondaryColor:   formData.get("secondaryColor"),
    accentColor:      formData.get("accentColor"),
    textColor:        formData.get("textColor"),
    mutedColor:       formData.get("mutedColor"),
    borderColor:      formData.get("borderColor"),
    cardColor:        formData.get("cardColor"),
    darkBgColor:      formData.get("darkBgColor"),
    darkPrimaryColor: formData.get("darkPrimaryColor"),
    darkAccentColor:  formData.get("darkAccentColor"),
    darkCardColor:    formData.get("darkCardColor"),
    darkTextColor:    formData.get("darkTextColor"),
    darkMutedColor:   formData.get("darkMutedColor"),
    darkBorderColor:  formData.get("darkBorderColor"),
  }

  const parsed = SettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const data = {
    ...parsed.data,
    logoUrl:     parsed.data.logoUrl     || null,
    faviconUrl:  parsed.data.faviconUrl  || null,
    darkLogoUrl: parsed.data.darkLogoUrl || null,
  }

  try {
    const existing = await prisma.tenantConfig.findFirst()
    if (existing) {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data })
    } else {
      await prisma.tenantConfig.create({ data })
    }
    // Revalidate all paths that use tenant config
    revalidatePath("/", "layout")
    revalidatePath("/admin", "layout")
    revalidatePath("/admin/settings")
    return { success: true }
  } catch {
    return { error: "Failed to save settings. Please try again." }
  }
}
