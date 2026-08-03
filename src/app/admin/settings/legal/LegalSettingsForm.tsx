"use client"

import { useFormState } from "react-dom"
import { useTranslation } from "react-i18next"
import { SettingsSection, SubmitButton } from "../FormFields"
import LocalizedFieldInput from "@/components/admin/LocalizedFieldInput"
import { saveLegalContent, type LegalFormState } from "./actions"
import type { Language } from "@/lib/i18n-shared"

const initialState: LegalFormState = {}

interface LegalSettingsFormProps {
  config: {
    termsContent_pl: string | null
    termsContent_en: string | null
    termsContent_uk: string | null
    privacyContent_pl: string | null
    privacyContent_en: string | null
    privacyContent_uk: string | null
  }
  enabledLocales: Language[]
}

export default function LegalSettingsForm({ config, enabledLocales }: LegalSettingsFormProps) {
  const { t } = useTranslation()
  const [state, formAction] = useFormState(saveLegalContent, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <SettingsSection
        title={t('admin.settings.legal.termsSectionTitle')}
        description={t('admin.settings.legal.termsSectionDesc')}
      >
        <LocalizedFieldInput
          baseName="termsContent"
          variant="textarea"
          rows={20}
          resizable
          enabledLocales={enabledLocales}
          values={{ pl: config.termsContent_pl, en: config.termsContent_en, uk: config.termsContent_uk }}
          label={t('admin.settings.legal.contentLabel')}
          placeholder={t('admin.settings.legal.placeholder')}
        />
        <p className="text-xs text-muted-foreground">{t('admin.settings.legal.formattingHint')}</p>
      </SettingsSection>

      <SettingsSection
        title={t('admin.settings.legal.privacySectionTitle')}
        description={t('admin.settings.legal.privacySectionDesc')}
      >
        <LocalizedFieldInput
          baseName="privacyContent"
          variant="textarea"
          rows={20}
          resizable
          enabledLocales={enabledLocales}
          values={{ pl: config.privacyContent_pl, en: config.privacyContent_en, uk: config.privacyContent_uk }}
          label={t('admin.settings.legal.contentLabel')}
          placeholder={t('admin.settings.legal.placeholder')}
        />
        <p className="text-xs text-muted-foreground">{t('admin.settings.legal.formattingHint')}</p>
      </SettingsSection>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-[var(--md-success)]">{t('admin.settings.general.settingsSavedMsg')}</p>}

      <div className="flex border-t pt-4">
        <SubmitButton />
      </div>
    </form>
  )
}
