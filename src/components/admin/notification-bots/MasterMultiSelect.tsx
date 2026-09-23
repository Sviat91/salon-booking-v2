'use client'

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { MasterOption } from './NotificationBotCard'

interface Props {
  masters: MasterOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** Disabled (e.g. scope is ALL) but still rendered — the caller keeps this
   * element mounted rather than conditionally hiding it, so the card's height
   * doesn't jump when switching scope (2026-09-23). */
  disabled?: boolean
}

/**
 * Compact closed-by-default multi-select for the bot's master scope (AD-3
 * consolidation). Closed state shows a one-line summary; open state renders
 * an absolutely-positioned checklist panel that stays open while toggling
 * multiple masters. Uses a real `mousedown` outside-click listener (not
 * `ProcedureSelect.tsx`'s background-click trick, which relies on owning a
 * large empty click target — this component sits inside a dense card).
 * Trigger/panel/animation classes are copied from `ui/select.tsx` so this
 * reads as the same site-wide dropdown, not a bespoke one (2026-09-23).
 */
export default function MasterMultiSelect({ masters, selectedIds, onChange, disabled }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const isDisabled = disabled || masters.length === 0

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  React.useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function toggleMaster(id: string, checked: boolean) {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((m) => m !== id))
  }

  const selectedMasters = masters.filter((m) => selectedIds.includes(m.id))
  const summary =
    selectedMasters.length === 0
      ? t('admin.settings.notificationBots.noMastersSelected')
      : selectedMasters.length === 1
        ? selectedMasters[0].name ?? selectedMasters[0].id
        : t('admin.settings.notificationBots.mastersSelectedSummary', {
            name: selectedMasters[0].name ?? selectedMasters[0].id,
            count: selectedMasters.length - 1,
          })

  return (
    <div ref={wrapperRef} className="relative max-w-xs">
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="group flex h-8 w-full items-center justify-between gap-2 truncate rounded-[--radius] border border-input bg-transparent px-3 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded:rotate-180" aria-hidden />
      </button>
      {!disabled && masters.length === 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">{t('admin.settings.notificationBots.noMasters')}</p>
      )}
      {open && (
        <div className="absolute z-[200] mt-1 w-full max-h-80 origin-top overflow-auto rounded-[--radius] border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-90 duration-150">
          <ul>
            {masters.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-[calc(var(--radius)-4px)] px-2 py-1.5 text-sm hover:bg-[var(--md-primary-container)] hover:text-[var(--md-on-primary-container)]">
                  <Checkbox
                    checked={selectedIds.includes(m.id)}
                    onCheckedChange={(checked) => toggleMaster(m.id, checked)}
                  />
                  {m.name ?? m.id}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
