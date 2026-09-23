'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { useConfirm } from '@/components/ConfirmDialogProvider'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'
import BotRecipientsField, { type BotRecipient } from './BotRecipientsField'
import MasterMultiSelect from './MasterMultiSelect'

export interface Bot {
  id: string
  label: string
  username: string | null
  enabled: boolean
  scope: 'ALL' | 'SELECTED'
  masterIds: string[]
  scopeMasterNames: string[]
  ownerId: string | null
  ownerName: string | null
  hasToken: boolean
  recipients: { chatId: string; label: string | null }[]
}

export interface MasterOption {
  id: string
  name: string | null
}

/** Visual-only mask shown as the token field's placeholder when a token is already
 * saved, so an empty-looking input doesn't read as "nothing configured" and prompt
 * people to keep re-entering a token. Never part of the field's actual `value`. */
const TOKEN_MASK_PLACEHOLDER = '••••••••••••••••••••'

interface Props {
  bot: Bot | null
  masters: MasterOption[]
  canEditScope: boolean
  apiBase: string
  onSaved: () => void
  onCancel?: () => void
  /** Reports this card's own computed `isDirty` on every change, so the parent
   * manager can aggregate across all cards without knowing their internals. */
  onDirtyChange?: (dirty: boolean) => void
}

export interface NotificationBotCardHandle {
  isDirty: boolean
  save: () => Promise<void>
}

function idsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function recipientsEqual(a: BotRecipient[], b: { chatId: string; label: string | null }[]) {
  if (a.length !== b.length) return false
  return a.every(
    (r, i) => r.chatId.trim() === b[i].chatId.trim() && r.label.trim() === (b[i].label ?? '').trim()
  )
}

/**
 * One bot's create/edit form. Plain `React.useState` local form (AD-8 — a
 * full-replace PATCH makes a diff/field-array unnecessary). `bot === null`
 * means an unsaved draft appended by "Add bot".
 */
const NotificationBotCard = React.forwardRef<NotificationBotCardHandle, Props>(function NotificationBotCard(
  { bot, masters, canEditScope, apiBase, onSaved, onCancel, onDirtyChange },
  ref
) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const labelId = React.useId()
  const tokenId = React.useId()

  const [label, setLabel] = React.useState(bot?.label ?? '')
  const [token, setToken] = React.useState('')
  const [enabled, setEnabled] = React.useState(bot?.enabled ?? true)
  const [scope, setScope] = React.useState<'ALL' | 'SELECTED'>(bot?.scope ?? 'SELECTED')
  const [masterIds, setMasterIds] = React.useState<string[]>(bot?.masterIds ?? [])
  const [recipients, setRecipients] = React.useState<BotRecipient[]>(
    bot?.recipients.map((r) => ({ chatId: r.chatId, label: r.label ?? '' })) ?? []
  )
  const [busy, setBusy] = React.useState<'save' | 'test' | 'delete' | null>(null)

  const isDirty = bot
    ? label.trim() !== bot.label ||
      token.trim() !== '' ||
      enabled !== bot.enabled ||
      (canEditScope && (scope !== bot.scope || !idsEqual(masterIds, bot.masterIds))) ||
      !recipientsEqual(recipients, bot.recipients)
    : label.trim() !== '' ||
      token.trim() !== '' ||
      recipients.some((r) => r.chatId.trim() !== '') ||
      (canEditScope && scope === 'SELECTED' && masterIds.length > 0)

  React.useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  async function save() {
    const trimmedLabel = label.trim()
    const trimmedToken = token.trim()
    if (!trimmedLabel) {
      toast.error(t('admin.settings.notificationBots.labelRequired'))
      return
    }
    if (!bot && !trimmedToken) {
      toast.error(t('admin.settings.notificationBots.tokenRequired'))
      return
    }
    if (canEditScope && scope === 'SELECTED' && masterIds.length === 0) {
      toast.error(t(apiErrorKey('BOT_SCOPE_REQUIRED')))
      return
    }

    setBusy('save')
    try {
      const body: Record<string, unknown> = {
        label: trimmedLabel,
        enabled,
        recipients: recipients.map((r) => ({ chatId: r.chatId, label: r.label })),
      }
      if (trimmedToken) body.token = trimmedToken
      if (canEditScope) {
        body.scope = scope
        body.masterIds = scope === 'SELECTED' ? masterIds : []
      }

      const res = bot
        ? await fetch(`${apiBase}/${bot.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch(apiBase, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(t(apiErrorKey(data.code)))
        return
      }
      setToken('')
      toast.success(t('admin.settings.notificationBots.saveSuccess'))
      if (data.tokenCheck === 'failed') {
        toast.warning(t('admin.settings.notificationBots.tokenCheckFailed'))
      }
      onSaved()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  React.useImperativeHandle(ref, () => ({ isDirty, save }), [isDirty, save])

  async function test() {
    if (!bot) return
    setBusy('test')
    try {
      const res = await fetch(`${apiBase}/${bot.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(t(apiErrorKey(data.code)))
        return
      }
      toast.success(
        data.username
          ? t('admin.settings.notificationBots.testSuccessWithUsername', { username: data.username })
          : t('admin.settings.notificationBots.testSuccess')
      )
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!bot) {
      onCancel?.()
      return
    }
    if (!(await confirm(t('admin.settings.notificationBots.deleteConfirm')))) return
    setBusy('delete')
    try {
      const res = await fetch(`${apiBase}/${bot.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(t(apiErrorKey(data.code)))
        return
      }
      toast.success(t('admin.settings.notificationBots.deleteSuccess'))
      // Unmounting (once the parent's list drops this id) never re-fires the
      // isDirty-reporting effect's cleanup, so tell the parent explicitly —
      // otherwise a dirty-then-deleted bot leaves Save Settings stuck lit.
      onDirtyChange?.(false)
      onSaved()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-[16px] border border-border bg-card p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {bot ? bot.label : t('admin.settings.notificationBots.newBotTitle')}
          </p>
          {bot?.username && <p className="text-xs text-muted-foreground">@{bot.username}</p>}
          {canEditScope && bot?.ownerId && (
            <p className="text-xs text-muted-foreground">
              {t('admin.settings.notificationBots.ownedByLabel', { name: bot.ownerName ?? '' })}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={labelId}>{t('admin.settings.notificationBots.labelLabel')}</Label>
        <Input
          id={labelId}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={64}
          placeholder={t('admin.settings.notificationBots.labelPlaceholder')}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={tokenId}>{t('admin.settings.notificationBots.tokenLabel')}</Label>
        <Input
          id={tokenId}
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={
            bot?.hasToken ? TOKEN_MASK_PLACEHOLDER : t('admin.settings.notificationBots.tokenPlaceholder')
          }
          className="max-w-sm"
        />
        {bot?.hasToken && (
          <p className="text-xs text-muted-foreground">
            {t('admin.settings.notificationBots.tokenKeepPlaceholder')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t('admin.settings.notificationBots.tokenDesc')}</p>
      </div>

      <div className="flex items-center justify-between gap-4 py-1">
        <p className="text-sm font-medium leading-none">{t('admin.settings.notificationBots.enabledLabel')}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground w-7 text-right">
            {enabled ? t('admin.settings.notifications.onLabel') : t('admin.settings.notifications.offLabel')}
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {canEditScope ? (
        <div className="grid gap-1.5">
          <Label>{t('admin.settings.notificationBots.scopeLabel')}</Label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={scope === 'ALL'}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setScope('ALL')
                    setMasterIds([])
                  }
                }}
              />
              {t('admin.settings.notificationBots.scopeAll')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={scope === 'SELECTED'}
                onCheckedChange={(checked) => checked && setScope('SELECTED')}
              />
              {t('admin.settings.notificationBots.scopeSelected')}
            </label>
          </div>
          {/* Always mounted (never conditionally hidden) so the card's height
              doesn't jump when switching scope — disabled + cleared instead. */}
          <MasterMultiSelect
            masters={masters}
            selectedIds={masterIds}
            onChange={setMasterIds}
            disabled={scope === 'ALL'}
          />
        </div>
      ) : (
        <div className="grid gap-1">
          <p className="text-sm font-medium leading-none">{t('admin.settings.notificationBots.scopeLabel')}</p>
          <p className="text-sm text-muted-foreground">
            {bot
              ? bot.scope === 'ALL'
                ? t('admin.settings.notificationBots.scopeAll')
                : t('admin.settings.notificationBots.scopeSummarySelected', {
                    names: bot.scopeMasterNames.join(', '),
                  })
              : t('admin.settings.notificationBots.scopeSummaryOwnBookingsOnly')}
          </p>
        </div>
      )}

      <BotRecipientsField value={recipients} onChange={setRecipients} />

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <Button type="button" disabled={busy !== null} onClick={save}>
          {busy === 'save' ? t('common.saving') : t('common.save')}
        </Button>
        {bot && (
          <Button type="button" variant="outline" disabled={busy !== null} onClick={test}>
            {busy === 'test' ? t('admin.settings.googleCalendar.testingBtn') : t('admin.settings.notificationBots.testBtn')}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="hover:text-destructive"
          disabled={busy !== null}
          onClick={remove}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {bot ? t('admin.settings.notificationBots.deleteBtn') : t('common.cancel')}
        </Button>
      </div>
    </div>
  )
})

NotificationBotCard.displayName = 'NotificationBotCard'
export default NotificationBotCard
