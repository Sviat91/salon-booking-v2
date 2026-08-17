import { useState } from 'react'
import SettingsSection from '../../shared/SettingsSection'

const LANGUAGES = [
  { code: 'pl', name: 'Polski' },
  { code: 'uk', name: 'Українська' },
  { code: 'en', name: 'English' },
] as const

type LangCode = (typeof LANGUAGES)[number]['code']

// Structural, inert port of the real LanguagesSection.tsx — same checkbox
// list and "the last enabled language can't be unchecked" rule as the real
// component, but selection state is local-only and nothing persists on reload.
export default function LanguagesSection() {
  const [selected, setSelected] = useState<LangCode[]>(['pl', 'uk', 'en'])

  function toggle(code: LangCode) {
    const isLastEnabled = selected.length === 1 && selected.includes(code)
    if (isLastEnabled) return
    setSelected((prev) => (prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]))
  }

  return (
    <SettingsSection
      title="Content Languages"
      description="Languages available for service names and master bios"
    >
      <div className="flex flex-wrap gap-6">
        {LANGUAGES.map(({ code, name }) => {
          const isLastEnabled = selected.length === 1 && selected.includes(code)
          return (
            <label key={code} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(code)}
                onChange={() => toggle(code)}
                className="h-4 w-4 accent-primary"
              />
              <span className={isLastEnabled ? 'text-muted-foreground' : 'text-foreground'}>{name}</span>
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Polish is always enabled as the default language. Disabling a language hides its input in authoring forms but does not delete saved translations.
      </p>
    </SettingsSection>
  )
}
