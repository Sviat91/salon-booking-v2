"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { parseEnabledLocales } from "@/lib/localized-content"
import { invalidateTenantConfigCache } from "@/lib/tenant"

function buildSettingsSchema(t: (key: string) => string) {
  const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, t('admin.settings.general.invalidHexColor'))

  return z.object({
  brandName:      z.string().min(1, t('admin.settings.general.brandNameRequired')).max(80),
  logoUrl:        z.string().optional().default(""),
  faviconUrl:     z.string().optional().default(""),
  darkLogoUrl:    z.string().optional().default(""),
  themeToggleIconUrl:     z.string().optional().default(""),
  darkThemeToggleIconUrl: z.string().optional().default(""),
  logoPositionX:  z.coerce.number().min(0).max(100).default(0),
  logoPositionY:  z.coerce.number().min(0).max(100).default(0),
  logoWidth:      z.coerce.number().min(50).max(800).default(200),
  logoHeight:     z.coerce.number().min(20).max(200).default(80),
  logoPages:      z.string().optional().default('["home","booking"]'),
  logoLayer:      z.string().optional().default('above'),
  bgType:          z.string().optional().default('solid'),
  bgImageUrl:      z.string().optional().default(''),
  bgGradientFrom:  hexColor.default('#FDE5C3'),
  bgGradientTo:    hexColor.default('#FFF6E9'),
  bgGradientAngle: z.coerce.number().min(0).max(360).default(135),
  bgApplyToDark:   z.string().optional().default('true'),
  logoFullscreen:  z.string().optional().default('false'),
  darkBgType:          z.string().optional().default('solid'),
  darkBgImageUrl:      z.string().optional().default(''),
  darkBgGradientFrom:  hexColor.default('#9c6849'),
  darkBgGradientTo:    hexColor.default('#2A2A2A'),
  darkBgGradientAngle: z.coerce.number().min(0).max(360).default(135),
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
  availableSlotColor: hexColor,
  dayOffColor:     hexColor,
  workingHourStart: z.coerce.number().min(0).max(23).default(8),
  workingHourEnd:   z.coerce.number().min(1).max(24).default(21),
  // Salon contact / legal info
  salonAddress:     z.string().max(200).optional().default(""),
  salonCity:        z.string().max(100).optional().default(""),
  salonPhone:       z.string().max(30).optional().default(""),
  salonEmail:       z.string().max(120).optional().default(""),
  salonCompanyName: z.string().max(200).optional().default(""),
  salonNip:         z.string().max(30).optional().default(""),
  salonLegalAddress:z.string().max(200).optional().default(""),
  enabledLocales:   z.string().optional().default('["pl","en","uk"]'),
  homepageWidgetBlock: z.string().optional().default(""),
  })
}

export type SettingsFormState = {
  error?: string
  success?: boolean
}

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const t = getServerT()
  const raw = {
    brandName:        formData.get("brandName"),
    logoUrl:          formData.get("logoUrl") || "",
    faviconUrl:       formData.get("faviconUrl") || "",
    darkLogoUrl:      formData.get("darkLogoUrl") || "",
    themeToggleIconUrl:     formData.get("themeToggleIconUrl") || "",
    darkThemeToggleIconUrl: formData.get("darkThemeToggleIconUrl") || "",
    logoPositionX:    formData.get("logoPositionX") || 0,
    logoPositionY:    formData.get("logoPositionY") || 0,
    logoWidth:        formData.get("logoWidth") || 200,
    logoHeight:       formData.get("logoHeight") || 80,
    logoPages:        formData.get("logoPages") || '["home","booking"]',
    logoLayer:        formData.get("logoLayer") || "above",
    bgType:          formData.get('bgType') || 'solid',
    bgImageUrl:      formData.get('bgImageUrl') || '',
    bgGradientFrom:  formData.get('bgGradientFrom') || '#FDE5C3',
    bgGradientTo:    formData.get('bgGradientTo') || '#FFF6E9',
    bgGradientAngle: formData.get('bgGradientAngle') || 135,
    bgApplyToDark:   formData.get('bgApplyToDark') || 'true',
    logoFullscreen:  formData.get('logoFullscreen') || 'false',
    darkBgType:          formData.get('darkBgType') || 'solid',
    darkBgImageUrl:      formData.get('darkBgImageUrl') || '',
    darkBgGradientFrom:  formData.get('darkBgGradientFrom') || '#9c6849',
    darkBgGradientTo:    formData.get('darkBgGradientTo') || '#2A2A2A',
    darkBgGradientAngle: formData.get('darkBgGradientAngle') || 135,
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
    availableSlotColor: formData.get("availableSlotColor"),
    dayOffColor:      formData.get("dayOffColor"),
    workingHourStart: formData.get("workingHourStart"),
    workingHourEnd:   formData.get("workingHourEnd"),
    salonAddress:     formData.get("salonAddress") || "",
    salonCity:        formData.get("salonCity") || "",
    salonPhone:       formData.get("salonPhone") || "",
    salonEmail:       formData.get("salonEmail") || "",
    salonCompanyName: formData.get("salonCompanyName") || "",
    salonNip:         formData.get("salonNip") || "",
    salonLegalAddress:formData.get("salonLegalAddress") || "",
    enabledLocales:   formData.get("enabledLocales") || '["pl","en","uk"]',
    homepageWidgetBlock: formData.get("homepageWidgetBlock") || "",
  }

  const parsed = buildSettingsSchema(t).safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const parsedLocales = parseEnabledLocales(parsed.data.enabledLocales)
  const enabledLocales = JSON.stringify(parsedLocales)

  const data = {
    ...parsed.data,
    enabledLocales,
    logoUrl:          parsed.data.logoUrl          || null,
    faviconUrl:       parsed.data.faviconUrl       || null,
    darkLogoUrl:      parsed.data.darkLogoUrl      || null,
    themeToggleIconUrl:     parsed.data.themeToggleIconUrl     || null,
    darkThemeToggleIconUrl: parsed.data.darkThemeToggleIconUrl || null,
    salonAddress:     parsed.data.salonAddress      || null,
    salonCity:        parsed.data.salonCity         || null,
    salonPhone:       parsed.data.salonPhone        || null,
    salonEmail:       parsed.data.salonEmail        || null,
    salonCompanyName: parsed.data.salonCompanyName  || null,
    salonNip:         parsed.data.salonNip          || null,
    salonLegalAddress:parsed.data.salonLegalAddress || null,
    bgImageUrl:    parsed.data.bgImageUrl || null,
    bgApplyToDark:  parsed.data.bgApplyToDark === 'true',
    logoFullscreen: parsed.data.logoFullscreen === 'true',
    darkBgImageUrl: parsed.data.darkBgImageUrl || null,
    homepageWidgetBlock: parsed.data.homepageWidgetBlock || null,
  }

  try {
    const existing = await prisma.tenantConfig.findFirst()
    if (existing) {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data })
    } else {
      await prisma.tenantConfig.create({ data })
    }
    await invalidateTenantConfigCache()
    // Revalidate all paths that use tenant config
    revalidatePath("/", "layout")
    revalidatePath("/admin", "layout")
    revalidatePath("/admin/settings")
    return { success: true }
  } catch {
    return { error: t('admin.settings.general.saveSettingsError') }
  }
}
