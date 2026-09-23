'use client'

import * as React from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface BotRecipient {
  chatId: string
  label: string
}

interface Props {
  value: BotRecipient[]
  onChange: (value: BotRecipient[]) => void
}

/**
 * Plain-state chat-ID + label rows for one bot's recipient list, visually
 * matching `TelegramRecipientsField.tsx` but driven by props instead of
 * `useFieldArray` (AD-8 — the bot card is plain `useState`, not react-hook-form).
 */
export default function BotRecipientsField({ value, onChange }: Props) {
  const { t } = useTranslation()

  React.useEffect(() => {
    if (value.length === 0) onChange([{ chatId: '', label: '' }])
  }, [value.length, onChange])

  function updateRow(index: number, patch: Partial<BotRecipient>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium leading-none">{t('admin.settings.notificationBots.recipientsLabel')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('admin.settings.notificationBots.recipientsDesc')}</p>
      </div>

      <div className="space-y-2">
        {value.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={row.chatId}
              onChange={(e) => updateRow(index, { chatId: e.target.value })}
              maxLength={64}
              placeholder={t('admin.settings.notifications.recipientChatIdPlaceholder')}
              className="flex-1"
            />
            <Input
              value={row.label}
              onChange={(e) => updateRow(index, { label: e.target.value })}
              maxLength={64}
              placeholder={t('admin.settings.notifications.recipientLabelPlaceholder')}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive shrink-0"
              aria-label={t('admin.settings.notifications.removeRecipientAria')}
              onClick={() => removeRow(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={() => onChange([...value, { chatId: '', label: '' }])}
      >
        <Plus className="w-3.5 h-3.5" />
        {t('admin.settings.notifications.addRecipientBtn')}
      </Button>

      <p className="text-[0.8rem] text-muted-foreground">
        <Trans i18nKey="admin.settings.notifications.groupChatHelp" components={{ code: <code /> }} />
      </p>
    </div>
  )
}
