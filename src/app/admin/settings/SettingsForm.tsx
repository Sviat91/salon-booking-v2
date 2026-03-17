"use client"

import { useFormState, useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveSettings, type SettingsFormState } from "./actions"

type TenantConfig = {
  brandName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  textColor: string
  mutedColor: string
}

const initialState: SettingsFormState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save Settings"}
    </Button>
  )
}

const colorFields: { name: keyof TenantConfig; label: string; description: string }[] = [
  { name: "primaryColor", label: "Primary Color", description: "Main brand color, buttons" },
  { name: "secondaryColor", label: "Secondary Color", description: "Backgrounds, cards" },
  { name: "accentColor", label: "Accent Color", description: "Highlights, badges" },
  { name: "textColor", label: "Text Color", description: "Main body text" },
  { name: "mutedColor", label: "Muted Color", description: "Subtitles, placeholders" },
]

export default function SettingsForm({ config }: { config: TenantConfig }) {
  const [state, formAction] = useFormState(saveSettings, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* Brand */}
      <section>
        <h2 className="text-base font-semibold mb-4">Brand</h2>
        <div className="grid gap-1.5 max-w-sm">
          <Label htmlFor="brandName">Salon Name</Label>
          <Input
            id="brandName"
            name="brandName"
            defaultValue={config.brandName}
            placeholder="My Salon"
            required
          />
        </div>
      </section>

      {/* Colors */}
      <section>
        <h2 className="text-base font-semibold mb-1">Colors</h2>
        <p className="text-xs text-muted-foreground mb-4">
          These values map to CSS variables across the entire UI.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colorFields.map((field) => (
            <div key={field.name} className="grid gap-1.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              <div className="flex gap-2 items-center">
                {/* Native color picker */}
                <input
                  type="color"
                  id={`color-picker-${field.name}`}
                  defaultValue={config[field.name]}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5"
                  onChange={(e) => {
                    const input = document.getElementById(field.name) as HTMLInputElement
                    if (input) input.value = e.target.value
                  }}
                />
                <Input
                  id={field.name}
                  name={field.name}
                  defaultValue={config[field.name]}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#000000"
                  className="font-mono text-sm"
                  onChange={(e) => {
                    const picker = document.getElementById(
                      `color-picker-${field.name}`
                    ) as HTMLInputElement
                    if (picker && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                      picker.value = e.target.value
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{field.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback */}
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Settings saved successfully.
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  )
}
