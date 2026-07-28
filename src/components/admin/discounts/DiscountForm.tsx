"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { useFormState, useFormStatus } from "react-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerDropdown } from "@/components/DatePickerDropdown"
import { createDiscount, updateDiscount, type DiscountFormState } from "@/app/admin/discounts/actions"
import DiscountScopeFields, { type ServiceOption } from "./DiscountScopeFields"
import DiscountWindowFields from "./DiscountWindowFields"
import type { DiscountRow } from "./DiscountListClient"
import { parseWindowDays, parseWindowIntervals, type DiscountOwner } from "@/lib/discounts/shared"

interface DiscountFormProps {
  discount?: DiscountRow
  owner: DiscountOwner
  scope: "global" | "master"
  services: ServiceOption[]
  onSuccess: () => void
}

const initialState: DiscountFormState = {}

function SubmitButton({ label }: { label: string }) {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? t('common.saving') : label}
    </Button>
  )
}

/**
 * "YYYY-MM-DD" using the browser's local calendar day, or "" when null.
 * Must NOT use `toISOString()` — that reads the UTC day, which silently
 * shifts by one whenever the local offset crosses midnight (this is exactly
 * how a date persisted as local-midnight-in-Warsaw ended up displaying as
 * the previous day here).
 */
function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  return format(new Date(date), "yyyy-MM-dd")
}

export default function DiscountForm({ discount, owner, scope, services, onSuccess }: DiscountFormProps) {
  const { t } = useTranslation()
  const action = discount ? updateDiscount.bind(null, discount.id) : createDiscount.bind(null, owner)
  const [state, formAction] = useFormState(action, initialState)

  const [requiresCode, setRequiresCode] = useState(discount?.requiresCode ?? false)

  const existingServiceIds = new Set(discount?.services.map((s) => s.serviceId) ?? [])
  const [scopeMode, setScopeMode] = useState<'all' | 'selected'>(existingServiceIds.size > 0 ? 'selected' : 'all')
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(existingServiceIds)

  const existingWindowDays = parseWindowDays(discount?.windowDays ?? null)
  const existingWindowIntervals = parseWindowIntervals(discount?.windowIntervals ?? null)
  const [windowEnabled, setWindowEnabled] = useState(existingWindowDays.length > 0 && existingWindowIntervals.length > 0)
  const [windowDaysSet, setWindowDaysSet] = useState<Set<number>>(new Set(existingWindowDays))
  const [windowStart, setWindowStart] = useState(existingWindowIntervals[0]?.start ?? "")
  const [windowEnd, setWindowEnd] = useState(existingWindowIntervals[0]?.end ?? "")

  const [startDate, setStartDate] = useState(toDateInputValue(discount?.startDate ?? null))
  const [endDate, setEndDate] = useState(toDateInputValue(discount?.endDate ?? null))

  useEffect(() => {
    if (state.success) onSuccess()
  }, [state.success, onSuccess])

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleWindowDay(d: number) {
    setWindowDaysSet((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="label">{t('admin.discounts.labelField')}</Label>
        <Input id="label" name="label" defaultValue={discount?.label ?? ""} placeholder={t('admin.discounts.labelPlaceholder')} required />
        <p className="text-xs text-muted-foreground">{t('admin.discounts.labelHint')}</p>
        {state.fieldErrors?.label && <p className="text-xs text-destructive">{state.fieldErrors.label[0]}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="percent">{t('admin.discounts.percentField')}</Label>
        <Input id="percent" name="percent" type="number" min={1} max={100} defaultValue={discount?.percent ?? ""} required />
        {state.fieldErrors?.percent && <p className="text-xs text-destructive">{state.fieldErrors.percent[0]}</p>}
      </div>

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="requiresCode"
            checked={requiresCode}
            onChange={(e) => setRequiresCode(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {t('admin.discounts.requiresCode')}
        </label>
        {requiresCode && (
          <div className="grid gap-1.5">
            <Label htmlFor="code">{t('admin.discounts.codeField')}</Label>
            <Input id="code" name="code" defaultValue={discount?.code ?? ""} placeholder={t('admin.discounts.codePlaceholder')} />
            <p className="text-xs text-muted-foreground">{t('admin.discounts.codeHint')}</p>
            {state.fieldErrors?.code && <p className="text-xs text-destructive">{state.fieldErrors.code[0]}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="oncePerClient" defaultChecked={discount?.oncePerClient ?? false} className="h-4 w-4 accent-primary" />
          {t('admin.discounts.oncePerClient')}
        </label>
        <p className="text-xs text-muted-foreground">{t('admin.discounts.oncePerClientHint')}</p>
      </div>

      <DiscountScopeFields
        services={services}
        scopeMode={scopeMode}
        onScopeModeChange={setScopeMode}
        selectedServiceIds={selectedServiceIds}
        onToggleService={toggleService}
        allHintKey={scope === "master" ? 'admin.discounts.scopeAllMasterHint' : 'admin.discounts.scopeAllGlobalHint'}
      />

      <DiscountWindowFields
        enabled={windowEnabled}
        onEnabledChange={setWindowEnabled}
        days={windowDaysSet}
        onToggleDay={toggleWindowDay}
        start={windowStart}
        end={windowEnd}
        onStartChange={setWindowStart}
        onEndChange={setWindowEnd}
      />
      {state.fieldErrors?.windowEnabled && <p className="text-xs text-destructive">{state.fieldErrors.windowEnabled[0]}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="startDate">{t('admin.discounts.periodFrom')}</Label>
            {startDate && (
              <button type="button" onClick={() => setStartDate("")} className="text-xs text-muted-foreground underline hover:text-foreground">
                {t('common.clear')}
              </button>
            )}
          </div>
          <DatePickerDropdown date={startDate} onChange={setStartDate} />
          <input type="hidden" id="startDate" name="startDate" value={startDate} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="endDate">{t('admin.discounts.periodTo')}</Label>
            {endDate && (
              <button type="button" onClick={() => setEndDate("")} className="text-xs text-muted-foreground underline hover:text-foreground">
                {t('common.clear')}
              </button>
            )}
          </div>
          <DatePickerDropdown date={endDate} onChange={setEndDate} />
          <input type="hidden" id="endDate" name="endDate" value={endDate} />
          {state.fieldErrors?.endDateRaw && <p className="text-xs text-destructive">{state.fieldErrors.endDateRaw[0]}</p>}
        </div>
      </div>

      <div className="grid gap-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="active" defaultChecked={discount?.active ?? true} className="h-4 w-4 accent-primary" />
          {t('admin.discounts.activeField')}
        </label>
        <p className="text-xs text-muted-foreground">{t('admin.discounts.activeHint')}</p>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton label={discount ? t('admin.discounts.updateBtn') : t('admin.discounts.saveBtn')} />
    </form>
  )
}
