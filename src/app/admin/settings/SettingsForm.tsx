"use client"

import { useState, useEffect } from "react"
import { useFormState } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveSettings, type SettingsFormState } from "./actions"
import LogoEditor from "./LogoEditor"
import BackgroundSection from "./BackgroundSection"
import { ColorRow, ImageUploadField, SubmitButton } from "./FormFields"

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
}

const initialState: SettingsFormState = {}

// Light theme color fields — plain English labels
const lightColorFields: { name: keyof TenantConfig; label: string; description: string }[] = [
  { name: "primaryColor",   label: "Secondary Tint",   description: "Accent backgrounds, hover states" },
  { name: "cardColor",      label: "Card Background",  description: "Background for cards and panels" },
  { name: "accentColor",    label: "Primary Button",   description: "Buttons and highlighted elements" },
  { name: "textColor",      label: "Body Text",        description: "Main text color" },
  { name: "mutedColor",     label: "Muted Text",       description: "Subtitles, placeholders" },
  { name: "borderColor",    label: "Borders",          description: "Color of dividers and outlines" },
]

const darkColorFields: { name: keyof TenantConfig; label: string; description: string }[] = [
  { name: "darkBgColor",     label: "Dark Background",      description: "Main background in dark theme" },
  { name: "darkPrimaryColor", label: "Dark Secondary Tint", description: "Accent backgrounds, hover states" },
  { name: "darkCardColor",   label: "Dark Card",            description: "Card / panel background" },
  { name: "darkAccentColor", label: "Dark Primary Button",  description: "Buttons and highlighted elements" },
  { name: "darkTextColor",   label: "Dark Text",            description: "Main text on dark background" },
  { name: "darkMutedColor",  label: "Dark Muted Text",      description: "Subtitles on dark background" },
  { name: "darkBorderColor", label: "Dark Borders",         description: "Dividers in dark theme" },
]


export default function SettingsForm({ config }: { config: TenantConfig }) {
  const [state, formAction] = useFormState(saveSettings, initialState)
  const [isDirty, setIsDirty] = useState(false)

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
    }
  }, [state.success])

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
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Upload failed")
      setPreview(json.url)
      setUrl(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      id="settings-form"
      action={formAction}
      className="flex flex-col gap-10"
      onChange={() => setIsDirty(true)}
    >

      <section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Brand</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Salon name and visual identity</p>
        </div>

        <div className="grid gap-1.5 max-w-sm">
          <Label htmlFor="brandName">Salon Name</Label>
          <Input
            id="brandName"
            name="brandName"
            defaultValue={config.brandName}
            required
          />
          <p className="text-xs text-muted-foreground">
            Shown in the browser tab title and meta tags.
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
          label="Favicon"
          hint="Small icon shown in the browser tab. Recommended: PNG 32×32 or SVG. Max 4 MB."
          preview={faviconPreview}
          fieldName="faviconUrl"
          fieldValue={faviconUrl}
          onUpload={(e) => { uploadFile(e, setFaviconPreview, setFaviconUrl, setFaviconUploading, setFaviconError); setIsDirty(true) }}
          onRemove={() => { setFaviconPreview(null); setFaviconUrl(""); setIsDirty(true) }}
          uploading={faviconUploading}
          uploadError={faviconError}
        />
      </section>

      {/* ── Salon Contact Info ────────────────────────────────────────── */}
      <section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Salon Contact Info</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Address, phone, email and legal details. Displayed on booking confirmation, support page, terms and privacy policy.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="salonCompanyName">Company Name</Label>
            <Input
              id="salonCompanyName"
              name="salonCompanyName"
              defaultValue={config.salonCompanyName ?? ""}
              placeholder="e.g. Beauty Studio LLC"
            />
            <p className="text-xs text-muted-foreground">Legal entity name shown in terms &amp; privacy</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salonNip">Tax ID (NIP)</Label>
            <Input
              id="salonNip"
              name="salonNip"
              defaultValue={config.salonNip ?? ""}
              placeholder="e.g. 9512580063"
            />
            <p className="text-xs text-muted-foreground">Tax identification number</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="salonAddress">Salon Address</Label>
            <Input
              id="salonAddress"
              name="salonAddress"
              defaultValue={config.salonAddress ?? ""}
              placeholder="e.g. Sarmacka 4B/ lokal 106"
            />
            <p className="text-xs text-muted-foreground">Street address shown to clients</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salonCity">City / Postal Code</Label>
            <Input
              id="salonCity"
              name="salonCity"
              defaultValue={config.salonCity ?? ""}
              placeholder="e.g. 02-972 Warszawa"
            />
            <p className="text-xs text-muted-foreground">City and postal code</p>
          </div>
        </div>

        <div className="grid gap-1.5 max-w-sm">
          <Label htmlFor="salonLegalAddress">Legal Address</Label>
          <Input
            id="salonLegalAddress"
            name="salonLegalAddress"
            defaultValue={config.salonLegalAddress ?? ""}
            placeholder="e.g. Herbu Janina 3a/40, 02-972 Warszawa"
          />
          <p className="text-xs text-muted-foreground">Registered address if different from salon address. Shown in terms &amp; privacy.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="salonPhone">Phone Number</Label>
            <Input
              id="salonPhone"
              name="salonPhone"
              type="tel"
              defaultValue={config.salonPhone ?? ""}
              placeholder="e.g. +48 789 894 948"
            />
            <p className="text-xs text-muted-foreground">Shown on booking confirmation &amp; support</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salonEmail">Contact Email</Label>
            <Input
              id="salonEmail"
              name="salonEmail"
              type="email"
              defaultValue={config.salonEmail ?? ""}
              placeholder="e.g. info@salon.pl"
            />
            <p className="text-xs text-muted-foreground">Public contact email</p>
          </div>
        </div>
      </section>

      {/* ── Calendar Settings ────────────────────────────────────────── */}
      <section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Calendar Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Colors used in the booking calendar
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorRow
            field={{ name: "availableSlotColor", label: "Available Slot", description: "Color for open working intervals" }}
            defaultValue={config.availableSlotColor}
          />
          <ColorRow
            field={{ name: "dayOffColor", label: "Day Off", description: "Color highlighting non-working days" }}
            defaultValue={config.dayOffColor}
          />
        </div>
      </section>

      {/* ── Business Hours ────────────────────────────────────────── */}
      <section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Business Hours</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Global salon opening and closing hours
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="workingHourStart">Open Hour (Start)</Label>
            <Input id="workingHourStart" name="workingHourStart" type="number" min="0" max="23" defaultValue={config.workingHourStart} />
            <p className="text-xs text-muted-foreground">Salon opens (e.g. 8 for 8:00 AM)</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="workingHourEnd">Close Hour (End)</Label>
            <Input id="workingHourEnd" name="workingHourEnd" type="number" min="1" max="24" defaultValue={config.workingHourEnd} />
            <p className="text-xs text-muted-foreground">Salon closes (e.g. 21 for 9:00 PM)</p>
          </div>
        </div>
      </section>

      {/* ── Light theme ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Light Theme</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Colors used when the light theme is active
          </p>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lightColorFields.map((field) => (
            <ColorRow key={field.name} field={field} defaultValue={config[field.name] as string} />
          ))}
        </div>
      </section>

      {/* ── Dark theme ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Dark Theme Colors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Colors used when the dark theme is active
          </p>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {darkColorFields.map((field) => (
            <ColorRow key={field.name} field={field} defaultValue={config[field.name] as string} />
          ))}
        </div>
      </section>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600 dark:text-green-400">Settings saved.</p>}
    </form>
  )
}
