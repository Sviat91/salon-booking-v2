"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import Image from "next/image"
import { Upload, X, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveSettings, type SettingsFormState } from "./actions"
import LogoEditor from "./LogoEditor"

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
  availableSlotColor: string
}

const initialState: SettingsFormState = {}

// Light theme color fields — plain English labels
const lightColorFields: { name: keyof TenantConfig; label: string; description: string }[] = [
  { name: "secondaryColor", label: "Page Background",  description: "Main background color of pages" },
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

// ── Shared sub-components ─────────────────────────────────────────────────────

function ColorRow({
  field,
  defaultValue,
}: {
  field: { name: string; label: string; description: string }
  defaultValue: string
}) {
  const [color, setColor] = useState(defaultValue)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={field.name}>{field.label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={color}
          className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5 shrink-0"
          onChange={(e) => setColor(e.target.value)}
        />
        <Input
          id={field.name}
          name={field.name}
          value={color}
          pattern="^#[0-9A-Fa-f]{6}$"
          placeholder="#000000"
          className="font-mono text-sm"
          onChange={(e) => {
            const val = e.target.value
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
              setColor(val)
            }
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{field.description}</p>
    </div>
  )
}

function ImageUploadField({
  label,
  hint,
  preview,
  fieldName,
  fieldValue,
  onUpload,
  onRemove,
  uploading,
  uploadError,
}: {
  label: string
  hint: string
  preview: string | null
  fieldName: string
  fieldValue: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  uploading: boolean
  uploadError: string | null
}) {
  return (
    <div className="grid gap-2 max-w-sm">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
      <input type="hidden" name={fieldName} value={fieldValue} />
      <div className="flex items-start gap-4">
        {preview ? (
          <div className="relative flex h-16 w-32 items-center justify-center rounded-lg border border-border bg-muted/30 p-2">
            <Image src={preview} alt={label} fill className="object-contain p-1" />
            <button
              type="button"
              onClick={onRemove}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 gap-1.5 text-xs text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            None
          </div>
        )}
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </div>
        </label>
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save Settings"}
    </Button>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function SettingsForm({ config }: { config: TenantConfig }) {
  const [state, formAction] = useFormState(saveSettings, initialState)

  const [logoUrl, setLogoUrl] = useState<string>(config.logoUrl ?? "")
  const [darkLogoUrl, setDarkLogoUrl] = useState<string>(config.darkLogoUrl ?? "")
  const [logoPositionX, setLogoPositionX] = useState(config.logoPositionX)
  const [logoPositionY, setLogoPositionY] = useState(config.logoPositionY)
  const [logoWidth, setLogoWidth] = useState(config.logoWidth)
  const [logoHeight, setLogoHeight] = useState(config.logoHeight)
  const [logoPages, setLogoPages] = useState(config.logoPages)
  const [logoLayer, setLogoLayer] = useState(config.logoLayer ?? "above")
  const [logoUploading, setLogoUploading] = useState(false)
  const [darkLogoUploading, setDarkLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [darkLogoError, setDarkLogoError] = useState<string | null>(null)

  const [faviconPreview, setFaviconPreview] = useState<string | null>(config.faviconUrl)
  const [faviconUrl, setFaviconUrl] = useState<string>(config.faviconUrl ?? "")
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconError, setFaviconError] = useState<string | null>(null)

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
    <form action={formAction} className="flex flex-col gap-10">

      <section className="flex flex-col gap-4">
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
          }}
          onLogoUpload={(url) => setLogoUrl(url)}
          onDarkLogoUpload={(url) => setDarkLogoUrl(url)}
          onPositionChange={(x, y) => { setLogoPositionX(x); setLogoPositionY(y) }}
          onSizeChange={(w, h) => { setLogoWidth(w); setLogoHeight(h) }}
          onPagesChange={(pages) => setLogoPages(pages)}
          onLayerChange={(layer) => setLogoLayer(layer)}
          onRemoveLogo={() => setLogoUrl("")}
          onRemoveDarkLogo={() => setDarkLogoUrl("")}
          logoUploading={logoUploading}
          darkLogoUploading={darkLogoUploading}
          logoError={logoError}
          darkLogoError={darkLogoError}
          onLogoUploadStart={() => { setLogoUploading(true); setLogoError(null) }}
          onDarkLogoUploadStart={() => { setDarkLogoUploading(true); setDarkLogoError(null) }}
        />

        <ImageUploadField
          label="Favicon"
          hint="Small icon shown in the browser tab. Recommended: PNG 32×32 or SVG. Max 4 MB."
          preview={faviconPreview}
          fieldName="faviconUrl"
          fieldValue={faviconUrl}
          onUpload={(e) => uploadFile(e, setFaviconPreview, setFaviconUrl, setFaviconUploading, setFaviconError)}
          onRemove={() => { setFaviconPreview(null); setFaviconUrl("") }}
          uploading={faviconUploading}
          uploadError={faviconError}
        />
      </section>

      {/* ── Calendar Settings ────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
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
        </div>
      </section>

      {/* ── Light theme ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Light Theme Colors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Colors used when the light theme is active
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lightColorFields.map((field) => (
            <ColorRow key={field.name} field={field} defaultValue={config[field.name] as string} />
          ))}
        </div>
      </section>

      {/* ── Dark theme ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Dark Theme Colors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Colors used when the dark theme is active
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {darkColorFields.map((field) => (
            <ColorRow key={field.name} field={field} defaultValue={config[field.name] as string} />
          ))}
        </div>
      </section>

      {/* ── Feedback ─────────────────────────────────────────────── */}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Settings saved. Reload the page to see color changes applied across the admin panel.
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  )
}
