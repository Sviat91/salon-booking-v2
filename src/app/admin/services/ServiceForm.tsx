"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { useTranslation } from "react-i18next"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createService, updateService, type ServiceFormState } from "./actions"
import LocalizedFieldInput from "@/components/admin/LocalizedFieldInput"
import type { Language } from "@/lib/i18n-shared"

type Service = {
  id: string
  name_pl: string
  name_en: string | null
  name_uk: string | null
  duration: number
  price: number
  masterServices?: { masterProfileId: string; priceOverride: number | null }[]
}

type MasterOption = {
  masterProfileId: string
  name: string
}

interface ServiceFormProps {
  service?: Service
  masters: MasterOption[]
  enabledLocales: Language[]
  onSuccess: () => void
}

const initialState: ServiceFormState = {}

function SubmitButton({ label }: { label: string }) {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? t('common.saving') : label}
    </Button>
  )
}

export default function ServiceForm({ service, masters, enabledLocales, onSuccess }: ServiceFormProps) {
  const { t } = useTranslation()
  const action = service
    ? updateService.bind(null, service.id)
    : createService

  const [state, formAction] = useFormState(action, initialState)

  // Existing assignment map: profileId → priceOverride
  const existingAssignments = new Map(
    service?.masterServices?.map((ms) => [ms.masterProfileId, ms.priceOverride]) ?? []
  )

  // Track which masters are checked
  const [checkedMasters, setCheckedMasters] = useState<Set<string>>(
    new Set(existingAssignments.keys())
  )

  useEffect(() => {
    if (state.success) onSuccess()
  }, [state.success, onSuccess])

  function toggleMaster(id: string) {
    setCheckedMasters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Name */}
      <LocalizedFieldInput
        baseName="name"
        label={t('admin.services.serviceName')}
        values={{ pl: service?.name_pl, en: service?.name_en, uk: service?.name_uk }}
        enabledLocales={enabledLocales}
        placeholder={t('admin.services.serviceNamePlaceholder')}
        required
        errors={{
          pl: state.fieldErrors?.name_pl?.[0],
          en: state.fieldErrors?.name_en?.[0],
          uk: state.fieldErrors?.name_uk?.[0],
        }}
      />

      {/* Duration */}
      <div className="grid gap-1.5">
        <Label htmlFor="duration">{t('admin.services.durationLabel')}</Label>
        <Input
          id="duration"
          name="duration"
          type="number"
          min={5}
          max={480}
          defaultValue={service?.duration ?? 60}
          required
        />
        {state.fieldErrors?.duration && (
          <p className="text-xs text-destructive">{state.fieldErrors.duration[0]}</p>
        )}
      </div>

      {/* Default price */}
      <div className="grid gap-1.5">
        <Label htmlFor="price">{t('admin.services.defaultPrice')}</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step={0.01}
          defaultValue={service?.price ?? ""}
          placeholder="0.00"
          required
        />
        <p className="text-xs text-muted-foreground">
          {t('admin.services.defaultPriceHint')}
        </p>
        {state.fieldErrors?.price && (
          <p className="text-xs text-destructive">{state.fieldErrors.price[0]}</p>
        )}
      </div>

      {/* Master assignment */}
      {masters.length > 0 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">{t('admin.services.assignToMasters')}</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            {t('admin.services.assignHint')}
          </p>
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {masters.map((m) => {
              const checked = checkedMasters.has(m.masterProfileId)
              return (
                <div key={m.masterProfileId} className="flex items-center gap-3 px-3 py-2.5 bg-background">
                  <input
                    type="checkbox"
                    id={`master_${m.masterProfileId}`}
                    name={`master_${m.masterProfileId}`}
                    checked={checked}
                    onChange={() => toggleMaster(m.masterProfileId)}
                    className="h-4 w-4 accent-primary shrink-0"
                  />
                  <label
                    htmlFor={`master_${m.masterProfileId}`}
                    className="flex-1 cursor-pointer text-sm font-medium"
                  >
                    {m.name}
                  </label>
                  {checked && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{t('management.priceLabel')}</span>
                      <Input
                        name={`price_${m.masterProfileId}`}
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={existingAssignments.get(m.masterProfileId) ?? ""}
                        placeholder={t('admin.services.defaultPricePlaceholder')}
                        className="h-7 w-24 text-xs px-2"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton label={service ? t('admin.services.updateServiceBtn') : t('admin.services.addServiceTitle')} />
    </form>
  )
}
