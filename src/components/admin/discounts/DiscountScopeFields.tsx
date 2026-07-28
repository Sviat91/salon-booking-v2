"use client"
import { useTranslation } from 'react-i18next'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { resolveLocalized } from '@/lib/localized-content'

export interface ServiceOption {
  id: string
  name_pl: string
  name_en: string | null
  name_uk: string | null
}

/**
 * `scopeMode` radio + a scrollable checkbox list of `services` (`service_<id>`
 * names, submitted as FormData keys), disabled when `scopeMode === "all"`.
 */
export default function DiscountScopeFields({
  services,
  scopeMode,
  onScopeModeChange,
  selectedServiceIds,
  onToggleService,
  allHintKey,
}: {
  services: ServiceOption[]
  scopeMode: 'all' | 'selected'
  onScopeModeChange: (mode: 'all' | 'selected') => void
  selectedServiceIds: Set<string>
  onToggleService: (id: string) => void
  allHintKey: string
}) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{t('admin.discounts.scopeMode')}</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scopeMode"
            value="all"
            checked={scopeMode === 'all'}
            onChange={() => onScopeModeChange('all')}
            className="accent-primary"
          />
          {t('admin.discounts.scopeModeAll')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scopeMode"
            value="selected"
            checked={scopeMode === 'selected'}
            onChange={() => onScopeModeChange('selected')}
            className="accent-primary"
          />
          {t('admin.discounts.scopeModeSelected')}
        </label>
      </div>

      {scopeMode === 'all' ? (
        <p className="text-xs text-muted-foreground">{t(allHintKey)}</p>
      ) : (
        <div className="max-h-48 overflow-auto rounded-xl border border-border divide-y divide-border">
          {services.map((s) => {
            const checked = selectedServiceIds.has(s.id)
            const name = resolveLocalized({ pl: s.name_pl, en: s.name_en, uk: s.name_uk }, language)
            return (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name={`service_${s.id}`}
                  checked={checked}
                  onChange={() => onToggleService(s.id)}
                  className="h-4 w-4 accent-primary shrink-0"
                />
                {name}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
