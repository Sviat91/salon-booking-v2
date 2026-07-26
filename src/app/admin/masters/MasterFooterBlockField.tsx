"use client"

import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import SingleBlockSlotEditor from "@/components/admin/content/SingleBlockSlotEditor"
import type { BlockType } from "@/lib/content/blocks"
import type { Language } from "@/lib/i18n-shared"

const ALLOWED: BlockType[] = ["photoWidget", "text"]

interface MasterFooterBlockFieldProps {
  value: string | null
  enabledLocales: Language[]
}

/** Admin-side editor for a master's `MasterProfile.footerBlock`, sized for the Masters Sheet form. */
export default function MasterFooterBlockField({ value, enabledLocales }: MasterFooterBlockFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-1.5">
      <Label>{t('admin.masters.footerBlockLabel')}</Label>
      <p className="text-xs text-muted-foreground -mt-1">{t('admin.masters.footerBlockHint')}</p>
      <SingleBlockSlotEditor
        name="footerBlock"
        value={value}
        allowed={ALLOWED}
        enabledLocales={enabledLocales}
      />
    </div>
  )
}
