'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Trans, useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Recipient = { id: string; chatId: string; label: string | null }

export default function TelegramRecipientsField() {
  const { t } = useTranslation()
  const [recipients, setRecipients] = React.useState<Recipient[]>([])
  const [loading, setLoading] = React.useState(true)
  const [newChatId, setNewChatId] = React.useState('')
  const [newLabel, setNewLabel] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/notification-settings/recipients')
        const data = await res.json()
        setRecipients(data.recipients ?? [])
      } catch {
        toast.error(t('admin.settings.notifications.recipientAddFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [t])

  async function handleAdd() {
    if (!newChatId.trim()) {
      toast.error(t('admin.settings.notifications.recipientChatIdRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/notification-settings/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: newChatId.trim(), label: newLabel.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed to add recipient')
      const created: Recipient = await res.json()
      setRecipients((prev) => [...prev, created])
      setNewChatId('')
      setNewLabel('')
    } catch {
      toast.error(t('admin.settings.notifications.recipientAddFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/notification-settings/recipients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete recipient')
      setRecipients((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error(t('admin.settings.notifications.recipientDeleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium leading-none">{t('admin.settings.notifications.recipientsLabel')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('admin.settings.notifications.recipientsDesc')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.settings.notifications.noRecipientsHint')}</p>
      ) : (
        <div className="space-y-2">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <Input value={r.chatId} disabled className="flex-1" />
              <Input value={r.label ?? ''} disabled className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="hover:text-destructive shrink-0"
                aria-label={t('admin.settings.notifications.removeRecipientAria')}
                disabled={deletingId === r.id}
                onClick={() => handleDelete(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newChatId}
          onChange={(e) => setNewChatId(e.target.value)}
          placeholder={t('admin.settings.notifications.recipientChatIdPlaceholder')}
          className="flex-1"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t('admin.settings.notifications.recipientLabelPlaceholder')}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 shrink-0"
          disabled={saving || !newChatId.trim()}
          onClick={handleAdd}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('admin.settings.notifications.addRecipientBtn')}
        </Button>
      </div>

      <p className="text-[0.8rem] text-muted-foreground">
        <Trans i18nKey="admin.settings.notifications.groupChatHelp" components={{ code: <code /> }} />
      </p>
    </div>
  )
}
