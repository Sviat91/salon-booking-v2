'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FormSkeleton from '@/components/admin/skeletons/FormSkeleton'
import NotificationBotCard, { type Bot, type MasterOption } from './NotificationBotCard'

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
}

let draftSeq = 0

/**
 * Shared list + "add bot" surface: embedded (canEditScope) inside
 * `NotificationSettingsForm.tsx` on `/admin/settings/notifications`, and
 * rendered standalone (own page) on `/admin/master/notification-bots` (AD-11).
 */
export default function NotificationBotsManager({ apiBase, canEditScope, telegramEnabled }: Props) {
  const { t } = useTranslation()
  const [fetchedTelegramEnabled, setFetchedTelegramEnabled] = React.useState<boolean | null>(null)
  const [masters, setMasters] = React.useState<MasterOption[]>([])
  const [bots, setBots] = React.useState<Bot[]>([])
  const [drafts, setDrafts] = React.useState<string[]>([])

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

  React.useEffect(() => {
    load()
  }, [load])

  function addDraft() {
    draftSeq += 1
    setDrafts((d) => [...d, `draft-${draftSeq}`])
  }

  function removeDraft(id: string) {
    setDrafts((d) => d.filter((x) => x !== id))
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
          bot={bot}
          masters={masters}
          canEditScope={canEditScope}
          apiBase={apiBase}
          onSaved={load}
        />
      ))}

      {drafts.map((id) => (
        <NotificationBotCard
          key={id}
          bot={null}
          masters={masters}
          canEditScope={canEditScope}
          apiBase={apiBase}
          onSaved={() => onDraftSaved(id)}
          onCancel={() => removeDraft(id)}
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
