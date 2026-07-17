"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/ui/checkbox"
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type Language } from "@/lib/i18n-shared"
import { SettingsSection } from "./FormFields"

export default function LanguagesSection({
  enabledLocales,
  onChange,
}: {
  enabledLocales: Language[]
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Language[]>(enabledLocales)

  function toggle(lang: Language) {
    const isLastEnabled = selected.length === 1 && selected.includes(lang)
    if (isLastEnabled) return
    setSelected((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
    onChange()
  }

  return (
    <SettingsSection
      title={t('admin.settings.general.languagesSectionTitle')}
      description={t('admin.settings.general.languagesSectionDesc')}
    >
      <input type="hidden" name="enabledLocales" value={JSON.stringify(selected)} />
      <div className="flex flex-wrap gap-6">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isLastEnabled = selected.length === 1 && selected.includes(lang)
          return (
            <label key={lang} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selected.includes(lang)} onCheckedChange={() => toggle(lang)} />
              <span className={isLastEnabled ? "text-muted-foreground" : ""}>
                {LANGUAGE_NAMES[lang]}
              </span>
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.settings.general.languagesSectionHint')}</p>
    </SettingsSection>
  )
}
