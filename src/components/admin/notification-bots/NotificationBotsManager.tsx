'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FormSkeleton from '@/components/admin/skeletons/FormSkeleton'
import NotificationBotCard, {
  type Bot,
  type MasterOption,
  type NotificationBotCardHandle,
} from './NotificationBotCard'

interface Props {
  apiBase: string
  /** Admin surface can edit any bot's scope; master surface never can (AD-4). */
  canEditScope: boolean
  /**
   * When supplied (admin settings page, from the live `notifTelegramEnabled`
   * toggle) this wins over the fetched value so the notice tracks the toggle
   * before it's saved. Omitted on the master page, which has no toggle of
   * its own — the fetched value is used there (U-10).
   */
  telegramEnabled?: boolean
  /** Aggregated across all rendered cards (bots + drafts) — true iff any card
   * has unsaved local changes. Used by the admin settings page to light up
   * the sidebar/inline "Save Settings" buttons. */
  onDirtyChange?: (dirty: boolean) => void
}

export interface NotificationBotsManagerHandle {
  /** Saves every card whose own computed `isDirty` is true, in parallel, then
   * reloads the list once. Each card's own `save()` already toasts its own
   * success/failure — no error aggregation here. */
  saveAllDirty: () => Promise<void>
}

let draftSeq = 0

/**
 * Shared list + "add bot" surface: embedded (canEditScope) inside
 * `NotificationSettingsForm.tsx` on `/admin/settings/notifications`, and
 * rendered standalone (own page) on `/admin/master/notification-bots` (AD-11).
 */
const NotificationBotsManager = React.forwardRef<NotificationBotsManagerHandle, Props>(
  function NotificationBotsManager({ apiBase, canEditScope, telegramEnabled, onDirtyChange }, ref) {
  const { t } = useTranslation()
  const [fetchedTelegramEnabled, setFetchedTelegramEnabled] = React.useState<boolean | null>(null)
  const [masters, setMasters] = React.useState<MasterOption[]>([])
  const [bots, setBots] = React.useState<Bot[]>([])
  const [drafts, setDrafts] = React.useState<string[]>([])
  const [dirtyIds, setDirtyIds] = React.useState<Set<string>>(new Set())
  const cardRefs = React.useRef<Map<string, NotificationBotCardHandle>>(new Map())

  function setCardDirty(key: string, dirty: boolean) {
    setDirtyIds((prev) => {
      const has = prev.has(key)
      if (dirty === has) return prev
      const next = new Set(prev)
      if (dirty) next.add(key)
      else next.delete(key)
      return next
    })
  }

  React.useEffect(() => {
    onDirtyChange?.(dirtyIds.size > 0)
  }, [dirtyIds, onDirtyChange])

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(apiBase)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setFetchedTelegramEnabled(Boolean(data.telegramEnabled))
      setMasters(data.masters ?? [])
      setBots(data.bots ?? [])
    } catch {
      toast.error(t('admin.settings.notificationBots.loadFailed'))
    }
  }, [apiBase, t])

  React.useImperativeHandle(ref, () => ({
    saveAllDirty: async () => {
      const toSave = Array.from(cardRefs.current.entries())
        .filter(([, handle]) => handle.isDirty)
        .map(([, handle]) => handle.save())
      await Promise.all(toSave)
      await load()
    },
  }))

  React.useEffect(() => {
    load()
  }, [load])

  function addDraft() {
    draftSeq += 1
    setDrafts((d) => [...d, `draft-${draftSeq}`])
  }

  function removeDraft(id: string) {
    setDrafts((d) => d.filter((x) => x !== id))
    // The card unmounts as part of this same state update, without a final
    // onDirtyChange(false) report — clear its tracked dirty state here so a
    // saved/cancelled draft can't leave Save Settings stuck enabled.
    setCardDirty(id, false)
  }

  function onDraftSaved(id: string) {
    removeDraft(id)
    load()
  }

  if (fetchedTelegramEnabled === null) {
    return <FormSkeleton />
  }

  const effectiveTelegramEnabled = telegramEnabled ?? fetchedTelegramEnabled

  return (
    <div className="flex flex-col gap-4">
      {!effectiveTelegramEnabled && (
        <p className="rounded-[16px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          {t('admin.settings.notificationBots.telegramDisabledNotice')}
        </p>
      )}

      {bots.map((bot) => (
        <NotificationBotCard
          key={bot.id}
          ref={(handle) => {
            if (handle) cardRefs.current.set(bot.id, handle)
            else cardRefs.current.delete(bot.id)
          }}
          bot={bot}
          masters={masters}
          canEditScope={canEditScope}
          apiBase={apiBase}
          onSaved={load}
          onDirtyChange={(dirty) => setCardDirty(bot.id, dirty)}
        />
      ))}

      {drafts.map((id) => (
        <NotificationBotCard
          key={id}
          ref={(handle) => {
            if (handle) cardRefs.current.set(id, handle)
            else cardRefs.current.delete(id)
          }}
          bot={null}
          masters={masters}
          canEditScope={canEditScope}
          apiBase={apiBase}
          onSaved={() => onDraftSaved(id)}
          onCancel={() => removeDraft(id)}
          onDirtyChange={(dirty) => setCardDirty(id, dirty)}
        />
      ))}

      <div>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addDraft}>
          <Plus className="w-3.5 h-3.5" />
          {t('admin.settings.notificationBots.addBotBtn')}
        </Button>
      </div>
    </div>
  )
  }
)

NotificationBotsManager.displayName = 'NotificationBotsManager'
export default NotificationBotsManager
