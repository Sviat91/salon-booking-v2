"use client"

import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LANGUAGE_NAMES, DEFAULT_LANGUAGE, type Language } from "@/lib/i18n-shared"
import type { TextBlockConfig } from "@/lib/content/blocks"

interface TextBlockConfigEditorProps {
  config: TextBlockConfig
  onChange: (config: TextBlockConfig) => void
  enabledLocales: Language[]
}

const FIELD_BY_LANG: Record<Language, keyof TextBlockConfig> = {
  pl: "text_pl",
  en: "text_en",
  uk: "text_uk",
}

/**
 * One textarea per enabled locale, controlled against a `TextBlockConfig`
 * (not form fields — see `LocalizedFieldInput.tsx` for the form-field
 * equivalent this conceptually mirrors). `text_pl` is required.
 */
export default function TextBlockConfigEditor({ config, onChange, enabledLocales }: TextBlockConfigEditorProps) {
  const { t } = useTranslation()
  const locales = enabledLocales.includes(DEFAULT_LANGUAGE)
    ? enabledLocales
    : [DEFAULT_LANGUAGE, ...enabledLocales]

  return (
    <div className="flex flex-col gap-4">
      {locales.map((lang) => {
        const field = FIELD_BY_LANG[lang]
        const required = lang === DEFAULT_LANGUAGE
        return (
          <div key={lang} className="grid gap-1.5">
            <Label>
              {LANGUAGE_NAMES[lang]}
              {required && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              value={config[field] ?? ""}
              onChange={(e) => onChange({ ...config, [field]: e.target.value })}
              rows={4}
              className="resize-none"
              placeholder={t('admin.pages.textBlockPlaceholder')}
            />
            {required && !config.text_pl.trim() && (
              <p className="text-xs text-destructive">{t('admin.pages.textRequired')}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
