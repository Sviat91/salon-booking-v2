"use client"

import { useTranslation } from "react-i18next"
import SingleBlockSlotEditor from "@/components/admin/content/SingleBlockSlotEditor"
import { SettingsSection } from "./FormFields"
import type { Language } from "@/lib/i18n-shared"

export default function HomepageWidgetSection({
  value,
  enabledLocales,
  onChange,
}: {
  value: string | null
  enabledLocales: Language[]
  onChange: () => void
}) {
  const { t } = useTranslation()

  return (
    <SettingsSection
      title={t('admin.settings.general.homepageWidgetSectionTitle')}
      description={t('admin.settings.general.homepageWidgetSectionDesc')}
    >
      <SingleBlockSlotEditor
        name="homepageWidgetBlock"
        value={value}
        allowed={["photoWidget"]}
        enabledLocales={enabledLocales}
        onChange={onChange}
      />
    </SettingsSection>
  )
}
