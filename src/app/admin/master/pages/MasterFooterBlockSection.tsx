"use client"

import { useFormState, useFormStatus } from "react-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import SingleBlockSlotEditor from "@/components/admin/content/SingleBlockSlotEditor"
import { SettingsSection } from "@/app/admin/settings/FormFields"
import { saveMasterFooterBlock, type MasterFooterBlockFormState } from "./actions"
import type { Language } from "@/lib/i18n-shared"

const initialState: MasterFooterBlockFormState = {}

function SubmitButton() {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? t('common.saving') : t('admin.pages.saveChangesBtn')}
    </Button>
  )
}

interface MasterFooterBlockSectionProps {
  value: string | null
  enabledLocales: Language[]
}

/** Master's own editor for `MasterProfile.footerBlock` — the singleton slot shown at the bottom of their booking page (AD-9). */
export default function MasterFooterBlockSection({ value, enabledLocales }: MasterFooterBlockSectionProps) {
  const { t } = useTranslation()
  const [state, formAction] = useFormState(saveMasterFooterBlock, initialState)

  return (
    <SettingsSection
      title={t('admin.pages.footerBlockSectionTitle')}
      description={t('admin.pages.footerBlockSectionDesc')}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <SingleBlockSlotEditor
          name="footerBlock"
          value={value}
          allowed={["photoWidget", "text"]}
          enabledLocales={enabledLocales}
        />
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && (
          <p className="text-xs font-medium text-[var(--md-on-success-container)]">{t('admin.pages.footerBlockSaved')}</p>
        )}
        <SubmitButton />
      </form>
    </SettingsSection>
  )
}
