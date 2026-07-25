"use client"

import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { hasAnyEnabledLocaleValue } from "@/lib/localized-content"
import { LANGUAGE_NAMES, type Language } from "@/lib/i18n-shared"
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
 * equivalent this conceptually mirrors). Per C-3, no locale is privileged —
 * the rule is "at least one enabled locale is non-empty", shown as one
 * generic hint rather than pinned to a specific tab/asterisk.
 */
export default function TextBlockConfigEditor({ config, onChange, enabledLocales }: TextBlockConfigEditorProps) {
  const { t } = useTranslation()
  const anyFilled = hasAnyEnabledLocaleValue(
    { pl: config.text_pl, en: config.text_en, uk: config.text_uk },
    enabledLocales
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4">
        {enabledLocales.map((lang) => {
          const field = FIELD_BY_LANG[lang]
          return (
            <div key={lang} className="grid gap-1.5">
              <Label>{LANGUAGE_NAMES[lang]}</Label>
              <Textarea
                value={config[field] ?? ""}
                onChange={(e) => onChange({ ...config, [field]: e.target.value })}
                rows={4}
                className="resize-none"
                placeholder={t('admin.pages.textBlockPlaceholder')}
              />
            </div>
          )
        })}
      </div>
      {!anyFilled && (
        <p className="text-xs text-destructive">{t('admin.pages.anyLocaleRequiredHint')}</p>
      )}
    </div>
  )
}
