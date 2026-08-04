"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFormState } from "react-dom"
import { useTranslation } from "react-i18next"
import { Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { saveSettings, type SettingsFormState } from "./actions"
import LogoEditor from "./LogoEditor"
import BackgroundSection from "./BackgroundSection"
import { ColorRow, ImageUploadField, SubmitButton, SettingsSection } from "./FormFields"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"
import { resizeImageIfNeeded } from "@/lib/image-resize"
import LanguagesSection from "./LanguagesSection"
import HomepageWidgetSection from "./HomepageWidgetSection"
import { parseEnabledLocales } from "@/lib/localized-content"

const M3_LIGHT_DEFAULTS = {
  primaryColor:  '#FFF0F1',
  cardColor:     '#FFF0F1',
  accentColor:   '#8B4A58',
  textColor:     '#211A1B',
  mutedColor:    '#524344',
  borderColor:   '#D8C2C3',
} as const

const M3_DARK_DEFAULTS = {
  darkBgColor:      '#191112',
  darkPrimaryColor: '#261E1F',
  darkCardColor:    '#22160f',
  darkAccentColor:  '#FFB2B8',
  darkTextColor:    '#EDE1E1',
  darkMutedColor:   '#D8C2C3',
  darkBorderColor:  '#524344',
} as const

type TenantConfig = {
  brandName:       string
  logoUrl:         string | null
  faviconUrl:      string | null
  darkLogoUrl:     string | null
  logoPositionX:   number
  logoPositionY:   number
  logoWidth:       number
  logoHeight:      number
  logoPages:       string
  logoLayer:       string
  bgType:          string
  bgImageUrl:      string | null
  bgGradientFrom:  string
  bgGradientTo:    string
  bgGradientAngle: number
  bgApplyToDark:   boolean
  logoFullscreen:  boolean
  primaryColor:    string
  secondaryColor:  string
  accentColor:     string
  textColor:       string
  mutedColor:      string
  borderColor:     string
  cardColor:       string
  darkBgColor:     string
  darkPrimaryColor: string
  darkAccentColor: string
  darkCardColor:   string
  darkTextColor:   string
  darkMutedColor:  string
  darkBorderColor: string
  darkBgType:          string
  darkBgImageUrl:      string | null
  darkBgGradientFrom:  string
  darkBgGradientTo:    string
  darkBgGradientAngle: number
  availableSlotColor: string
  dayOffColor:     string
  workingHourStart: number
  workingHourEnd:   number
  salonAddress:      string | null
  salonCity:         string | null
  salonPhone:        string | null
  salonEmail:        string | null
  salonCompanyName:  string | null
  salonNip:          string | null
  salonLegalAddress: string | null
  enabledLocales:    string
  homepageWidgetBlock: string | null
}

const initialState: SettingsFormState = {}

// Light/dark theme color fields — labelKey/descKey resolved via t() at render
const lightColorFields: { name: keyof TenantConfig; labelKey: string; descKey: string }[] = [
  { name: "primaryColor",   labelKey: "admin.settings.general.primaryColorLabel",   descKey: "admin.settings.general.primaryColorDesc" },
  { name: "cardColor",      labelKey: "admin.settings.general.cardColorLabel",      descKey: "admin.settings.general.cardColorDesc" },
  { name: "accentColor",    labelKey: "admin.settings.general.accentColorLabel",    descKey: "admin.settings.general.accentColorDesc" },
  { name: "textColor",      labelKey: "admin.settings.general.textColorLabel",      descKey: "admin.settings.general.textColorDesc" },
  { name: "mutedColor",     labelKey: "admin.settings.general.mutedColorLabel",     descKey: "admin.settings.general.mutedColorDesc" },
  { name: "borderColor",    labelKey: "admin.settings.general.borderColorLabel",    descKey: "admin.settings.general.borderColorDesc" },
]

const darkColorFields: { name: keyof TenantConfig; labelKey: string; descKey: string }[] = [
  { name: "darkBgColor",      labelKey: "admin.settings.general.darkBgColorLabel",      descKey: "admin.settings.general.darkBgColorDesc" },
  { name: "darkPrimaryColor", labelKey: "admin.settings.general.darkPrimaryColorLabel", descKey: "admin.settings.general.primaryColorDesc" },
  { name: "darkCardColor",    labelKey: "admin.settings.general.darkCardColorLabel",    descKey: "admin.settings.general.darkCardColorDesc" },
  { name: "darkAccentColor",  labelKey: "admin.settings.general.darkAccentColorLabel",  descKey: "admin.settings.general.accentColorDesc" },
  { name: "darkTextColor",    labelKey: "admin.settings.general.darkTextColorLabel",    descKey: "admin.settings.general.darkTextColorDesc" },
  { name: "darkMutedColor",   labelKey: "admin.settings.general.darkMutedColorLabel",   descKey: "admin.settings.general.darkMutedColorDesc" },
  { name: "darkBorderColor",  labelKey: "admin.settings.general.darkBorderColorLabel",  descKey: "admin.settings.general.darkBorderColorDesc" },
]


export default function SettingsForm({ config }: { config: TenantConfig }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [state, formAction] = useFormState(saveSettings, initialState)
  const [isDirty, setIsDirty] = useState(false)
  const [lightReset, setLightReset] = useState(0)
  const [darkReset,  setDarkReset]  = useState(0)
  const [lightColorOverrides, setLightColorOverrides] = useState<Record<string, string> | null>(null)
  const [darkColorOverrides,  setDarkColorOverrides]  = useState<Record<string, string> | null>(null)

  const [logoUrl, setLogoUrl] = useState<string>(config.logoUrl ?? "")
  const [darkLogoUrl, setDarkLogoUrl] = useState<string>(config.darkLogoUrl ?? "")
  const [logoPositionX, setLogoPositionX] = useState(config.logoPositionX)
  const [logoPositionY, setLogoPositionY] = useState(config.logoPositionY)
  const [logoWidth, setLogoWidth] = useState(config.logoWidth)
  const [logoHeight, setLogoHeight] = useState(config.logoHeight)
  const [logoPages, setLogoPages] = useState(config.logoPages)
  const [logoLayer, setLogoLayer] = useState(config.logoLayer ?? "above")
  const [logoFullscreen, setLogoFullscreen] = useState(config.logoFullscreen ?? false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [darkLogoUploading, setDarkLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [darkLogoError, setDarkLogoError] = useState<string | null>(null)

  const [bgImageUrl, setBgImageUrl] = useState<string>(config.bgImageUrl ?? "")
  const [darkBgImageUrl, setDarkBgImageUrl] = useState<string>(config.darkBgImageUrl ?? "")

  const [faviconPreview, setFaviconPreview] = useState<string | null>(config.faviconUrl)
  const [faviconUrl, setFaviconUrl] = useState<string>(config.faviconUrl ?? "")
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconError, setFaviconError] = useState<string | null>(null)

  // Reset dirty on successful save
  useEffect(() => {
    if (state.success) {
      setIsDirty(false)
      router.refresh()
    }
  }, [state.success, router])

  // Dispatch custom event so sidebar can read isDirty
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('settings-dirty', { detail: { isDirty } }))
  }, [isDirty])

  async function uploadFile(
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (v: string | null) => void,
    setUrl: (v: string) => void,
    setUploading: (v: boolean) => void,
    setError: (v: string | null) => void
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    const processedFile = file.type !== "image/svg+xml" ? await resizeImageIfNeeded(file, 512) : file
    const fd = new FormData()
    fd.append("file", processedFile)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.code ? t(apiErrorKey(json.code)) : t('admin.masters.uploadFailed'))
      setPreview(json.url)
      setUrl(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.masters.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  function resetLightToM3() {
    setLightColorOverrides(M3_LIGHT_DEFAULTS)
    setLightReset(k => k + 1)
    setIsDirty(true)
  }
  function resetDarkToM3() {
    setDarkColorOverrides(M3_DARK_DEFAULTS)
    setDarkReset(k => k + 1)
    setIsDirty(true)
  }

  return (
    <form
      id="settings-form"
      action={formAction}
      className="flex flex-col gap-10"
      onChange={() => setIsDirty(true)}
    >

      <SettingsSection title={t('admin.settings.general.brandSectionTitle')} description={t('admin.settings.general.brandSectionDesc')}>
        <div className="grid gap-1.5 max-w-sm">
          <Label htmlFor="brandName">{t('admin.settings.general.salonNameLabel')}</Label>
          <Input
            id="brandName"
            name="brandName"
            defaultValue={config.brandName}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t('admin.settings.general.salonNameHint')}
          </p>
        </div>

        <LogoEditor
          config={{
            logoUrl,
            darkLogoUrl,
            logoPositionX,
            logoPositionY,
            logoWidth,
            logoHeight,
            logoPages,
            logoLayer,
            logoFullscreen,
          }}
          homepageWidgetBlock={config.homepageWidgetBlock}
          onLogoUpload={(url) => { setLogoUrl(url); setIsDirty(true) }}
          onDarkLogoUpload={(url) => { setDarkLogoUrl(url); setIsDirty(true) }}
          onPositionChange={(x, y) => { setLogoPositionX(x); setLogoPositionY(y); setIsDirty(true) }}
          onSizeChange={(w, h) => { setLogoWidth(w); setLogoHeight(h); setIsDirty(true) }}
          onPagesChange={(pages) => { setLogoPages(pages); setIsDirty(true) }}
          onLayerChange={(layer) => { setLogoLayer(layer); setIsDirty(true) }}
          logoFullscreen={logoFullscreen}
          onFullscreenChange={(v) => { setLogoFullscreen(v); setIsDirty(true) }}
          onRemoveLogo={() => { setLogoUrl(""); setIsDirty(true) }}
          onRemoveDarkLogo={() => { setDarkLogoUrl(""); setIsDirty(true) }}
          logoUploading={logoUploading}
          darkLogoUploading={darkLogoUploading}
          logoError={logoError}
          darkLogoError={darkLogoError}
          onLogoUploadStart={() => { setLogoUploading(true); setLogoError(null) }}
          onDarkLogoUploadStart={() => { setDarkLogoUploading(true); setDarkLogoError(null) }}
        />
        <input type="hidden" name="logoFullscreen" value={String(logoFullscreen)} />

        <ImageUploadField
          label={t('admin.settings.general.faviconLabel')}
          hint={t('admin.settings.general.faviconHint')}
          preview={faviconPreview}
          fieldName="faviconUrl"
          fieldValue={faviconUrl}
          onUpload={(e) => { uploadFile(e, setFaviconPreview, setFaviconUrl, setFaviconUploading, setFaviconError); setIsDirty(true) }}
          onRemove={() => { setFaviconPreview(null); setFaviconUrl(""); setIsDirty(true) }}
          uploading={faviconUploading}
          uploadError={faviconError}
        />
      </SettingsSection>

      {/* ── Salon Contact Info ────────────────────────────────────────── */}
      <SettingsSection
        title={t('admin.settings.general.contactSectionTitle')}
        description={t('admin.settings.general.contactSectionDesc')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="salonCompanyName">{t('admin.settings.general.companyNameLabel')}</Label>
            <Input
              id="salonCompanyName"
              name="salonCompanyName"
              defaultValue={config.salonCompanyName ?? ""}
              placeholder={t('admin.settings.general.companyNamePlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.companyNameHint')}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salonNip">{t('admin.settings.general.taxIdLabel')}</Label>
            <Input
              id="salonNip"
              name="salonNip"
              defaultValue={config.salonNip ?? ""}
              placeholder={t('admin.settings.general.taxIdPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.taxIdHint')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="salonAddress">{t('admin.settings.general.salonAddressLabel')}</Label>
            <Input
              id="salonAddress"
              name="salonAddress"
              defaultValue={config.salonAddress ?? ""}
              placeholder={t('admin.settings.general.salonAddressPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.salonAddressHint')}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salonCity">{t('admin.settings.general.salonCityLabel')}</Label>
            <Input
              id="salonCity"
              name="salonCity"
              defaultValue={config.salonCity ?? ""}
              placeholder={t('admin.settings.general.salonCityPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.salonCityHint')}</p>
          </div>
        </div>

        <div className="grid gap-1.5 max-w-sm">
          <Label htmlFor="salonLegalAddress">{t('admin.settings.general.legalAddressLabel')}</Label>
          <Input
            id="salonLegalAddress"
            name="salonLegalAddress"
            defaultValue={config.salonLegalAddress ?? ""}
            placeholder={t('admin.settings.general.legalAddressPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('admin.settings.general.legalAddressHint')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="salonPhone">{t('admin.settings.general.phoneNumberLabel')}</Label>
            <Input
              id="salonPhone"
              name="salonPhone"
              type="tel"
              defaultValue={config.salonPhone ?? ""}
              placeholder={t('admin.settings.general.phoneNumberPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.phoneNumberHint')}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salonEmail">{t('admin.settings.general.contactEmailLabel')}</Label>
            <Input
              id="salonEmail"
              name="salonEmail"
              type="email"
              defaultValue={config.salonEmail ?? ""}
              placeholder={t('admin.settings.general.contactEmailPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.contactEmailHint')}</p>
          </div>
        </div>
      </SettingsSection>

      {/* ── Calendar Settings ────────────────────────────────────────── */}
      <SettingsSection title={t('admin.settings.general.calendarSectionTitle')} description={t('admin.settings.general.calendarSectionDesc')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorRow
            field={{ name: "availableSlotColor", label: t('admin.settings.general.availableSlotLabel'), description: t('admin.settings.general.availableSlotDesc') }}
            defaultValue={config.availableSlotColor}
          />
          <ColorRow
            field={{ name: "dayOffColor", label: t('admin.settings.general.dayOffLabel'), description: t('admin.settings.general.dayOffDesc') }}
            defaultValue={config.dayOffColor}
          />
        </div>
      </SettingsSection>

      {/* ── Business Hours ────────────────────────────────────────── */}
      <SettingsSection title={t('admin.settings.general.businessHoursTitle')} description={t('admin.settings.general.businessHoursDesc')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="workingHourStart">{t('admin.settings.general.openHourLabel')}</Label>
            <Input id="workingHourStart" name="workingHourStart" type="number" min="0" max="23" defaultValue={config.workingHourStart} />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.openHourHint')}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="workingHourEnd">{t('admin.settings.general.closeHourLabel')}</Label>
            <Input id="workingHourEnd" name="workingHourEnd" type="number" min="1" max="24" defaultValue={config.workingHourEnd} />
            <p className="text-xs text-muted-foreground">{t('admin.settings.general.closeHourHint')}</p>
          </div>
        </div>
      </SettingsSection>

      {/* ── Content Languages ────────────────────────────────────── */}
      <LanguagesSection enabledLocales={parseEnabledLocales(config.enabledLocales)} onChange={() => setIsDirty(true)} />
      <HomepageWidgetSection value={config.homepageWidgetBlock} enabledLocales={parseEnabledLocales(config.enabledLocales)} onChange={() => setIsDirty(true)} />

      {/* ── Light theme ──────────────────────────────────────────── */}
      <SettingsSection
        title={t('admin.settings.general.lightThemeTitle')}
        description={t('admin.settings.general.lightThemeDesc')}
        action={
          <button
            type="button"
            onClick={resetLightToM3}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {t('admin.settings.general.resetToM3')}
          </button>
        }
      >
        <BackgroundSection
          config={{
            bgType: config.bgType,
            bgImageUrl: bgImageUrl,
            bgGradientFrom: config.bgGradientFrom,
            bgGradientTo: config.bgGradientTo,
            bgGradientAngle: config.bgGradientAngle,
            secondaryColor: config.secondaryColor,
            bgApplyToDark: config.bgApplyToDark,
          }}
          onBgImageUpload={(url) => { setBgImageUrl(url); setIsDirty(true) }}
        />
        <div key={lightReset} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lightColorFields.map((field) => (
            <ColorRow
              key={field.name}
              field={{ name: field.name, label: t(field.labelKey), description: t(field.descKey) }}
              defaultValue={lightColorOverrides?.[field.name as keyof typeof M3_LIGHT_DEFAULTS] ?? config[field.name] as string}
            />
          ))}
        </div>
      </SettingsSection>

      {/* ── Dark theme ───────────────────────────────────────────── */}
      <SettingsSection
        title={t('admin.settings.general.darkThemeTitle')}
        description={t('admin.settings.general.darkThemeDesc')}
        action={
          <button
            type="button"
            onClick={resetDarkToM3}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {t('admin.settings.general.resetToM3')}
          </button>
        }
      >
        <BackgroundSection
          config={{
            bgType: config.darkBgType || 'solid',
            bgImageUrl: darkBgImageUrl || null,
            bgGradientFrom: config.darkBgGradientFrom || '#9c6849',
            bgGradientTo: config.darkBgGradientTo || '#2A2A2A',
            bgGradientAngle: config.darkBgGradientAngle ?? 135,
            secondaryColor: config.darkBgColor || '#724b27',
            bgApplyToDark: false,
          }}
          onBgImageUpload={(url) => { setDarkBgImageUrl(url); setIsDirty(true) }}
          prefix="dark"
        />
        <div key={darkReset} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {darkColorFields.map((field) => (
            <ColorRow
              key={field.name}
              field={{ name: field.name, label: t(field.labelKey), description: t(field.descKey) }}
              defaultValue={darkColorOverrides?.[field.name as keyof typeof M3_DARK_DEFAULTS] ?? config[field.name] as string}
            />
          ))}
        </div>
      </SettingsSection>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-[var(--md-success)]">{t('admin.settings.general.settingsSavedMsg')}</p>}

      {/* Mobile-only floating Save button — the sidebar's equivalent button is off-canvas
          below `lg`, so this mirrors it via the same `form="settings-form"` submit target. */}
      <button
        type="submit"
        form="settings-form"
        disabled={!isDirty}
        aria-label={t('admin.nav.saveSettings')}
        className={cn(
          "lg:hidden fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          isDirty
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground opacity-50 pointer-events-none"
        )}
      >
        <Save className="h-5 w-5" />
      </button>
    </form>
  )
}
