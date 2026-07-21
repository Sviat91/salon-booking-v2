"use client"

import { useTranslation } from "react-i18next"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"
import { resolveLocalized } from "@/lib/localized-content"
import type { Language } from "@/lib/i18n-shared"

type Service = { id: string; name_pl: string; name_en?: string | null; name_uk?: string | null; duration: number }

interface AppointmentServiceSelectProps {
  services: Service[]
  language: Language
  value: string
  onChange: (serviceId: string) => void
  customServiceName: string
  onCustomServiceNameChange: (name: string) => void
}

/**
 * Service picker for the manual appointment form (shared by the edit-mode
 * shared block and each create-mode entry row). Presentational only — the
 * services list, current selection, and custom-name state are owned by the
 * parent (AppointmentModal).
 */
export default function AppointmentServiceSelect({
  services,
  language,
  value,
  onChange,
  customServiceName,
  onCustomServiceNameChange,
}: AppointmentServiceSelectProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{t('admin.calendar.selectServiceLabel')}</label>
      <Select value={value} onValueChange={(v) => onChange(v ?? "custom")}>
        <SelectTrigger className="h-10">
          <SelectValue>
            {(v: string) => {
              if (v === "custom") return t('admin.calendar.customServiceOption')
              const s = services.find(sv => sv.id === v)
              return s ? `${resolveLocalized({ pl: s.name_pl, en: s.name_en, uk: s.name_uk }, language)} (${s.duration}m)` : v
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom"><SelectItemText>{t('admin.calendar.customServiceOption')}</SelectItemText></SelectItem>
          {services.map(s => <SelectItem key={s.id} value={s.id}><SelectItemText>{resolveLocalized({ pl: s.name_pl, en: s.name_en, uk: s.name_uk }, language)} ({s.duration}m)</SelectItemText></SelectItem>)}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <div className="space-y-1.5 animate-in slide-in-from-top-2">
          <label className="text-sm font-medium">{t('admin.calendar.customServiceNameLabel')} <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={customServiceName}
            onChange={e => onCustomServiceNameChange(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder={t('admin.calendar.customServiceNamePlaceholder')}
          />
        </div>
      )}
    </div>
  )
}
