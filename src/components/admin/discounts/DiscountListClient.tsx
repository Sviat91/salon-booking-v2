"use client"

import { useCallback, useState, useTransition } from "react"
import { format } from "date-fns"
import { useTranslation } from "react-i18next"
import { Plus, Pencil, Trash2, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import DataCard from "@/components/admin/DataCard"
import DiscountForm from "./DiscountForm"
import type { ServiceOption } from "./DiscountScopeFields"
import { deleteDiscount, toggleDiscountActive } from "@/app/admin/discounts/actions"
import { parseWindowDays, parseWindowIntervals, type DiscountOwner } from "@/lib/discounts/shared"
import type { Language } from "@/lib/i18n-shared"
import { useConfirm } from "@/components/ConfirmDialogProvider"

export type DiscountRow = {
  id: string
  label: string
  percent: number
  masterId: string | null
  requiresCode: boolean
  code: string | null
  oncePerClient: boolean
  windowDays: string | null
  windowIntervals: string | null
  startDate: Date | null
  endDate: Date | null
  active: boolean
  createdAt: Date
  services: { serviceId: string }[]
}

const DATES_SHORT_KEYS = [
  'dates.sundayShort',
  'dates.mondayShort',
  'dates.tuesdayShort',
  'dates.wednesdayShort',
  'dates.thursdayShort',
  'dates.fridayShort',
  'dates.saturdayShort',
] as const

interface DiscountListClientProps {
  discounts: DiscountRow[]
  /** Authorization payload forwarded verbatim to createDiscount. */
  owner: DiscountOwner
  /** UI copy variant only — never used for authorization. */
  scope: "global" | "master"
  services: ServiceOption[]
  /** Accepted for signature parity with the content-pages precedent; `label`
   * is plain text (not per-locale), so the form never needs this. */
  enabledLocales: Language[]
}

export default function DiscountListClient({ discounts, owner, scope, services }: DiscountListClientProps) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [editTarget, setEditTarget] = useState<DiscountRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirm(t('admin.discounts.deleteConfirm')))) return
    startTransition(() => { deleteDiscount(id) })
  }, [t, confirm])

  const handleToggle = useCallback((id: string, active: boolean) => {
    startTransition(() => { toggleDiscountActive(id, !active) })
  }, [])

  const renderActions = (d: DiscountRow) => (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(d); setEditOpen(true) }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="hover:text-destructive"
        onClick={() => handleDelete(d.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  const typeCell = (d: DiscountRow) =>
    d.requiresCode ? (
      <Badge variant="warning">{t('admin.discounts.typeCode')}: {d.code}</Badge>
    ) : (
      <Badge variant="muted">{t('admin.discounts.typeAutomatic')}</Badge>
    )

  const scopeCell = (d: DiscountRow) =>
    d.services.length === 0 ? t('admin.discounts.scopeAll') : t('admin.discounts.scopeCount', { count: d.services.length })

  const windowCell = (d: DiscountRow) => {
    const days = parseWindowDays(d.windowDays)
    const intervals = parseWindowIntervals(d.windowIntervals)
    if (days.length === 0 || intervals.length === 0) return t('admin.discounts.none')
    const dayLabels = days.map((day) => t(DATES_SHORT_KEYS[day])).join(', ')
    return `${dayLabels} · ${intervals[0].start}–${intervals[0].end}`
  }

  const periodCell = (d: DiscountRow) => {
    if (!d.startDate && !d.endDate) return t('admin.discounts.none')
    // date-fns `format()` reads the local calendar day, matching DiscountForm's
    // toDateInputValue() — toLocaleDateString()/toISOString() disagree with it
    // near midnight and made the list and the edit form show different dates.
    const fmt = (date: Date | null) => (date ? format(new Date(date), 'MMM d, yyyy') : '…')
    return `${fmt(d.startDate)} – ${fmt(d.endDate)}`
  }

  const statusCell = (d: DiscountRow) => (
    <button type="button" onClick={() => handleToggle(d.id, d.active)}>
      {d.active ? (
        <Badge variant="success">{t('admin.discounts.statusActive')}</Badge>
      ) : (
        <Badge variant="muted">{t('admin.discounts.statusInactive')}</Badge>
      )}
    </button>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.discounts.manageEyebrow')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "master" ? t('admin.discounts.masterDesc') : t('admin.discounts.manageDesc')}
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button className="h-10 gap-2 px-5">
                <Plus className="h-4 w-4" />
                {t('admin.discounts.addTrigger')}
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('admin.discounts.addTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <DiscountForm
                owner={owner}
                scope={scope}
                services={services}
                onSuccess={() => setAddOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {discounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <Percent className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t('admin.discounts.noneTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('admin.discounts.noneHint', { title: t('admin.discounts.addTitle') })}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {['colLabel', 'colPercent', 'colType', 'colScope', 'colWindow', 'colPeriod', 'colStatus'].map((key) => (
                    <th key={key} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {t(`admin.discounts.${key}`)}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.discounts.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{d.label}</td>
                    <td className="px-4 py-3 text-muted-foreground">-{d.percent}%</td>
                    <td className="px-4 py-3">{typeCell(d)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{scopeCell(d)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{windowCell(d)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{periodCell(d)}</td>
                    <td className="px-4 py-3">{statusCell(d)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">{renderActions(d)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {discounts.map((d) => (
              <DataCard
                key={d.id}
                title={`${d.label} · -${d.percent}%`}
                fields={[
                  { label: t('admin.discounts.colType'), value: typeCell(d) },
                  { label: t('admin.discounts.colScope'), value: scopeCell(d) },
                  { label: t('admin.discounts.colWindow'), value: windowCell(d) },
                  { label: t('admin.discounts.colPeriod'), value: periodCell(d) },
                  { label: t('admin.discounts.colStatus'), value: statusCell(d) },
                ]}
                actions={renderActions(d)}
              />
            ))}
          </div>
        </>
      )}

      {/* Single shared edit Sheet — controlled by editTarget/editOpen, not per-row */}
      <Sheet
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditTarget(null)
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t('admin.discounts.editTitle')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {editTarget && (
              <DiscountForm
                discount={editTarget}
                owner={owner}
                scope={scope}
                services={services}
                onSuccess={() => {
                  setEditOpen(false)
                  setEditTarget(null)
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
