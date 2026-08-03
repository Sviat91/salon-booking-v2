"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { LANGUAGE_NAMES, DEFAULT_LANGUAGE, type Language } from "@/lib/i18n-shared"

type LocalizedValues = Partial<Record<Language, string | null | undefined>>

interface LocaleFieldControlProps {
  fieldId: string
  variant: "input" | "textarea"
  defaultValue: string
  placeholder?: string
  required: boolean
  rows: number
  resizable: boolean
}

function LocaleFieldControl({ fieldId, variant, defaultValue, placeholder, required, rows, resizable }: LocaleFieldControlProps) {
  if (variant === "textarea") {
    return (
      <Textarea
        id={fieldId}
        name={fieldId}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={resizable ? "resize-y" : "resize-none"}
      />
    )
  }
  return (
    <Input
      id={fieldId}
      name={fieldId}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
    />
  )
}

interface LocalizedFieldInputProps {
  /** Base field name — `name` or `bio` — combined with the locale suffix, e.g. `name_pl`. */
  baseName: string
  label: string
  values?: LocalizedValues
  enabledLocales: Language[]
  variant?: "input" | "textarea"
  /** Whether the default-locale (`pl`) variant is required. Other locales stay optional. */
  required?: boolean
  placeholder?: string
  rows?: number
  errors?: Partial<Record<Language, string>>
  /** Allows vertical resizing of the textarea variant. Defaults to `false` (non-resizable, today's behaviour). */
  resizable?: boolean
}

/**
 * Reusable per-locale form field. Renders a single plain input/textarea when only
 * one locale is enabled for the tenant; otherwise renders a compact tab set (one
 * tab per enabled locale), emitting `${baseName}_${locale}` form fields for all
 * enabled locales.
 */
export default function LocalizedFieldInput({
  baseName,
  label,
  values = {},
  enabledLocales,
  variant = "input",
  required = false,
  placeholder,
  rows = 3,
  errors,
  resizable = false,
}: LocalizedFieldInputProps) {
  const locales = enabledLocales.includes(DEFAULT_LANGUAGE)
    ? enabledLocales
    : [DEFAULT_LANGUAGE, ...enabledLocales]

  const [activeLang, setActiveLang] = useState<Language>(
    locales.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : locales[0]
  )

  if (locales.length <= 1) {
    const lang = locales[0] ?? DEFAULT_LANGUAGE
    const fieldId = `${baseName}_${lang}`
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        <LocaleFieldControl
          fieldId={fieldId}
          variant={variant}
          defaultValue={values[lang] ?? ""}
          placeholder={placeholder}
          required={required && lang === DEFAULT_LANGUAGE}
          rows={rows}
          resizable={resizable}
        />
        {errors?.[lang] && <p className="text-xs text-destructive">{errors[lang]}</p>}
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1 border-b border-border">
        {locales.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActiveLang(lang)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors",
              activeLang === lang
                ? "bg-muted text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LANGUAGE_NAMES[lang]}
          </button>
        ))}
      </div>
      {locales.map((lang) => {
        const fieldId = `${baseName}_${lang}`
        return (
          <div key={lang} className={activeLang === lang ? "block" : "hidden"}>
            <LocaleFieldControl
              fieldId={fieldId}
              variant={variant}
              defaultValue={values[lang] ?? ""}
              placeholder={placeholder}
              required={required && lang === DEFAULT_LANGUAGE}
              rows={rows}
              resizable={resizable}
            />
            {errors?.[lang] && <p className="text-xs text-destructive mt-1">{errors[lang]}</p>}
          </div>
        )
      })}
    </div>
  )
}
